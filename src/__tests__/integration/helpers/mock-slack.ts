// TASK-501: 統合テストスイート - Slackモック環境
// REDフェーズ: Slack API モック実装

export interface MockSlackMessage {
  text: string;
  user: string;
  ts: string;
  channel?: string;
  thread_ts?: string;
  files?: Array<{
    name: string;
    url_private: string;
    mimetype?: string;
  }>;
  blocks?: any[];
  attachments?: any[];
}

export interface MockSlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  messages: MockSlackMessage[];
}

export interface NetworkErrorConfig {
  type: 'timeout' | 'connection_failure' | 'intermittent';
  duration?: number;
  failureRate?: number;
  averageFailureDuration?: number;
}

export interface AuthErrorConfig {
  type: 'expired' | 'invalid' | 'revoked';
}

/**
 * Slack API環境のモック実装
 * API呼び出し、エラー状態、レート制限をシミュレート
 */
export class MockSlackEnvironment {
  private channels: Map<string, MockSlackChannel> = new Map();
  private networkError: NetworkErrorConfig | null = null;
  private authError: AuthErrorConfig | null = null;
  private rateLimit: { duration: number; startTime: number } | null = null;
  private newMessages: MockSlackMessage[] = [];
  
  // Enhanced components
  private networkSimulator: NetworkConditionSimulator;
  private rateLimitManager: RateLimitManager;
  private responseCache: ResponseCache;
  private responseGenerator: RealisticResponseGenerator;

  constructor() {
    this.networkSimulator = new NetworkConditionSimulator();
    this.rateLimitManager = new RateLimitManager();
    this.responseCache = new ResponseCache();
    this.responseGenerator = new RealisticResponseGenerator();
    this.initializeDefaultChannels();
  }

  // Initialization
  private initializeDefaultChannels(): void {
    const defaultChannels = [
      { id: 'C12345', name: 'general', is_private: false },
      { id: 'C67890', name: 'random', is_private: false },
      { id: 'C11111', name: 'dev', is_private: false },
      { id: 'G22222', name: 'design', is_private: true },
      { id: 'G33333', name: 'marketing', is_private: true }
    ];

    defaultChannels.forEach(channel => {
      this.channels.set(`#${channel.name}`, {
        ...channel,
        messages: []
      });
    });
  }

  async resetToCleanState(): Promise<void> {
    this.channels.clear();
    this.networkError = null;
    this.authError = null;
    this.rateLimit = null;
    this.newMessages = [];
    this.responseCache.clear();
    this.networkSimulator.setNetworkQuality(1.0);
    this.initializeDefaultChannels();
  }

  async cleanup(): Promise<void> {
    await this.resetToCleanState();
  }

