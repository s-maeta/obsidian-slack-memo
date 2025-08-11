// 共通の型定義

// 結果型（成功/失敗を表現）
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

// Type guard for Result type
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

export function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// プラグイン設定
export interface PluginSettings {
  slackToken: string | null;
  syncInterval: number; // 分単位
  channelMappings: ChannelMapping[];
  dailyNoteSettings: DailyNoteSettings;
  messageFormat: MessageFormatSettings;
  syncHistory: SyncHistory;
  storageSettings: StorageSettings;
}

// ストレージ設定
export interface StorageSettings {
  baseFolder: string; // 基本フォルダ（例: "Slack Sync"）
  organizationType: 'daily' | 'channel-daily' | 'channel-only'; // 整理方法
  dailyPageSettings: DailyPageSettings;
  channelPageSettings: ChannelPageSettings;
}

// 日付別ページ設定
export interface DailyPageSettings {
  enabled: boolean;
  folderPath: string; // 日付別フォルダのパス（例: "{baseFolder}/Daily"）
  fileNameFormat: string; // ファイル名形式（例: "{date}"）
  pageHeaderFormat: string; // ページヘッダー形式
  sectionHeaderFormat: string; // チャンネルセクションのヘッダー形式
}

// チャンネル別ページ設定  
export interface ChannelPageSettings {
  enabled: boolean;
  folderPath: string; // チャンネル別フォルダのパス（例: "{baseFolder}/Channels/{channel}"）
  fileNameFormat: string; // ファイル名形式（例: "{date}"）
  pageHeaderFormat: string; // ページヘッダー形式
}

// チャンネルマッピング設定
export interface ChannelMapping {
  channelId: string;
  channelName: string;
  targetFolder: string;
  saveAsIndividualFiles: boolean;
  fileNameFormat: string;
  enableTags: boolean;
  tags: string[];
}

// デイリーノート設定
export interface DailyNoteSettings {
  enabled: boolean;
  folder: string;
  dateFormat: string; // "YYYY-MM-DD"
  headerFormat: string;
  appendToExisting: boolean;
}

// メッセージフォーマット設定
export interface MessageFormatSettings {
  includeTimestamp: boolean;
  includeUserName: boolean;
  includeChannelName: boolean;
  timestampFormat: string;
  convertMentions: boolean;
  preserveEmojis: boolean;
}

// 同期履歴
export interface SyncHistory {
  lastSyncTime: string | null;
  totalMessagesSynced: number;
  channelLastSync: Record<string, string>; // チャンネルIDごとの最終同期時刻
}

// デフォルト設定
export const DEFAULT_SETTINGS: PluginSettings = {
  slackToken: null,
  syncInterval: 30,
  channelMappings: [],
  dailyNoteSettings: {
    enabled: false,
    folder: 'Daily Notes',
    dateFormat: 'YYYY-MM-DD',
    headerFormat: '## Slack Messages - {{date}}',
    appendToExisting: true,
  },
  messageFormat: {
    includeTimestamp: true,
    includeUserName: true,
    includeChannelName: false,
    timestampFormat: 'HH:mm',
    convertMentions: true,
    preserveEmojis: true,
  },
  syncHistory: {
    lastSyncTime: null,
    totalMessagesSynced: 0,
    channelLastSync: {},
  },
  storageSettings: {
    baseFolder: 'Slack Sync',
    organizationType: 'daily',
    dailyPageSettings: {
      enabled: true,
      folderPath: '{baseFolder}/Daily',
      fileNameFormat: '{date}',
      pageHeaderFormat: '# {date} - Slack Messages',
      sectionHeaderFormat: '## #{channel}'
    },
    channelPageSettings: {
      enabled: false,
      folderPath: '{baseFolder}/Channels/{channel}',
      fileNameFormat: '{date}',
      pageHeaderFormat: '# #{channel} - {date}'
    }
  },
};