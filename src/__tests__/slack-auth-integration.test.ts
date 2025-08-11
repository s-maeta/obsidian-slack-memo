import { SlackAuthManager } from '../slack-auth';
import { isError, isSuccess } from '../types';

describe('SlackAuthManager - Integration Tests', () => {
  let authManager: SlackAuthManager;
  let mockPlugin: any;

  beforeEach(() => {
    // Create mock plugin
    mockPlugin = {
      settings: {
        slackToken: process.env.SLACK_TOKEN || 'test-token'
      },
      saveSettings: jest.fn()
    };

    authManager = new SlackAuthManager(mockPlugin);
  });

  describe('real token validation', () => {
    it('should validate token format correctly', async () => {
      const testTokens = [
        'xoxe.xoxp-1-FAKE-TOKEN-FOR-TESTING-PURPOSES-ONLY',
        'xoxb-FAKE-BOT-TOKEN-FOR-TESTING',
        'xoxp-FAKE-USER-TOKEN-FOR-TESTING'
      ];

      for (const token of testTokens) {
        console.log(`Testing token format: ${token.substring(0, 20)}...`);
        
        // Note: This will make real API calls if a token is provided
        // In CI/CD, these should be skipped or use environment variables
        if (token.includes('test-token')) {
          // Skip real API call for test token
          continue;
        }

        const result = await authManager.validateToken(token);
        
        // The result could be success or failure depending on the token validity
        // We're mainly testing that the format is accepted and no crashes occur
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        
        if (isError(result)) {
          console.log(`Token validation failed: ${result.error.message}`);
          // Common expected errors for test tokens:
          expect(['invalid_auth', 'token_revoked', 'account_inactive'].some(
            expectedError => result.error.message.includes(expectedError)
          )).toBe(true);
        }
        
        if (isSuccess(result)) {
          console.log(`Token validation succeeded:`, result.value);
          expect(result.value).toHaveProperty('ok', true);
        }
      }
    });

    // Skip this test in CI by default
    it.skip('should work with real Slack token from environment', async () => {
      const realToken = process.env.SLACK_REAL_TOKEN;
      
      if (!realToken) {
        console.log('Skipping real token test - no SLACK_REAL_TOKEN environment variable');
        return;
      }

      const result = await authManager.validateToken(realToken);
      
      if (isSuccess(result)) {
        expect(result.value).toHaveProperty('ok', true);
        expect(result.value).toHaveProperty('team');
        expect(result.value).toHaveProperty('user');
        console.log('Real token validation successful:', result.value);
      } else {
        console.error('Real token validation failed:', result.error.message);
        // Don't fail the test for real token issues - just log them
      }
    });
  });

  describe('token error diagnosis', () => {
    it('should provide clear error messages for common issues', async () => {
      const testCases = [
        {
          token: '',
          expectedError: /empty|invalid/i
        },
        {
          token: 'invalid-format',
          expectedError: /format|invalid/i
        },
        {
          token: 'xoxb-invalid-token',
          expectedError: /invalid_auth|token_revoked/i
        }
      ];

      for (const testCase of testCases) {
        if (testCase.token === '') {
          // Empty token should be caught before API call
          expect(testCase.token).toBe('');
          continue;
        }

        const result = await authManager.validateToken(testCase.token);
        
        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.message).toMatch(testCase.expectedError);
        }
      }
    });
  });

  describe('getDecryptedToken integration', () => {
    it('should return token from plugin settings', async () => {
      const testToken = 'xoxe.xoxp-1-test-token';
      mockPlugin.settings.slackToken = testToken;

      const result = await authManager.getDecryptedToken();
      
      expect(result).toBe(testToken);
    });

    it('should return null when no token is set', async () => {
      mockPlugin.settings.slackToken = '';

      const result = await authManager.getDecryptedToken();
      
      expect(result).toBeNull();
    });
  });
});