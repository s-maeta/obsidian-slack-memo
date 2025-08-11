// TASK-302: 同期状態表示UI - 型定義

/**
 * 同期状態の定義
 */
export enum SyncStatus {
  IDLE = 'idle',           // アイドル状態
  SYNCING = 'syncing',     // 同期中
  SUCCESS = 'success',     // 成功
  ERROR = 'error',         // エラー
  WARNING = 'warning'      // 警告
}

/**
 * 通知タイプの定義
 */
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * 同期進捗情報
 */
export interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
  currentChannel?: string;
}

/**
 * エラー情報
 */
export interface SyncError {
  message: string;
  timestamp: Date;
  code?: string;
}

/**
 * 同期履歴項目
 */
export interface SyncHistoryItem {
  id: string;
  timestamp: Date;
  status: SyncStatus;
  channelsProcessed: number;
  messagesCount: number;
  duration: number; // milliseconds
  error?: string;
}

/**
 * 同期状態管理クラスのインターフェース
 */
export interface ISyncStatusManager {
  currentStatus: SyncStatus;
  progress: SyncProgress;
  lastError?: SyncError;
  history: SyncHistoryItem[];
  isCancelled: boolean;
  startTime?: Date;

  // メソッド
  startSync(channels: string[]): void;
  updateProgress(current: number, total: number, currentChannel?: string): void;
  completeSync(messageCount: number): void;
  setError(error: Error): void;
  cancelSync(): void;
  addHistoryItem(item: SyncHistoryItem): void;
}

/**
 * ステータスバーアイテムのインターフェース
 */
export interface IStatusBarItem {
  element: HTMLElement;
  
  updateStatus(status: SyncStatus): void;
  updateProgress(progress: SyncProgress): void;
  showTooltip(message: string): void;
  onClick(handler: () => void): void;
}

/**
 * 同期進捗モーダルのインターフェース
 */
export interface ISyncProgressModal {
  isOpen: boolean;
  
  open(): void;
  close(): void;
  updateProgress(progress: SyncProgress): void;
  updateStatus(status: SyncStatus): void;
  addLogMessage(message: string): void;
  showError(error: string): void;
  showComplete(stats: { messagesCount: number; duration: number }): void;
  onCancel(handler: () => void): void;
  onRetry(handler: () => void): void;
}

/**
 * 通知管理クラスのインターフェース
 */
export interface INotificationManager {
  showToast(message: string, type: NotificationType, duration?: number): void;
  showError(message: string, details?: string): void;
  setNotificationLevel(level: NotificationType): void;
  showActionNotification(message: string, actions: NotificationAction[]): void;
}

/**
 * 通知アクション
 */
export interface NotificationAction {
  label: string;
  handler: () => void;
}

/**
 * 同期履歴ビューのインターフェース
 */
export interface ISyncHistoryView {
  isVisible: boolean;
  
  show(): void;
  hide(): void;
  updateHistory(history: SyncHistoryItem[]): void;
  filterHistory(filter: 'all' | 'success' | 'error'): void;
  searchHistory(query: string): void;
  deleteHistoryItem(id: string): void;
  exportHistory(): void;
  onItemClick(handler: (item: SyncHistoryItem) => void): void;
}

/**
 * 同期イベントの定義
 */
export type SyncEvent = 
  | { type: 'SYNC_START'; payload: { channels: string[] } }
  | { type: 'SYNC_PROGRESS'; payload: { current: number; total: number; currentChannel?: string } }
  | { type: 'SYNC_SUCCESS'; payload: { messageCount: number; duration: number } }
  | { type: 'SYNC_ERROR'; payload: { error: Error } }
  | { type: 'SYNC_CANCEL'; payload: {} };

/**
 * 同期状態UIの統合インターフェース
 */
export interface ISyncStatusUI {
  statusBarItem: IStatusBarItem;
  progressModal: ISyncProgressModal;
  notificationManager: INotificationManager;
  historyView: ISyncHistoryView;
  
  onSyncEvent(event: SyncEvent): void;
  updateDisplay(): void;
  cleanup(): void;
}

/**
 * ツールチップ情報
 */
export interface TooltipInfo {
  status: string;
  lastSync?: string;
  nextSync?: string;
  errorMessage?: string;
}

/**
 * 履歴フィルター条件
 */
export interface HistoryFilter {
  status?: SyncStatus;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

/**
 * 統計情報
 */
export interface SyncStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalMessages: number;
  averageDuration: number;
  lastSyncTime?: Date;
}