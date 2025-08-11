// TASK-402: パフォーマンス最適化 - テストスイート
// REDフェーズ: 失敗するテストの実装

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  BatchProcessor,
  MemoryManager,
  PerformanceMonitor,
  ProgressTracker,
  PerformanceOptimizer
} from '../performance-optimizer';
import {
  BatchProcessorConfig,
  MemoryManagerConfig,
  PerformanceOptimizerConfig,
  TestDataItem,
  BatchExecutor
} from '../performance-types';

// ===============================
// BatchProcessor テスト
// ===============================

describe('BatchProcessor', () => {
  let processor: BatchProcessor<TestDataItem>;
  let defaultConfig: BatchProcessorConfig;

  beforeEach(() => {
    defaultConfig = {
      batchSize: 100,
      maxConcurrent: 3,
      batchInterval: 1000,
      retryCount: 2,
      retryDelayMs: 500,
      timeoutMs: 30000
    };
    processor = new BatchProcessor<TestDataItem>(defaultConfig);
  });

  afterEach(() => {
    processor?.cancel();
  });

  test('TC-BP-001: should split large dataset into batches correctly', async () => {
    const items = Array.from({length: 1000}, (_, i) => ({
      id: i,
      data: `item-${i}`
    }));
    
    const batches = processor.createBatches(items);
    
    expect(batches.length).toBe(10);
    expect(batches[0].length).toBe(100);
    expect(batches[9].length).toBe(100);
    expect(batches.reduce((sum: number, batch: any[]) => sum + batch.length, 0)).toBe(1000);
  });

  test('TC-BP-002: should execute batches concurrently with limit', async () => {
    const processor = new BatchProcessor<number>({
      batchSize: 10,
      maxConcurrent: 3,
      batchInterval: 0,
      retryCount: 0,
      retryDelayMs: 0,
      timeoutMs: 5000
    });
    
    const executedBatches: number[] = [];
    let concurrentCount = 0;
    let maxConcurrent = 0;
    
    const mockExecutor = jest.fn().mockImplementation(async (batch: number[]) => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await new Promise(resolve => setTimeout(resolve, 100));
      executedBatches.push(...batch);
      concurrentCount--;
      return { success: true, processedItems: batch.length };
    });
    
    const items = Array.from({length: 50}, (_, i) => i);
    await processor.processBatches(items, mockExecutor as any);
    
    expect(maxConcurrent).toBe(3);
    expect(executedBatches).toHaveLength(50);
    expect(mockExecutor).toHaveBeenCalledTimes(5);
  });

  test('TC-BP-003: should handle batch errors without stopping entire process', async () => {
    const processor = new BatchProcessor<number>({
      batchSize: 10,
      maxConcurrent: 2,
      batchInterval: 0,
      retryCount: 1,
      retryDelayMs: 100,
      timeoutMs: 5000
    });
    
    let callCount = 0;
    const mockExecutor = jest.fn().mockImplementation(async (batch: number[]) => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Batch processing failed');
      }
      return { success: true, processedItems: batch.length };
    });
    
    const items = Array.from({length: 30}, (_, i) => i);
    const result = await processor.processBatches(items, mockExecutor as any);
    
    expect(result.totalProcessed).toBe(20);
    expect(result.totalFailed).toBe(10);
    expect(result.batchErrors).toHaveLength(1);
    expect(mockExecutor).toHaveBeenCalledTimes(4); // 3 + 1 retry
  });

  test('TC-BP-004: should retry failed batches according to configuration', async () => {
    const processor = new BatchProcessor<string>({
      batchSize: 5,
      maxConcurrent: 1,
      batchInterval: 0,
      retryCount: 2,
      retryDelayMs: 100,
      timeoutMs: 5000
    });
    
    let attempt = 0;
    const mockExecutor = jest.fn().mockImplementation(async (batch: string[]) => {
      attempt++;
      if (attempt <= 2) {
        throw new Error(`Attempt ${attempt} failed`);
      }
      return { success: true, processedItems: batch.length };
    });
    
    const items = ['a', 'b', 'c', 'd', 'e'];
    const result = await processor.processBatches(items, mockExecutor as any);
    
    expect(result.totalProcessed).toBe(5);
    expect(mockExecutor).toHaveBeenCalledTimes(3);
    expect(result.retryAttempts).toBe(2);
  });

  test('TC-BP-005: should cancel batch processing when requested', async () => {
    const processor = new BatchProcessor<number>({
      batchSize: 10,
      maxConcurrent: 1,
      batchInterval: 0,
      retryCount: 0,
      retryDelayMs: 0,
      timeoutMs: 10000
    });
    
    const mockExecutor = jest.fn().mockImplementation(async (batch: number[]) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, processedItems: batch.length };
    });
    
    const items = Array.from({length: 100}, (_, i) => i);
    const processingPromise = processor.processBatches(items, mockExecutor as any);
    
    // 500ms後にキャンセル
    setTimeout(() => processor.cancel(), 500);
    
    const result = await processingPromise;
    expect(result.cancelled).toBe(true);
    expect(result.totalProcessed).toBeLessThan(100);
    expect(mockExecutor).toHaveBeenCalledTimes(1);
  });
});

