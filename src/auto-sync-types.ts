// TASK-401: 自動同期スケジューラー 型定義

/**
 * 自動同期の設定
 */
export interface AutoSyncSettings {
  /** 自動同期の有効/無効 */
  enabled: boolean;
  /** 同期間隔（ミリ秒） */
  intervalMs: number;
  /** 起動時初回同期 */
  initialSyncOnStartup: boolean;
  /** 最大リトライ回数 */
  maxRetryCount: number;
  /** リトライ間隔（ミリ秒） */
  retryBackoffMs: number;
  /** 同期タイムアウト（ミリ秒） */
  syncTimeoutMs: number;
}

/**
 * 同期イベントの基底インターフェース
 */
export interface BaseSyncEvent {
  timestamp: Date;
  schedulerInstanceId: string;
}

/**
 * 同期開始イベント
 */
export interface SyncStartEvent extends BaseSyncEvent {
  type: 'sync_start';
  channels: string[];
  isAutoSync: boolean;
}

/**
 * 同期完了イベント  
 */
export interface SyncCompleteEvent extends BaseSyncEvent {
  type: 'sync_complete';
  channels: string[];
  messagesCount: number;
  duration: number;
  isAutoSync: boolean;
}

/**
 * 同期エラーイベント
 */
export interface SyncErrorEvent extends BaseSyncEvent {
  type: 'sync_error';
  error: Error;
  channels: string[];
  retryCount: number;
  isAutoSync: boolean;
}

/**
 * 同期イベントの統合型
 */
export type SyncEvent = SyncStartEvent | SyncCompleteEvent | SyncErrorEvent;

/**
 * 自動同期スケジューラーのインターフェース
 */
export interface IAutoSyncScheduler {
  /** スケジューラー制御 */
  start(): void;
  stop(): void;
  restart(): void;
  
  /** 状態取得 */
  isRunning(): boolean;
  getLastSyncTime(): Date | null;
  getNextSyncTime(): Date | null;
  
  /** 設定更新 */
  updateInterval(intervalMs: number): void;
  updateSettings(settings: AutoSyncSettings): void;
  
  /** 同期実行 */
  forceSyncNow(): Promise<void>;
  
  /** イベントハンドラー */
  onSyncStart?: (event: SyncStartEvent) => void;
  onSyncComplete?: (event: SyncCompleteEvent) => void;
  onSyncError?: (event: SyncErrorEvent) => void;
}

/**
 * 同期実行のインターフェース（依存性注入用）
 */
export interface ISyncExecutor {
  /** 同期を実行する */
  executeSync(channels: string[]): Promise<{
    messagesCount: number;
    duration: number;
  }>;
  
  /** 同期状態を取得する */
  isSyncInProgress(): boolean;
}

/**
 * スケジューラーの実行状態
 */
export enum SchedulerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * リトライ戦略のインターフェース
 */
export interface IRetryStrategy {
  /** 次回リトライまでの待機時間を計算 */
  calculateDelayMs(retryCount: number): number;
  
  /** リトライを実行すべきかどうか判定 */
  shouldRetry(retryCount: number, error: Error): boolean;
  
  /** リトライ戦略をリセット */
  reset(): void;
}

/**
 * 指数バックオフリトライ戦略の設定
 */
export interface ExponentialBackoffConfig {
  /** 初期遅延時間（ミリ秒） */
  initialDelayMs: number;
  /** 最大遅延時間（ミリ秒） */
  maxDelayMs: number;
  /** バックオフ倍率 */
  multiplier: number;
  /** 最大リトライ回数 */
  maxRetries: number;
}