import { SlackAuthManager } from '../slack-auth';
import { isError } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('SlackAuthManager - validateToken', () => {
  let authManager: SlackAuthManager;
  let mockPlugin: any;

  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Create mock plugin
    mockPlugin = {
      settings: {
        slackToken: 'test-token'
      },
      saveSettings: jest.fn()
    };

    authManager = new SlackAuthManager(mockPlugin);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('successful validation', () => {
    it('should return success for valid token', async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        team: 'Test Team',
        user: 'test_user',
        team_id: 'T12345'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('xoxb-valid-token');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockResponse);
      }
      expect(fetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer xoxb-valid-token',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    });

    it('should handle xoxe token format', async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        team: 'Test Team',
        user: 'test_user',
        team_id: 'T12345'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('xoxe.xoxp-1-test-token');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockResponse);
      }
    });
  });

  describe('failed validation', () => {
    it('should return error for invalid_auth', async () => {
      // Arrange
      const mockResponse = {
        ok: false,
        error: 'invalid_auth'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('invalid-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('invalid_auth');
      }
    });

    it('should return error for token_revoked', async () => {
      // Arrange
      const mockResponse = {
        ok: false,
        error: 'token_revoked'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('revoked-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('token_revoked');
      }
    });

    it('should handle HTTP 401 Unauthorized', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 401,
        json: jest.fn().mockResolvedValueOnce({
          ok: false,
          error: 'invalid_auth'
        })
      });

      // Act
      const result = await authManager.validateToken('unauthorized-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('invalid_auth');
      }
    });

    it('should handle network errors', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await authManager.validateToken('any-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('Network error');
      }
    });

    it('should handle fetch timeout', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Request timeout'));

      // Act
      const result = await authManager.validateToken('timeout-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('Request timeout');
      }
    });

    it('should provide default error message for undefined error', async () => {
      // Arrange
      const mockResponse = {
        ok: false
        // error field is undefined
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('undefined-error-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('認証に失敗しました');
      }
    });
  });

  describe('different token formats', () => {
    const testTokenFormats = [
      { format: 'xoxb-', description: 'Bot User OAuth Token' },
      { format: 'xoxp-', description: 'User OAuth Token' },
      { format: 'xoxe.xoxp-', description: 'Refresh Token format' },
    ];

    testTokenFormats.forEach(({ format, description }) => {
      it(`should accept ${description} (${format})`, async () => {
        // Arrange
        const mockResponse = {
          ok: true,
          team: 'Test Team',
          user: 'test_user'
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockResponse)
        });

        // Act
        const testToken = format.includes('xoxe') 
          ? 'xoxe.xoxp-1-test-token-here'
          : `${format}1234567890-test-token-here`;
        
        const result = await authManager.validateToken(testToken);

        // Assert
        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      });
    });
  });

  describe('real-world error scenarios', () => {
    it('should handle rate limiting', async () => {
      // Arrange
      const mockResponse = {
        ok: false,
        error: 'ratelimited'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 429,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('rate-limited-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('ratelimited');
      }
    });

    it('should handle missing scope errors', async () => {
      // Arrange
      const mockResponse = {
        ok: false,
        error: 'missing_scope',
        needed: 'channels:read',
        provided: 'identify'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await authManager.validateToken('insufficient-scope-token');

      // Assert
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toBe('missing_scope');
      }
    });
  });

  describe('console logging', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log validation attempt', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ ok: true })
      });

      // Act
      await authManager.validateToken('test-token');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('SlackAuthManager: Validating token...');
    });

    it('should log response status and data', async () => {
      // Arrange
      const mockResponse = { ok: true, team: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      await authManager.validateToken('test-token');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('SlackAuthManager: Validation response status:', 200);
      expect(consoleSpy).toHaveBeenCalledWith('SlackAuthManager: Validation response data:', mockResponse);
    });
  });
});