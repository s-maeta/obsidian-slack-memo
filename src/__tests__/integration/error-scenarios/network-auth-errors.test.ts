// TASK-501: 統合テストスイート - エラーシナリオテスト
// REDフェーズ: ネットワーク・認証エラー処理テスト

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestFramework } from '../helpers/integration-framework';
import { MockObsidianEnvironment } from '../helpers/mock-obsidian';
import { MockSlackEnvironment } from '../helpers/mock-slack';
import { TestDataGenerator } from '../helpers/test-data';

describe('Error Scenario Tests - Network and Authentication', () => {
  let testFramework: IntegrationTestFramework;
  let obsidianEnv: MockObsidianEnvironment;
  let slackEnv: MockSlackEnvironment;
  let testData: TestDataGenerator;

  beforeEach(async () => {
    testFramework = new IntegrationTestFramework();
    obsidianEnv = new MockObsidianEnvironment();
    slackEnv = new MockSlackEnvironment();
    testData = new TestDataGenerator();
    
    await testFramework.initialize({
      obsidian: obsidianEnv,
      slack: slackEnv,
      cleanState: false // エラーテストは設定済み環境を使用
    });
    
    await testFramework.setupCompletedEnvironment();
  });

  afterEach(async () => {
    slackEnv.clearAllErrors(); // エラー状態をクリア
    await testFramework.cleanup();
  });

  describe('TC-ES-001: Network error handling', () => {
    test('should handle connection timeout gracefully', async () => {
      // Given: ネットワークタイムアウト状態
      slackEnv.simulateTimeout(5000); // 5秒タイムアウト
      
      const startTime = Date.now();
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      
      // Then: タイムアウトエラーの適切な処理
      expect(syncResult.success).toBe(false);
      expect(syncResult.error.type).toBe('TimeoutError');
      expect(syncResult.error.message).toContain('timeout');
      expect(elapsedTime).toBeGreaterThanOrEqual(5000);
      expect(elapsedTime).toBeLessThan(8000); // 適切にタイムアウト
      
      // リトライ回数の確認
      expect(syncResult.retryAttempts).toBe(3);
      expect(syncResult.retryDuration).toBeGreaterThan(10000); // バックオフ考慮
      
      // ユーザー通知の確認
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('error');
      expect(notification.message).toContain('接続タイムアウト');
      expect(notification.hasRetryButton()).toBe(true);
      
      // ステータス表示の確認
      const statusBar = await testFramework.getStatusBar();
      expect(statusBar.getState()).toBe('error');
      expect(statusBar.getTooltip()).toContain('timeout');
    }, 30000);

    test('should handle connection failure with exponential backoff retry', async () => {
      // Given: 接続失敗状態
      slackEnv.simulateConnectionFailure();
      
      let retryTimes: number[] = [];
      const retryCallback = (attempt: number, delay: number) => {
        retryTimes.push(delay);
      };
      
      testFramework.onRetryAttempt(retryCallback);
      
      // 5秒後に接続復旧
      setTimeout(() => {
        slackEnv.restoreConnection();
      }, 5000);
      
      // When: 同期実行（リトライで最終的に成功）
      const syncResult = await testFramework.executeSync();
      
      // Then: 指数バックオフリトライで成功
      expect(syncResult.success).toBe(true);
      expect(syncResult.retryAttempts).toBeGreaterThan(1);
      
      // バックオフ間隔の確認
      expect(retryTimes).toHaveLength(syncResult.retryAttempts);
      for (let i = 1; i < retryTimes.length; i++) {
        expect(retryTimes[i]).toBeGreaterThanOrEqual(retryTimes[i-1]);
      }
      
      // 最終成功通知
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('success');
      expect(notification.message).toContain('接続復旧');
    }, 15000);

    test('should handle intermittent network issues', async () => {
      // Given: 間欠的な接続問題
      slackEnv.simulateIntermittentConnection({
        failureRate: 0.3, // 30%の確率で失敗
        averageFailureDuration: 2000 // 平均2秒の接続断
      });
      
      // When: 複数回の同期実行
      const syncResults = [];
      for (let i = 0; i < 5; i++) {
        const result = await testFramework.executeSync();
        syncResults.push(result);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Then: 最終的にすべて成功
      const successCount = syncResults.filter(r => r.success).length;
      expect(successCount).toBe(5);
      
      // リトライが発生したことを確認
      const totalRetries = syncResults.reduce((sum, r) => sum + r.retryAttempts, 0);
      expect(totalRetries).toBeGreaterThan(0);
      
      // ネットワーク品質の通知
      const networkNotification = await testFramework.getNetworkQualityNotification();
      if (networkNotification) {
        expect(networkNotification.message).toContain('ネットワーク不安定');
      }
    }, 10000);
  });

  describe('TC-ES-002: Authentication error handling', () => {
    test('should handle expired token gracefully', async () => {
      // Given: 期限切れトークン
      slackEnv.simulateExpiredToken();
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      // Then: 認証エラーの適切な処理
      expect(syncResult.success).toBe(false);
      expect(syncResult.error.type).toBe('AuthenticationError');
      expect(syncResult.error.code).toBe('token_expired');
      
      // 認証エラーモーダルの表示
      const authModal = await testFramework.getAuthErrorModal();
      expect(authModal.isVisible()).toBe(true);
      expect(authModal.getMessage()).toContain('認証期限切れ');
      expect(authModal.hasReauthButton()).toBe(true);
      
      // ステータスバーの認証エラー表示
      const statusBar = await testFramework.getStatusBar();
      expect(statusBar.getState()).toBe('auth_error');
      expect(statusBar.getIcon()).toContain('warning');
      
      // セキュアストレージからのトークン削除確認
      const storedToken = await obsidianEnv.getSecureData('slack_token');
      expect(storedToken).toBeNull(); // 期限切れトークンは削除される
    }, 3000);

    test('should handle invalid token with re-authentication flow', async () => {
      // Given: 無効なトークン
      slackEnv.simulateInvalidToken();
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      expect(syncResult.success).toBe(false);
      
      // 再認証フローの開始
      const authModal = await testFramework.getAuthErrorModal();
      const reauthButton = authModal.getReauthButton();
      
      await reauthButton.click();
      
      // Then: OAuth再認証の開始
      const oauthWindow = await testFramework.getOAuthWindow();
      expect(oauthWindow.isOpened()).toBe(true);
      expect(oauthWindow.getUrl()).toContain('slack.com/oauth');
      
      // 既存トークンのクリア確認
      expect(await obsidianEnv.getSecureData('slack_token')).toBeNull();
      
      // 再認証成功のシミュレーション
      const newToken = 'xoxp-new-token-12345';
      await oauthWindow.simulateUserApproval(newToken);
      
      // 新しいトークンの保存確認
      const savedToken = await obsidianEnv.getSecureData('slack_token');
      expect(savedToken).toBe(newToken);
      
      // 再認証後の自動同期試行
      const retrySyncResult = await testFramework.executeSync();
      expect(retrySyncResult.success).toBe(true);
    }, 5000);

    test('should handle token revocation', async () => {
      // Given: 取り消されたトークン
      slackEnv.simulateRevokedToken();
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      // Then: トークン取り消しエラーの処理
      expect(syncResult.success).toBe(false);
      expect(syncResult.error.type).toBe('AuthenticationError');
      expect(syncResult.error.code).toBe('token_revoked');
      
      // 取り消し通知
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('error');
      expect(notification.message).toContain('認証が取り消されました');
      expect(notification.hasReauthButton()).toBe(true);
      
      // セキュリティクリーンアップの確認
      expect(await obsidianEnv.getSecureData('slack_token')).toBeNull();
      expect(await obsidianEnv.getSecureData('refresh_token')).toBeNull();
      
      // 設定のリセット確認
      const settings = await testFramework.getPluginSettings();
      expect(settings.isAuthenticated).toBe(false);
      expect(settings.lastAuthTime).toBeNull();
    }, 3000);

    test('should handle OAuth flow cancellation', async () => {
      // Given: 認証が必要な状態
      await obsidianEnv.clearSecureData('slack_token');
      
      // When: 認証フロー開始・キャンセル
      const settingsTab = await testFramework.getSettingsTab();
      const authButton = settingsTab.getAuthButton();
      
      await authButton.click();
      const oauthWindow = await testFramework.getOAuthWindow();
      
      // ユーザーによるキャンセル
      await oauthWindow.simulateUserCancel();
      
      // Then: 適切なキャンセル処理
      expect(oauthWindow.isOpened()).toBe(false);
      
      const cancelNotification = await testFramework.getLastNotification();
      expect(cancelNotification.type).toBe('info');
      expect(cancelNotification.message).toContain('認証をキャンセル');
      
      // 状態の確認
      expect(await obsidianEnv.getSecureData('slack_token')).toBeNull();
      expect(settingsTab.isAuthenticationPending()).toBe(false);
      expect(authButton.isEnabled()).toBe(true);
    }, 3000);
  });

  describe('TC-ES-003: API rate limit handling', () => {
    test('should handle rate limit with exponential backoff', async () => {
      // Given: レート制限状態
      slackEnv.simulateRateLimit(120); // 2分の制限
      
      const startTime = Date.now();
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      
      // Then: レート制限の適切な処理
      expect(syncResult.success).toBe(true); // 最終的に成功
      expect(syncResult.retryAttempts).toBeGreaterThan(0);
      
      // バックオフ待機時間の確認
      expect(elapsedTime).toBeGreaterThan(30000); // 最低30秒は待機
      expect(elapsedTime).toBeLessThan(180000); // 3分以内には完了
      
      // レート制限通知の確認
      const rateLimitNotification = await testFramework.getRateLimitNotification();
      expect(rateLimitNotification.isVisible()).toBe(true);
      expect(rateLimitNotification.getRemainingTime()).toBeLessThan(120000);
      
      // ステータス表示
      const statusBar = await testFramework.getStatusBar();
      expect(statusBar.getState()).toBe('rate_limited');
      expect(statusBar.getTooltip()).toContain('レート制限');
    }, 200000); // 3分20秒タイムアウト

    test('should queue requests during rate limit', async () => {
      // Given: レート制限状態
      slackEnv.simulateRateLimit(60);
      
      // When: 複数同期リクエスト
      const syncPromises = [
        testFramework.executeSync(),
        testFramework.executeSync(),
        testFramework.executeSync()
      ];
      
      // Then: キューイング処理
      const results = await Promise.allSettled(syncPromises);
      
      // 最初のリクエストのみが制限に遭遇、他はキューで待機
      const fulfilledResults = results.filter(r => r.status === 'fulfilled');
      expect(fulfilledResults).toHaveLength(3);
      
      // キュー処理の確認
      const queueStatus = await testFramework.getRequestQueueStatus();
      expect(queueStatus.maxQueueLength).toBe(2);
      expect(queueStatus.totalProcessingTime).toBeGreaterThan(60000);
      
      // 順次処理の確認
      const processingTimes = fulfilledResults.map((r: any) => r.value.processingTime);
      for (let i = 1; i < processingTimes.length; i++) {
        expect(processingTimes[i]).toBeGreaterThan(processingTimes[i-1]);
      }
    }, 150000);
  });

  describe('TC-ES-004: Data conversion error handling', () => {
    test('should handle malformed message gracefully', async () => {
      // Given: 不正形式のメッセージ
      const malformedMessages = [
        { text: null, user: 'U12345', ts: '1634567890.123456' },
        { text: 'test', user: null, ts: '1634567891.123456' },
        { text: 'test', user: 'U12345', ts: null },
        { text: 'test', user: 'U12345', ts: 'invalid_timestamp' },
        { text: '\uFFFD\uFFFD\uFFFD', user: 'U12345', ts: '1634567892.123456' } // 不正文字
      ];
      
      const validMessages = testData.generateMessages(10);
      const allMessages = [...malformedMessages, ...validMessages];
      
      slackEnv.addChannelMessages('#general', allMessages);
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      // Then: 部分的成功の処理
      expect(syncResult.partialSuccess).toBe(true);
      expect(syncResult.totalProcessed).toBe(10); // 正常メッセージのみ
      expect(syncResult.errorCount).toBe(5); // 不正メッセージ数
      expect(syncResult.skippedCount).toBe(5);
      
      // エラー詳細の確認
      expect(syncResult.errors).toHaveLength(5);
      syncResult.errors.forEach(error => {
        expect(error.type).toBe('ConversionError');
        expect(error.originalMessage).toBeDefined();
      });
      
      // エラーログの確認
      const errorLog = await testFramework.getErrorLog();
      expect(errorLog.entries).toHaveLength(5);
      expect(errorLog.entries[0].message).toContain('変換エラー');
      
      // 正常メッセージの処理確認
      const savedFile = await obsidianEnv.getCreatedFiles()[0];
      const content = await obsidianEnv.readFile(savedFile);
      const messageCount = (content.match(/^## /gm) || []).length;
      expect(messageCount).toBe(10);
      
      // 部分成功通知
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('warning');
      expect(notification.message).toContain('部分的に完了');
    }, 5000);

    test('should handle encoding issues', async () => {
      // Given: エンコーディング問題のあるメッセージ
      const encodingTestMessages = [
        { text: 'Hello 🌍 World!', user: 'U12345', ts: '1634567890.123456' },
        { text: 'こんにちは世界', user: 'U12345', ts: '1634567891.123456' },
        { text: 'Тест на русском', user: 'U12345', ts: '1634567892.123456' },
        { text: '🚀🌟✨💫', user: 'U12345', ts: '1634567893.123456' },
        { text: 'Mixed: English + 日本語 + русский', user: 'U12345', ts: '1634567894.123456' }
      ];
      
      slackEnv.addChannelMessages('#general', encodingTestMessages);
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      // Then: エンコーディングの適切な処理
      expect(syncResult.success).toBe(true);
      expect(syncResult.totalProcessed).toBe(5);
      
      const savedFile = await obsidianEnv.getCreatedFiles()[0];
      const content = await obsidianEnv.readFile(savedFile);
      
      // UTF-8エンコーディングの確認
      expect(content).toContain('🌍');
      expect(content).toContain('こんにちは世界');
      expect(content).toContain('Тест на русском');
      expect(content).toContain('🚀🌟✨💫');
      expect(content).toContain('Mixed: English + 日本語 + русский');
      
      // ファイルエンコーディングの検証
      const fileEncoding = await obsidianEnv.getFileEncoding(savedFile);
      expect(fileEncoding).toBe('utf-8');
    }, 3000);
  });

  describe('TC-ES-005: File system error handling', () => {
    test('should handle write permission error', async () => {
      // Given: 書き込み権限エラー
      obsidianEnv.simulateWritePermissionError('/notes/');
      
      const testMessages = testData.generateMessages(5);
      slackEnv.addChannelMessages('#general', testMessages);
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      // Then: 権限エラーの適切な処理
      expect(syncResult.success).toBe(false);
      expect(syncResult.error.type).toBe('FileSystemError');
      expect(syncResult.error.code).toBe('EACCES');
      expect(syncResult.error.message).toContain('permission');
      
      // ユーザー通知
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('error');
      expect(notification.message).toContain('書き込み権限');
      expect(notification.hasHelpButton()).toBe(true);
      
      // 代替パス提案
      const pathSuggestion = await testFramework.getPathSuggestion();
      expect(pathSuggestion.isVisible()).toBe(true);
      expect(pathSuggestion.getAlternativePaths()).toHaveLength(2);
    }, 3000);

    test('should handle disk space full error', async () => {
      // Given: ディスク容量不足
      obsidianEnv.simulateDiskFull();
      
      const largeMessages = testData.generateLargeMessages(100);
      slackEnv.addChannelMessages('#general', largeMessages);
      
      // When: 同期実行
      const syncResult = await testFramework.executeSync();
      
      // Then: 容量不足エラーの処理
      expect(syncResult.success).toBe(false);
      expect(syncResult.error.type).toBe('FileSystemError');
      expect(syncResult.error.code).toBe('ENOSPC');
      
      // 容量不足通知
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('error');
      expect(notification.message).toContain('容量不足');
      
      // 容量管理提案
      const storageManager = await testFramework.getStorageManager();
      expect(storageManager.isVisible()).toBe(true);
      expect(storageManager.getCurrentUsage()).toBeGreaterThan(0);
      expect(storageManager.hasCleanupOptions()).toBe(true);
    }, 5000);

    test('should handle file corruption', async () => {
      // Given: 既存ファイルの破損
      const existingFile = '/notes/general.md';
      await obsidianEnv.createFile(existingFile, 'initial content');
      obsidianEnv.simulateFileCorruption(existingFile);
      
      const newMessages = testData.generateMessages(3);
      slackEnv.addChannelMessages('#general', newMessages);
      
      // When: 同期実行（既存ファイルへの追記）
      const syncResult = await testFramework.executeSync();
      
      // Then: ファイル破損への対応
      expect(syncResult.partialSuccess).toBe(true);
      expect(syncResult.backupCreated).toBe(true);
      
      // バックアップファイルの作成確認
      const backupFile = await obsidianEnv.findFile('/notes/general.md.backup');
      expect(backupFile).toBeDefined();
      
      // 新規ファイルの作成確認
      const newFile = await obsidianEnv.findFile('/notes/general-recovered.md');
      expect(newFile).toBeDefined();
      
      const content = await obsidianEnv.readFile(newFile!);
      expect(content).toContain('# Slack Messages');
      
      // 復旧通知
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('warning');
      expect(notification.message).toContain('ファイルを復旧');
    }, 5000);
  });
});