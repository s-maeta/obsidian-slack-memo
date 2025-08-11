# TASK-402: パフォーマンス最適化 - テストケース設計

## テストケース概要

パフォーマンス最適化機能の包括的なテストスイートを設計します。バッチ処理、メモリ効率化、非同期処理最適化、プログレッシブレンダリングの各機能について、性能要件を満たすことを検証します。

## テストカテゴリ

### 1. BatchProcessor テスト
### 2. MemoryManager テスト  
### 3. PerformanceMonitor テスト
### 4. ProgressTracker テスト
### 5. 統合パフォーマンステスト

---

## 1. BatchProcessor テスト

### TC-BP-001: バッチ分割機能
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 大量データの適切なバッチ分割

```typescript
test('should split large dataset into batches correctly', async () => {
  const processor = new BatchProcessor<string>({
    batchSize: 100,
    maxConcurrent: 3
  });
  const items = Array.from({length: 1000}, (_, i) => `item-${i}`);
  
  const batches = processor.createBatches(items);
  
  expect(batches.length).toBe(10);
  expect(batches[0].length).toBe(100);
  expect(batches[9].length).toBe(100);
  expect(batches.reduce((sum, batch) => sum + batch.length, 0)).toBe(1000);
});
```

### TC-BP-002: 並行バッチ実行
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 設定された並行数での適切なバッチ実行

```typescript
test('should execute batches concurrently with limit', async () => {
  const processor = new BatchProcessor<number>({
    batchSize: 10,
    maxConcurrent: 3
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
  await processor.processBatches(items, mockExecutor);
  
  expect(maxConcurrent).toBe(3);
  expect(executedBatches).toHaveLength(50);
  expect(mockExecutor).toHaveBeenCalledTimes(5);
});
```

### TC-BP-003: バッチエラーハンドリング
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 個別バッチエラー時の適切な処理

```typescript
test('should handle batch errors without stopping entire process', async () => {
  const processor = new BatchProcessor<number>({
    batchSize: 10,
    maxConcurrent: 2,
    retryCount: 1
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
  const result = await processor.processBatches(items, mockExecutor);
  
  expect(result.totalProcessed).toBe(20);
  expect(result.totalFailed).toBe(10);
  expect(result.batchErrors).toHaveLength(1);
  expect(mockExecutor).toHaveBeenCalledTimes(4); // 3 + 1 retry
});
```

### TC-BP-004: バッチリトライ機能
**カテゴリ**: 単体テスト  
**優先度**: 中  
**テスト内容**: 失敗バッチの自動リトライ

```typescript
test('should retry failed batches according to configuration', async () => {
  const processor = new BatchProcessor<string>({
    batchSize: 5,
    maxConcurrent: 1,
    retryCount: 2,
    retryDelayMs: 100
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
  const result = await processor.processBatches(items, mockExecutor);
  
  expect(result.totalProcessed).toBe(5);
  expect(mockExecutor).toHaveBeenCalledTimes(3);
  expect(result.retryAttempts).toBe(2);
});
```

### TC-BP-005: バッチキャンセル機能
**カテゴリ**: 単体テスト  
**優先度**: 中  
**テスト内容**: 処理途中でのキャンセル機能

```typescript
test('should cancel batch processing when requested', async () => {
  const processor = new BatchProcessor<number>({
    batchSize: 10,
    maxConcurrent: 1
  });
  
  const mockExecutor = jest.fn().mockImplementation(async (batch: number[]) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, processedItems: batch.length };
  });
  
  const items = Array.from({length: 100}, (_, i) => i);
  const processingPromise = processor.processBatches(items, mockExecutor);
  
  // 500ms後にキャンセル
  setTimeout(() => processor.cancel(), 500);
  
  const result = await processingPromise;
  expect(result.cancelled).toBe(true);
  expect(result.totalProcessed).toBeLessThan(100);
  expect(mockExecutor).toHaveBeenCalledTimes(1);
});
```

---

## 2. MemoryManager テスト

### TC-MM-001: メモリ使用量監視
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: メモリ使用量の正確な監視

