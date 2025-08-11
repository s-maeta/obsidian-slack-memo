// TASK-402: パフォーマンス最適化 - 型定義

// ===============================
// バッチ処理関連の型定義
// ===============================

export interface BatchProcessorConfig {
  batchSize: number;           // バッチサイズ（デフォルト100）
  maxConcurrent: number;       // 最大並行バッチ数（デフォルト3）
  batchInterval: number;       // バッチ間隔ms（デフォルト3000）
  retryCount: number;          // リトライ回数（デフォルト3）
  retryDelayMs: number;        // リトライ遅延ms（デフォルト1000）
  timeoutMs: number;           // タイムアウトms（デフォルト30000）
}

export interface BatchResult<T> {
  success: boolean;
  processedItems: number;
  results?: T[];
  error?: Error;
  batchIndex?: number;
  retryAttempts?: number;
}

export interface BatchJob<T> {
  id: string;                  // ジョブID
  items: T[];                  // 処理対象アイテム
  batchSize: number;           // バッチサイズ
  status: JobStatus;           // 実行状態
  startTime: Date;             // 開始時刻
  endTime?: Date;              // 終了時刻
  error?: Error;               // エラー情報
  progress: number;            // 進捗率（0-100）
  batchResults: BatchResult<T>[]; // バッチ結果配列
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface BatchProcessingResult<T> {
  totalProcessed: number;
  totalFailed: number;
  successfulBatches: number;
  failedBatches: number;
  retryAttempts: number;
  batchErrors: Array<{batchIndex: number, error: Error}>;
  cancelled: boolean;
  processingTime: number;
  averageProcessingTime: number;
  configurationChanges?: number;
  finalBatchSize?: number;
  finalMaxConcurrent?: number;
}

export type BatchExecutor<T, R> = (
  batch: T[], 
  batchIndex: number, 
  context: BatchContext
) => Promise<BatchResult<R>>;

export interface BatchContext {
  jobId: string;
  totalBatches: number;
  completedBatches: number;
  isCancelled: boolean;
}

export interface IBatchProcessor<T, R = T> {
  processBatches(items: T[], executor: BatchExecutor<T, R>): Promise<BatchProcessingResult<R>>;
  createBatches(items: T[]): T[][];
  cancel(): void;
  updateConfiguration(config: Partial<BatchProcessorConfig>): void;
  onProcessingStart(callback: () => void): void;
  onBatchComplete(callback: (batchIndex: number, result: BatchResult<R>) => void): void;
  onProcessingComplete(callback: (result: BatchProcessingResult<R>) => void): void;
}

// ===============================
// メモリ管理関連の型定義
// ===============================

export interface MemoryManagerConfig {
  leakDetectionEnabled: boolean;
  leakThresholdMB: number;
  gcThresholdMB: number;
  autoGCEnabled: boolean;
  monitoringInterval: number;
}

export interface MemoryMetrics {
  currentUsage: number;
  peakUsage: number;
  initialUsage: number;
  memoryDelta: number;
  gcCount: number;
  leakDetections: number;
  snapshots: Array<{name: string, usage: number, timestamp: Date}>;
}

export interface MemoryLeak {
  leakSize: number;
  threshold: number;
  detectionTime: Date;
  stackTrace?: string;
}

export interface IObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  getPoolSize(): number;
  clear(): void;
}

export interface IMemoryManager {
  getCurrentUsage(): number;
  getPeakUsage(): number;
  getMemoryDelta(): number;
  forceGC(): void;
  checkMemoryLeaks(): void;
  checkMemoryUsage(): void;
  getGCCount(): number;
  createObjectPool<T>(factory: () => T): IObjectPool<T>;
  recordMemorySnapshot(name: string): void;
  getMemoryMetrics(): MemoryMetrics;
  onMemoryLeak(callback: (leak: MemoryLeak) => void): void;
  onGCTriggered(callback: () => void): void;
  startMemoryMonitoring(): void;
  stopMemoryMonitoring(): void;
}

// ===============================
// パフォーマンス監視関連の型定義
// ===============================

export interface PerformanceMetrics {
  totalItems: number;          // 処理対象件数
  processedItems: number;      // 処理完了件数
  failedItems: number;         // 処理失敗件数
  batchesCompleted: number;    // 完了バッチ数
  batchesFailed: number;       // 失敗バッチ数
  averageProcessingTime: number; // 平均処理時間
  memoryUsagePeak: number;     // ピークメモリ使用量
  cpuUsageAverage: number;     // 平均CPU使用率
  timers: Record<string, number>; // 各種タイマー
  throughput: Record<string, ThroughputMetrics>; // スループット情報
}

