// TASK-401: 自動同期スケジューラー テストスイート

import { AutoSyncScheduler } from '../auto-sync-scheduler';
import { 
  AutoSyncSettings, 
  SyncStartEvent, 
  SyncCompleteEvent, 
  SyncErrorEvent, 
  ISyncExecutor,
  SchedulerState
} from '../auto-sync-types';

// Jest fakeTimers を使用してタイマーを制御
jest.useFakeTimers();

describe('AutoSyncScheduler', () => {
  let scheduler: AutoSyncScheduler;
  let mockSyncExecutor: jest.Mocked<ISyncExecutor>;
  let mockSettings: AutoSyncSettings;

  beforeEach(() => {
    // モックのSyncExecutorを作成
    mockSyncExecutor = {
      executeSync: jest.fn(),
      isSyncInProgress: jest.fn()
    };

    // デフォルト設定
    mockSettings = {
      enabled: true,
      intervalMs: 300000, // 5分
      initialSyncOnStartup: true,
      maxRetryCount: 3,
      retryBackoffMs: 1000,
      syncTimeoutMs: 30000
    };

    // AutoSyncSchedulerインスタンスを作成
    scheduler = new AutoSyncScheduler(mockSyncExecutor, mockSettings);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    scheduler.stop();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Constructor and Properties', () => {
    // TC-AS-001: コンストラクタとプロパティ
    test('TC-AS-001: should create instance with correct initial state', () => {
      expect(scheduler).toBeInstanceOf(AutoSyncScheduler);
      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getLastSyncTime()).toBeNull();
      expect(scheduler.getNextSyncTime()).toBeNull();
    });

    test('should reject invalid settings', () => {
      const invalidSettings = { ...mockSettings, intervalMs: -1 };
      expect(() => new AutoSyncScheduler(mockSyncExecutor, invalidSettings))
        .toThrow('Invalid interval');
    });

    test('should reject null sync executor', () => {
      expect(() => new AutoSyncScheduler(null as any, mockSettings))
        .toThrow('Sync executor is required');
    });
  });

  describe('Start and Stop Operations', () => {
    // TC-AS-002: start() メソッド
    test('TC-AS-002: should start scheduler correctly', () => {
      scheduler.start();
      
      expect(scheduler.isRunning()).toBe(true);
      expect(scheduler.getNextSyncTime()).not.toBeNull();
    });

    test('should execute initial sync on startup when enabled', () => {
      mockSettings.initialSyncOnStartup = true;
      scheduler = new AutoSyncScheduler(mockSyncExecutor, mockSettings);
      
      scheduler.start();
      
      expect(mockSyncExecutor.executeSync).toHaveBeenCalledWith([]);
    });

    test('should not execute initial sync when disabled', () => {
      mockSettings.initialSyncOnStartup = false;
      scheduler = new AutoSyncScheduler(mockSyncExecutor, mockSettings);
      
      scheduler.start();
      
      expect(mockSyncExecutor.executeSync).not.toHaveBeenCalled();
    });

    test('should not start if already running', () => {
      scheduler.start();
      const firstNextSyncTime = scheduler.getNextSyncTime();
      
      scheduler.start(); // 2回目の呼び出し
      
      expect(scheduler.getNextSyncTime()).toEqual(firstNextSyncTime);
    });

    // TC-AS-003: stop() メソッド
    test('TC-AS-003: should stop scheduler correctly', () => {
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      
      scheduler.stop();
      
      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getNextSyncTime()).toBeNull();
    });

    test('should clear timers when stopped', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      scheduler.start();
      scheduler.stop();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    test('should do nothing if already stopped', () => {
      expect(scheduler.isRunning()).toBe(false);
      
      scheduler.stop(); // すでに停止状態で呼び出し
      
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('Restart Operation', () => {
    // TC-AS-004: restart() メソッド
    test('TC-AS-004: should restart scheduler with new settings', () => {
      scheduler.start();
      const originalInterval = scheduler.getNextSyncTime();
      
      scheduler.updateInterval(600000); // 10分に変更
      scheduler.restart();
      
      expect(scheduler.isRunning()).toBe(true);
      expect(scheduler.getNextSyncTime()).not.toEqual(originalInterval);
    });

    test('should restart even if not running', () => {
      expect(scheduler.isRunning()).toBe(false);
      
      scheduler.restart();
      
      expect(scheduler.isRunning()).toBe(true);
    });
  });

  describe('Interval Management', () => {
    // TC-AS-005: updateInterval() メソッド
    test('TC-AS-005: should update interval correctly', () => {
      const newInterval = 600000; // 10分
      
      scheduler.updateInterval(newInterval);
      
      // 内部設定が更新されることを間接的に確認
      scheduler.start();
      const nextSyncTime = scheduler.getNextSyncTime();
      expect(nextSyncTime?.getTime()).toBeGreaterThan(Date.now() + newInterval - 1000);
    });

    test('should reject invalid intervals', () => {
      expect(() => scheduler.updateInterval(0)).toThrow('Invalid interval');
      expect(() => scheduler.updateInterval(-1000)).toThrow('Invalid interval');
    });

    test('should restart scheduler if running', () => {
      scheduler.start();
      const restartSpy = jest.spyOn(scheduler, 'restart');
      
      scheduler.updateInterval(600000);
      
      expect(restartSpy).toHaveBeenCalled();
    });
  });

  describe('State Queries', () => {
    // TC-AS-006: isRunning() メソッド  
    test('TC-AS-006: should return correct running state', () => {
      expect(scheduler.isRunning()).toBe(false);
      
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    // TC-AS-007: getLastSyncTime() メソッド
    test('TC-AS-007: should return null initially', () => {
      expect(scheduler.getLastSyncTime()).toBeNull();
    });

    test('should return last sync time after sync completion', async () => {
      mockSyncExecutor.executeSync.mockResolvedValue({
        messagesCount: 5,
        duration: 1000
      });

      const syncStartTime = Date.now();
      await scheduler.forceSyncNow();
      
      const lastSyncTime = scheduler.getLastSyncTime();
      expect(lastSyncTime).not.toBeNull();
      expect(lastSyncTime!.getTime()).toBeGreaterThanOrEqual(syncStartTime);
    });

    // TC-AS-008: getNextSyncTime() メソッド
    test('TC-AS-008: should return null when stopped', () => {
      expect(scheduler.getNextSyncTime()).toBeNull();
    });

    test('should return next sync time when running', () => {
      scheduler.start();
      
      const nextSyncTime = scheduler.getNextSyncTime();
      expect(nextSyncTime).not.toBeNull();
      expect(nextSyncTime!.getTime()).toBeGreaterThan(Date.now());
    });

    test('should update next sync time after interval change', () => {
      scheduler.start();
      const originalTime = scheduler.getNextSyncTime();
      
      scheduler.updateInterval(600000); // 10分に変更
      
      const newTime = scheduler.getNextSyncTime();
      expect(newTime).not.toEqual(originalTime);
    });
  });

  describe('Force Sync', () => {
    // TC-AS-009: forceSyncNow() メソッド
    test('TC-AS-009: should execute sync immediately', async () => {
      mockSyncExecutor.executeSync.mockResolvedValue({
        messagesCount: 10,
        duration: 2000
      });

      const syncPromise = scheduler.forceSyncNow();
      
      expect(mockSyncExecutor.executeSync).toHaveBeenCalled();
      await expect(syncPromise).resolves.toBeUndefined();
    });

    test('should prevent duplicate force sync', async () => {
      mockSyncExecutor.isSyncInProgress.mockReturnValue(true);

      await expect(scheduler.forceSyncNow()).rejects.toThrow('Sync already in progress');
    });

    test('should handle sync execution errors', async () => {
      const syncError = new Error('Network error');
      mockSyncExecutor.executeSync.mockRejectedValue(syncError);

      await expect(scheduler.forceSyncNow()).rejects.toThrow('Network error');
    });
  });

  describe('Settings Update', () => {
    // TC-AS-010: updateSettings() メソッド
    test('TC-AS-010: should update settings correctly', () => {
      const newSettings: AutoSyncSettings = {
        ...mockSettings,
        enabled: false,
        intervalMs: 600000
      };

      scheduler.updateSettings(newSettings);
      
      // 設定が無効になったので停止する
      expect(scheduler.isRunning()).toBe(false);
    });

    test('should start scheduler when enabled', () => {
      scheduler.stop();
      
      const newSettings: AutoSyncSettings = {
        ...mockSettings,
        enabled: true
      };

      scheduler.updateSettings(newSettings);
      
      expect(scheduler.isRunning()).toBe(true);
    });

    test('should reject invalid settings', () => {
      const invalidSettings = {
        ...mockSettings,
        intervalMs: -1000
      };

      expect(() => scheduler.updateSettings(invalidSettings))
        .toThrow('Invalid settings');
    });
  });

  describe('Sync Conflict Prevention', () => {
    // TC-CF-001: 重複実行防止
    test('TC-CF-001: should prevent duplicate automatic sync', () => {
      mockSyncExecutor.isSyncInProgress.mockReturnValue(true);
      
      scheduler.start();
      
      // タイマーが発火しても同期中なら新しい同期は開始されない
      jest.advanceTimersByTime(mockSettings.intervalMs);
      
      expect(mockSyncExecutor.executeSync).not.toHaveBeenCalled();
    });

    // TC-CF-002: 最小間隔制限
    test('TC-CF-002: should respect minimum interval between syncs', async () => {
      mockSyncExecutor.executeSync.mockResolvedValue({
        messagesCount: 5,
        duration: 100
      });

      // 最初の同期を実行
      await scheduler.forceSyncNow();
      
      // 最小間隔未満で再実行を試行
      jest.advanceTimersByTime(30000); // 30秒後（1分未満）
      
      scheduler.start();
      jest.advanceTimersByTime(mockSettings.intervalMs);
      
      // 最小間隔を守るため、実行されない
      expect(mockSyncExecutor.executeSync).toHaveBeenCalledTimes(1);
    });

    // TC-CF-003: 同期状態管理
    test('TC-CF-003: should manage sync state correctly', async () => {
      let syncInProgress = false;
      mockSyncExecutor.isSyncInProgress.mockImplementation(() => syncInProgress);
      mockSyncExecutor.executeSync.mockImplementation(async () => {
        syncInProgress = true;
        // 同期処理をシミュレート
        await new Promise(resolve => setTimeout(resolve, 100));
        syncInProgress = false;
        return { messagesCount: 3, duration: 100 };
      });

      await scheduler.forceSyncNow();
      
      expect(syncInProgress).toBe(false);
    });
  });

  describe('Error Handling', () => {
    // TC-EH-001: ネットワークエラー対応
    test('TC-EH-001: should retry on network errors', async () => {
      const networkError = new Error('Network timeout');
      mockSyncExecutor.executeSync
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({ messagesCount: 5, duration: 1000 });

      scheduler.start();
      jest.advanceTimersByTime(mockSettings.intervalMs);
      
      // リトライ処理を待機
      jest.advanceTimersByTime(mockSettings.retryBackoffMs * 3);

      expect(mockSyncExecutor.executeSync).toHaveBeenCalledTimes(3);
    });

    // TC-EH-002: リトライ機構
    test('TC-EH-002: should implement exponential backoff retry', async () => {
      const error = new Error('API error');
      mockSyncExecutor.executeSync.mockRejectedValue(error);

      const retryDelays: number[] = [];
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        retryDelays.push(delay as number);
        return setTimeout(callback, 0); // 即座に実行
      });

      scheduler.start();
      jest.advanceTimersByTime(mockSettings.intervalMs);
      
      // 全リトライの完了を待機
      jest.runAllTimers();

      // 指数バックオフの確認：1s, 2s, 4s
      expect(retryDelays.filter(delay => [1000, 2000, 4000].includes(delay)))
        .toHaveLength(3);
    });

    // TC-EH-003: タイムアウト処理
    test('TC-EH-003: should timeout long running sync', async () => {
      mockSyncExecutor.executeSync.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 35000)) // 35秒
      );

      scheduler.start();
      jest.advanceTimersByTime(mockSettings.intervalMs);
      
      // タイムアウト時間経過
      jest.advanceTimersByTime(mockSettings.syncTimeoutMs + 1000);

      // タイムアウトエラーが発生することを確認
      expect(scheduler.getLastSyncTime()).toBeNull(); // 同期が完了していない
    });

    // TC-EH-004: 設定エラー対応
    test('TC-EH-004: should handle invalid configuration', () => {
      const invalidSettings = {
        ...mockSettings,
        intervalMs: 0
      };

      expect(() => scheduler.updateSettings(invalidSettings))
        .toThrow('Invalid settings');
    });
  });

  describe('Event Handling', () => {
    test('should emit sync start event', async () => {
      const startHandler = jest.fn();
      scheduler.onSyncStart = startHandler;

      await scheduler.forceSyncNow();

      expect(startHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_start',
          channels: expect.any(Array),
          isAutoSync: false
        })
      );
    });

    test('should emit sync complete event', async () => {
      mockSyncExecutor.executeSync.mockResolvedValue({
        messagesCount: 7,
        duration: 1500
      });

      const completeHandler = jest.fn();
      scheduler.onSyncComplete = completeHandler;

      await scheduler.forceSyncNow();

      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_complete',
          messagesCount: 7,
          duration: 1500
        })
      );
    });

    test('should emit sync error event', async () => {
      const syncError = new Error('Sync failed');
      mockSyncExecutor.executeSync.mockRejectedValue(syncError);

      const errorHandler = jest.fn();
      scheduler.onSyncError = errorHandler;

      await expect(scheduler.forceSyncNow()).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_error',
          error: syncError,
          retryCount: 0
        })
      );
    });
  });

  describe('Timer Integration', () => {
    // TC-MK-001: タイマーモック
    test('TC-MK-001: should schedule sync at correct intervals', () => {
      scheduler.start();
      
      expect(scheduler.isRunning()).toBe(true);
      
      // 間隔が経過する前
      jest.advanceTimersByTime(mockSettings.intervalMs - 1000);
      expect(mockSyncExecutor.executeSync).not.toHaveBeenCalled();
      
      // 間隔が経過した後
      jest.advanceTimersByTime(1000);
      expect(mockSyncExecutor.executeSync).toHaveBeenCalled();
    });

    test('should clear timers on stop', () => {
      scheduler.start();
      const timerCount = jest.getTimerCount();
      
      scheduler.stop();
      
      expect(jest.getTimerCount()).toBeLessThan(timerCount);
    });
  });
});