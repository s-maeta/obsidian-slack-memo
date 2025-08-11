// ================================
// Slack API関連の型定義
// ================================

// Slackメッセージの基本型
export interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  attachments?: SlackAttachment[];
  files?: SlackFile[];
  edited?: {
    user: string;
    ts: string;
  };
}

// Slack添付ファイル
export interface SlackAttachment {
  id: string;
  title?: string;
  title_link?: string;
  text?: string;
  fallback?: string;
  image_url?: string;
  thumb_url?: string;
}

// Slackファイル
export interface SlackFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  url_private: string;
  url_private_download: string;
  size: number;
  created: number;
}

// Slackチャンネル情報
export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_member: boolean;
  is_private: boolean;
}

// Slackユーザー情報
export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  is_bot: boolean;
}

// ================================
// プラグイン設定関連の型定義
// ================================

// プラグイン全体設定
export interface PluginSettings {
  slackToken: string | null;
  syncInterval: number; // 分単位
  channelMappings: ChannelMapping[];
  dailyNoteSettings: DailyNoteSettings;
  messageFormat: MessageFormatSettings;
  syncHistory: SyncHistory;
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
  lastSyncTime: string | null; // 全体の最終同期時刻
  totalMessagesSynced: number;
  channelLastSync: Record<string, string>; // チャンネルID別の最終同期時刻
}

// ================================
// 内部データ構造の型定義
// ================================

// 処理済みメッセージ
export interface ProcessedMessage {
  id: string;
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  thread?: ProcessedMessage[];
  attachments: ProcessedAttachment[];
  metadata: MessageMetadata;
}

// 処理済み添付ファイル
export interface ProcessedAttachment {
  type: 'file' | 'image' | 'link';
  title: string;
  url: string;
  markdownLink: string;
}

// メッセージメタデータ
export interface MessageMetadata {
  originalTs: string;
  isEdited: boolean;
  editedAt?: Date;
  threadCount?: number;
  tags: string[];
}

// 保存先情報
export interface SaveTarget {
  filePath: string;
  content: string;
  append: boolean;
  createFolders: boolean;
}

// ================================
// API関連の型定義
// ================================

// Slack API認証リクエスト
export interface SlackAuthRequest {
  code: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

// Slack API認証レスポンス
export interface SlackAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  team?: {
    id: string;
    name: string;
  };
  error?: string;
}

// メッセージ取得リクエスト
export interface GetMessagesRequest {
  channel: string;
  oldest?: string;
  latest?: string;
  limit?: number;
  inclusive?: boolean;
}

// API基本レスポンス
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  error_detail?: string;
  retry_after?: number;
}

// ================================
// UI/イベント関連の型定義
// ================================

// 同期状態
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'completed';

// 同期進捗情報
export interface SyncProgress {
  status: SyncStatus;
  current: number;
  total: number;
  currentChannel?: string;
  message?: string;
  errors: SyncError[];
}

// 同期エラー
export interface SyncError {
  timestamp: Date;
  channel?: string;
  message: string;
  code: string;
  recoverable: boolean;
}

// 設定変更イベント
export interface SettingsChangeEvent {
  type: 'token' | 'mapping' | 'format' | 'interval';
  oldValue: any;
  newValue: any;
}

// ================================
// ユーティリティ型定義
// ================================

// 部分的な更新用の型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 成功/失敗の結果型
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

// ページネーション情報
export interface PaginationInfo {
  has_more: boolean;
  next_cursor?: string;
  response_metadata?: {
    next_cursor: string;
  };
}