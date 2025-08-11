// TASK-401: 自動同期スケジューラー実装

import {
  IAutoSyncScheduler,
  AutoSyncSettings,
  ISyncExecutor,
  SyncStartEvent,
  SyncCompleteEvent,
  SyncErrorEvent,
  SchedulerState,
  IRetryStrategy
} from './auto-sync-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 指数バックオフリトライ戦略
 */
class ExponentialBackoffRetryStrategy implements IRetryStrategy {
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly multiplier: number;
  private readonly maxRetries: number;

  constructor(
    initialDelayMs: number = 1000,
    maxRetries: number = 3,
    multiplier: number = 2,
    maxDelayMs: number = 30000
  ) {
    this.initialDelayMs = initialDelayMs;
    this.maxRetries = maxRetries;
    this.multiplier = multiplier;
    this.maxDelayMs = maxDelayMs;
  }

  calculateDelayMs(retryCount: number): number {
    const delay = this.initialDelayMs * Math.pow(this.multiplier, retryCount);
    return Math.min(delay, this.maxDelayMs);
  }

  shouldRetry(retryCount: number, error: Error): boolean {
    return retryCount < this.maxRetries;
  }

  reset(): void {
    // 必要に応じて状態をリセット
  }
}

/**
 * 自動同期スケジューラー
 */
export class AutoSyncScheduler implements IAutoSyncScheduler {
  private syncExecutor: ISyncExecutor;
  private settings: AutoSyncSettings;
  private state: SchedulerState = SchedulerState.STOPPED;
  private timerId?: NodeJS.Timeout;
  private lastSyncTime: Date | null = null;
  private nextSyncTime: Date | null = null;
  private readonly instanceId: string;
  private retryStrategy: IRetryStrategy;
  private currentChannels: string[] = [];

  // イベントハンドラー
  public onSyncStart?: (event: SyncStartEvent) => void;
  public onSyncComplete?: (event: SyncCompleteEvent) => void;  
  public onSyncError?: (event: SyncErrorEvent) => void;

  constructor(syncExecutor: ISyncExecutor, settings: AutoSyncSettings) {
    this.validateConstructorArgs(syncExecutor, settings);
    
    this.syncExecutor = syncExecutor;
    this.settings = { ...settings };
    this.instanceId = uuidv4();
    this.retryStrategy = new ExponentialBackoffRetryStrategy(
      settings.retryBackoffMs,
      settings.maxRetryCount
    );
  }

  private validateConstructorArgs(syncExecutor: ISyncExecutor, settings: AutoSyncSettings): void {
    if (!syncExecutor) {
      throw new Error('Sync executor is required');
    }
    
    this.validateSettings(settings);
  }

  private validateSettings(settings: AutoSyncSettings): void {
    if (!settings) {
      throw new Error('Settings are required');
    }
    
    if (settings.intervalMs <= 0) {
      throw new Error('Invalid interval');
    }
    
    if (settings.maxRetryCount < 0) {
      throw new Error('Invalid retry count');
    }
  }

  /**
   * スケジューラーを開始する
   */
  public start(): void {
    if (this.state === SchedulerState.RUNNING) {
      return; // 既に実行中
    }

    this.state = SchedulerState.STARTING;
    
    // 初回同期の実行
    if (this.settings.initialSyncOnStartup) {
      // 非同期で初回同期を実行（スケジューラー開始をブロックしない）
      setTimeout(() => {
        this.executeSync([], false).catch(error => {
          console.error('Initial sync failed:', error);
        });
      }, 0);
    }

    // 定期実行を開始
    this.scheduleNextSync();
    this.state = SchedulerState.RUNNING;
  }

  /**
   * スケジューラーを停止する  
   */
  public stop(): void {
    if (this.state === SchedulerState.STOPPED) {
      return; // 既に停止済み
    }

    this.state = SchedulerState.STOPPING;
    
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    
    this.nextSyncTime = null;
    this.state = SchedulerState.STOPPED;
  }

  /**
   * スケジューラーを再起動する
   */
  public restart(): void {
    this.stop();
    this.start();
  }

  /**
   * 実行状態を取得する
   */
  public isRunning(): boolean {
    return this.state === SchedulerState.RUNNING;
  }

  /**
   * 最終同期時刻を取得する
   */
  public getLastSyncTime(): Date | null {
    return this.lastSyncTime ? new Date(this.lastSyncTime.getTime()) : null;
  }

  /**
   * 次回同期時刻を取得する
   */
  public getNextSyncTime(): Date | null {
    return this.nextSyncTime ? new Date(this.nextSyncTime.getTime()) : null;
  }

  /**
   * 同期間隔を更新する
   */
  public updateInterval(intervalMs: number): void {
    if (intervalMs <= 0) {
      throw new Error('Invalid interval');
    }

    this.settings.intervalMs = intervalMs;
    
    if (this.isRunning()) {
      this.restart();
    }
  }

  /**
   * 設定を更新する
   */
  public updateSettings(settings: AutoSyncSettings): void {
    if (!settings) {
      throw new Error('Invalid settings');
    }
    
    this.validateSettings(settings);
    
    const wasRunning = this.isRunning();
    
    // 現在実行中であれば一旦停止
    if (wasRunning) {
      this.stop();
    }
    
    // 設定を更新
    this.settings = { ...settings };
    
    // 新しい設定で自動同期が有効であれば開始
    if (settings.enabled) {
      this.start();
    }
  }