// ===============================
// MemoryManager テスト
// ===============================

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let defaultConfig: MemoryManagerConfig;

  beforeEach(() => {
    defaultConfig = {
      leakDetectionEnabled: true,
      leakThresholdMB: 50,
      gcThresholdMB: 100,
      autoGCEnabled: true,
      monitoringInterval: 1000
    };
    memoryManager = new MemoryManager(defaultConfig);
  });

  afterEach(() => {
    memoryManager?.stopMemoryMonitoring();
  });

  test('TC-MM-001: should monitor memory usage accurately', () => {
    const initialMemory = memoryManager.getCurrentUsage();
    
    // 大量のオブジェクトを作成
    const largeArray = Array.from({length: 100000}, (_, i) => ({
      id: i,
      data: `data-${i}`.repeat(100)
    }));
    
    const peakMemory = memoryManager.getPeakUsage();
    
    expect(peakMemory).toBeGreaterThan(initialMemory);
    expect(memoryManager.getMemoryDelta()).toBeGreaterThan(0);
    
    // オブジェクトを削除
    largeArray.length = 0;
    memoryManager.forceGC();
    
    const finalMemory = memoryManager.getCurrentUsage();
    expect(finalMemory).toBeLessThan(peakMemory);
  });

  test('TC-MM-002: should reuse objects efficiently with object pooling', () => {
    const pool = memoryManager.createObjectPool<{id: number, data: string}>(() => ({
      id: 0,
      data: ''
    }));
    
    const initialMemory = memoryManager.getCurrentUsage();
    
    // オブジェクトを大量取得・返却
    for (let i = 0; i < 10000; i++) {
      const obj = pool.acquire();
      obj.id = i;
      obj.data = `data-${i}`;
      pool.release(obj);
    }
    
    const finalMemory = memoryManager.getCurrentUsage();
    expect(finalMemory - initialMemory).toBeLessThan(1000000); // 1MB以下
    expect(pool.getPoolSize()).toBeGreaterThan(0);
  });

  test('TC-MM-003: should detect memory leaks', async () => {
    const memoryManager = new MemoryManager({
      leakDetectionEnabled: true,
      leakThresholdMB: 50,
      gcThresholdMB: 200,
      autoGCEnabled: false,
      monitoringInterval: 500
    });
    
    let leakDetected = false;
    
    memoryManager.onMemoryLeak((leak: any) => {
      leakDetected = true;
      expect(leak.leakSize).toBeGreaterThan(50 * 1024 * 1024);
    });
    
    // 意図的にメモリリークを作成
    const leakyArray: any[] = [];
    for (let i = 0; i < 100000; i++) {
      leakyArray.push({
        id: i,
        largeData: new Array(1000).fill(i)
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    memoryManager.checkMemoryLeaks();
    
    expect(leakDetected).toBe(true);
  });

  test('TC-MM-004: should trigger garbage collection at appropriate times', () => {
    let gcTriggered = false;
    memoryManager.onGCTriggered(() => {
      gcTriggered = true;
    });
    
    // メモリを大量消費
    const largeData = Array.from({length: 200000}, (_, i) => ({
      id: i,
      data: new Array(1000).fill(`data-${i}`)
    }));
    
    memoryManager.checkMemoryUsage();
    
    expect(gcTriggered).toBe(true);
    expect(memoryManager.getGCCount()).toBeGreaterThan(0);
  });
});

// ===============================
// PerformanceMonitor テスト
// ===============================

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  test('TC-PM-001: should measure processing times accurately', async () => {
    monitor.startTimer('test-operation');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const elapsed = monitor.endTimer('test-operation');
    
    expect(elapsed).toBeGreaterThanOrEqual(1000);
    expect(elapsed).toBeLessThan(1100);
    
    const metrics = monitor.getMetrics();
    expect(metrics.timers['test-operation']).toEqual(elapsed);
  });

  test('TC-PM-002: should measure throughput correctly', () => {
    monitor.startThroughputMeasurement('items-processing');
    
    // 100件の処理をシミュレート
    for (let i = 0; i < 100; i++) {
      monitor.recordItem('items-processing');
    }
    
    const throughput = monitor.getThroughput('items-processing');
    expect(throughput.itemsPerSecond).toBeGreaterThan(0);
    expect(throughput.totalItems).toBe(100);
  });

  test('TC-PM-003: should monitor CPU usage during processing', async () => {
    monitor.startCPUMonitoring();
    
    // CPU集約的な処理
    const result = Array.from({length: 1000000}, (_, i) => Math.sqrt(i))
      .reduce((sum, val) => sum + val, 0);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const cpuUsage = monitor.getCPUUsage();
    expect(cpuUsage.averageUsage).toBeGreaterThan(0);
    expect(cpuUsage.peakUsage).toBeGreaterThan(cpuUsage.averageUsage);
    
    monitor.stopCPUMonitoring();
  });

  test('TC-PM-004: should monitor memory usage during batch processing', async () => {
    monitor.startMemoryMonitoring();
    
    // バッチ処理をシミュレート
    for (let batch = 0; batch < 10; batch++) {
      const batchData = Array.from({length: 10000}, (_, i) => ({
        id: batch * 10000 + i,
        data: `batch-${batch}-item-${i}`
      }));
      
      // 処理中のメモリ使用量を記録
      monitor.recordMemorySnapshot(`batch-${batch}`);
      
      // バッチ処理完了後にクリーンアップ
      batchData.length = 0;
    }
    
    const memoryMetrics = monitor.getMemoryMetrics();
    expect(memoryMetrics.snapshots).toHaveLength(10);
    expect(memoryMetrics.peakUsage).toBeGreaterThan(memoryMetrics.initialUsage);
    
    monitor.stopMemoryMonitoring();
  });
});