```typescript
test('should monitor memory usage accurately', () => {
  const memoryManager = new MemoryManager();
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
```

### TC-MM-002: オブジェクトプーリング
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: オブジェクトプールの効率的な再利用

```typescript
test('should reuse objects efficiently with object pooling', () => {
  const memoryManager = new MemoryManager();
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
```

### TC-MM-003: メモリリーク検出
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: メモリリークの早期検出

```typescript
test('should detect memory leaks', async () => {
  const memoryManager = new MemoryManager({
    leakDetectionEnabled: true,
    leakThresholdMB: 50
  });
  
  const initialMemory = memoryManager.getCurrentUsage();
  let leakDetected = false;
  
  memoryManager.onMemoryLeak((leak) => {
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
```

### TC-MM-004: ガベージコレクション制御
**カテゴリ**: 単体テスト  
**優先度**: 中  
**テスト内容**: 適切なタイミングでのGC実行

```typescript
test('should trigger garbage collection at appropriate times', () => {
  const memoryManager = new MemoryManager({
    gcThresholdMB: 100,
    autoGCEnabled: true
  });
  
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
```

---

## 3. PerformanceMonitor テスト

### TC-PM-001: 処理時間測定
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 各種処理時間の正確な測定

```typescript
test('should measure processing times accurately', async () => {
  const monitor = new PerformanceMonitor();
  
  monitor.startTimer('test-operation');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const elapsed = monitor.endTimer('test-operation');
  
  expect(elapsed).toBeGreaterThanOrEqual(1000);
  expect(elapsed).toBeLessThan(1100);
  
  const metrics = monitor.getMetrics();
  expect(metrics.timers['test-operation']).toEqual(elapsed);
});
```

### TC-PM-002: スループット測定
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 処理スループットの測定

```typescript
test('should measure throughput correctly', () => {
  const monitor = new PerformanceMonitor();
  
  monitor.startThroughputMeasurement('items-processing');
  
  // 100件の処理をシミュレート
  for (let i = 0; i < 100; i++) {
    monitor.recordItem('items-processing');
  }
  
  const throughput = monitor.getThroughput('items-processing');
  expect(throughput.itemsPerSecond).toBeGreaterThan(0);
  expect(throughput.totalItems).toBe(100);
});
```

### TC-PM-003: CPU使用率監視
**カテゴリ**: 統合テスト  
**優先度**: 中  
**テスト内容**: CPU使用率の監視

```typescript
test('should monitor CPU usage during processing', async () => {
  const monitor = new PerformanceMonitor();
  
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
```

### TC-PM-004: メモリ使用量監視
**カテゴリ**: 統合テスト  
**優先度**: 高  
**テスト内容**: 処理中のメモリ使用量変化の監視

```typescript
test('should monitor memory usage during batch processing', async () => {
  const monitor = new PerformanceMonitor();
  
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
```

---

## 4. ProgressTracker テスト

### TC-PT-001: 進捗率計算
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 正確な進捗率の計算

```typescript
test('should calculate progress percentage correctly', () => {
  const tracker = new ProgressTracker({
    totalItems: 1000,
    batchSize: 100
  });
  
  expect(tracker.getProgress()).toBe(0);
  
  tracker.updateProgress(100);
  expect(tracker.getProgress()).toBe(10);
  
  tracker.updateProgress(500);
  expect(tracker.getProgress()).toBe(60);
  
  tracker.updateProgress(1000);
  expect(tracker.getProgress()).toBe(100);
});
```

### TC-PT-002: 残り時間予測
**カテゴリ**: 単体テスト  
**優先度**: 高  
**テスト内容**: 残り処理時間の予測精度

```typescript
test('should estimate remaining time accurately', async () => {
  const tracker = new ProgressTracker({
    totalItems: 1000,
    batchSize: 100
  });
  
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
```

### TC-PT-003: バッチ進捗管理
**カテゴリ**: 単体テスト  
**優先度**: 中  
**テスト内容**: バッチ単位での進捗管理

```typescript
test('should track batch-level progress', () => {
  const tracker = new ProgressTracker({
    totalItems: 1000,
    batchSize: 100
  });
  
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
```

