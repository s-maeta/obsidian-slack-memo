// Jest setup file for Obsidian Slack Sync Plugin tests

// Mock Obsidian API
global.window = {} as any;
global.document = {} as any;

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    // Comment out console.log in tests unless explicitly needed
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep error and warn for debugging
    warn: console.warn,
    error: console.error,
  };
}

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
(global as any).mockPlugin = {
  loadData: jest.fn(),
  saveData: jest.fn(),
  addSettingTab: jest.fn(),
  addCommand: jest.fn(),
  addRibbonIcon: jest.fn(),
  addStatusBarItem: jest.fn(),
  registerDomEvent: jest.fn(),
  registerInterval: jest.fn(),
  app: {
    workspace: {
      getActiveViewOfType: jest.fn(),
    },
    vault: {
      create: jest.fn(),
      modify: jest.fn(),
      adapter: {
        exists: jest.fn(),
        mkdir: jest.fn(),
      },
    },
  },
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
