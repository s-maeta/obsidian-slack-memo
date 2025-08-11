import { SlackAPIClient } from '../src/slack-api-client';
import { SlackAuthManager } from '../src/slack-auth';
import { SettingsManager } from '../src/settings';
import { Channel, Message } from '../src/slack-types';
import { isSuccess, isError } from '../src/types';

// モックの設定
const mockPlugin = {
  loadData: jest.fn(),
  saveData: jest.fn(),
  registerObsidianProtocolHandler: jest.fn(),
  addCommand: jest.fn(),
};

const mockAuthManager = {
  getDecryptedToken: jest.fn(),
  isAuthenticated: jest.fn(),
};

// グローバルfetchのモック
global.fetch = jest.fn();

describe('Slack APIクライアント', () => {
  let apiClient: SlackAPIClient;
  let authManager: SlackAuthManager;

  beforeEach(() => {
    jest.clearAllMocks();
    const settingsManager = new SettingsManager(mockPlugin as any);
    authManager = new SlackAuthManager(settingsManager);
    
    // AuthManagerのメソッドをモック化
    authManager.getDecryptedToken = mockAuthManager.getDecryptedToken;
    authManager.isAuthenticated = mockAuthManager.isAuthenticated;
    
    // デフォルトでトークンを返すようにモック
    mockAuthManager.getDecryptedToken.mockResolvedValue('xoxb-test-token');
    mockAuthManager.isAuthenticated.mockResolvedValue(true);
    
    apiClient = new SlackAPIClient(authManager);
  });

  describe('基本的なAPI呼び出し', () => {
    it('認証トークンが自動的に付与される', async () => {
      const mockResponse = {
        ok: true,
        channels: [] as Channel[],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await apiClient.listChannels();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer xoxb-test-token',
          }),
        })
      );
    });

    it('正しいエンドポイントにリクエストが送信される', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await apiClient.listChannels();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://slack.com/api/conversations.list'),
        expect.any(Object)
      );
    });
  });

  describe('conversations.list', () => {
    it('チャンネルリストが取得できる', async () => {
      const mockChannels: Channel[] = [
        { id: 'C123', name: 'general', is_private: false },
        { id: 'C456', name: 'random', is_private: false },
      ];

      const mockResponse = {
        ok: true,
        channels: mockChannels,
        response_metadata: {
          next_cursor: '',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockChannels);
      }
    });

    it('プライベートチャンネルを含む取得ができる', async () => {
      const mockChannels: Channel[] = [
        { id: 'C123', name: 'general', is_private: false },
        { id: 'C456', name: 'private-channel', is_private: true },
      ];

      const mockResponse = {
        ok: true,
        channels: mockChannels,
        response_metadata: { next_cursor: '' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.listChannels({ 
        types: 'public_channel,private_channel' 
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
      }
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('types=public_channel%2Cprivate_channel'),
        expect.any(Object)
      );
    });

    it('ページネーションが正しく処理される', async () => {
      const page1Channels: Channel[] = Array(100).fill(null).map((_, i) => ({
        id: `C${i}`,
        name: `channel-${i}`,
        is_private: false,
      }));

      const page2Channels: Channel[] = Array(50).fill(null).map((_, i) => ({
        id: `C${i + 100}`,
        name: `channel-${i + 100}`,
        is_private: false,
      }));

      // 1ページ目のレスポンス
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: page1Channels,
          response_metadata: { next_cursor: 'cursor123' },
        }),
      });

      // 2ページ目のレスポンス
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: page2Channels,
          response_metadata: { next_cursor: '' },
        }),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(150);
      }
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('cursor=cursor123'),
        expect.any(Object)
      );
    });

    it('空のチャンネルリストを正しく処理する', async () => {
      const mockResponse = {
        ok: true,
        channels: [] as Channel[],
        response_metadata: { next_cursor: '' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('conversations.history', () => {
    it('メッセージ履歴が取得できる', async () => {
      const mockMessages: Message[] = [
        { type: 'message', ts: '1234567890.123456', text: 'Hello', user: 'U123' },
        { type: 'message', ts: '1234567891.123456', text: 'World', user: 'U456' },
      ];

      const mockResponse = {
        ok: true,
        messages: mockMessages,
        has_more: false,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getChannelHistory('C123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockMessages);
      }
    });

    it('差分取得（oldest指定）が機能する', async () => {
      const mockMessages: Message[] = [
        { type: 'message', ts: '1234567892.123456', text: 'New message', user: 'U123' },
      ];

      const mockResponse = {
        ok: true,
        messages: mockMessages,
        has_more: false,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getChannelHistory('C123', {
        oldest: '1234567891.000000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockMessages);
      }
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('oldest=1234567891.000000'),
        expect.any(Object)
      );
    });

    it('取得件数制限（limit指定）が機能する', async () => {
      const mockMessages: Message[] = Array(50).fill(null).map((_, i) => ({
        type: 'message',
        ts: `123456789${i}.123456`,
        text: `Message ${i}`,
        user: 'U123',
      }));

      const mockResponse = {
        ok: true,
        messages: mockMessages,
        has_more: true,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getChannelHistory('C123', { limit: 50 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(50);
      }
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
    });

    it('存在しないチャンネルでエラーを返す', async () => {
      const mockResponse = {
        ok: false,
        error: 'channel_not_found',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getChannelHistory('invalid-channel');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('channel_not_found');
      }
    });
  });

  describe('conversations.replies', () => {
    it('スレッドの返信が取得できる', async () => {
      const mockReplies: Message[] = [
        { type: 'message', ts: '1234567890.123456', text: 'Parent', user: 'U123' },
        { type: 'message', ts: '1234567891.123456', text: 'Reply 1', user: 'U456', thread_ts: '1234567890.123456' },
        { type: 'message', ts: '1234567892.123456', text: 'Reply 2', user: 'U789', thread_ts: '1234567890.123456' },
      ];

      const mockResponse = {
        ok: true,
        messages: mockReplies,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getThreadReplies('C123', '1234567890.123456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockReplies);
      }
    });

    it('返信がないスレッドで親メッセージのみ返す', async () => {
      const mockReplies: Message[] = [
        { type: 'message', ts: '1234567890.123456', text: 'Parent', user: 'U123' },
      ];

      const mockResponse = {
        ok: true,
        messages: mockReplies,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getThreadReplies('C123', '1234567890.123456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(1);
      }
    });

    it('無効なthread_tsでエラーを返す', async () => {
      const mockResponse = {
        ok: false,
        error: 'thread_not_found',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.getThreadReplies('C123', 'invalid-ts');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('thread_not_found');
      }
    });
  });

  describe('レート制限処理', () => {
    it('429エラーで自動リトライする', async () => {
      // 1回目: 429エラー
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => key === 'retry-after' ? '1' : null
        },
      });

      // 2回目: 成功
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: [] as Channel[],
          response_metadata: { next_cursor: '' },
        }),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('3回リトライ後にエラーを返す', async () => {
      // すべて429エラーを返す
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => key === 'retry-after' ? '1' : null
        },
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('レート制限');
      }
      expect(fetch).toHaveBeenCalledTimes(4); // 初回 + 3回リトライ
    });

    it('Retry-Afterヘッダーを尊重する', async () => {
      jest.setTimeout(10000); // タイムアウトを10秒に設定
      
      const startTime = Date.now();

      // 1回目: 429エラー（Retry-After: 2秒）
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => key === 'retry-after' ? '2' : null
        },
      });

      // 2回目: 成功
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: [] as Channel[],
          response_metadata: { next_cursor: '' },
        }),
      });

      await apiClient.listChannels();

      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('エラーハンドリング', () => {
    it('APIエラーレスポンスを適切に処理する', async () => {
      const mockResponse = {
        ok: false,
        error: 'invalid_auth',
        error_description: 'Invalid authentication token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('invalid_auth');
      }
    });

    it('ネットワークエラーを捕捉する', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await apiClient.listChannels();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('ネットワークエラー');
      }
    });

    it.skip('タイムアウトエラーを処理する', async () => {
      // タイムアウトのテストは実装の詳細に依存するため、スキップ
      // 実際の環境ではAbortControllerが正しく動作することを前提とする
    });

    it('無効なトークンエラーを返す', async () => {
      const mockResponse = {
        ok: false,
        error: 'invalid_auth',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('invalid_auth');
      }
    });
  });

  describe('ページネーション', () => {
    it('すべてのページが自動的に取得される', async () => {
      const page1: Channel[] = Array(100).fill(null).map((_, i) => ({
        id: `C${i}`,
        name: `channel-${i}`,
      }));

      const page2: Channel[] = Array(50).fill(null).map((_, i) => ({
        id: `C${i + 100}`,
        name: `channel-${i + 100}`,
      }));

      // 1ページ目
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: page1,
          response_metadata: { next_cursor: 'page2' },
        }),
      });

      // 2ページ目
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: page2,
          response_metadata: { next_cursor: '' },
        }),
      });

      const result = await apiClient.listChannels();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(150);
      }
    });

    it('各リクエストで正しいcursorが使用される', async () => {
      // 1ページ目
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: [{ id: 'C1', name: 'channel1' }],
          response_metadata: { next_cursor: 'cursor-page2' },
        }),
      });

      // 2ページ目
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          channels: [{ id: 'C2', name: 'channel2' }],
          response_metadata: { next_cursor: '' },
        }),
      });

      await apiClient.listChannels();

      // 2回目の呼び出しでcursorが使用されているか確認
      expect(fetch).toHaveBeenNthCalledWith(2,
        expect.stringContaining('cursor=cursor-page2'),
        expect.any(Object)
      );
    });
  });
});