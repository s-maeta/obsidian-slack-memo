// TASK-302: 同期状態表示UI - SyncStatusManager 実装

import { 
  ISyncStatusManager, 
  SyncStatus, 
  SyncProgress, 
  SyncError, 
  SyncHistoryItem,
  SyncEvent 
} from './sync-status-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 同期状態管理クラス - REFACTORフェーズで改善
 */
export class SyncStatusManager implements ISyncStatusManager {
  public currentStatus: SyncStatus = SyncStatus.IDLE;
  public progress: SyncProgress = {
    current: 0,
    total: 0,
    percentage: 0
  };
  public lastError?: SyncError;
  public history: SyncHistoryItem[] = [];
  public isCancelled: boolean = false;
  public startTime?: Date;

  private channels: string[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private readonly MAX_HISTORY_ITEMS = 100;

  /**
   * 同期を開始する - REFACTORで改善
   */
  public startSync(channels: string[]): void {
    this.validateChannels(channels);
    
    this.currentStatus = SyncStatus.SYNCING;
    this.startTime = new Date();
    this.isCancelled = false;
    this.channels = [...channels]; // イミュータブルコピー
    this.resetProgress(channels.length);
    this.lastError = undefined;
    
    this.emitEvent({
      type: 'SYNC_START',
      payload: { channels }
    });
  }

  /**
   * チャンネル配列の妥当性チェック
   */
  private validateChannels(channels: string[]): void {
    if (!Array.isArray(channels) || channels.length === 0) {
      throw new Error('Channels array must not be empty');
    }
    
    const invalidChannels = channels.filter(ch => typeof ch !== 'string' || !ch.trim());
    if (invalidChannels.length > 0) {
      throw new Error('All channels must be non-empty strings');
    }
  }

  /**
   * 進捗状態をリセット
   */
  private resetProgress(totalChannels: number): void {
    this.progress = {
      current: 0,
      total: totalChannels,
      percentage: 0
    };
  }

  /**
   * 進捗を更新する - REFACTORで改善
   */
  public updateProgress(current: number, total: number, currentChannel?: string): void {
    this.validateProgressValues(current, total);
    
    const percentage = this.calculatePercentage(current, total);
    
    this.progress = {
      current,
      total,
      percentage,
      currentChannel
    };
    
    this.emitEvent({
      type: 'SYNC_PROGRESS',
      payload: { current, total, currentChannel }
    });
  }

  /**
   * 進捗値の妥当性チェック
   */
  private validateProgressValues(current: number, total: number): void {
    if (typeof current !== 'number' || typeof total !== 'number') {
      throw new Error('Progress values must be numbers');
    }
    
    if (current < 0 || total < 0) {
      throw new Error('Progress values must be non-negative');
    }
    
    if (current > total) {
      throw new Error('Current progress cannot exceed total');
    }
  }

  /**
   * パーセンテージを計算
   */
  private calculatePercentage(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((current / total) * 100 * 100) / 100; // 小数点2桁まで
  }

  /**
   * 同期を完了する
   */
  public completeSync(messageCount: number): void {
    if (this.currentStatus !== SyncStatus.SYNCING) {
      return;
    }

    this.currentStatus = SyncStatus.SUCCESS;
    
    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    const historyItem: SyncHistoryItem = {
      id: uuidv4(),
      timestamp: new Date(),
      status: SyncStatus.SUCCESS,
      channelsProcessed: this.channels.length,
      messagesCount: messageCount,
      duration
    };

    this.addHistoryItem(historyItem);
  }

  /**
   * エラーを設定する
   */
  public setError(error: Error): void {
    this.currentStatus = SyncStatus.ERROR;
    this.lastError = {
      message: error.message,
      timestamp: new Date(),
      code: error.name
    };

    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    const historyItem: SyncHistoryItem = {
      id: uuidv4(),
      timestamp: new Date(),
      status: SyncStatus.ERROR,
      channelsProcessed: this.channels.length,
      messagesCount: 0,
      duration,
      error: error.message
    };

    this.addHistoryItem(historyItem);
  }

  /**
   * 同期をキャンセルする
   */
  public cancelSync(): void {
    this.currentStatus = SyncStatus.IDLE;
    this.isCancelled = true;
  }

  /**
   * 履歴アイテムを追加する - REFACTORで改善
   */
  public addHistoryItem(item: SyncHistoryItem): void {
    this.validateHistoryItem(item);
    
    // 新しいアイテムを先頭に追加
    this.history.unshift({ ...item }); // イミュータブルコピー
    
    // 最大件数制限を維持
    this.enforceHistoryLimit();
  }

  /**
   * 履歴アイテムの妥当性チェック
   */
  private validateHistoryItem(item: SyncHistoryItem): void {
    if (!item || typeof item !== 'object') {
      throw new Error('History item must be a valid object');
    }
    
    const requiredFields = ['id', 'timestamp', 'status', 'channelsProcessed', 'messagesCount', 'duration'];
    for (const field of requiredFields) {
      if (!(field in item)) {
        throw new Error(`History item missing required field: ${field}`);
      }
    }
  }

  /**
   * 履歴の最大件数制限を強制
   */
  private enforceHistoryLimit(): void {
    if (this.history.length > this.MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, this.MAX_HISTORY_ITEMS);
    }
  }

  /**
   * イベントを発行する
   */
  private emitEvent(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    });
  }

  /**
   * イベントリスナーを追加
   */
  public addEventListener(eventType: string, listener: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * イベントリスナーを削除
   */
  public removeEventListener(eventType: string, listener: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 統計情報を取得
   */
  public getStatistics(): { 
    totalSyncs: number; 
    successRate: number; 
    averageDuration: number;
    lastSyncTime?: Date;
  } {
    const totalSyncs = this.history.length;
    const successfulSyncs = this.history.filter(item => item.status === SyncStatus.SUCCESS).length;
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
    
    const durations = this.history.map(item => item.duration);
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length 
      : 0;

    const lastSyncTime = this.history.length > 0 ? this.history[0].timestamp : undefined;

    return {
      totalSyncs,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
      lastSyncTime
    };
  }

  /**
   * 現在の状態をJSON形式で取得
   */
  public toJSON(): object {
    return {
      currentStatus: this.currentStatus,
      progress: this.progress,
      lastError: this.lastError,
      historyCount: this.history.length,
      isCancelled: this.isCancelled,
      statistics: this.getStatistics()
    };
  }
}