### TC-PT-004: 進捗イベント通知
**カテゴリ**: 単体テスト  
**優先度**: 中  
**テスト内容**: 進捗変更時の適切なイベント発火

```typescript
test('should emit progress events correctly', () => {
  const tracker = new ProgressTracker({
    totalItems: 1000,
    batchSize: 100
  });
  
  const progressEvents: number[] = [];
  const batchEvents: number[] = [];
  
  tracker.onProgressUpdate((progress) => {
    progressEvents.push(progress);
  });
  
  tracker.onBatchCompleted((batchId) => {
    batchEvents.push(batchId);
  });
  
  tracker.updateProgress(100);
  tracker.completeBatch(1, 100);
  
  tracker.updateProgress(200);
  tracker.completeBatch(2, 100);
  
  expect(progressEvents).toEqual([10, 20]);
  expect(batchEvents).toEqual([1, 2]);
});
```

---

## 5. 統合パフォーマンステスト

### TC-IP-001: 大量データ処理テスト
**カテゴリ**: 統合テスト  
**優先度**: 高  
**テスト内容**: 10,000件データの効率的処理

```typescript
test('should process 10000 items efficiently', async () => {
  const performanceSystem = new PerformanceOptimizer({
    batchSize: 100,
    maxConcurrent: 3,
    memoryThresholdMB: 100
  });
  
  const startTime = Date.now();
  const initialMemory = process.memoryUsage().heapUsed;
  
  const items = Array.from({length: 10000}, (_, i) => ({
    id: i,
    data: `test-data-${i}`,
    timestamp: new Date()
  }));
  
  const result = await performanceSystem.process(items, async (batch) => {
    // データ処理のシミュレート
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      success: true,
      processedItems: batch.length,
      results: batch.map(item => ({ ...item, processed: true }))
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
});
```

### TC-IP-002: メモリ効率テスト
**カテゴリ**: パフォーマンステスト  
**優先度**: 高  
**テスト内容**: メモリ使用量の効率性検証

```typescript
test('should maintain memory efficiency during large processing', async () => {
  const performanceSystem = new PerformanceOptimizer({
    batchSize: 100,
    maxConcurrent: 2,
    memoryOptimization: true
  });
  
  const memoryTracker: number[] = [];
  
  // メモリ使用量を1秒ごとに記録
  const memoryInterval = setInterval(() => {
    memoryTracker.push(process.memoryUsage().heapUsed);
  }, 1000);
  
  const largeItems = Array.from({length: 5000}, (_, i) => ({
    id: i,
    largeData: new Array(1000).fill(`data-${i}`)
  }));
  
  await performanceSystem.process(largeItems, async (batch) => {
    // 各アイテムを処理
    return {
      success: true,
      processedItems: batch.length,
      results: batch.map(item => ({ id: item.id, processed: true }))
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
});
```

### TC-IP-003: UI応答性テスト
**カテゴリ**: 統合テスト  
**優先度**: 高  
**テスト内容**: 処理中のUI応答性維持

```typescript
test('should maintain UI responsiveness during processing', async () => {
  const performanceSystem = new PerformanceOptimizer({
    batchSize: 50,
    maxConcurrent: 2,
    uiUpdateInterval: 100
  });
  
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
  
  const items = Array.from({length: 2000}, (_, i) => ({ id: i }));
  
  processingActive = true;
  await performanceSystem.process(items, async (batch) => {
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
});
```

### TC-IP-004: エラー回復テスト
**カテゴリ**: 統合テスト  
**優先度**: 中  
**テスト内容**: 部分的エラー時の適切な回復処理

