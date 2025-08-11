import { ChannelMapping } from '../src/types';
import { SettingsManager, DEFAULT_SETTINGS } from '../src/settings';

// Obsidianのモック
const mockPlugin = {
  loadData: jest.fn(),
  saveData: jest.fn(),
};

describe('プラグイン設定管理', () => {
  let settingsManager: SettingsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsManager = new SettingsManager(mockPlugin as any);
  });

  describe('デフォルト設定', () => {
    it('初期化時に適切なデフォルト値が設定される', () => {
      expect(DEFAULT_SETTINGS.slackToken).toBe(null);
      expect(DEFAULT_SETTINGS.syncInterval).toBe(15);
      expect(DEFAULT_SETTINGS.channelMappings).toEqual([]);
      expect(DEFAULT_SETTINGS.dailyNoteSettings.enabled).toBe(false);
      expect(DEFAULT_SETTINGS.messageFormat.includeTimestamp).toBe(true);
      expect(DEFAULT_SETTINGS.syncHistory.totalMessagesSynced).toBe(0);
    });

    it('必須設定項目がすべて含まれている', () => {
      const settings = DEFAULT_SETTINGS;
      expect(settings).toHaveProperty('slackToken');
      expect(settings).toHaveProperty('syncInterval');
      expect(settings).toHaveProperty('channelMappings');
      expect(settings).toHaveProperty('dailyNoteSettings');
      expect(settings).toHaveProperty('messageFormat');
      expect(settings).toHaveProperty('syncHistory');
    });
  });

  describe('設定の読み込み', () => {
    it('存在しない設定ファイルの場合、デフォルト設定が返される', async () => {
      mockPlugin.loadData.mockResolvedValue(null);

      const settings = await settingsManager.loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
    });

    it('既存の設定ファイルから正しく設定が読み込まれる', async () => {
      const existingData = {
        slackToken: 'xoxb-test-token',
        syncInterval: 30,
        channelMappings: [
          {
            channelId: 'C123',
            channelName: 'general',
            targetFolder: 'Slack/General',
            saveAsIndividualFiles: true,
            fileNameFormat: 'YYYY-MM-DD',
            enableTags: false,
            tags: [] as string[] as string[] as string[],
          },
        ],
      };
      mockPlugin.loadData.mockResolvedValue(existingData);

      const settings = await settingsManager.loadSettings();

      expect(settings.slackToken).toBe('xoxb-test-token');
      expect(settings.syncInterval).toBe(30);
      expect(settings.channelMappings).toHaveLength(1);
    });

    it('不正な設定ファイルの場合、デフォルト設定にフォールバックする', async () => {
      mockPlugin.loadData.mockRejectedValue(new Error('読み込み失敗'));

      const settings = await settingsManager.loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('設定の保存', () => {
    it('設定変更が正しく保存される', async () => {
      mockPlugin.saveData.mockResolvedValue(undefined);
      mockPlugin.loadData.mockResolvedValue(null);

      await settingsManager.loadSettings();
      await settingsManager.updateSettings({ syncInterval: 60 });

      expect(mockPlugin.saveData).toHaveBeenCalledTimes(1);
      expect(settingsManager.getSettings().syncInterval).toBe(60);
    });

    it('部分的な設定更新が正しく動作する', async () => {
      mockPlugin.saveData.mockResolvedValue(undefined);
      mockPlugin.loadData.mockResolvedValue(null);

      await settingsManager.loadSettings();
      await settingsManager.updateSettings({
        messageFormat: { includeTimestamp: false },
      });

      const settings = settingsManager.getSettings();
      expect(settings.messageFormat.includeTimestamp).toBe(false);
      expect(settings.messageFormat.includeUserName).toBe(true); // 他の値は保持
    });

    it('無効な設定値の場合、エラーが発生する', async () => {
      mockPlugin.loadData.mockResolvedValue(null);
      await settingsManager.loadSettings();

      await expect(
        settingsManager.updateSettings({
          slackToken: 'invalid-token',
        })
      ).rejects.toThrow('無効なSlackトークン形式です');

      await expect(
        settingsManager.updateSettings({
          syncInterval: -1,
        })
      ).rejects.toThrow('同期間隔は1分以上の数値である必要があります');
    });
  });

  describe('設定の検証', () => {
    beforeEach(async () => {
      mockPlugin.loadData.mockResolvedValue(null);
      await settingsManager.loadSettings();
    });

    it('Slackトークンの形式が正しく検証される', async () => {
      // 有効なトークン
      await expect(
        settingsManager.updateSettings({
          slackToken: 'xoxb-valid-token',
        })
      ).resolves.not.toThrow();

      // 無効なトークン
      await expect(
        settingsManager.updateSettings({
          slackToken: 'invalid-token',
        })
      ).rejects.toThrow('無効なSlackトークン形式です');

      // null値は許可
      await expect(
        settingsManager.updateSettings({
          slackToken: null,
        })
      ).resolves.not.toThrow();
    });

    it('チャンネルマッピングの重複が検出される', async () => {
      const mapping1: ChannelMapping = {
        channelId: 'C123',
        channelName: 'general',
        targetFolder: 'Slack/General',
        saveAsIndividualFiles: true,
        fileNameFormat: 'YYYY-MM-DD',
        enableTags: false,
        tags: [] as string[] as string[],
      };

      await settingsManager.addChannelMapping(mapping1);

      // 同じchannelIdのマッピングを追加しようとするとエラー
      await expect(settingsManager.addChannelMapping(mapping1)).rejects.toThrow(
        'チャンネル general は既にマッピングされています'
      );
    });

    it('ファイルパスの妥当性が検証される', async () => {
      await expect(
        settingsManager.updateSettings({
          dailyNoteSettings: { folder: 'Valid/Path' },
        })
      ).resolves.not.toThrow();

      await expect(
        settingsManager.updateSettings({
          dailyNoteSettings: { folder: 123 as any },
        })
      ).rejects.toThrow('フォルダパスは文字列である必要があります');
    });
  });

  describe('設定のマイグレーション', () => {
    it('古いバージョンの設定が正しく移行される', async () => {
      jest.clearAllMocks();
      const oldData = {
        slackToken: 'xoxb-old-token',
        syncInterval: -1, // 無効な値
        channelMappings: 'not-array', // 無効な値
        syncHistory: null as any, // 無効な値
      };
      mockPlugin.loadData.mockResolvedValue(oldData);

      const newSettingsManager = new SettingsManager(mockPlugin as any);
      const settings = await newSettingsManager.loadSettings();

      expect(settings.slackToken).toBe('xoxb-old-token');
      expect(settings.syncInterval).toBe(DEFAULT_SETTINGS.syncInterval); // デフォルト値に修正
      expect(settings.channelMappings).toEqual([]); // デフォルト値に修正
      expect(settings.syncHistory).toEqual(DEFAULT_SETTINGS.syncHistory); // デフォルト値に修正
    });

    it('未知の設定項目は無視される', async () => {
      jest.clearAllMocks();
      const dataWithUnknown = {
        ...DEFAULT_SETTINGS,
        unknownProperty: 'should be ignored',
        anotherUnknown: { nested: 'value' },
      };
      mockPlugin.loadData.mockResolvedValue(dataWithUnknown);

      const newSettingsManager = new SettingsManager(mockPlugin as any);
      const settings = await newSettingsManager.loadSettings();

      expect(settings).not.toHaveProperty('unknownProperty');
      expect(settings).not.toHaveProperty('anotherUnknown');
    });
  });

  describe('設定変更イベント', () => {
    beforeEach(async () => {
      mockPlugin.loadData.mockResolvedValue(null);
      mockPlugin.saveData.mockResolvedValue(undefined);
      await settingsManager.loadSettings();
    });

    it('設定変更時にイベントが発火される', async () => {
      const listener = jest.fn();
      settingsManager.addSettingsChangeListener(listener);

      await settingsManager.updateSettings({ syncInterval: 30 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: 'interval',
        oldValue: expect.any(Object),
        newValue: expect.any(Object),
      });
    });

    it('設定変更をリスナーが受信できる', async () => {
      const events: any[] = [];
      const listener = (event: any) => events.push(event);

      settingsManager.addSettingsChangeListener(listener);

      await settingsManager.updateSettings({ slackToken: 'xoxb-new-token' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('token');

      // リスナーの削除
      settingsManager.removeSettingsChangeListener(listener);
      await settingsManager.updateSettings({ syncInterval: 45 });

      expect(events).toHaveLength(1); // リスナーが削除されているのでイベントは増えない
    });
  });
});

describe('チャンネルマッピング設定', () => {
  let settingsManager: SettingsManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPlugin.loadData.mockResolvedValue(null);
    mockPlugin.saveData.mockResolvedValue(undefined);
    settingsManager = new SettingsManager(mockPlugin as any);
    await settingsManager.loadSettings();
  });

  it('新しいマッピングが追加できる', async () => {
    const mapping: ChannelMapping = {
      channelId: 'C111',
      channelName: 'test-channel-1',
      targetFolder: 'Slack/Test1',
      saveAsIndividualFiles: true,
      fileNameFormat: 'YYYY-MM-DD',
      enableTags: false,
      tags: [] as string[],
    };

    await settingsManager.addChannelMapping(mapping);

    const settings = settingsManager.getSettings();
    expect(settings.channelMappings).toHaveLength(1);
    expect(settings.channelMappings[0]).toEqual(mapping);
  });

  it('既存のマッピングが更新できる', async () => {
    const mapping: ChannelMapping = {
      channelId: 'C222',
      channelName: 'test-channel-2',
      targetFolder: 'Slack/Test2',
      saveAsIndividualFiles: true,
      fileNameFormat: 'YYYY-MM-DD',
      enableTags: false,
      tags: [] as string[],
    };

    await settingsManager.addChannelMapping(mapping);
    await settingsManager.updateChannelMapping('C222', { targetFolder: 'New/Path' });

    const settings = settingsManager.getSettings();
    expect(settings.channelMappings[0].targetFolder).toBe('New/Path');
    expect(settings.channelMappings[0].channelName).toBe('test-channel-2'); // 他は保持
  });

  it('マッピングが削除できる', async () => {
    const mapping: ChannelMapping = {
      channelId: 'C333',
      channelName: 'test-channel-3',
      targetFolder: 'Slack/Test3',
      saveAsIndividualFiles: true,
      fileNameFormat: 'YYYY-MM-DD',
      enableTags: false,
      tags: [] as string[],
    };

    await settingsManager.addChannelMapping(mapping);
    expect(settingsManager.getSettings().channelMappings).toHaveLength(1);

    await settingsManager.removeChannelMapping('C333');
    expect(settingsManager.getSettings().channelMappings).toHaveLength(0);
  });
});

describe('同期履歴管理', () => {
  let settingsManager: SettingsManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPlugin.loadData.mockResolvedValue(null);
    mockPlugin.saveData.mockResolvedValue(undefined);
    settingsManager = new SettingsManager(mockPlugin as any);
    await settingsManager.loadSettings();
  });

  it('チャンネル別の最終同期時刻が記録される', async () => {
    const timestamp = '2024-01-15T10:30:00Z';

    await settingsManager.updateSyncHistory('C123', timestamp);

    const settings = settingsManager.getSettings();
    expect(settings.syncHistory.channelLastSync['C123']).toBe(timestamp);
    expect(settings.syncHistory.lastSyncTime).toBe(timestamp);
  });

  it('全体の統計情報が更新される', async () => {
    const initialCount = settingsManager.getSettings().syncHistory.totalMessagesSynced;

    await settingsManager.updateSyncHistory('C123', '2024-01-15T10:30:00Z');

    const settings = settingsManager.getSettings();
    expect(settings.syncHistory.totalMessagesSynced).toBe(initialCount + 1);
  });

  it('履歴のリセットが正しく動作する', async () => {
    // 履歴を設定
    await settingsManager.updateSyncHistory('C123', '2024-01-15T10:30:00Z');

    // リセット実行
    await settingsManager.resetSyncHistory();

    const settings = settingsManager.getSettings();
    expect(settings.syncHistory.lastSyncTime).toBe(null);
    expect(settings.syncHistory.totalMessagesSynced).toBe(0);
    expect(settings.syncHistory.channelLastSync).toEqual({});
  });
});
