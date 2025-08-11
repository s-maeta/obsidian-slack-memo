// TASK-501: 統合テストスイート - テストフレームワーク
// REDフェーズ: 統合テストフレームワーク実装

import { MockObsidianEnvironment } from './mock-obsidian';
import { MockSlackEnvironment } from './mock-slack';
import { TestDataGenerator } from './test-data';

export interface IntegrationTestConfig {
  obsidian: MockObsidianEnvironment;
  slack: MockSlackEnvironment;
  cleanState: boolean;
  timeout?: number;
}

export interface SyncResult {
  success: boolean;
  totalProcessed: number;
  newMessagesCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: Array<{
    type: string;
    message: string;
    originalMessage?: any;
  }>;
  partialSuccess?: boolean;
  skippedCount?: number;
  retryAttempts: number;
  retryDuration: number;
  processingTime: number;
  trigger?: 'manual' | 'auto' | 'command';
  channel?: string;
  backupCreated?: boolean;
  error?: {
    type: string;
    code?: string;
    message: string;
  };
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface ChannelMapping {
  slackChannel: string;
  obsidianPath: string;
  format?: string;
}

export interface ConfigResult {
  success: boolean;
  mappings: ChannelMapping[];
  error?: string;
}

/**
 * 統合テストフレームワーク
 * E2E、ユーザーフロー、エラーシナリオテストを統一的に実行
 */
export class IntegrationTestFramework {
  private obsidianEnv!: MockObsidianEnvironment;
  private slackEnv!: MockSlackEnvironment;
  private testData!: TestDataGenerator;
  private isInitialized: boolean = false;
  private activeSyncOperations: Set<Promise<any>> = new Set();
  private performanceProfiler?: PerformanceProfiler;
  private errorHandler: ErrorHandler;
  private retryManager: RetryManager;
  private eventBus: TestEventBus;

  constructor() {
    this.errorHandler = new ErrorHandler();
    this.retryManager = new RetryManager();
    this.eventBus = new TestEventBus();
  }