  // Message Management
  addChannelMessages(channelName: string, messages: MockSlackMessage[]): void {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Channel not found: ${channelName}`);
    }

    messages.forEach(msg => {
      msg.channel = channelName;
      if (!msg.ts) {
        msg.ts = (Date.now() / 1000).toString();
      }
    });

    channel.messages.push(...messages);
    this.newMessages.push(...messages);
  }

  getChannelMessages(channelName: string): MockSlackMessage[] {
    const channel = this.channels.get(channelName);
    return channel ? [...channel.messages] : [];
  }

  getAllMessages(): MockSlackMessage[] {
    const allMessages: MockSlackMessage[] = [];
    this.channels.forEach(channel => {
      allMessages.push(...channel.messages);
    });
    return allMessages;
  }

  getNewMessages(): MockSlackMessage[] {
    const messages = [...this.newMessages];
    this.newMessages = []; // Clear after retrieval
    return messages;
  }

  // Enhanced Error Simulation
  simulateTimeout(duration: number): void {
    this.networkError = { type: 'timeout', duration };
    this.networkSimulator.setNetworkQuality(0.1); // Very poor quality
  }

  simulateConnectionFailure(): void {
    this.networkError = { type: 'connection_failure' };
    this.networkSimulator.setNetworkQuality(0.0); // No connectivity
  }

  simulateIntermittentConnection(config: {
    failureRate: number;
    averageFailureDuration: number;
  }): void {
    this.networkError = {
      type: 'intermittent',
      failureRate: config.failureRate,
      averageFailureDuration: config.averageFailureDuration
    };
    this.networkSimulator.setNetworkQuality(1.0 - config.failureRate);
  }

  simulateNetworkError(): void {
    this.networkError = { type: 'connection_failure' };
    this.networkSimulator.setNetworkQuality(0.2);
  }

  restoreNetwork(): void {
    this.networkError = null;
    this.networkSimulator.setNetworkQuality(1.0);
  }

  restoreConnection(): void {
    this.networkError = null;
    this.networkSimulator.setNetworkQuality(1.0);
  }

  simulateExpiredToken(): void {
    this.authError = { type: 'expired' };
  }

  simulateInvalidToken(): void {
    this.authError = { type: 'invalid' };
  }

  simulateRevokedToken(): void {
    this.authError = { type: 'revoked' };
  }

  simulateRateLimit(durationSeconds: number): void {
    this.rateLimit = {
      duration: durationSeconds * 1000,
      startTime: Date.now()
    };

    // Auto-clear for testing
    setTimeout(() => {
      this.rateLimit = null;
    }, Math.min(durationSeconds * 1000, 5000)); // Max 5 seconds for tests
  }

  clearRateLimit(): void {
    this.rateLimit = null;
  }

  clearAllErrors(): void {
    this.networkError = null;
    this.authError = null;
    this.rateLimit = null;
    this.networkSimulator.setNetworkQuality(1.0);
  }

  // Enhanced State Queries
  hasNetworkError(): boolean {
    if (!this.networkError) return false;

    if (this.networkError.type === 'intermittent') {
      return this.networkSimulator.shouldSimulateFailure();
    }

    return true;
  }

  hasAuthError(): boolean {
    return this.authError !== null;
  }

  getAuthErrorType(): string {
    return this.authError?.type || 'unknown';
  }

  hasRateLimit(): boolean {
    // Check both manual rate limit and automatic rate limiting
    if (this.rateLimit) {
      const elapsed = Date.now() - this.rateLimit.startTime;
      if (elapsed < this.rateLimit.duration) {
        return true;
      }
    }
    
    return this.rateLimitManager.isRateLimited();
  }

  getRateLimitDuration(): number {
    if (this.rateLimit) {
      const remaining = this.rateLimit.duration - (Date.now() - this.rateLimit.startTime);
      return Math.max(0, remaining);
    }
    
    return this.rateLimitManager.getTimeUntilReset();
  }

  // Enhanced API Methods with Realistic Behavior
  async conversations_list(): Promise<any> {
    const cacheKey = 'conversations_list';
    const cached = this.responseCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this.simulateNetworkConditions();
    this.rateLimitManager.recordRequest();

    if (this.hasNetworkError()) {
      throw new Error('Network error: Connection failed');
    }

    if (this.hasAuthError()) {
      throw new Error(`Authentication error: ${this.getAuthErrorType()} token`);
    }

    if (this.hasRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const channels = Array.from(this.channels.values());
    const response = this.responseGenerator.generateConversationsListResponse(channels);
    
    this.responseCache.set(cacheKey, response);
    return response;
  }

  async conversations_history(channel: string, options?: any): Promise<any> {
    const cacheKey = `conversations_history_${channel}_${JSON.stringify(options)}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this.simulateNetworkConditions();
    this.rateLimitManager.recordRequest();

    if (this.hasNetworkError()) {
      throw new Error('Network error: Connection failed');
    }

    if (this.hasAuthError()) {
      throw new Error(`Authentication error: ${this.getAuthErrorType()} token`);
    }

    if (this.hasRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const channelData = this.channels.get(channel);
    if (!channelData) {
      return {
        ok: false,
        error: 'channel_not_found'
      };
    }

    let messages = [...channelData.messages];
    
    // Apply filters
    if (options?.oldest) {
      const oldestTs = parseFloat(options.oldest);
      messages = messages.filter(msg => parseFloat(msg.ts) >= oldestTs);
    }

    if (options?.limit) {
      messages = messages.slice(0, options.limit);
    }

    const response = this.responseGenerator.generateConversationsHistoryResponse(messages);
    this.responseCache.set(cacheKey, response);
    return response;
  }

  async conversations_replies(channel: string, ts: string): Promise<any> {
    await this.simulateNetworkConditions();
    this.rateLimitManager.recordRequest();

    if (this.hasNetworkError()) {
      throw new Error('Network error: Connection failed');
    }

    const channelData = this.channels.get(channel);
    if (!channelData) {
      return {
        ok: false,
        error: 'channel_not_found'
      };
    }

    const replies = channelData.messages.filter(msg => msg.thread_ts === ts);

    return {
      ok: true,
      messages: replies,
      has_more: false
    };
  }

  async auth_test(): Promise<any> {
    await this.simulateNetworkConditions();
    this.rateLimitManager.recordRequest();

    if (this.hasAuthError()) {
      throw new Error(`Authentication error: ${this.getAuthErrorType()} token`);
    }

    return this.responseGenerator.generateAuthTestResponse();
  }

  async users_info(user: string): Promise<any> {
    const cacheKey = `users_info_${user}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this.simulateNetworkConditions();
    this.rateLimitManager.recordRequest();

    const response = this.responseGenerator.generateUserInfoResponse(user);
    this.responseCache.set(cacheKey, response);
    return response;
  }

  async files_info(fileId: string): Promise<any> {
    await this.simulateNetworkConditions();
    this.rateLimitManager.recordRequest();

    return {
      ok: true,
      file: {
        id: fileId,
        name: `file_${fileId}.txt`,
        mimetype: 'text/plain',
        size: Math.floor(Math.random() * 1024000) + 1024,
        url_private: `https://files.slack.com/files-pri/T1234567890-${fileId}/file.txt`,
        created: Math.floor(Date.now() / 1000),
        timestamp: Math.floor(Date.now() / 1000)
      }
    };
  }

  // OAuth Simulation
  async simulateOAuthFlow(): Promise<{ success: boolean; token?: string; error?: string }> {
    await this.simulateNetworkConditions();
    
    if (this.hasNetworkError()) {
      return {
        success: false,
        error: 'Network error during OAuth flow'
      };
    }

    return {
      success: true,
      token: 'xoxp-oauth-token-' + Math.random().toString(36).substring(2)
    };
  }

  async validateToken(token: string): Promise<boolean> {
    if (this.hasAuthError()) {
      return false;
    }
    return token.startsWith('xoxp-') || token.startsWith('xoxb-');
  }

  // Channel Management
  getAvailableChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  addChannel(name: string, isPrivate: boolean = false): void {
    const id = `${isPrivate ? 'G' : 'C'}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    this.channels.set(name, {
      id,
      name: name.replace('#', ''),
      is_private: isPrivate,
      messages: []
    });
  }

  removeChannel(name: string): void {
    this.channels.delete(name);
  }

  // Webhook Simulation
  async sendWebhook(url: string, payload: any): Promise<any> {
    await this.simulateNetworkConditions();
    
    return {
      ok: true,
      ts: (Date.now() / 1000).toString()
    };
  }

  // Real-time Events Simulation
  simulateRealTimeMessage(channel: string, message: MockSlackMessage): void {
    this.addChannelMessages(channel, [message]);
  }

  simulateUserTyping(channel: string, user: string): void {
    // Typing indicator simulation
  }

  simulateChannelJoin(channel: string, user: string): void {
    // Channel join simulation
  }

  simulateChannelLeave(channel: string, user: string): void {
    // Channel leave simulation
  }

  // Private helper methods
  private async simulateNetworkConditions(): Promise<void> {
    const latency = this.networkSimulator.calculateLatency();
    
    if (latency > 100) {
      await this.sleep(Math.min(latency, 2000)); // Cap at 2 seconds for tests
    }

    if (this.networkError?.type === 'intermittent') {
      await this.simulateIntermittentFailure();
    }
  }

  private async simulateIntermittentFailure(): Promise<void> {
    if (this.networkSimulator.shouldSimulateFailure()) {
      const failureDuration = Math.random() * 1000 + 500; // 0.5-1.5 seconds
      await this.sleep(failureDuration);
      
      if (Math.random() < 0.2) { // 20% chance of actual failure
        throw new Error('Intermittent network failure');
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Performance and monitoring methods
  getPerformanceMetrics(): NetworkPerformanceMetrics {
    return {
      networkQuality: this.networkSimulator.getNetworkQuality(),
      averageLatency: this.networkSimulator.calculateLatency(),
      rateLimitRemaining: this.rateLimitManager.getRemainingRequests(),
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    return Math.random() * 0.3 + 0.7; // 70-100% hit rate
  }
}

// Enhanced Network and Performance Classes
class NetworkConditionSimulator {
  private qualityScore: number = 1.0; // 0.0 to 1.0
  private latencyBase: number = 50; // Base latency in ms

  setNetworkQuality(score: number): void {
    this.qualityScore = Math.max(0, Math.min(1, score));
  }

  getNetworkQuality(): number {
    return this.qualityScore;
  }

  calculateLatency(): number {
    const jitter = Math.random() * 100; // 0-100ms jitter
    const qualityMultiplier = (1.0 - this.qualityScore) * 10; // Worse quality = higher multiplier
    return this.latencyBase + (jitter * qualityMultiplier);
  }

  shouldSimulateFailure(): boolean {
    const failureRate = (1.0 - this.qualityScore) * 0.2; // Max 20% failure rate
    return Math.random() < failureRate;
  }
}

class RateLimitManager {
  private requests: number[] = [];
  private maxRequestsPerMinute: number = 100;

  isRateLimited(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old requests
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    return this.requests.length >= this.maxRequestsPerMinute;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requests.filter(time => time > oneMinuteAgo);
    return Math.max(0, this.maxRequestsPerMinute - recentRequests.length);
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, (oldestRequest + 60000) - Date.now());
  }
}

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxAge: number = 300000; // 5 minutes

  get(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Enhanced Response Generators
class RealisticResponseGenerator {
  generateConversationsListResponse(channels: MockSlackChannel[]): any {
    return {
      ok: true,
      channels: channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        is_channel: true,
        is_group: channel.is_private,
        is_private: channel.is_private,
        is_member: true,
        is_archived: false,
        created: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        creator: 'U12345',
        name_normalized: channel.name.toLowerCase(),
        num_members: Math.floor(Math.random() * 100) + 5,
        purpose: {
          value: `Purpose for ${channel.name}`,
          creator: 'U12345',
          last_set: Math.floor(Date.now() / 1000) - 3600
        },
        topic: {
          value: `Topic for ${channel.name}`,
          creator: 'U12345',
          last_set: Math.floor(Date.now() / 1000) - 1800
        }
      })),
      response_metadata: {
        next_cursor: '',
        scopes: ['channels:read'],
        acceptedScopes: ['channels:read']
      }
    };
  }

  generateConversationsHistoryResponse(messages: MockSlackMessage[]): any {
    return {
      ok: true,
      messages: messages.map(msg => ({
        ...msg,
        type: 'message',
        subtype: msg.thread_ts ? 'thread_broadcast' : undefined,
        ts: msg.ts,
        user: msg.user,
        text: msg.text,
        thread_ts: msg.thread_ts,
        reply_count: msg.thread_ts ? Math.floor(Math.random() * 5) : undefined,
        reply_users_count: msg.thread_ts ? Math.floor(Math.random() * 3) + 1 : undefined,
        latest_reply: msg.thread_ts ? (parseFloat(msg.ts) + Math.random() * 3600).toString() : undefined,
        reactions: this.generateReactions(),
        files: msg.files?.map(file => ({
          ...file,
          id: `F${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          created: Math.floor(parseFloat(msg.ts)),
          timestamp: Math.floor(parseFloat(msg.ts)),
          filetype: file.mimetype?.split('/')[1] || 'txt',
          size: Math.floor(Math.random() * 1024000) + 1024
        }))
      })),
      has_more: false,
      pin_count: Math.floor(Math.random() * 3),
      channel_actions_ts: null,
      channel_actions_count: 0
    };
  }

  private generateReactions(): any[] {
    const reactions = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡'];
    const result = [];
    
    // Random chance of having reactions
    if (Math.random() < 0.3) {
      const reactionCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < reactionCount; i++) {
        const emoji = reactions[Math.floor(Math.random() * reactions.length)];
        result.push({
          name: emoji,
          users: [`U${Math.random().toString(36).substring(2, 8).toUpperCase()}`],
          count: Math.floor(Math.random() * 5) + 1
        });
      }
    }
    
    return result;
  }

  generateAuthTestResponse(): any {
    return {
      ok: true,
      url: 'https://test-workspace.slack.com/',
      team: 'Test Workspace',
      user: 'testuser',
      team_id: 'T' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      user_id: 'U' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      bot_id: 'B' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      enterprise_id: null,
      is_enterprise_install: false
    };
  }

  generateUserInfoResponse(userId: string): any {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const name = names[Math.floor(Math.random() * names.length)];
    
    return {
      ok: true,
      user: {
        id: userId,
        team_id: 'T12345678',
        name: name.toLowerCase(),
        deleted: false,
        color: Math.random().toString(16).substring(2, 8),
        real_name: `${name} Test`,
        tz: 'America/New_York',
        tz_label: 'Eastern Standard Time',
        tz_offset: -18000,
        profile: {
          title: 'Software Developer',
          phone: '+1 555-123-4567',
          skype: `${name.toLowerCase()}.test`,
          real_name: `${name} Test`,
          real_name_normalized: `${name} Test`,
          display_name: name,
          display_name_normalized: name.toLowerCase(),
          fields: {},
          status_text: 'Working from home',
          status_emoji: ':house_with_garden:',
          status_expiration: 0,
          avatar_hash: Math.random().toString(36).substring(2, 10),
          email: `${name.toLowerCase()}.test@example.com`,
          first_name: name,
          last_name: 'Test',
          image_24: `https://avatars.slack-edge.com/avatar_${Math.random().toString(36)}_24.png`,
          image_32: `https://avatars.slack-edge.com/avatar_${Math.random().toString(36)}_32.png`,
          image_48: `https://avatars.slack-edge.com/avatar_${Math.random().toString(36)}_48.png`,
          image_72: `https://avatars.slack-edge.com/avatar_${Math.random().toString(36)}_72.png`,
          image_192: `https://avatars.slack-edge.com/avatar_${Math.random().toString(36)}_192.png`,
          image_512: `https://avatars.slack-edge.com/avatar_${Math.random().toString(36)}_512.png`,
          team: 'T12345678'
        },
        is_admin: false,
        is_owner: false,
        is_primary_owner: false,
        is_restricted: false,
        is_ultra_restricted: false,
        is_bot: false,
        is_app_user: false,
        updated: Math.floor(Date.now() / 1000)
      }
    };
  }
}

// Performance monitoring interface
interface NetworkPerformanceMetrics {
  networkQuality: number;
  averageLatency: number;
  rateLimitRemaining: number;
  cacheHitRate: number;
}
