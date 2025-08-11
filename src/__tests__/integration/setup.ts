// TASK-501: 統合テストスイート - テストセットアップ
// GREENフェーズ: テスト環境初期化

import { jest } from '@jest/globals';

// Global test timeout for integration tests
jest.setTimeout(60000); // 1分デフォルトタイムアウト

// Mock global objects
global.performance = global.performance || {
  now: () => Date.now(),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2048 * 1024 * 1024
  }
};

// Mock process if not available (browser environment)
if (typeof global.process === 'undefined') {
  global.process = {
    memoryUsage: () => ({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: 50 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    }),
    env: {},
    cwd: () => '/test',
    platform: 'test'
  } as any;
}

// Console setup for better test output
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  if (args[0] && args[0].includes && args[0].includes('Not implemented')) {
    // Suppress "Not implemented" errors during GREEN phase
    return;
  }
  originalError.apply(console, args);
};

console.warn = (...args: any[]) => {
  if (args[0] && args[0].includes && args[0].includes('Not implemented')) {
    // Suppress "Not implemented" warnings during GREEN phase
    return;
  }
  originalWarn.apply(console, args);
};

// Global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinLast(milliseconds: number): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeWithinLast(received: number, expected: number) {
    const now = Date.now();
    const timeDiff = now - received;
    
    return {
      message: () =>
        `expected ${received} to be within last ${expected}ms (actual diff: ${timeDiff}ms)`,
      pass: timeDiff <= expected && timeDiff >= 0
    };
  }
});

// Setup and teardown
beforeAll(() => {
  console.log('🧪 Starting integration test suite...');
});

afterAll(() => {
  console.log('✅ Integration test suite completed');
  
  // Restore console methods
  console.error = originalError;
  console.warn = originalWarn;
});