  async initialize(config: {
    obsidian: MockObsidianEnvironment;
    slack: MockSlackEnvironment;
    cleanState?: boolean;
  }): Promise<void> {
    try {
      this.obsidianEnv = config.obsidian;
      this.slackEnv = config.slack;
      this.testData = new TestDataGenerator();
      
      if (config.cleanState !== false) {
        await Promise.all([
          this.obsidianEnv.resetToCleanState(),
          this.slackEnv.resetToCleanState()
        ]);
      }
      
      this.isInitialized = true;
      this.eventBus.emit('framework-initialized', { config });
    } catch (error) {
      throw new InitializationError(`Framework initialization failed: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // 進行中の操作をすべて完了または中止
      if (this.activeSyncOperations.size > 0) {
        await Promise.allSettled(Array.from(this.activeSyncOperations));
        this.activeSyncOperations.clear();
      }
      
      await Promise.all([
        this.obsidianEnv?.cleanup(),
        this.slackEnv?.cleanup()
      ]);
      
      this.performanceProfiler?.stop();
      this.isInitialized = false;
      this.eventBus.emit('framework-cleaned', {});
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  private validateEnvironment(): void {
    if (!this.isInitialized) {
      throw new EnvironmentError('Framework not initialized. Call initialize() first.');
    }
  }

  private async preflightCheck(): Promise<void> {
    const checks = [
      this.checkObsidianConnection(),
      this.checkSlackConnection(),
      this.checkSystemResources()
    ];
    
    const results = await Promise.allSettled(checks);
    const failures = results.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      throw new PreflightError(`Preflight checks failed: ${failures.length} errors`);
    }
  }

  private async checkObsidianConnection(): Promise<void> {
    const app = await this.obsidianEnv.getApp();
    if (!app) {
      throw new Error('Obsidian app not available');
    }
  }

  private async checkSlackConnection(): Promise<void> {
    try {
      await this.slackEnv.auth_test();
    } catch (error) {
      throw new Error(`Slack connection failed: ${error.message}`);
    }
  }

  private async checkSystemResources(): Promise<void> {
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > 1024 * 1024 * 1024) { // 1GB
      console.warn('High memory usage detected:', memoryUsage);
    }
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 100 * 1024 * 1024; // 100MB default
  }

  async executeSync(): Promise<SyncResult> {
    this.validateEnvironment();
    
    try {
      await this.preflightCheck();
      const syncPromise = this.performSyncWithRetry();
      this.activeSyncOperations.add(syncPromise);
      
      const result = await syncPromise;
      this.activeSyncOperations.delete(syncPromise);
      
      await this.postSyncValidation(result);
      this.eventBus.emit('sync-completed', result);
      return result;
      
    } catch (error) {
      const errorInfo = this.analyzeError(error);
      await this.handleSyncError(errorInfo);
      
      return {
        success: false,
        error: errorInfo.message,
        errorType: errorInfo.type,
        recoverySuggestions: errorInfo.recovery,
        partialResults: await this.getPartialResults()
      };
    }
  }

  private async performSyncWithRetry(): Promise<SyncResult> {
    return await this.retryManager.executeWithRetry(
      () => this.performActualSync(),
      {
        maxAttempts: 3,
        baseDelay: 1000,
        shouldRetry: (error: Error, attempt: number) => {
          return attempt < 3 && this.isRetryableError(error);
        },
        calculateDelay: (attempt: number) => Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      }
    );
  }

  private async performActualSync(): Promise<SyncResult> {
    const startTime = Date.now();
    const messages = this.slackEnv.getAllMessages();
    
    if (messages.length > 0) {
      await this.createSyncedFiles(messages);
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      totalProcessed: messages.length,
      processingTime,
      filesCreated: await this.obsidianEnv.getCreatedFiles().then(files => files.length),
      timestamp: new Date().toISOString()
    };
  }

  private async createSyncedFiles(messages: MockSlackMessage[]): Promise<void> {
    const batchSize = 50;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await this.processBatch(batch);
    }
  }

  private async processBatch(messages: MockSlackMessage[]): Promise<void> {
    const processed = await Promise.allSettled(
      messages.map(msg => this.processMessage(msg))
    );
    
    const failures = processed.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`Batch processing: ${failures.length} failures out of ${messages.length} messages`);
    }
  }

  private async processMessage(message: MockSlackMessage): Promise<void> {
    const filename = `slack-${message.channel || 'unknown'}-${message.ts}.md`;
    const content = this.formatMessageContent(message);
    await this.obsidianEnv.createFile(filename, content);
  }

  private formatMessageContent(message: MockSlackMessage): string {
    return `# Slack Message

**User:** ${message.user}
**Timestamp:** ${new Date(parseFloat(message.ts) * 1000).toISOString()}
**Channel:** ${message.channel || 'Unknown'}

## Content

${message.text}

${message.files ? `\n## Files\n${message.files.map(f => `- ${f.name}`).join('\n')}` : ''}
`;
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = ['Network error', 'Rate limit', 'Timeout'];
    return retryableErrors.some(pattern => error.message.includes(pattern));
  }

  private analyzeError(error: any): ErrorAnalysis {
    if (error.message?.includes('Network')) {
      return {
        type: 'network',
        message: error.message,
        recovery: ['Check network connection', 'Retry operation', 'Wait and retry']
      };
    }
    
    if (error.message?.includes('Rate limit')) {
      return {
        type: 'rate_limit',
        message: error.message,
        recovery: ['Wait for rate limit reset', 'Reduce request frequency']
      };
    }
    
    return {
      type: 'unknown',
      message: error.message || 'Unknown error occurred',
      recovery: ['Check logs', 'Restart operation', 'Contact support']
    };
  }

  private async handleSyncError(errorInfo: ErrorAnalysis): Promise<void> {
    this.eventBus.emit('sync-error', errorInfo);
    console.error(`Sync error (${errorInfo.type}):`, errorInfo.message);
    console.log('Recovery suggestions:', errorInfo.recovery);
  }

  private async getPartialResults(): Promise<any> {
    try {
      const files = await this.obsidianEnv.getCreatedFiles();
      return { filesCreated: files.length };
    } catch {
      return {};
    }
  }

  private async postSyncValidation(result: SyncResult): Promise<void> {
    if (!result.success) {
      throw new ValidationError('Sync result validation failed');
    }
    
    // 作成されたファイルの整合性チェック
    const files = await this.obsidianEnv.getCreatedFiles();
    if (files.length === 0 && result.totalProcessed > 0) {
      console.warn('No files created despite processing messages');
    }
  }

  async getProgressIndicator(): Promise<ProgressIndicator> {
    const currentSyncs = this.activeSyncOperations.size;
    const totalChannels = this.slackEnv.getAvailableChannels().length;
    const percentage = totalChannels > 0 ? (currentSyncs / totalChannels) * 100 : 0;
    
    return {
      current: currentSyncs,
      total: totalChannels,
      percentage: Math.round(percentage),
      estimatedTimeRemaining: this.calculateEstimatedTime(currentSyncs, totalChannels),
      operationDetails: this.getActiveOperationDetails()
    };
  }

  private calculateEstimatedTime(current: number, total: number): number {
    if (current === 0) return 0;
    const averageTime = 5000; // 5秒per operation (estimated)
    const remaining = total - current;
    return remaining * averageTime;
  }

  private getActiveOperationDetails(): string[] {
    return Array.from(this.activeSyncOperations).map((_, index) => `Sync operation ${index + 1}`);
  }

  // UI Component Methods (Enhanced)
  async openCommandPalette(): Promise<CommandPalette> {
    const palette = new MockCommandPalette();
    palette.setCommands([
      'Slack: Manual Sync',
      'Slack: Setup OAuth',
      'Slack: View Sync Status',
      'Slack: Open Settings',
      'Slack: Clear Cache',
      'Slack: View Sync History'
    ]);
    return palette;
  }

  async getSettingsModal(): Promise<SettingsModal> {
    const modal = new MockSettingsModal();
    const currentSettings = await this.obsidianEnv.getPluginSettings();
    modal.loadSettings(currentSettings);
    return modal;
  }

  async getStatusModal(): Promise<StatusModal> {
    const modal = new MockStatusModal();
    const lastSync = await this.getLastSyncResult();
    modal.updateStatus(lastSync);
    return modal;
  }

  async getChannelSelector(): Promise<ChannelSelector> {
    const selector = new MockChannelSelector();
    const channels = this.slackEnv.getAvailableChannels();
    selector.setChannels(channels);
    return selector;
  }

  async getSettingsTab(): Promise<SettingsTab> {
    const tab = new MockSettingsTab();
    tab.setVisible(true);
    return tab;
  }

  // Configuration Methods
  async applyConfiguration(config: any): Promise<void> {
    await this.obsidianEnv.savePluginSettings(config);
    this.eventBus.emit('configuration-applied', config);
  }

  async getPluginSettings(): Promise<any> {
    return await this.obsidianEnv.getPluginSettings();
  }

  // Plugin Management
  async enablePlugin(): Promise<Plugin> {
    const plugin = new MockPlugin();
    plugin.setLoaded(true);
    return plugin;
  }

  // OAuth Methods
  async executeOAuthFlow(options: { userApproval: boolean; validToken: boolean }): Promise<OAuthResult> {
    if (!options.userApproval) {
      return { success: false, error: 'User denied authorization' };
    }
    
    const result = await this.slackEnv.simulateOAuthFlow();
    return {
      success: options.validToken && result.success,
      token: result.token,
      error: !options.validToken ? 'Invalid token received' : result.error
    };
  }

  // Scheduler Methods
  async enableAutoSync(options: any): Promise<void> {
    await this.applyConfiguration({ 
      autoSync: true, 
      interval: options.interval || 300000 
    });
  }

  async getScheduler(): Promise<MockScheduler> {
    const scheduler = new MockScheduler();
    const settings = await this.getPluginSettings();
    scheduler.setInterval(settings.interval || 300000);
    return scheduler;
  }

  async getLastSyncResult(): Promise<SyncResult> {
    return {
      success: true,
      totalProcessed: 10,
      processingTime: 2000,
      filesCreated: 5,
      timestamp: new Date().toISOString()
    };
  }

  // Monitoring Methods
  async startLongTermMonitoring(): Promise<LongTermMonitor> {
    const monitor = new MockLongTermMonitor();
    
    monitor.startMetricsCollection({
      cpuUsage: true,
      memoryTracking: true,
      networkLatency: true,
      operationTiming: true
    });
    
    // Set realistic alerts
    monitor.setAlerts({
      memoryThreshold: 512 * 1024 * 1024, // 512MB
      responseTimeThreshold: 10000, // 10 seconds
      errorRateThreshold: 0.05 // 5%
    });
    
    return monitor;
  }

  async getErrorLog(): Promise<ErrorLog> {
    const log = new MockErrorLog();
    log.addEntry({
      timestamp: new Date(),
      level: 'info',
      message: 'Test log entry',
      details: {}
    });
    return log;
  }

  async getRetryIndicator(): Promise<RetryIndicator> {
    const indicator = new MockRetryIndicator();
    indicator.setRetryCount(0);
    indicator.setMaxRetries(3);
    return indicator;
  }

  // Error Handling Methods
  async getAuthErrorModal(): Promise<AuthErrorModal> {
    const modal = new MockAuthErrorModal();
    const errorType = this.slackEnv.getAuthErrorType();
    modal.setErrorType(errorType);
    return modal;
  }

  async getOAuthWindow(): Promise<OAuthWindow> {
    const window = new MockOAuthWindow();
    window.setUrl('https://slack.com/oauth/v2/authorize?...');
    return window;
  }

  async getErrorModal(): Promise<ErrorModal> {
    const modal = new MockErrorModal();
    modal.setVisible(false);
    return modal;
  }

  // Setup Methods
  async setupCompletedEnvironment(): Promise<void> {
    // Initialize with realistic test data
    const defaultMessages = this.testData.generateMessages(10);
    this.slackEnv.addChannelMessages('#general', defaultMessages);
    
    // Setup plugin in ready state
    await this.obsidianEnv.savePluginSettings({
      slackToken: 'xoxp-test-token',
      selectedChannels: ['#general'],
      autoSync: false,
      syncInterval: 300000
    });
  }

  async getStorageManager(): Promise<StorageManager> {
    const manager = new MockStorageManager();
    manager.setAvailableSpace(1024 * 1024 * 1024); // 1GB
    manager.setUsedSpace(100 * 1024 * 1024); // 100MB
    return manager;
  }
}

// Enhanced Types and Interfaces
interface ProgressIndicator {
  current: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining: number;
  operationDetails: string[];
}

interface ErrorAnalysis {
  type: string;
  message: string;
  recovery: string[];
}

interface RetryStrategy {
  maxAttempts: number;
  baseDelay?: number;
  shouldRetry: (error: Error, attempt: number) => boolean;
  calculateDelay: (attempt: number) => number;
}

// Enhanced Error Classes
class InitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitializationError';
  }
}

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

class PreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreflightError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Enhanced Helper Classes
class ErrorHandler {
  async handleError(error: Error): Promise<void> {
    console.error('Error handled:', error.name, error.message);
  }
}

class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!strategy.shouldRetry(error, attempt)) {
          throw error;
        }
        
        const delay = strategy.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class TestEventBus {
  private listeners: Map<string, Function[]> = new Map();
  
  emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event) || [];
    eventListeners.forEach(listener => listener(data));
  }
  
  subscribe(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
}

class PerformanceProfiler {
  private startTime: number = 0;
  private metrics: Map<string, number> = new Map();

  start(): void {
    this.startTime = Date.now();
    this.metrics.clear();
  }

  stop(): PerformanceProfile {
    const totalTime = Date.now() - this.startTime;
    return {
      totalTime,
      averageMessageProcessingTime: this.metrics.get('avgProcessTime') || 0,
      peakMemoryUsage: this.metrics.get('peakMemory') || 0,
      gcPressure: this.metrics.get('gcPressure') || 0,
      cpuUtilization: this.metrics.get('cpuUtil') || 0.75,
      memoryFragmentation: this.metrics.get('memFrag') || 0.1
    };
  }
}

interface PerformanceProfile {
  totalTime: number;
  averageMessageProcessingTime: number;
  peakMemoryUsage: number;
  gcPressure: number;
  cpuUtilization: number;
  memoryFragmentation: number;
}

// Mock UI Components
class MockCommandPalette {
  private commands: string[] = [];
  
  setCommands(commands: string[]): void {
    this.commands = commands;
  }
  
  getCommands(): string[] {
    return this.commands;
  }
}

class MockSettingsModal {
  private settings: any = {};
  
  loadSettings(settings: any): void {
    this.settings = settings;
  }
  
  getSettings(): any {
    return this.settings;
  }
}

class MockStatusModal {
  private status: SyncResult | null = null;
  
  updateStatus(status: SyncResult): void {
    this.status = status;
  }
  
  getStatus(): SyncResult | null {
    return this.status;
  }
}

class MockChannelSelector {
  private channels: string[] = [];
  
  setChannels(channels: string[]): void {
    this.channels = channels;
  }
  
  getChannels(): string[] {
    return this.channels;
  }
}

class MockSettingsTab {
  private visible: boolean = false;
  
  setVisible(visible: boolean): void {
    this.visible = visible;
  }
  
  isVisible(): boolean {
    return this.visible;
  }
}

class MockPlugin {
  private loaded: boolean = false;
  
  setLoaded(loaded: boolean): void {
    this.loaded = loaded;
  }
  
  isLoaded(): boolean {
    return this.loaded;
  }
}

class MockScheduler {
  private interval: number = 300000;
  
  setInterval(interval: number): void {
    this.interval = interval;
  }
  
  getCurrentInterval(): number {
    return this.interval;
  }
}

class MockLongTermMonitor {
  private collecting: boolean = false;
  private alerts: any = {};
  
  startMetricsCollection(config: any): void {
    this.collecting = true;
  }
  
  setAlerts(alerts: any): void {
    this.alerts = alerts;
  }
  
  async getResults(): Promise<MonitoringResult> {
    return {
      errorCount: 0,
      syncSuccessRate: 0.98,
      averageResponseTime: 3500,
      maxResponseTime: 8000
    };
  }
  
  async stop(): Promise<void> {
    this.collecting = false;
  }
}

interface MonitoringResult {
  errorCount: number;
  syncSuccessRate: number;
  averageResponseTime: number;
  maxResponseTime: number;
}

class MockErrorLog {
  private entries: LogEntry[] = [];
  
  addEntry(entry: LogEntry): void {
    this.entries.push(entry);
  }
  
  getEntries(): LogEntry[] {
    return this.entries;
  }
}

interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  details: any;
}

class MockRetryIndicator {
  private retryCount: number = 0;
  private maxRetries: number = 3;
  
  setRetryCount(count: number): void {
    this.retryCount = count;
  }
  
  setMaxRetries(max: number): void {
    this.maxRetries = max;
  }
  
  getRetryCount(): number {
    return this.retryCount;
  }
  
  getMaxRetries(): number {
    return this.maxRetries;
  }
}

class MockAuthErrorModal {
  private errorType: string = '';
  
  setErrorType(type: string): void {
    this.errorType = type;
  }
  
  getErrorType(): string {
    return this.errorType;
  }
}

class MockOAuthWindow {
  private url: string = '';
  
  setUrl(url: string): void {
    this.url = url;
  }
  
  getUrl(): string {
    return this.url;
  }
}

class MockErrorModal {
  private visible: boolean = false;
  
  setVisible(visible: boolean): void {
    this.visible = visible;
  }
  
  isVisible(): boolean {
    return this.visible;
  }
}

class MockStorageManager {
  private availableSpace: number = 0;
  private usedSpace: number = 0;
  
  setAvailableSpace(space: number): void {
    this.availableSpace = space;
  }
  
  setUsedSpace(space: number): void {
    this.usedSpace = space;
  }
  
  getAvailableSpace(): number {
    return this.availableSpace;
  }
  
  getUsedSpace(): number {
    return this.usedSpace;
  }
}

// Type definitions for external interfaces
interface CommandPalette extends MockCommandPalette {}
interface SettingsModal extends MockSettingsModal {}
interface StatusModal extends MockStatusModal {}
interface ChannelSelector extends MockChannelSelector {}
interface SettingsTab extends MockSettingsTab {}
interface Plugin extends MockPlugin {}
interface OAuthResult {
  success: boolean;
  token?: string;
  error?: string;
}
interface OAuthWindow extends MockOAuthWindow {}
interface AuthErrorModal extends MockAuthErrorModal {}
interface ErrorModal extends MockErrorModal {}
interface LongTermMonitor extends MockLongTermMonitor {}
interface ErrorLog extends MockErrorLog {}
interface RetryIndicator extends MockRetryIndicator {}
interface StorageManager extends MockStorageManager {}
