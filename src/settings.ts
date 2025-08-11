import { Plugin } from 'obsidian';
import { PluginSettings, ChannelMapping, DEFAULT_SETTINGS } from './types';

// 不足している型定義を追加
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface SettingsChangeEvent {
  type: 'token' | 'mapping' | 'format' | 'interval';
  oldValue: any;
  newValue: any;
}

// Use DEFAULT_SETTINGS from types.ts

export class SettingsManager {
  private plugin: Plugin;
  private settings: PluginSettings;
  private listeners: ((event: SettingsChangeEvent) => void)[] = [];

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.settings = { ...DEFAULT_SETTINGS };
  }

  async loadSettings(): Promise<PluginSettings> {
    try {
      const data = await this.plugin.loadData();
      if (data) {
        this.settings = this.migrateSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
      return this.settings;
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
      this.settings = { ...DEFAULT_SETTINGS };
      return this.settings;
    }
  }

  async saveSettings(): Promise<void> {
    try {
      await this.plugin.saveData(this.settings);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      throw error;
    }
  }

  getSettings(): PluginSettings {
    return { ...this.settings };
  }

  async updateSettings(updates: DeepPartial<PluginSettings>): Promise<void> {
    const oldSettings = { ...this.settings };

    // バリデーション
    this.validateSettings(updates);

    // 設定の更新
    this.settings = this.mergeSettings(this.settings, updates);

    // 保存
    await this.saveSettings();

    // イベント発火
    this.notifySettingsChange(oldSettings, this.settings);
  }

  // チャンネルマッピング管理
  async addChannelMapping(mapping: ChannelMapping): Promise<void> {
    // 重複チェック
    if (this.settings.channelMappings.some(m => m.channelId === mapping.channelId)) {
      throw new Error(`チャンネル ${mapping.channelName} は既にマッピングされています`);
    }

    this.settings.channelMappings.push(mapping);
    await this.saveSettings();

    this.notifySettingsChange(
      { channelMappings: this.settings.channelMappings.slice(0, -1) },
      { channelMappings: this.settings.channelMappings }
    );
  }

  async updateChannelMapping(channelId: string, updates: Partial<ChannelMapping>): Promise<void> {
    const index = this.settings.channelMappings.findIndex(m => m.channelId === channelId);
    if (index === -1) {
      throw new Error(`チャンネル ${channelId} のマッピングが見つかりません`);
    }

    const oldMapping = { ...this.settings.channelMappings[index] };
    this.settings.channelMappings[index] = { ...oldMapping, ...updates };

    await this.saveSettings();

    this.notifySettingsChange(
      { channelMappings: [oldMapping] },
      { channelMappings: [this.settings.channelMappings[index]] }
    );
  }

  async removeChannelMapping(channelId: string): Promise<void> {
    const index = this.settings.channelMappings.findIndex(m => m.channelId === channelId);
    if (index === -1) {
      throw new Error(`チャンネル ${channelId} のマッピングが見つかりません`);
    }

    const removedMapping = this.settings.channelMappings.splice(index, 1)[0];
    await this.saveSettings();

    this.notifySettingsChange({ channelMappings: [removedMapping] }, { channelMappings: [] });
  }

  // 同期履歴管理
  async updateSyncHistory(channelId: string, lastSyncTime: string): Promise<void> {
    this.settings.syncHistory.channelLastSync[channelId] = lastSyncTime;
    this.settings.syncHistory.lastSyncTime = lastSyncTime;
    this.settings.syncHistory.totalMessagesSynced += 1;

    await this.saveSettings();
  }

  async resetSyncHistory(): Promise<void> {
    this.settings.syncHistory = {
      lastSyncTime: null,
      totalMessagesSynced: 0,
      channelLastSync: {},
    };

    await this.saveSettings();
  }

  // イベントリスナー管理
  addSettingsChangeListener(listener: (event: SettingsChangeEvent) => void): void {
    this.listeners.push(listener);
  }

  removeSettingsChangeListener(listener: (event: SettingsChangeEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private validateSettings(settings: DeepPartial<PluginSettings>): void {
    // Slackトークンの検証
    if (settings.slackToken !== undefined) {
      if (settings.slackToken !== null && typeof settings.slackToken !== 'string') {
        throw new Error('Slackトークンは文字列である必要があります');
      }
      if (settings.slackToken && !settings.slackToken.startsWith('xoxb-')) {
        throw new Error('無効なSlackトークン形式です');
      }
    }

    // 同期間隔の検証
    if (settings.syncInterval !== undefined) {
      if (typeof settings.syncInterval !== 'number' || settings.syncInterval < 1) {
        throw new Error('同期間隔は1分以上の数値である必要があります');
      }
    }

    // フォルダパスの検証
    if (settings.dailyNoteSettings?.folder !== undefined) {
      if (typeof settings.dailyNoteSettings.folder !== 'string') {
        throw new Error('フォルダパスは文字列である必要があります');
      }
    }
  }

  private mergeSettings(
    current: PluginSettings,
    updates: DeepPartial<PluginSettings>
  ): PluginSettings {
    const result: any = { ...current };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const currentValue = current[key as keyof PluginSettings];
          if (typeof currentValue === 'object' && currentValue !== null) {
            result[key] = {
              ...currentValue,
              ...value,
            };
          } else {
            result[key] = value;
          }
        } else {
          result[key] = value;
        }
      }
    }

    return result as PluginSettings;
  }

  private migrateSettings(data: any): PluginSettings {
    // 設定のマイグレーション処理
    // 許可されたキーのみを抽出
    const migrated: PluginSettings = {
      slackToken: data.slackToken ?? DEFAULT_SETTINGS.slackToken,
      syncInterval:
        typeof data.syncInterval === 'number' && data.syncInterval >= 1
          ? data.syncInterval
          : DEFAULT_SETTINGS.syncInterval,
      channelMappings: Array.isArray(data.channelMappings)
        ? data.channelMappings
        : DEFAULT_SETTINGS.channelMappings,
      dailyNoteSettings:
        typeof data.dailyNoteSettings === 'object' && data.dailyNoteSettings !== null
          ? { ...DEFAULT_SETTINGS.dailyNoteSettings, ...data.dailyNoteSettings }
          : DEFAULT_SETTINGS.dailyNoteSettings,
      messageFormat:
        typeof data.messageFormat === 'object' && data.messageFormat !== null
          ? { ...DEFAULT_SETTINGS.messageFormat, ...data.messageFormat }
          : DEFAULT_SETTINGS.messageFormat,
      syncHistory:
        typeof data.syncHistory === 'object' && data.syncHistory !== null
          ? { ...DEFAULT_SETTINGS.syncHistory, ...data.syncHistory }
          : DEFAULT_SETTINGS.syncHistory,
      storageSettings:
        typeof data.storageSettings === 'object' && data.storageSettings !== null
          ? { ...DEFAULT_SETTINGS.storageSettings, ...data.storageSettings }
          : DEFAULT_SETTINGS.storageSettings,
    };

    return migrated;
  }

  private notifySettingsChange(oldValue: any, newValue: any): void {
    const event: SettingsChangeEvent = {
      type: this.determineChangeType(oldValue, newValue),
      oldValue,
      newValue,
    };

    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('設定変更リスナーでエラーが発生しました:', error);
      }
    });
  }

  private determineChangeType(oldValue: any, newValue: any): SettingsChangeEvent['type'] {
    if (oldValue.slackToken !== newValue.slackToken) return 'token';
    if (oldValue.channelMappings !== newValue.channelMappings) return 'mapping';
    if (
      oldValue.messageFormat !== newValue.messageFormat ||
      oldValue.dailyNoteSettings !== newValue.dailyNoteSettings
    )
      return 'format';
    if (oldValue.syncInterval !== newValue.syncInterval) return 'interval';
    return 'format'; // デフォルト
  }
}
