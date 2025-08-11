import { SlackAuthManager } from '../src/slack-auth';
import { SettingsManager } from '../src/settings';

// テスト用のモック設定
const mockPlugin = {
  loadData: jest.fn(),
  saveData: jest.fn(),
  registerObsidianProtocolHandler: jest.fn(),
  addCommand: jest.fn(),
};

const mockCrypto = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
};

describe('Slack OAuth認証', () => {
  let authManager: SlackAuthManager;
  let settingsManager: SettingsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsManager = new SettingsManager(mockPlugin as any);
    authManager = new SlackAuthManager(
      settingsManager, 
      mockCrypto as any, 
      'test-client-id', 
      'test-client-secret'
    );
    
    // settingsManagerのメソッドをモック化
    settingsManager.updateSettings = jest.fn();
    settingsManager.getSettings = jest.fn().mockReturnValue({
      slackToken: null,
    });
  });

  describe('OAuth URL生成', () => {
    it('正しいOAuth URLが生成される', () => {
      const url = authManager.generateAuthUrl();
      
      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('scope=channels%3Aread%2Cchannels%3Ahistory%2Cusers%3Aread');
      expect(url).toContain('redirect_uri=obsidian%3A%2F%2Fslack-sync%2Fauth%2Fcallback');
      expect(url).toContain('state=');
    });

    it('stateパラメータが毎回異なる値になる', () => {
      const url1 = authManager.generateAuthUrl();
      const url2 = authManager.generateAuthUrl();
      
      const state1 = new URL(url1).searchParams.get('state');
      const state2 = new URL(url2).searchParams.get('state');
      
      expect(state1).not.toBe(state2);
      expect(state1).toHaveLength(32); // 32文字のランダム文字列
    });

    it('client_idが設定されていない場合はエラーを投げる', () => {
      // client_idを設定しない状態でテスト
      const noIdAuthManager = new SlackAuthManager(settingsManager, mockCrypto as any);
      expect(() => noIdAuthManager.generateAuthUrl()).toThrow('Slack Client IDが設定されていません');
    });
  });

  describe('認証コード処理', () => {
    let validState: string;

    beforeEach(() => {
      // 事前にOAuth URLを生成してstateを設定
      const url = authManager.generateAuthUrl();
      validState = new URL(url).searchParams.get('state') || '';
    });

    it('有効な認証コードで認証が成功する', async () => {
      const mockTokenResponse = {
        ok: true,
        access_token: 'xoxb-test-token',
        team: { id: 'T123', name: 'Test Team' },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      mockCrypto.encrypt.mockReturnValue('encrypted-token');

      const result = await authManager.handleAuthCallback('valid-code', validState);

      expect(result.success).toBe(true);
      expect(mockCrypto.encrypt).toHaveBeenCalledWith('xoxb-test-token');
      expect(settingsManager.updateSettings).toHaveBeenCalledWith({
        slackToken: 'encrypted-token',
      });
    });

    it('無効なstateパラメータの場合はエラーを返す', async () => {
      const result = await authManager.handleAuthCallback('code', 'invalid-state');

      expect(result.success).toBe(false);
      expect(result.error).toContain('無効な認証状態');
    });

    it('Slack APIエラーの場合は適切にハンドリングする', async () => {
      const mockErrorResponse = {
        ok: false,
        error: 'invalid_code',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      });

      const result = await authManager.handleAuthCallback('invalid-code', validState);

      expect(result.success).toBe(false);
      expect(result.error).toContain('認証に失敗しました');
    });

    it('ネットワークエラーの場合は適切にハンドリングする', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await authManager.handleAuthCallback('code', validState);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ネットワークエラー');
    });
  });

  describe('トークン管理', () => {
    it('トークンが暗号化されて保存される', async () => {
      mockCrypto.encrypt.mockReturnValue('encrypted-token');
      
      await authManager.saveToken('xoxb-test-token');

      expect(mockCrypto.encrypt).toHaveBeenCalledWith('xoxb-test-token');
      expect(settingsManager.updateSettings).toHaveBeenCalledWith({
        slackToken: 'encrypted-token',
      });
    });

    it('保存されたトークンが正しく復号化される', async () => {
      mockCrypto.decrypt.mockReturnValue('xoxb-test-token');
      settingsManager.getSettings = jest.fn().mockReturnValue({
        slackToken: 'encrypted-token',
      });

      const token = await authManager.getDecryptedToken();

      expect(mockCrypto.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(token).toBe('xoxb-test-token');
    });

    it('トークンが設定されていない場合はnullを返す', async () => {
      settingsManager.getSettings = jest.fn().mockReturnValue({
        slackToken: null,
      });

      const token = await authManager.getDecryptedToken();

      expect(token).toBe(null);
    });

    it('復号化に失敗した場合はエラーを投げる', async () => {
      mockCrypto.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      settingsManager.getSettings = jest.fn().mockReturnValue({
        slackToken: 'corrupted-token',
      });

      await expect(authManager.getDecryptedToken()).rejects.toThrow('トークンの復号化に失敗しました');
    });
  });

  describe('トークン検証', () => {
    it('有効なトークンの場合は成功を返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          user: { id: 'U123', name: 'Test User' },
        }),
      });

      const result = await authManager.validateToken('xoxb-valid-token');

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer xoxb-valid-token',
          }),
        })
      );
    });

    it('無効なトークンの場合は失敗を返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ok: false,
          error: 'invalid_auth',
        }),
      });

      const result = await authManager.validateToken('xoxb-invalid-token');

      expect(result.success).toBe(false);
    });
  });

  describe('認証状態管理', () => {
    it('認証済みの場合はtrueを返す', async () => {
      authManager.getDecryptedToken = jest.fn().mockResolvedValue('xoxb-token');
      authManager.validateToken = jest.fn().mockResolvedValue({ success: true });

      const isAuthenticated = await authManager.isAuthenticated();

      expect(isAuthenticated).toBe(true);
    });

    it('未認証の場合はfalseを返す', async () => {
      authManager.getDecryptedToken = jest.fn().mockResolvedValue(null);

      const isAuthenticated = await authManager.isAuthenticated();

      expect(isAuthenticated).toBe(false);
    });

    it('無効なトークンの場合はfalseを返す', async () => {
      authManager.getDecryptedToken = jest.fn().mockResolvedValue('xoxb-token');
      authManager.validateToken = jest.fn().mockResolvedValue({ success: false });

      const isAuthenticated = await authManager.isAuthenticated();

      expect(isAuthenticated).toBe(false);
    });
  });

  describe('ログアウト', () => {
    it('ログアウト時にトークンが削除される', async () => {
      await authManager.logout();

      expect(settingsManager.updateSettings).toHaveBeenCalledWith({
        slackToken: null,
      });
    });
  });
});