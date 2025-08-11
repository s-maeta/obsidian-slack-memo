import { SlackAuthManager } from './slack-auth';
import { Result } from './types';
import {
  Channel,
  Message,
  ListChannelsOptions,
  HistoryOptions,
  ChannelsListResponse,
  ConversationsHistoryResponse,
  ConversationsRepliesResponse,
  SlackAPIResponse,
} from './slack-types';

export class SlackAPIClient {
  private authManager: SlackAuthManager;
  private readonly baseUrl = 'https://slack.com/api';
  private readonly timeout = 30000; // 30秒
  private readonly maxRetries = 3;

  constructor(authManager: SlackAuthManager) {
    this.authManager = authManager;
  }

  // チャンネル一覧を取得
  async listChannels(options?: ListChannelsOptions): Promise<Result<Channel[]>> {
    try {
      const channels: Channel[] = [];
      let cursor = options?.cursor;

      do {
        const params: Record<string, string> = {
          limit: (options?.limit || 100).toString(),
        };

        if (options?.types) {
          params.types = options.types;
        }

        if (options?.exclude_archived !== undefined) {
          params.exclude_archived = options.exclude_archived.toString();
        }

        if (cursor) {
          params.cursor = cursor;
        }

        const response = await this.makeRequest<ChannelsListResponse>('conversations.list', params);

        if (!response.success) {
          return response as Result<Channel[]>;
        }

        const data = response.value;
        if (!data.ok) {
          return {
            success: false,
            error: new Error(`Slack API error: ${data.error}`),
          };
        }

        channels.push(...data.channels);
        cursor = data.response_metadata?.next_cursor;

        // limitが指定されている場合は1ページのみ取得
        if (options?.limit) {
          break;
        }
      } while (cursor);

      return { success: true, value: channels };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // チャンネルのメッセージ履歴を取得
  async getChannelHistory(channelId: string, options?: HistoryOptions): Promise<Result<Message[]>> {
    try {
      const messages: Message[] = [];
      let cursor = options?.cursor;

      do {
        const params: Record<string, string> = {
          channel: channelId,
          limit: (options?.limit || 100).toString(),
        };

        if (options?.latest) {
          params.latest = options.latest;
        }

        if (options?.oldest) {
          params.oldest = options.oldest;
        }

        if (options?.inclusive !== undefined) {
          params.inclusive = options.inclusive.toString();
        }

        if (cursor) {
          params.cursor = cursor;
        }

        const response = await this.makeRequest<ConversationsHistoryResponse>('conversations.history', params);

        if (!response.success) {
          return response as Result<Message[]>;
        }

        const data = response.value;
        console.log(`SlackAPIClient: conversations.history response for ${channelId}:`, {
          ok: data.ok,
          messagesCount: data.messages?.length,
          has_more: data.has_more,
          response_metadata: data.response_metadata
        });
        
        if (!data.ok) {
          return {
            success: false,
            error: new Error(`Slack API error: ${data.error}`),
          };
        }

        if (data.messages && data.messages.length > 0) {
          console.log(`SlackAPIClient: Sample messages:`, data.messages.slice(0, 3).map(m => ({
            ts: m.ts,
            user: m.user,
            text: m.text?.substring(0, 100),
            subtype: m.subtype
          })));
        }

        messages.push(...data.messages);
        cursor = data.response_metadata?.next_cursor;

        // limitが指定されている場合、またはhas_moreがfalseの場合は終了
        if (options?.limit || !data.has_more) {
          break;
        }
      } while (cursor);

      return { success: true, value: messages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // チャンネルに参加
  async joinChannel(channelId: string): Promise<Result<boolean>> {
    try {
      const params: Record<string, string> = {
        channel: channelId,
      };

      const response = await this.makePostRequest<SlackAPIResponse>('conversations.join', params);

      if (!response.success) {
        return response as Result<boolean>;
      }

      const data = response.value;
      if (!data.ok) {
        return {
          success: false,
          error: new Error(`Slack API error: ${data.error}`),
        };
      }

      return { success: true, value: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // スレッドの返信を取得
  async getThreadReplies(channelId: string, threadTs: string): Promise<Result<Message[]>> {
    try {
      const params: Record<string, string> = {
        channel: channelId,
        ts: threadTs,
      };

      const response = await this.makeRequest<ConversationsRepliesResponse>('conversations.replies', params);

      if (!response.success) {
        return response as Result<Message[]>;
      }

      const data = response.value;
      if (!data.ok) {
        return {
          success: false,
          error: new Error(`Slack API error: ${data.error}`),
        };
      }

      return { success: true, value: data.messages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // 内部メソッド: API リクエストを実行
  private async makeRequest<T extends SlackAPIResponse>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<Result<T>> {
    try {
      console.log('SlackAPIClient: Making request to', endpoint);
      const token = await this.authManager.getDecryptedToken();
      if (!token) {
        console.error('SlackAPIClient: No token available');
        return {
          success: false,
          error: new Error('認証トークンが設定されていません'),
        };
      }
      
      // トークンの形式をチェック（xoxe.xoxp- 形式にも対応）
      const validTokenFormats = [
        token.startsWith('xoxb-'),
        token.startsWith('xoxp-'),
        token.startsWith('xoxe-'),
        token.startsWith('xoxe.xoxp-')
      ];
      
      if (!validTokenFormats.some(valid => valid)) {
        console.error('SlackAPIClient: Invalid token format. Token should start with xoxb-, xoxp-, xoxe-, or xoxe.xoxp-');
        return {
          success: false,
          error: new Error('無効なトークン形式です。Slackトークンは xoxb-, xoxp-, xoxe-, または xoxe.xoxp- で始まる必要があります。'),
        };
      }
      
      console.log('SlackAPIClient: Token format valid, starting request');

      let retries = 0;
      let lastError: Error | null = null;

      while (retries <= this.maxRetries) {
        try {
          const url = new URL(`${this.baseUrl}/${endpoint}`);
          if (params) {
            Object.entries(params).forEach(([key, value]) => {
              url.searchParams.append(key, value);
            });
          }

          try {
            console.log('SlackAPIClient: Sending request to:', url.toString());
            
            // Obsidian環境では `requestUrl` を使用する
            const { requestUrl } = require('obsidian');
            
            const response = await requestUrl({
              url: url.toString(),
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            console.log('SlackAPIClient: Response status:', response.status);

            // エラーレスポンスをチェック
            if (response.status < 200 || response.status >= 300) {
              console.error('SlackAPIClient: HTTP error response:', response.status, response.text);
              
              // レート制限チェック
              if (response.status === 429) {
                if (retries >= this.maxRetries) {
                  return {
                    success: false,
                    error: new Error('レート制限: 最大リトライ回数を超えました'),
                  };
                }

                const retryAfterHeader = response.headers['retry-after'];
                const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
                await this.handleRateLimit(retryAfter);
                retries++;
                continue;
              }
              
              return {
                success: false,
                error: new Error(`HTTP ${response.status}: ${response.text}`),
              };
            }

            const data = response.json as T;
            console.log('SlackAPIClient: Response data:', data);
            return { success: true, value: data };
          } catch (error) {
            throw error;
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.error('SlackAPIClient: Request error:', error);
          
          if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            return {
              success: false,
              error: new Error(`ネットワークエラーが発生しました: ${error.message}`),
            };
          }
          
          if (retries >= this.maxRetries) {
            break;
          }
          
          console.log(`SlackAPIClient: Retrying request (${retries + 1}/${this.maxRetries})`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 指数バックオフ
        }
      }

      return {
        success: false,
        error: lastError || new Error('Unknown error'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // 内部メソッド: POST APIリクエストを実行
  private async makePostRequest<T extends SlackAPIResponse>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<Result<T>> {
    try {
      console.log('SlackAPIClient: Making POST request to', endpoint);
      const token = await this.authManager.getDecryptedToken();
      if (!token) {
        return {
          success: false,
          error: new Error('認証トークンが設定されていません'),
        };
      }

      // Create form data
      const formData = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      // Obsidian環境では `requestUrl` を使用する
      const { requestUrl } = require('obsidian');
      
      const response = await requestUrl({
        url: `${this.baseUrl}/${endpoint}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      console.log('SlackAPIClient: POST Response status:', response.status);
      const data = response.json as T;
      console.log('SlackAPIClient: POST Response data:', data);
      
      return { success: true, value: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // レート制限の処理
  private async handleRateLimit(retryAfter: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }
}