// ===============================
// ProgressTracker テスト
// ===============================

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker({
      totalItems: 1000,
      batchSize: 100
    });
  });

  test('TC-PT-001: should calculate progress percentage correctly', () => {
    expect(tracker.getProgress()).toBe(0);
    
    tracker.updateProgress(100);
    expect(tracker.getProgress()).toBe(10);
    
    tracker.updateProgress(500);
    expect(tracker.getProgress()).toBe(50);
    
    tracker.updateProgress(1000);
    expect(tracker.getProgress()).toBe(100);
  });

  test('TC-PT-002: should estimate remaining time accurately', async () => {
    tracker.start();
    
    // 100件処理（1秒）
    await new Promise(resolve => setTimeout(resolve, 1000));
    tracker.updateProgress(100);
    
    const remainingTime = tracker.getEstimatedRemainingTime();
    expect(remainingTime).toBeGreaterThan(8000); // 約9秒
    expect(remainingTime).toBeLessThan(10000);
    
    // さらに200件処理（2秒）
    await new Promise(resolve => setTimeout(resolve, 2000));
    tracker.updateProgress(300);
    
    const updatedRemainingTime = tracker.getEstimatedRemainingTime();
    expect(updatedRemainingTime).toBeLessThan(remainingTime);
  });

  test('TC-PT-003: should track batch-level progress', () => {
    expect(tracker.getTotalBatches()).toBe(10);
    expect(tracker.getCompletedBatches()).toBe(0);
    
    tracker.completeBatch(1, 100);
    expect(tracker.getCompletedBatches()).toBe(1);
    expect(tracker.getBatchProgress(1)).toBe(100);
    
    tracker.completeBatch(2, 75); // 部分完了
    expect(tracker.getCompletedBatches()).toBe(1);
    expect(tracker.getBatchProgress(2)).toBe(75);
    
    tracker.completeBatch(2, 100);
    expect(tracker.getCompletedBatches()).toBe(2);
  });

  test('TC-PT-004: should emit progress events correctly', () => {
    const progressEvents: number[] = [];
    const batchEvents: number[] = [];
    
    tracker.onProgressUpdate((progress: any) => {
      progressEvents.push(progress);
    });
    
    tracker.onBatchCompleted((batchId: any) => {
      batchEvents.push(batchId);
    });
    
    tracker.updateProgress(100);
    tracker.completeBatch(1, 100);
    
    tracker.updateProgress(200);
    tracker.completeBatch(2, 100);
    
    expect(progressEvents).toEqual([10, 20]);
    expect(batchEvents).toEqual([1, 2]);
  });
});

