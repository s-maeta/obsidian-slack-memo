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

  constructor() {
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

  // Error Simulation
  simulateTimeout(duration: number): void {
    this.networkError = { type: 'timeout', duration };
  }

  simulateConnectionFailure(): void {
    this.networkError = { type: 'connection_failure' };
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
  }

  simulateNetworkError(): void {
    this.networkError = { type: 'connection_failure' };
  }

  restoreNetwork(): void {
    this.networkError = null;
  }

  restoreConnection(): void {
    this.networkError = null;
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

    // 自動的にレート制限を解除
    setTimeout(() => {
      this.rateLimit = null;
    }, 1000); // テスト用に1秒に短縮
  }

  clearRateLimit(): void {
    this.rateLimit = null;
  }

  clearAllErrors(): void {
    this.networkError = null;
    this.authError = null;
    this.rateLimit = null;
  }

  // State Queries
  hasNetworkError(): boolean {
    if (!this.networkError) return false;

    if (this.networkError.type === 'intermittent') {
      return Math.random() < (this.networkError.failureRate || 0.3);
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
    if (!this.rateLimit) return false;
    
    const elapsed = Date.now() - this.rateLimit.startTime;
    return elapsed < this.rateLimit.duration;
  }

  getRateLimitDuration(): number {
    if (!this.rateLimit) return 0;
    
    const remaining = this.rateLimit.duration - (Date.now() - this.rateLimit.startTime);
    return Math.max(0, remaining);
  }

  // API Response Simulation (will fail until real implementation)
  async conversations_list(): Promise<any> {
    if (this.hasNetworkError()) {
      throw new Error('Network error: Connection failed');
    }

    if (this.hasAuthError()) {
      throw new Error('Authentication error: Invalid token');
    }

    if (this.hasRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    throw new Error('Not implemented: conversations_list');
  }

  async conversations_history(channel: string, options?: any): Promise<any> {
    if (this.hasNetworkError()) {
      throw new Error('Network error: Connection failed');
    }

    if (this.hasAuthError()) {
      throw new Error('Authentication error: Invalid token');
    }

    if (this.hasRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    throw new Error('Not implemented: conversations_history');
  }

  async conversations_replies(channel: string, ts: string): Promise<any> {
    if (this.hasNetworkError()) {
      throw new Error('Network error: Connection failed');
    }

    throw new Error('Not implemented: conversations_replies');
  }

  async auth_test(): Promise<any> {
    if (this.hasAuthError()) {
      throw new Error('Authentication error: Token invalid');
    }

    throw new Error('Not implemented: auth_test');
  }

  async users_info(user: string): Promise<any> {
    throw new Error('Not implemented: users_info');
  }

  async files_info(fileId: string): Promise<any> {
    throw new Error('Not implemented: files_info');
  }

  // OAuth Simulation
  async simulateOAuthFlow(): Promise<{ success: boolean; token?: string; error?: string }> {
    throw new Error('Not implemented: simulateOAuthFlow');
  }

  async validateToken(token: string): Promise<boolean> {
    throw new Error('Not implemented: validateToken');
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
    throw new Error('Not implemented: sendWebhook');
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
}