import { SettingsManager } from './settings';
import { CryptoManager } from './crypto';
import { Result } from './types';

export interface AuthResult {
  success: boolean;
  error?: string;
  team?: {
    id: string;
    name: string;
  };
}

export interface SlackAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  team?: {
    id: string;
    name: string;
  };
  error?: string;
}

export class SlackAuthManager {
  private settingsManager: SettingsManager;
  private cryptoManager: CryptoManager;
  private currentState: string | null = null;

  // Slack App設定
  private readonly CLIENT_ID: string;
  private readonly CLIENT_SECRET: string;
  private readonly REDIRECT_URI = 'obsidian://slack-sync/auth/callback';
  private readonly SCOPES = ['channels:read', 'channels:history', 'users:read'];

  constructor(settingsManager: SettingsManager, cryptoManager?: CryptoManager, clientId?: string, clientSecret?: string) {
    this.settingsManager = settingsManager;
    this.cryptoManager = cryptoManager || new CryptoManager();
    this.CLIENT_ID = clientId || process.env.SLACK_CLIENT_ID || 'your-slack-client-id';
    this.CLIENT_SECRET = clientSecret || process.env.SLACK_CLIENT_SECRET || 'your-slack-client-secret';
  }

  generateAuthUrl(): string {
    if (!this.CLIENT_ID || this.CLIENT_ID === 'your-slack-client-id') {
      throw new Error('Slack Client IDが設定されていません');
    }

    // CSRF保護用のstateパラメータを生成
    this.currentState = this.generateRandomString(32);

    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES.join(','),
      redirect_uri: this.REDIRECT_URI,
      state: this.currentState,
      response_type: 'code',
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleAuthCallback(code: string, state: string): Promise<AuthResult> {
    try {
      // State検証
      if (!this.currentState || state !== this.currentState) {
        return {
          success: false,
          error: '無効な認証状態です。再度認証を行ってください。',
        };
      }

      // 認証コードをアクセストークンに交換
      const tokenResponse = await this.exchangeCodeForToken(code);

      if (!tokenResponse.ok || !tokenResponse.access_token) {
        return {
          success: false,
          error: `認証に失敗しました: ${tokenResponse.error || 'Unknown error'}`,
        };
      }

      // トークンを暗号化して保存
      await this.saveToken(tokenResponse.access_token);

      // Stateをリセット
      this.currentState = null;

      return {
        success: true,
        team: tokenResponse.team,
      };
    } catch (error) {
      if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('ENOTFOUND')) {
        return {
          success: false,
          error: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
        };
      }

      return {
        success: false,
        error: `認証処理中にエラーが発生しました: ${error.message}`,
      };
    }
  }

  async saveToken(token: string): Promise<void> {
    const encryptedToken = this.cryptoManager.encrypt(token);
    await this.settingsManager.updateSettings({
      slackToken: encryptedToken,
    });
  }

  async getDecryptedToken(): Promise<string | null> {
    const settings = this.settingsManager.getSettings();
    
    if (!settings.slackToken) {
      return null;
    }

    try {
      return this.cryptoManager.decrypt(settings.slackToken);
    } catch (error) {
      throw new Error('トークンの復号化に失敗しました: ' + error.message);
    }
  }

  async validateToken(token: string): Promise<Result<any>> {
    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = await response.json();

      if (data.ok) {
        return { success: true, value: data };
      } else {
        return { success: false, error: new Error(data.error) };
      }
    } catch (error) {
      return { success: false, error };
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getDecryptedToken();
      if (!token) {
        return false;
      }

      const validation = await this.validateToken(token);
      return validation.success;
    } catch (error) {
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.settingsManager.updateSettings({
      slackToken: null,
    });
  }

  private async exchangeCodeForToken(code: string): Promise<SlackAuthResponse> {
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      code,
      redirect_uri: this.REDIRECT_URI,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    return response.json();
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}