```typescript
test('should recover gracefully from partial failures', async () => {
  const performanceSystem = new PerformanceOptimizer({
    batchSize: 100,
    maxConcurrent: 2,
    retryCount: 2,
    errorRecovery: true
  });
  
  let processedBatches = 0;
  const failureBatches = [2, 5]; // 2番目と5番目のバッチを失敗させる
  
  const items = Array.from({length: 1000}, (_, i) => ({ id: i }));
  
  const result = await performanceSystem.process(items, async (batch, batchIndex) => {
    processedBatches++;
    
    if (failureBatches.includes(batchIndex)) {
      throw new Error(`Batch ${batchIndex} processing failed`);
    }
    
    return {
      success: true,
      processedItems: batch.length,
      results: batch.map(item => ({ ...item, processed: true }))
    };
  });
  
  // 部分的成功の確認
  expect(result.totalProcessed).toBe(800); // 8バッチ × 100件
  expect(result.totalFailed).toBe(200); // 2バッチ × 100件
  expect(result.successfulBatches).toBe(8);
  expect(result.failedBatches).toBe(2);
  expect(result.retryAttempts).toBeGreaterThan(0);
  
  // エラー詳細の確認
  expect(result.errors).toHaveLength(2);
  expect(result.errors[0].batchIndex).toBe(2);
  expect(result.errors[1].batchIndex).toBe(5);
});
```

### TC-IP-005: 設定動的変更テスト
**カテゴリ**: 統合テスト  
**優先度**: 中  
**テスト内容**: 処理中の設定変更への対応

```typescript
test('should adapt to configuration changes during processing', async () => {
  const performanceSystem = new PerformanceOptimizer({
    batchSize: 100,
    maxConcurrent: 1,
    adaptiveConfiguration: true
  });
  
  const items = Array.from({length: 2000}, (_, i) => ({ id: i }));
  const processingStarted = new Promise(resolve => {
    performanceSystem.onProcessingStart(() => resolve(null));
  });
  
  // 処理開始
  const processingPromise = performanceSystem.process(items, async (batch) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, processedItems: batch.length };
  });
  
  // 処理開始を待機
  await processingStarted;
  
  // 設定を動的に変更
  setTimeout(() => {
    performanceSystem.updateConfiguration({
      batchSize: 50,  // バッチサイズを変更
      maxConcurrent: 3  // 並行数を増加
    });
  }, 1000);
  
  const result = await processingPromise;
  
  // 設定変更が適用されたことを確認
  expect(result.configurationChanges).toBeGreaterThan(0);
  expect(result.finalBatchSize).toBe(50);
  expect(result.finalMaxConcurrent).toBe(3);
  expect(result.totalProcessed).toBe(2000);
});
```

---

## パフォーマンス期待値

### 処理速度要件
- **100件バッチ**: 30秒以内
- **1000件処理**: 10分以内
- **10000件処理**: 30分以内

### メモリ効率要件
- **1000件処理**: メモリ増加100MB以下
- **10000件処理**: メモリ増加500MB以下
- **処理完了後**: メモリリーク10%以下

### UI応答性要件
- **平均応答時間**: 100ms以下
- **最大応答時間**: 200ms以下
- **UI更新間隔**: 100ms以下

## テスト実行計画

### Phase 1: 単体テスト (25ケース)
- BatchProcessor: 5ケース
- MemoryManager: 4ケース  
- PerformanceMonitor: 4ケース
- ProgressTracker: 4ケース
- 各種ユーティリティ: 8ケース

### Phase 2: 統合テスト (8ケース)
- 大量データ処理: 2ケース
- メモリ効率: 2ケース
- UI応答性: 2ケース
- エラー処理: 2ケース

### Phase 3: パフォーマンステスト (12ケース)
- 負荷テスト: 4ケース
- 持続性テスト: 4ケース
- 限界テスト: 4ケース

## 成功基準

### 定量的基準
- **全テスト成功率**: 95%以上
- **パフォーマンス要件**: 100%達成
- **メモリ効率要件**: 100%達成
- **UI応答性要件**: 100%達成

### 定性的基準
- **コード品質**: 保守可能なコード構造
- **テスト品質**: 再現可能で信頼性の高いテスト
- **文書品質**: テスト結果の明確な記録
- **拡張性**: 新機能追加に対応可能

---

**テストケース設計完了日**: 2025-01-11  
**総テストケース数**: 45ケース  
**推定テスト実行時間**: 6時間  
**次フェーズ**: RED (失敗テスト実装)