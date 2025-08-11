// TASK-501: 統合テストスイート - 回帰テスト
// GREENフェーズ: 既存機能保証テスト（最小実装）

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestFramework } from '../helpers/integration-framework';
import { MockObsidianEnvironment } from '../helpers/mock-obsidian';
import { MockSlackEnvironment } from '../helpers/mock-slack';
import { TestDataGenerator } from '../helpers/test-data';

describe('Regression Tests - Existing Functionality', () => {
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
      cleanState: false
    });
  });

  afterEach(async () => {
    await testFramework.cleanup();
  });

  describe('TC-REG-001: Existing functionality regression', () => {
    test('should maintain all TASK-001 to TASK-402 functionality', async () => {
      // TASK-001: Plugin initialization
      const pluginInit = await testPluginInitialization();
      expect(pluginInit).toBe(true);
      
      // TASK-002: Settings management  
      const settingsManagement = await testSettingsManagement();
      expect(settingsManagement).toBe(true);
      
      // TASK-101: OAuth authentication
      const oauthAuth = await testOauthAuthentication();
      expect(oauthAuth).toBe(true);
      
      // TASK-102: Slack API client
      const apiClient = await testSlackApiClient();
      expect(apiClient).toBe(true);
      
      // TASK-201: Markdown conversion
      const markdownConversion = await testMarkdownConversion();
      expect(markdownConversion).toBe(true);
      
      // TASK-301: Settings UI
      const settingsUI = await testSettingsUI();
      expect(settingsUI).toBe(true);
      
      // TASK-401: Auto sync scheduler
      const autoSyncScheduler = await testAutoSyncScheduler();
      expect(autoSyncScheduler).toBe(true);
      
      // TASK-402: Performance optimizer
      const performanceOptimizer = await testPerformanceOptimizer();
      expect(performanceOptimizer).toBe(true);
    });
  });

  // Helper Functions for Regression Tests
  async function testPluginInitialization(): Promise<boolean> {
    try {
      const plugin = await testFramework.enablePlugin();
      return plugin.isLoaded && plugin.isLoaded();
    } catch (error) {
      return false;
    }
  }

  async function testSettingsManagement(): Promise<boolean> {
    try {
      const settings = await testFramework.getPluginSettings();
      const testSettings = { ...settings, testProperty: 'test' };
      
      // 設定保存のテスト
      await obsidianEnv.savePluginSettings(testSettings);
      const savedSettings = await obsidianEnv.getPluginSettings();
      
      return savedSettings.testProperty === 'test';
    } catch (error) {
      return false;
    }
  }

  async function testOauthAuthentication(): Promise<boolean> {
    try {
      const authResult = await testFramework.executeOAuthFlow({
        userApproval: true,
        validToken: true
      });
      return authResult.success && !!authResult.token;
    } catch (error) {
      return false;
    }
  }

  async function testSlackApiClient(): Promise<boolean> {
    try {
      // API呼び出しテスト
      const channels = await slackEnv.conversations_list();
      const authTest = await slackEnv.auth_test();
      
      return channels.ok && authTest.ok;
    } catch (error) {
      return false;
    }
  }

  async function testMarkdownConversion(): Promise<boolean> {
    try {
      // メッセージ変換テスト
      const testMessages = testData.generateComplexMessageSet({
        simpleMessages: 2,
        messagesWithMentions: 1,
        codeBlocks: 1
      });
      
      slackEnv.addChannelMessages('#general', testMessages);
      const syncResult = await testFramework.executeSync();
      
      if (!syncResult.success) return false;
      
      // 変換結果の確認
      const files = await obsidianEnv.getCreatedFiles();
      if (files.length === 0) return false;
      
      const content = await obsidianEnv.readFile(files[0]);
      return content.includes('# Slack Messages');
    } catch (error) {
      return false;
    }
  }

  async function testSettingsUI(): Promise<boolean> {
    try {
      const settingsTab = await testFramework.getSettingsTab();
      return settingsTab.isVisible();
    } catch (error) {
      return false;
    }
  }

  async function testAutoSyncScheduler(): Promise<boolean> {
    try {
      await testFramework.enableAutoSync({ interval: 60000 });
      const scheduler = await testFramework.getScheduler();
      return scheduler.getCurrentInterval() === 60000;
    } catch (error) {
      return false;
    }
  }

  async function testPerformanceOptimizer(): Promise<boolean> {
    try {
      // パフォーマンス最適化機能のテスト
      const largeDataset = testData.generateMessages(1000);
      slackEnv.addChannelMessages('#general', largeDataset);
      
      const startTime = Date.now();
      const result = await testFramework.executeSync();
      const processingTime = Date.now() - startTime;
      
      // 効率的な処理の確認
      return result.success && processingTime < 60000; // 1分以内
    } catch (error) {
      return false;
    }
  }
});