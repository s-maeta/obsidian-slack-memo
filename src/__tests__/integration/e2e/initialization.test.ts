// TASK-501: 統合テストスイート - E2E初期化テスト
// REDフェーズ: 失敗するテスト実装

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestFramework } from '../helpers/integration-framework';
import { MockObsidianEnvironment } from '../helpers/mock-obsidian';
import { MockSlackEnvironment } from '../helpers/mock-slack';
import { TestDataGenerator } from '../helpers/test-data';

describe('E2E Integration Tests - Plugin Initialization', () => {
  let testFramework: IntegrationTestFramework;
  let obsidianEnv: MockObsidianEnvironment;
  let slackEnv: MockSlackEnvironment;
  let testData: TestDataGenerator;

  beforeEach(async () => {
    // 統合テスト環境の初期化
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

  describe('TC-E2E-001: Complete initialization flow', () => {
    test('should complete full plugin setup and first sync', async () => {
      // Given: 新規Obsidian環境
      expect(obsidianEnv.isCleanState()).toBe(true);
      expect(obsidianEnv.hasPluginData()).toBe(false);
      
      // Step 1: プラグイン有効化
      const plugin = await testFramework.enablePlugin();
      expect(plugin).toBeDefined();
      expect(plugin.isLoaded()).toBe(true);
      
      // Step 2: OAuth認証フロー
      const authResult = await testFramework.executeOAuthFlow({
        userApproval: true,
        validToken: true
      });
      expect(authResult.success).toBe(true);
      expect(authResult.token).toBeTruthy();
      expect(obsidianEnv.hasSecureToken()).toBe(true);
      
      // Step 3: チャンネル設定
      const channelConfig = testData.generateChannelMappings(3);
      const configResult = await testFramework.configureChannels(channelConfig);
      expect(configResult.success).toBe(true);
      expect(configResult.mappings).toHaveLength(3);
      
      // Step 4: 初回同期実行
      const syncResult = await testFramework.executeInitialSync();
      expect(syncResult.success).toBe(true);
      expect(syncResult.totalProcessed).toBeGreaterThan(0);
      expect(syncResult.errors).toHaveLength(0);
      
      // Step 5: 結果検証
      const savedFiles = await obsidianEnv.getCreatedFiles();
      expect(savedFiles.length).toBeGreaterThan(0);
      
      const fileContent = await obsidianEnv.readFile(savedFiles[0]);
      expect(fileContent).toContain('# Slack Messages');
      expect(fileContent).toMatch(/\d{4}-\d{2}-\d{2}/); // 日付形式
      
      // 全体処理時間が5分以内
      expect(testFramework.getTotalElapsedTime()).toBeLessThan(5 * 60 * 1000);
    }, 10 * 60 * 1000); // 10分タイムアウト
  });

  describe('TC-E2E-002: Data flow verification', () => {
    test('should handle complete data flow from Slack to Obsidian', async () => {
      // Given: 認証済み環境
      await testFramework.setupAuthenticatedEnvironment();
      
      // Slackに多様なテストメッセージを準備
      const testMessages = testData.generateComplexMessageSet({
        simpleMessages: 5,
        messagesWithMentions: 3,
        messagesWithAttachments: 2,
        codeBlocks: 2,
        threadMessages: 4
      });
      
      slackEnv.addChannelMessages('#general', testMessages);
      
      // When: 同期実行
      const syncResult = await testFramework.executeFullSync();
      
      // Then: データフロー検証
      expect(syncResult.success).toBe(true);
      expect(syncResult.totalProcessed).toBe(testMessages.length);
      
      // Markdown変換結果の検証
      const savedFiles = await obsidianEnv.getCreatedFiles();
      expect(savedFiles).toHaveLength(1);
      
      const content = await obsidianEnv.readFile(savedFiles[0]);
      
      // メンション変換確認
      expect(content).toMatch(/\[\[@\w+\]\]/); // [[mention]]形式
      
      // コードブロック変換確認
      expect(content).toContain('```');
      
      // 添付ファイル変換確認
      expect(content).toContain('[attachment]');
      
      // スレッド階層表現確認
      expect(content).toContain('  - '); // インデント付きリスト
      
      // メタデータ確認
      expect(content).toMatch(/^---\n.*channel:.*\n---/s); // フロントマター
    }, 3 * 60 * 1000);
  });

  describe('TC-E2E-003: Multiple channel sync', () => {
    test('should sync multiple channels concurrently', async () => {
      // Given: 5つのチャンネルが設定済み
      await testFramework.setupAuthenticatedEnvironment();
      
      const channels = ['#general', '#random', '#dev', '#design', '#marketing'];
      const channelMappings = channels.map(channel => ({
        slackChannel: channel,
        obsidianPath: `/notes/${channel.slice(1)}.md`,
        format: 'daily'
      }));
      
      await testFramework.configureChannels(channelMappings);
      
      // 各チャンネルにメッセージを追加
      channels.forEach(channel => {
        const messages = testData.generateMessages(50);
        slackEnv.addChannelMessages(channel, messages);
      });
      
      // When: 全チャンネル同期実行
      const startTime = Date.now();
      const syncResult = await testFramework.executeMultiChannelSync();
      const endTime = Date.now();
      
      // Then: 並行処理の検証
      expect(syncResult.success).toBe(true);
      expect(syncResult.channelResults).toHaveLength(5);
      expect(syncResult.totalProcessed).toBe(250); // 50 * 5チャンネル
      
      // 並行処理による時間効率の確認
      const sequentialTime = 5 * 60 * 1000; // 5チャンネル × 1分想定
      expect(endTime - startTime).toBeLessThan(sequentialTime * 0.6); // 40%時短
      
      // 全チャンネルのファイル作成確認
      const createdFiles = await obsidianEnv.getCreatedFiles();
      expect(createdFiles).toHaveLength(5);
      
      // 各ファイルの内容確認
      for (const file of createdFiles) {
        const content = await obsidianEnv.readFile(file);
        expect(content).toContain('# Slack Messages');
        expect(content.split('\n')).toHaveLength(expect.any(Number));
      }
    }, 8 * 60 * 1000);
  });

  describe('TC-E2E-004: Configuration change reflection', () => {
    test('should reflect configuration changes in sync behavior', async () => {
      // Given: デフォルト設定でテスト実行
      await testFramework.setupAuthenticatedEnvironment();
      
      const defaultConfig = {
        messageFormat: '{{timestamp}} - {{author}}: {{content}}',
        savePath: '/slack-messages/{{channel}}-{{date}}.md',
        includeAttachments: false
      };
      
      await testFramework.applyConfiguration(defaultConfig);
      
      // 初回同期
      const messages = testData.generateMessages(10);
      slackEnv.addChannelMessages('#general', messages);
      
      const initialSync = await testFramework.executeSync();
      expect(initialSync.success).toBe(true);
      
      const initialFile = (await obsidianEnv.getCreatedFiles())[0];
      const initialContent = await obsidianEnv.readFile(initialFile);
      
      // When: フォーマット・保存先を変更
      const newConfig = {
        messageFormat: '**{{author}}** ({{date}}): {{content}}',
        savePath: '/notes/general/{{date}}.md',
        includeAttachments: true
      };
      
      await testFramework.applyConfiguration(newConfig);
      
      // 設定変更後の同期
      const newMessages = testData.generateMessagesWithAttachments(5);
      slackEnv.addChannelMessages('#general', newMessages);
      
      const updatedSync = await testFramework.executeSync();
      expect(updatedSync.success).toBe(true);
      
      // Then: 変更した設定で同期が実行される
      const allFiles = await obsidianEnv.getCreatedFiles();
      const newFile = allFiles.find(f => f.includes('/notes/general/'));
      expect(newFile).toBeDefined();
      
      const newContent = await obsidianEnv.readFile(newFile!);
      
      // フォーマット変更の確認
      expect(newContent).toMatch(/\*\*\w+\*\* \(\d{4}-\d{2}-\d{2}\):/);
      expect(newContent).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} - \w+:/);
      
      // 添付ファイル処理の確認
      expect(newContent).toContain('[attachment:');
      expect(initialContent).not.toContain('[attachment:');
      
      // 保存先変更の確認
      expect(newFile).toContain('/notes/general/');
      expect(initialFile).toContain('/slack-messages/');
    }, 4 * 60 * 1000);
  });

  describe('TC-E2E-005: Long-term operation simulation', () => {
    test('should maintain stability during extended operation', async () => {
      // Given: 自動同期が設定済み
      await testFramework.setupAuthenticatedEnvironment();
      
      await testFramework.enableAutoSync({
        interval: 60000, // 1分間隔
        maxRetries: 3,
        memoryOptimization: true
      });
      
      // When: 30分間連続自動同期（24時間の短縮版）
      const testDuration = 30 * 60 * 1000; // 30分
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      // メッセージの継続追加をシミュレート
      const messageInterval = setInterval(() => {
        const newMessages = testData.generateMessages(5);
        slackEnv.addChannelMessages('#general', newMessages);
      }, 2 * 60 * 1000); // 2分ごと
      
      // 監視開始
      const monitor = await testFramework.startLongTermMonitoring();
      
      try {
        // 指定時間まで待機
        await new Promise(resolve => setTimeout(resolve, testDuration));
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        // Then: 安定性の検証
        const monitorResults = await monitor.getResults();
        
        // メモリリークなし
        const memoryIncrease = endMemory - startMemory;
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB以内
        
        // エラーなしで動作
        expect(monitorResults.errorCount).toBe(0);
        expect(monitorResults.crashCount).toBe(0);
        
        // 同期成功率
        expect(monitorResults.syncSuccessRate).toBeGreaterThan(0.95);
        
        // レスポンス時間の安定性
        expect(monitorResults.averageResponseTime).toBeLessThan(5000);
        expect(monitorResults.maxResponseTime).toBeLessThan(15000);
        
        // リソース使用量の安定性
        expect(monitorResults.peakMemoryUsage).toBeLessThan(512 * 1024 * 1024);
        expect(monitorResults.peakCpuUsage).toBeLessThan(80); // 80%未満
        
        // GC効率性
        expect(monitorResults.gcFrequency).toBeLessThan(60); // 1分間に1回未満
        
      } finally {
        clearInterval(messageInterval);
        await monitor.stop();
      }
    }, 35 * 60 * 1000); // 35分タイムアウト
  });
});