// ===============================
// 統合パフォーマンステスト
// ===============================

describe('PerformanceOptimizer Integration', () => {
  let performanceSystem: PerformanceOptimizer<TestDataItem>;
  
  beforeEach(() => {
    const config: PerformanceOptimizerConfig = {
      batchSize: 100,
      maxConcurrent: 3,
      batchInterval: 1000,
      retryCount: 2,
      retryDelayMs: 500,
      timeoutMs: 30000,
      memoryOptimization: true,
      uiUpdateInterval: 100,
      adaptiveConfiguration: true,
      memoryThresholdMB: 100
    };
    performanceSystem = new PerformanceOptimizer<TestDataItem>(config);
  });

  afterEach(() => {
    performanceSystem?.cancel();
  });

  test('TC-IP-001: should process 10000 items efficiently', async () => {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;
    
    const items = Array.from({length: 10000}, (_, i) => ({
      id: i,
      data: `test-data-${i}`,
      timestamp: new Date()
    }));
    
    const result = await performanceSystem.process(items, async (batch: any) => {
      // データ処理のシミュレート
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        success: true,
        processedItems: batch.length,
        results: batch.map((item: any) => ({ ...item, processed: true }))
      };
    });
    
    const endTime = Date.now();
    const finalMemory = process.memoryUsage().heapUsed;
    const processingTime = endTime - startTime;
    const memoryIncrease = finalMemory - initialMemory;
    
    // パフォーマンス要件の検証
    expect(result.totalProcessed).toBe(10000);
    expect(processingTime).toBeLessThan(600000); // 10分以内
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB以下
    expect(result.averageProcessingTime).toBeLessThan(30000); // 30秒/100件
  }, 700000); // 10分のタイムアウト

  test('TC-IP-002: should maintain memory efficiency during large processing', async () => {
    const memoryTracker: number[] = [];
    
    // メモリ使用量を1秒ごとに記録
    const memoryInterval = setInterval(() => {
      memoryTracker.push(process.memoryUsage().heapUsed);
    }, 1000);
    
    const largeItems = Array.from({length: 5000}, (_, i) => ({
      id: i,
      data: `data-${i}`,
      largeData: new Array(1000).fill(`data-${i}`)
    }));
    
    await performanceSystem.process(largeItems, async (batch: any) => {
      // 各アイテムを処理
      return {
        success: true,
        processedItems: batch.length,
        results: batch.map((item: any) => ({ id: item.id, processed: true }))
      };
    });
    
    clearInterval(memoryInterval);
    
    // メモリ使用量の増加が線形を超えないことを確認
    const maxMemory = Math.max(...memoryTracker);
    const minMemory = Math.min(...memoryTracker);
    const memoryIncrease = maxMemory - minMemory;
    
    expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB以下
    
    // 処理完了後のメモリリークチェック
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalMemory = process.memoryUsage().heapUsed;
    expect(finalMemory).toBeLessThan(maxMemory * 1.1); // 10%以内の残存
  }, 300000); // 5分のタイムアウト

  test('TC-IP-003: should maintain UI responsiveness during processing', async () => {
    const uiResponseTimes: number[] = [];
    let processingActive = false;
    
    // UI応答時間測定関数
    const measureUIResponse = () => {
      const start = performance.now();
      return new Promise(resolve => {
        setTimeout(() => {
          const responseTime = performance.now() - start;
          if (processingActive) {
            uiResponseTimes.push(responseTime);
          }
          resolve(responseTime);
        }, 0);
      });
    };
    
    // UI応答時間を定期測定
    const uiTestInterval = setInterval(() => {
      measureUIResponse();
    }, 50);
    
    const items = Array.from({length: 2000}, (_, i) => ({ id: i, data: `item-${i}` }));
    
    processingActive = true;
    await performanceSystem.process(items, async (batch: any) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { success: true, processedItems: batch.length };
    });
    processingActive = false;
    
    clearInterval(uiTestInterval);
    
    // UI応答時間が許容範囲内であることを確認
    const averageResponseTime = uiResponseTimes.reduce((a, b) => a + b, 0) / uiResponseTimes.length;
    const maxResponseTime = Math.max(...uiResponseTimes);
    
    expect(averageResponseTime).toBeLessThan(100); // 100ms以下
    expect(maxResponseTime).toBeLessThan(200); // 200ms以下
    expect(uiResponseTimes.length).toBeGreaterThan(10); // 十分なサンプル数
  }, 180000); // 3分のタイムアウト

  test('TC-IP-004: should recover gracefully from partial failures', async () => {
    let processedBatches = 0;
    const failureBatches = [2, 5]; // 2番目と5番目のバッチを失敗させる
    
    const items = Array.from({length: 1000}, (_, i) => ({ id: i, data: `item-${i}` }));
    
    const result = await performanceSystem.process(items, async (batch: any, batchIndex: any) => {
      processedBatches++;
      
      if (failureBatches.includes(batchIndex)) {
        throw new Error(`Batch ${batchIndex} processing failed`);
      }
      
      return {
        success: true,
        processedItems: batch.length,
        results: batch.map((item: any) => ({ ...item, processed: true }))
      };
    });
    
    // 部分的成功の確認
    expect(result.totalProcessed).toBe(800); // 8バッチ × 100件
    expect(result.totalFailed).toBe(200); // 2バッチ × 100件
    expect(result.successfulBatches).toBe(8);
    expect(result.failedBatches).toBe(2);
    expect(result.retryAttempts).toBeGreaterThan(0);
    
    // エラー詳細の確認
    expect(result.batchErrors).toHaveLength(2);
    expect(result.batchErrors[0].batchIndex).toBe(2);
    expect(result.batchErrors[1].batchIndex).toBe(5);
  });

  test('TC-IP-005: should adapt to configuration changes during processing', async () => {
    const items = Array.from({length: 2000}, (_, i) => ({ id: i, data: `item-${i}` }));
    
    let processingStarted = false;
    performanceSystem.onProcessingStart(() => {
      processingStarted = true;
    });
    
    // 処理開始
    const processingPromise = performanceSystem.process(items, async (batch: any) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, processedItems: batch.length };
    });
    
    // 処理開始を待機
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (processingStarted) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
    });
    
    // 設定を動的に変更
    setTimeout(() => {
      performanceSystem.updateConfiguration({
        batchSize: 50,  // バッチサイズを変更
        maxConcurrent: 5  // 並行数を増加
      });
    }, 1000);
    
    const result = await processingPromise;
    
    // 設定変更が適用されたことを確認
    expect(result.configurationChanges).toBeGreaterThan(0);
    expect(result.finalBatchSize).toBe(50);
    expect(result.finalMaxConcurrent).toBe(5);
    expect(result.totalProcessed).toBe(2000);
  });
});