export interface ThroughputMetrics {
  itemsPerSecond: number;
  totalItems: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface CPUUsageMetrics {
  averageUsage: number;
  peakUsage: number;
  samples: number[];
  monitoringDuration: number;
}

export interface IPerformanceMonitor {
  startTimer(name: string): void;
  endTimer(name: string): number;
  getMetrics(): PerformanceMetrics;
  startThroughputMeasurement(name: string): void;
  recordItem(name: string): void;
  getThroughput(name: string): ThroughputMetrics;
  startCPUMonitoring(): void;
  stopCPUMonitoring(): void;
  getCPUUsage(): CPUUsageMetrics;
  recordMemorySnapshot(name: string): void;
  getMemoryMetrics(): MemoryMetrics;
  startMemoryMonitoring(): void;
  stopMemoryMonitoring(): void;
  reset(): void;
}

// ===============================
// 進捗管理関連の型定義
// ===============================

export interface ProgressTrackerConfig {
  totalItems: number;
  batchSize: number;
  updateInterval?: number;
}

export interface ProgressMetrics {
  totalItems: number;
  processedItems: number;
  progress: number;              // 0-100
  totalBatches: number;
  completedBatches: number;
  estimatedRemainingTime: number; // ms
  averageItemsPerSecond: number;
  startTime: Date;
  elapsedTime: number;
}

export interface BatchProgress {
  batchId: number;
  progress: number;             // 0-100
  completed: boolean;
  startTime?: Date;
  endTime?: Date;
}

export interface IProgressTracker {
  start(): void;
  updateProgress(processedItems: number): void;
  completeBatch(batchId: number, progress: number): void;
  getProgress(): number;
  getTotalBatches(): number;
  getCompletedBatches(): number;
  getBatchProgress(batchId: number): number;
  getEstimatedRemainingTime(): number;
  getProgressMetrics(): ProgressMetrics;
  onProgressUpdate(callback: (progress: number) => void): void;
  onBatchCompleted(callback: (batchId: number) => void): void;
}

// ===============================
// パフォーマンス最適化統合インターフェース
// ===============================

export interface PerformanceOptimizerConfig extends BatchProcessorConfig {
  memoryOptimization: boolean;
  uiUpdateInterval: number;
  adaptiveConfiguration: boolean;
  memoryThresholdMB: number;
}

export interface ProcessingContext<T> {
  jobId: string;
  totalItems: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  memoryManager: IMemoryManager;
  performanceMonitor: IPerformanceMonitor;
  progressTracker: IProgressTracker;
  isCancelled: boolean;
}

export interface ProcessingResult<R> extends BatchProcessingResult<R> {
  memoryMetrics: MemoryMetrics;
  performanceMetrics: PerformanceMetrics;
  progressMetrics: ProgressMetrics;
}

export interface IPerformanceOptimizer<T, R = T> {
  process(items: T[], executor: BatchExecutor<T, R>): Promise<ProcessingResult<R>>;
  updateConfiguration(config: Partial<PerformanceOptimizerConfig>): void;
  cancel(): void;
  onProcessingStart(callback: () => void): void;
  onProgressUpdate(callback: (progress: ProgressMetrics) => void): void;
  onProcessingComplete(callback: (result: ProcessingResult<R>) => void): void;
}

// ===============================
// UIイベント関連の型定義
// ===============================

export interface UIUpdateEvent {
  type: 'progress' | 'batch_complete' | 'error' | 'complete' | 'cancelled';
  timestamp: Date;
  data: any;
}

export interface ProgressUpdateEvent extends UIUpdateEvent {
  type: 'progress';
  data: {
    progress: number;
    processedItems: number;
    totalItems: number;
    currentBatch: number;
    totalBatches: number;
    estimatedRemainingTime: number;
    memoryUsage: number;
    averageSpeed: number;
  };
}

export interface BatchCompleteEvent extends UIUpdateEvent {
  type: 'batch_complete';
  data: {
    batchIndex: number;
    batchSize: number;
    processingTime: number;
    memoryUsage: number;
    success: boolean;
    error?: Error;
  };
}

// ===============================
// テスト用の型定義
// ===============================

export interface TestDataItem {
  id: number;
  data: string;
  timestamp?: Date;
  largeData?: any[];
  processed?: boolean;
}

export interface PerformanceTestResult {
  totalProcessingTime: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
  averageResponseTime: number;
  maxResponseTime: number;
  throughputItemsPerSecond: number;
  memoryLeakDetected: boolean;
  uiResponsive: boolean;
  testsPassed: number;
  testsTotal: number;
}

export interface LoadTestConfig {
  itemCount: number;
  batchSize: number;
  maxConcurrent: number;
  processingTimeMs: number;
  memoryThresholdMB: number;
  uiResponseThresholdMs: number;
}

// ===============================
// エラー関連の型定義
// ===============================

export class BatchProcessingError extends Error {
  constructor(
    message: string,
    public batchIndex: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'BatchProcessingError';
  }
}

export class MemoryLimitExceededError extends Error {
  constructor(
    message: string,
    public currentUsage: number,
    public limit: number
  ) {
    super(message);
    this.name = 'MemoryLimitExceededError';
  }
}

export class PerformanceThresholdExceededError extends Error {
  constructor(
    message: string,
    public metricName: string,
    public actualValue: number,
    public threshold: number
  ) {
    super(message);
    this.name = 'PerformanceThresholdExceededError';
  }
}