// TASK-501: 統合テストスイート - ユーザーフローテスト
// REDフェーズ: 日常操作フローテスト

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestFramework } from '../helpers/integration-framework';
import { MockObsidianEnvironment } from '../helpers/mock-obsidian';
import { MockSlackEnvironment } from '../helpers/mock-slack';
import { TestDataGenerator } from '../helpers/test-data';

describe('User Flow Tests - Daily Operations', () => {
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
      cleanState: true
    });
  });

  afterEach(async () => {
    await testFramework.cleanup();
  });

  describe('TC-UF-001: Initial setup user flow', () => {
    test('should guide user through complete setup process', async () => {
      // Step 1: プラグイン有効化
      const plugin = await testFramework.enablePlugin();
      expect(plugin.isLoaded()).toBe(true);
      
      // 設定タブが表示される
      const settingsTab = await testFramework.getSettingsTab();
      expect(settingsTab.isVisible()).toBe(true);
      expect(settingsTab.hasWelcomeMessage()).toBe(true);
      
      // Step 2: OAuth認証
      const authButton = await settingsTab.getAuthButton();
      expect(authButton.isEnabled()).toBe(true);
      expect(authButton.getText()).toContain('Slack認証');
      
      const authWindow = await authButton.click();
      expect(authWindow.isOpened()).toBe(true);
      expect(authWindow.getUrl()).toContain('slack.com/oauth');
      
      // ユーザー承認のシミュレーション
      const authResult = await authWindow.simulateUserApproval();
      expect(authResult.success).toBe(true);
      expect(authResult.token).toBeTruthy();
      
      // トークンが保存される
      const storedToken = await obsidianEnv.getSecureData('slack_token');
      expect(storedToken).toBe(authResult.token);
      expect(storedToken).toMatch(/^xoxp-/);
      
      // Step 3: チャンネル設定
      await testFramework.waitForChannelLoad();
      
      const channelMappingUI = await settingsTab.getChannelMappingSection();
      expect(channelMappingUI.isVisible()).toBe(true);
      expect(channelMappingUI.getAvailableChannels()).toHaveLength(3);
      
      // チャンネルマッピング設定
      const mappings = [
        { channel: '#general', path: '/notes/general.md' },
        { channel: '#random', path: '/notes/random.md' },
        { channel: '#dev', path: '/notes/development/{{date}}.md' }
      ];
      
      for (const mapping of mappings) {
        await channelMappingUI.addMapping(mapping.channel, mapping.path);
      }
      
      const savedMappings = await channelMappingUI.getMappings();
      expect(savedMappings).toHaveLength(3);
      expect(savedMappings).toEqual(expect.arrayContaining(mappings));
      
      // Step 4: 初回同期
      const syncButton = await settingsTab.getInitialSyncButton();
      expect(syncButton.isEnabled()).toBe(true);
      expect(syncButton.getText()).toContain('初回同期');
      
      // 同期実行前のメッセージ準備
      testData.populateChannelsWithInitialMessages(slackEnv);
      
      const syncPromise = syncButton.click();
      
      // プログレス表示の確認
      const progressModal = await testFramework.getProgressModal();
      expect(progressModal.isVisible()).toBe(true);
      expect(progressModal.getProgress()).toBe(0);
      
      await testFramework.waitForProgressUpdate();
      expect(progressModal.getProgress()).toBeGreaterThan(0);
      
      const syncResult = await syncPromise;
      expect(syncResult.success).toBe(true);
      expect(syncResult.totalProcessed).toBeGreaterThan(0);
      
      // 完了通知の確認
      const notification = await testFramework.getLastNotification();
      expect(notification.type).toBe('success');
      expect(notification.message).toContain('初回同期完了');
      
      // 作成されたファイルの確認
      const createdFiles = await obsidianEnv.getCreatedFiles();
      expect(createdFiles).toHaveLength(3);
      
      // 全手順が5分以内に完了
      expect(testFramework.getTotalElapsedTime()).toBeLessThan(5 * 60 * 1000);
    }, 6 * 60 * 1000);
  });

  describe('TC-UF-002: Daily sync operations', () => {
    test('should handle daily sync operations smoothly', async () => {
      // Given: 設定完了済み環境
      await testFramework.setupCompletedEnvironment();
      
      // 新規メッセージを追加
      const newMessages = testData.generateMessages(20);
      slackEnv.addChannelMessages('#general', newMessages);
      
      // Step 1: 手動同期実行
      const syncButton = await testFramework.getSyncButton();
      expect(syncButton.isEnabled()).toBe(true);
      
      const syncResult = await syncButton.click();
      expect(syncResult.success).toBe(true);
      expect(syncResult.newMessagesCount).toBe(20);
      expect(syncResult.duplicateCount).toBe(0);
      
      // Step 2: ステータス確認
      const statusBar = await testFramework.getStatusBar();
      expect(statusBar.getSyncStatus()).toBe('completed');
      expect(statusBar.getLastSyncTime()).toBeWithinLast(5000);
      expect(statusBar.getMessageCount()).toBe(20);
      
      const statusIcon = statusBar.getIcon();
      expect(statusIcon.getState()).toBe('success');
      expect(statusIcon.getTooltip()).toContain('同期完了');
      
      // Step 3: 自動同期確認
      await testFramework.enableAutoSync({ interval: 30000 }); // 30秒間隔
      
      // 追加メッセージ投入
      const additionalMessages = testData.generateMessages(5);
      slackEnv.addChannelMessages('#general', additionalMessages);
      
      // 自動同期の実行を待機
      await testFramework.waitForAutoSync(35000); // 35秒待機
      
      const autoSyncResult = await testFramework.getLastSyncResult();
      expect(autoSyncResult.success).toBe(true);
      expect(autoSyncResult.newMessagesCount).toBe(5);
      expect(autoSyncResult.trigger).toBe('auto');
      
      // 最終確認
      const finalStatus = await statusBar.getSyncStatus();
      expect(finalStatus).toBe('completed');
      expect(statusBar.getLastSyncTime()).toBeWithinLast(30000);
    }, 2 * 60 * 1000);
  });

  describe('TC-UF-003: Command palette operations', () => {
    test('should execute all commands from command palette', async () => {
      // Given: 設定完了済み環境
      await testFramework.setupCompletedEnvironment();
      
      // Step 1: 手動同期コマンド
      const commandPalette = await testFramework.openCommandPalette();
      expect(commandPalette.isVisible()).toBe(true);
      
      const syncCommand = await commandPalette.findCommand('Slack: 手動同期を実行');
      expect(syncCommand).toBeDefined();
      expect(syncCommand.getHotkey()).toBe('Ctrl+Shift+S');
      
      const syncResult = await syncCommand.execute();
      expect(syncResult.success).toBe(true);
      
      const progressIndicator = await testFramework.getProgressIndicator();
      expect(progressIndicator.isVisible()).toBe(true);
      
      await testFramework.waitForCompletion();
      expect(progressIndicator.isVisible()).toBe(false);
      
      // Step 2: 設定表示コマンド  
      const settingsCommand = await commandPalette.findCommand('Slack: 設定画面を開く');
      expect(settingsCommand).toBeDefined();
      expect(settingsCommand.getHotkey()).toBe('Ctrl+Shift+P');
      
      await settingsCommand.execute();
      const settingsModal = await testFramework.getSettingsModal();
      expect(settingsModal.isVisible()).toBe(true);
      
      await settingsModal.close();
      
      // Step 3: 状態表示コマンド
      const statusCommand = await commandPalette.findCommand('Slack: 同期状態確認');
      expect(statusCommand).toBeDefined();
      expect(statusCommand.getHotkey()).toBe('Ctrl+Shift+I');
      
      await statusCommand.execute();
      const statusModal = await testFramework.getStatusModal();
      expect(statusModal.isVisible()).toBe(true);
      expect(statusModal.getContent()).toContain('最終同期');
      
      // Step 4: チャンネル選択同期コマンド
      const channelSyncCommand = await commandPalette.findCommand('Slack: 特定チャンネル同期');
      expect(channelSyncCommand).toBeDefined();
      
      await channelSyncCommand.execute();
      const channelSelector = await testFramework.getChannelSelector();
      expect(channelSelector.isVisible()).toBe(true);
      expect(channelSelector.getChannels()).toHaveLength(3);
      
      await channelSelector.selectChannel('#dev');
      const channelSyncResult = await channelSelector.confirmSync();
      expect(channelSyncResult.success).toBe(true);
      expect(channelSyncResult.channel).toBe('#dev');
    }, 2 * 60 * 1000);
  });

  describe('TC-UF-004: Settings change flow', () => {
    test('should handle settings changes smoothly', async () => {
      // Given: 設定完了済み環境
      await testFramework.setupCompletedEnvironment();
      
      // Step 1: チャンネル設定変更
      const settingsTab = await testFramework.getSettingsTab();
      const channelMapping = settingsTab.getChannelMappingSection();
      
      const currentMapping = await channelMapping.getMapping('#general');
      expect(currentMapping.path).toBe('/notes/general.md');
      
      await channelMapping.updateMapping('#general', '/notes/general-new.md');
      await settingsTab.saveSettings();
      
      const updatedMapping = await channelMapping.getMapping('#general');
      expect(updatedMapping.path).toBe('/notes/general-new.md');
      
      // Step 2: フォーマット変更
      const formatSection = settingsTab.getMessageFormatSection();
      const currentFormat = await formatSection.getCurrentFormat();
      expect(currentFormat).toContain('{{timestamp}}');
      
      const newFormat = '**{{author}}** ({{date}}): {{content}}';
      await formatSection.setFormat(newFormat);
      await settingsTab.saveSettings();
      
      const savedFormat = await formatSection.getCurrentFormat();
      expect(savedFormat).toBe(newFormat);
      
      // Step 3: 変更確認のための同期
      const testMessages = testData.generateMessages(3);
      slackEnv.addChannelMessages('#general', testMessages);
      
      const syncResult = await testFramework.executeSync();
      expect(syncResult.success).toBe(true);
      
      // 新しい保存先の確認
      const newFile = await obsidianEnv.findFile('/notes/general-new.md');
      expect(newFile).toBeDefined();
      
      // 新しいフォーマットの確認
      const content = await obsidianEnv.readFile(newFile!);
      expect(content).toMatch(/\*\*\w+\*\* \(\d{4}-\d{2}-\d{2}\):/);
      expect(content).not.toContain('timestamp');
      
      // Step 4: 自動同期間隔変更
      const autoSyncSection = settingsTab.getAutoSyncSection();
      const currentInterval = await autoSyncSection.getInterval();
      expect(currentInterval).toBe(300000); // デフォルト5分
      
      await autoSyncSection.setInterval(60000); // 1分に変更
      await settingsTab.saveSettings();
      
      const newInterval = await autoSyncSection.getInterval();
      expect(newInterval).toBe(60000);
      
      // 間隔変更の効果確認
      const scheduler = await testFramework.getScheduler();
      expect(scheduler.getCurrentInterval()).toBe(60000);
    }, 3 * 60 * 1000);
  });

  describe('TC-UF-005: Error response flow', () => {
    test('should guide user through error resolution', async () => {
      // Given: 設定完了済み環境
      await testFramework.setupCompletedEnvironment();
      
      // Step 1: エラー発生
      slackEnv.simulateNetworkError();
      
      const syncResult = await testFramework.executeSync();
      expect(syncResult.success).toBe(false);
      expect(syncResult.error).toContain('network');
      
      // エラー通知の表示確認
      const errorNotification = await testFramework.getLastNotification();
      expect(errorNotification.type).toBe('error');
      expect(errorNotification.message).toContain('ネットワークエラー');
      expect(errorNotification.isVisible()).toBe(true);
      
      // ステータスバーのエラー表示
      const statusBar = await testFramework.getStatusBar();
      expect(statusBar.getState()).toBe('error');
      expect(statusBar.getTooltip()).toContain('同期エラー');
      
      // Step 2: エラー詳細確認
      const errorIcon = statusBar.getErrorIcon();
      await errorIcon.click();
      
      const errorModal = await testFramework.getErrorModal();
      expect(errorModal.isVisible()).toBe(true);
      expect(errorModal.getErrorType()).toBe('NetworkError');
      expect(errorModal.getErrorMessage()).toContain('接続に失敗しました');
      expect(errorModal.hasRetryButton()).toBe(true);
      
      // エラーログの確認
      const errorLog = errorModal.getErrorLog();
      expect(errorLog).toContain('timestamp');
      expect(errorLog).toContain('error_code');
      expect(errorLog).toContain('stack_trace');
      
      // Step 3: 手動リトライ
      slackEnv.restoreNetwork(); // ネットワーク復旧
      
      const retryButton = errorModal.getRetryButton();
      expect(retryButton.isEnabled()).toBe(true);
      
      const retryResult = await retryButton.click();
      expect(retryResult.success).toBe(true);
      
      // 復旧確認
      await testFramework.waitForCompletion();
      expect(statusBar.getState()).toBe('success');
      expect(errorModal.isVisible()).toBe(false);
      
      // Step 4: 自動リトライの確認
      // 再度エラーを発生させる
      slackEnv.simulateRateLimit(60); // 60秒のレート制限
      
      const rateLimitResult = await testFramework.executeSync();
      expect(rateLimitResult.success).toBe(false);
      
      // バックグラウンドリトライの確認
      const retryIndicator = await testFramework.getRetryIndicator();
      expect(retryIndicator.isVisible()).toBe(true);
      expect(retryIndicator.getRemainingTime()).toBeGreaterThan(0);
      
      // リトライ実行の確認（短縮版）
      slackEnv.clearRateLimit();
      await testFramework.waitForRetry(5000); // 5秒待機（実際は60秒）
      
      const finalResult = await testFramework.getLastSyncResult();
      expect(finalResult.success).toBe(true);
      expect(finalResult.retryCount).toBeGreaterThan(0);
    }, 4 * 60 * 1000);
  });
});