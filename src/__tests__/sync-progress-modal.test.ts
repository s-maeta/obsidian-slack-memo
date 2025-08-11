// TASK-302: 同期状態表示UI - SyncProgressModal テストスイート

import { SyncProgressModal } from '../sync-progress-modal';
import { SyncStatus } from '../sync-status-types';

// モックHTMLElement
class TestHTMLElement {
  textContent: string = '';
  style: any = { width: '', display: '' };
  
  createDiv(options?: any): TestHTMLElement {
    const el = new TestHTMLElement();
    if (options?.cls) el.className = options.cls;
    return el;
  }
  
  createEl(tagName: string, options?: any): TestHTMLElement {
    const el = new TestHTMLElement();
    if (options?.text) el.textContent = options.text;
    if (options?.cls) el.className = options.cls;
    return el;
  }
  
  setAttribute(name: string, value: string) {}
  addEventListener(event: string, handler: Function) {}
  querySelector(selector: string): TestHTMLElement | null {
    return new TestHTMLElement();
  }
  
  className: string = '';
}

// Obsidian Modal のモック
class TestModal {
  isOpen: boolean = false;
  containerEl = new TestHTMLElement();
  contentEl = new TestHTMLElement();
  titleEl = new TestHTMLElement();
  
  constructor(app: any) {}
  
  open() {
    this.isOpen = true;
    (this as any).onOpen?.();
  }
  
  close() {
    this.isOpen = false;
  }
}

// Obsidian のモック
jest.mock('obsidian', () => ({
  Modal: TestModal,
  App: jest.fn()
}));

describe('SyncProgressModal', () => {
  let syncProgressModal: SyncProgressModal;
  let mockApp: any;

  beforeEach(() => {
    mockApp = {};
    syncProgressModal = new SyncProgressModal(mockApp);
  });

  describe('Modal Operations', () => {
    // TC-PM-001: モーダル初期表示
    test('TC-PM-001: should open modal with initial UI elements', () => {
      syncProgressModal.open();
      
      expect(syncProgressModal.isOpen).toBe(true);
      expect(syncProgressModal.titleEl.textContent).toContain('Slack同期状態');
    });

    // TC-PM-006: 閉じるボタン動作
    test('TC-PM-006: should close modal when close button clicked', () => {
      syncProgressModal.open();
      
      syncProgressModal.close();
      
      expect(syncProgressModal.isOpen).toBe(false);
    });
  });

  describe('Progress Display', () => {
    beforeEach(() => {
      syncProgressModal.open();
    });

    // TC-PM-002: 進捗バー表示
    test('TC-PM-002: should display progress bar with correct percentage', () => {
      const progress = {
        current: 3,
        total: 10,
        percentage: 30
      };
      
      syncProgressModal.updateProgress(progress);
      
      const progressBar = syncProgressModal.containerEl.querySelector('[data-testid="progress-bar"]');
      const progressText = syncProgressModal.containerEl.querySelector('[data-testid="progress-text"]');
      
      expect(progressBar).toBeTruthy();
      expect(progressText?.textContent).toContain('30%');
    });

    // TC-PM-003: 現在処理チャンネル表示
    test('TC-PM-003: should display current channel being processed', () => {
      const progress = {
        current: 3,
        total: 10,
        percentage: 30,
        currentChannel: '#general'
      };
      
      syncProgressModal.updateProgress(progress);
      
      const currentChannelEl = syncProgressModal.containerEl.querySelector('[data-testid="current-channel"]');
      expect(currentChannelEl?.textContent).toContain('処理中: #general');
    });

    // TC-PM-008: 自動更新機能
    test('TC-PM-008: should auto-update when progress changes externally', () => {
      const progress1 = { current: 2, total: 10, percentage: 20 };
      const progress2 = { current: 5, total: 10, percentage: 50 };
      
      syncProgressModal.updateProgress(progress1);
      let progressText = syncProgressModal.containerEl.querySelector('[data-testid="progress-text"]');
      expect(progressText?.textContent).toContain('20%');
      
      syncProgressModal.updateProgress(progress2);
      progressText = syncProgressModal.containerEl.querySelector('[data-testid="progress-text"]');
      expect(progressText?.textContent).toContain('50%');
    });
  });

  describe('Log Display', () => {
    beforeEach(() => {
      syncProgressModal.open();
    });

    // TC-PM-004: ログ表示機能
    test('TC-PM-004: should display log messages with timestamps', () => {
      const logMessage = 'チャンネル #general の処理を開始';
      
      syncProgressModal.addLogMessage(logMessage);
      
      const logArea = syncProgressModal.containerEl.querySelector('[data-testid="log-area"]');
      expect(logArea?.textContent).toContain(logMessage);
    });
  });

  describe('Action Buttons', () => {
    beforeEach(() => {
      syncProgressModal.open();
    });

    // TC-PM-005: キャンセルボタン動作
    test('TC-PM-005: should show cancel button during sync and handle clicks', () => {
      syncProgressModal.updateStatus(SyncStatus.SYNCING);
      
      const cancelButton = syncProgressModal.containerEl.querySelector('[data-testid="cancel-button"]');
      expect(cancelButton).toBeTruthy();
      
      const cancelHandler = jest.fn();
      syncProgressModal.onCancel(cancelHandler);
      
      // キャンセルボタンクリックをシミュレート
      const clickEvent = new Event('click');
      cancelButton?.dispatchEvent(clickEvent);
      
      expect(cancelHandler).toHaveBeenCalled();
    });

    // TC-PM-007: 再試行ボタン表示
    test('TC-PM-007: should show retry button when in error state', () => {
      syncProgressModal.updateStatus(SyncStatus.ERROR);
      
      const retryButton = syncProgressModal.containerEl.querySelector('[data-testid="retry-button"]');
      expect(retryButton).toBeTruthy();
      
      const retryHandler = jest.fn();
      syncProgressModal.onRetry(retryHandler);
    });
  });

  describe('Status Display', () => {
    beforeEach(() => {
      syncProgressModal.open();
    });

    // TC-PM-009: エラーメッセージ表示
    test('TC-PM-009: should display error message and details', () => {
      const errorMessage = 'ネットワーク接続エラーが発生しました';
      
      syncProgressModal.showError(errorMessage);
      
      const errorEl = syncProgressModal.containerEl.querySelector('[data-testid="error-message"]');
      expect(errorEl?.textContent).toContain(errorMessage);
    });

    // TC-PM-010: 完了状態の表示
    test('TC-PM-010: should display completion message and statistics', () => {
      const stats = {
        messagesCount: 42,
        duration: 15000
      };
      
      syncProgressModal.showComplete(stats);
      
      const completeEl = syncProgressModal.containerEl.querySelector('[data-testid="complete-message"]');
      expect(completeEl?.textContent).toContain('42件のメッセージ');
      expect(completeEl?.textContent).toContain('15秒');
    });
  });

  describe('Modal Lifecycle', () => {
    // モーダルのライフサイクルテスト
    test('should clean up resources on close', () => {
      syncProgressModal.open();
      expect(syncProgressModal.isOpen).toBe(true);
      
      syncProgressModal.close();
      expect(syncProgressModal.isOpen).toBe(false);
    });
  });
});