  /**
   * 即座に同期を実行する
   */
  public async forceSyncNow(): Promise<void> {
    if (this.syncExecutor.isSyncInProgress()) {
      throw new Error('Sync already in progress');
    }

    await this.executeSync(this.currentChannels, false);
  }

  /**
   * 次回同期をスケジュールする
   */
  private scheduleNextSync(): void {
    if (this.state !== SchedulerState.RUNNING) {
      this.nextSyncTime = null;
      return;
    }

    // 次回同期時刻を事前に設定
    this.nextSyncTime = new Date(Date.now() + this.settings.intervalMs);
    
    this.timerId = setTimeout(() => {
      this.nextSyncTime = null; // 実行開始時にクリア
      this.performScheduledSync();
    }, this.settings.intervalMs);
  }

  /**
   * スケジュールされた同期を実行する
   */
  private async performScheduledSync(): Promise<void> {
    if (this.state !== SchedulerState.RUNNING) {
      return;
    }

    // 同期競合の確認
    if (this.syncExecutor.isSyncInProgress()) {
      // 次回に延期（通常の間隔で再スケジュール）
      this.scheduleNextSync();
      return;
    }

    // 最小間隔の確認（自動同期のみ）
    if (this.lastSyncTime && this.isWithinMinimumInterval()) {
      // 最小間隔を守るため延期
      const remainingTime = 60000 - (Date.now() - this.lastSyncTime.getTime());
      this.nextSyncTime = new Date(Date.now() + remainingTime);
      
      this.timerId = setTimeout(() => {
        this.nextSyncTime = null;
        this.performScheduledSync();
      }, remainingTime);
      return;
    }

    try {
      await this.executeSync(this.currentChannels, true);
    } catch (error) {
      console.error('Scheduled sync failed:', error);
    }

    // 次回同期をスケジュール（成功・失敗に関わらず）
    this.scheduleNextSync();
  }

  /**
   * 最小間隔内かどうかをチェック
   */
  private isWithinMinimumInterval(): boolean {
    if (!this.lastSyncTime) return false;
    
    const minInterval = 60000; // 1分
    const timeSinceLastSync = Date.now() - this.lastSyncTime.getTime();
    
    return timeSinceLastSync < minInterval;
  }

  /**
   * 同期を実行する（リトライ機構付き）
   */
  private async executeSync(channels: string[], isAutoSync: boolean): Promise<void> {
    let retryCount = 0;
    
    while (true) {
      try {
        // 開始イベント発行
        this.emitSyncStartEvent(channels, isAutoSync);
        
        const startTime = Date.now();
        const result = await this.executeSyncWithTimeout(channels);
        const duration = Date.now() - startTime;
        
        // 成功時の処理
        this.lastSyncTime = new Date();
        this.emitSyncCompleteEvent(channels, result.messagesCount, duration, isAutoSync);
        
        return; // 成功
        
      } catch (error) {
        // エラーイベント発行
        this.emitSyncErrorEvent(error as Error, channels, retryCount, isAutoSync);
        
        // リトライ判定
        if (!this.retryStrategy.shouldRetry(retryCount, error as Error)) {
          throw error; // 最大リトライ回数に達した
        }
        
        // リトライ待機
        const delayMs = this.retryStrategy.calculateDelayMs(retryCount);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        retryCount++;
      }
    }
  }

  /**
   * タイムアウト付きで同期を実行する
   */
  private async executeSyncWithTimeout(channels: string[]): Promise<{
    messagesCount: number;
    duration: number;
  }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Sync timeout'));
      }, this.settings.syncTimeoutMs);

      this.syncExecutor.executeSync(channels)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 同期開始イベントを発行する
   */
  private emitSyncStartEvent(channels: string[], isAutoSync: boolean): void {
    const event: SyncStartEvent = {
      type: 'sync_start',
      timestamp: new Date(),
      schedulerInstanceId: this.instanceId,
      channels: [...channels],
      isAutoSync
    };

    if (this.onSyncStart) {
      try {
        this.onSyncStart(event);
      } catch (error) {
        console.error('Error in sync start handler:', error);
      }
    }
  }

  /**
   * 同期完了イベントを発行する
   */
  private emitSyncCompleteEvent(
    channels: string[],
    messagesCount: number,
    duration: number,
    isAutoSync: boolean
  ): void {
    const event: SyncCompleteEvent = {
      type: 'sync_complete',
      timestamp: new Date(),
      schedulerInstanceId: this.instanceId,
      channels: [...channels],
      messagesCount,
      duration,
      isAutoSync
    };

    if (this.onSyncComplete) {
      try {
        this.onSyncComplete(event);
      } catch (error) {
        console.error('Error in sync complete handler:', error);
      }
    }
  }

  /**
   * 同期エラーイベントを発行する
   */
  private emitSyncErrorEvent(
    error: Error,
    channels: string[],
    retryCount: number,
    isAutoSync: boolean
  ): void {
    const event: SyncErrorEvent = {
      type: 'sync_error',
      timestamp: new Date(),
      schedulerInstanceId: this.instanceId,
      error,
      channels: [...channels],
      retryCount,
      isAutoSync
    };

    if (this.onSyncError) {
      try {
        this.onSyncError(event);
      } catch (error) {
        console.error('Error in sync error handler:', error);
      }
    }
  }
}