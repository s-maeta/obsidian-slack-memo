// TASK-303: コマンドパレット統合テスト

import SlackSyncPlugin from '../main';
import { App } from 'obsidian';

// Obsidian の App クラスをモック
const mockApp = {
  workspace: {
    getActiveViewOfType: jest.fn(),
  },
  setting: {
    open: jest.fn(),
    openTabById: jest.fn(),
  }
} as unknown as App;

// Obsidian Notice をモック  
jest.mock('obsidian', () => ({
  Plugin: class MockPlugin {
    app = mockApp;
    manifest = { id: 'obsidian-slack-sync' };
    addCommand = jest.fn();
    addRibbonIcon = jest.fn(() => ({ addClass: jest.fn() }));
    addStatusBarItem = jest.fn(() => ({ 
      setText: jest.fn(), 
      addClass: jest.fn() 
    }));
    addSettingTab = jest.fn();
    loadData = jest.fn(async () => ({}));
    saveData = jest.fn();
  },
  PluginSettingTab: class MockPluginSettingTab {},
  Modal: class MockModal {},
  Notice: jest.fn(),
  Setting: jest.fn(() => ({
    setName: jest.fn(() => ({ 
      setDesc: jest.fn(() => ({ 
        addText: jest.fn(() => ({})),
        addSlider: jest.fn(() => ({})),
        addDropdown: jest.fn(() => ({})),
        addToggle: jest.fn(() => ({}))
      }))
    }))
  }))
}));

describe('Slack Sync Plugin Commands', () => {
  let plugin: SlackSyncPlugin;

  beforeEach(() => {
    plugin = new SlackSyncPlugin(mockApp, { 
      id: 'obsidian-slack-sync', 
      name: 'Slack Sync', 
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'Test plugin',
      author: 'Test',
      dir: ''
    });

    // addCommand のモック実装をリセット
    (plugin.addCommand as jest.Mock).mockClear();
  });

  test('should register all command palette commands', async () => {
    await plugin.onload();

    // 6つのコマンドが登録されたことを確認
    expect(plugin.addCommand).toHaveBeenCalledTimes(6);

    // 手動同期コマンドの登録を確認
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'manual-sync',
        name: 'Slack: 手動同期を実行',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 's' }],
      })
    );

    // 特定チャンネル同期コマンドの登録を確認
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sync-specific-channel',
        name: 'Slack: 特定チャンネルを同期',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'c' }],
      })
    );

    // 同期履歴表示コマンドの登録を確認
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'show-sync-history',
        name: 'Slack: 同期履歴を表示',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'h' }],
      })
    );

    // 設定画面を開くコマンドの登録を確認
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'open-settings',
        name: 'Slack: 設定画面を開く',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'p' }],
      })
    );

    // 同期状態確認コマンドの登録を確認
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'check-sync-status',
        name: 'Slack: 同期状態を確認',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
      })
    );

    // 自動同期オン/オフコマンドの登録を確認
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'toggle-auto-sync',
        name: 'Slack: 自動同期のオン/オフ',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
      })
    );
  });

  test('should register ribbon icon and status bar item', async () => {
    await plugin.onload();

    // リボンアイコンが追加されたことを確認
    expect(plugin.addRibbonIcon).toHaveBeenCalledWith(
      'sync',
      'Slack同期',
      expect.any(Function)
    );

    // ステータスバーアイテムが追加されたことを確認
    expect(plugin.addStatusBarItem).toHaveBeenCalled();
  });

  test('should register settings tab', async () => {
    await plugin.onload();

    // 設定タブが追加されたことを確認
    expect(plugin.addSettingTab).toHaveBeenCalledWith(
      expect.any(Object)
    );
  });

  test('should have proper hotkey configurations', async () => {
    await plugin.onload();

    const commandCalls = (plugin.addCommand as jest.Mock).mock.calls;
    
    // すべてのコマンドがホットキーを持っていることを確認
    commandCalls.forEach((call) => {
      const commandConfig = call[0];
      expect(commandConfig).toHaveProperty('hotkeys');
      expect(Array.isArray(commandConfig.hotkeys)).toBe(true);
      expect(commandConfig.hotkeys.length).toBeGreaterThan(0);
    });

    // ホットキーの形式が正しいことを確認
    const hotkeyConfigs = commandCalls.map(call => call[0].hotkeys[0]);
    hotkeyConfigs.forEach(hotkey => {
      expect(hotkey).toHaveProperty('modifiers');
      expect(hotkey).toHaveProperty('key');
      expect(hotkey.modifiers).toContain('Mod');
      expect(hotkey.modifiers).toContain('Shift');
      expect(typeof hotkey.key).toBe('string');
    });
  });

  test('should load and save settings properly', async () => {
    await plugin.onload();

    // 設定の読み込みが呼ばれたことを確認
    expect(plugin.loadData).toHaveBeenCalled();

    // デフォルト設定が適用されていることを確認
    expect(plugin.settings).toEqual(
      expect.objectContaining({
        slackToken: '',
        defaultChannels: [],
        syncInterval: 300000,
        notificationLevel: 'all',
        autoSync: false,
      })
    );
  });
});