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
        if (!data.ok) {
          return {
            success: false,
            error: new Error(`Slack API error: ${data.error}`),
          };
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
      const token = await this.authManager.getDecryptedToken();
      if (!token) {
        return {
          success: false,
          error: new Error('認証トークンが設定されていません'),
        };
      }

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

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);

          try {
            const response = await fetch(url.toString(), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // レート制限チェック
            if (response.status === 429) {
              if (retries >= this.maxRetries) {
                return {
                  success: false,
                  error: new Error('レート制限: 最大リトライ回数を超えました'),
                };
              }

              const retryAfterHeader = response.headers.get('retry-after');
              const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
              await this.handleRateLimit(retryAfter);
              retries++;
              continue;
            }

            const data = await response.json() as T;
            return { success: true, value: data };
          } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
              return {
                success: false,
                error: new Error('リクエストがタイムアウトしました'),
              };
            }
            
            throw error;
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          if (error.message.includes('Network') || error.message.includes('fetch')) {
            return {
              success: false,
              error: new Error('ネットワークエラーが発生しました'),
            };
          }
          
          if (retries >= this.maxRetries) {
            break;
          }
          
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

  // レート制限の処理
  private async handleRateLimit(retryAfter: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }
}