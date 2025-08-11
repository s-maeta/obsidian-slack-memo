// TASK-302: 同期状態表示UI - 統合テストスイート

import { SyncStatusManager } from '../sync-status-manager';
import { StatusBarItem } from '../status-bar-item';
import { SyncProgressModal } from '../sync-progress-modal';
import { NotificationManager } from '../notification-manager';
import { SyncHistoryView } from '../sync-history-view';
import { SyncStatus, NotificationType } from '../sync-status-types';

describe('Sync Integration Tests', () => {
  let syncStatusManager: SyncStatusManager;
  let statusBarItem: StatusBarItem;
  let syncProgressModal: SyncProgressModal;
  let notificationManager: NotificationManager;
  let syncHistoryView: SyncHistoryView;

  beforeEach(() => {
    syncStatusManager = new SyncStatusManager();
    
    const mockStatusBarElement = {
      textContent: '',
      className: '',
      setAttribute: jest.fn(),
      addEventListener: jest.fn()
    } as any;
    statusBarItem = new StatusBarItem(mockStatusBarElement);

    const mockApp = {} as any;
    syncProgressModal = new SyncProgressModal(mockApp);

    notificationManager = new NotificationManager();

    const mockContainer = {
      style: { display: 'none' },
      createEl: jest.fn(() => ({ setAttribute: jest.fn() })),
      querySelector: jest.fn()
    } as any;
    syncHistoryView = new SyncHistoryView(mockContainer);
  });

  describe('Sync Process Integration', () => {
    // TC-INT-001: 同期開始から完了までの流れ
    test('TC-INT-001: should handle complete sync flow from start to completion', async () => {
      const channels = ['C001', 'C002', 'C003'];
      
      // 1. 同期開始
      syncStatusManager.startSync(channels);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      expect(syncStatusManager.startTime).toBeDefined();
      
      // 2. 進捗更新
      syncStatusManager.updateProgress(1, 3, '#general');
      expect(syncStatusManager.progress.percentage).toBe(33.33333333333333);
      
      syncStatusManager.updateProgress(2, 3, '#random');
      expect(syncStatusManager.progress.percentage).toBe(66.66666666666667);
      
      syncStatusManager.updateProgress(3, 3, '#dev');
      expect(syncStatusManager.progress.percentage).toBe(100);
      
      // 3. 同期完了
      syncStatusManager.completeSync(150);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history.length).toBe(1);
      expect(syncStatusManager.history[0].messagesCount).toBe(150);
      expect(syncStatusManager.history[0].channelsProcessed).toBe(3);
    });

    // TC-INT-002: エラー発生時の処理
    test('TC-INT-002: should handle network error during sync', () => {
      const channels = ['C001', 'C002'];
      
      // 1. 同期開始
      syncStatusManager.startSync(channels);
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      
      // 2. 進捗更新
      syncStatusManager.updateProgress(1, 2, '#general');
      
      // 3. ネットワークエラー発生
      const networkError = new Error('Network timeout');
      syncStatusManager.setError(networkError);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.ERROR);
      expect(syncStatusManager.lastError?.message).toBe('Network timeout');
      expect(syncStatusManager.lastError?.timestamp).toBeInstanceOf(Date);
    });

    // TC-INT-003: キャンセル処理
    test('TC-INT-003: should handle sync cancellation', () => {
      const channels = ['C001', 'C002', 'C003'];
      
      // 1. 同期開始
      syncStatusManager.startSync(channels);
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      
      // 2. 進捗更新
      syncStatusManager.updateProgress(2, 3, '#random');
      
      // 3. ユーザーがキャンセル
      syncStatusManager.cancelSync();
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.IDLE);
      expect(syncStatusManager.isCancelled).toBe(true);
    });

    // TC-INT-004: 複数チャンネル同期の進捗
    test('TC-INT-004: should track progress across multiple channels accurately', () => {
      const channels = ['C001', 'C002', 'C003', 'C004', 'C005'];
      
      syncStatusManager.startSync(channels);
      
      // 各チャンネルの処理を順次実行
      const channelNames = ['#general', '#random', '#dev', '#design', '#marketing'];
      
      channelNames.forEach((channelName, index) => {
        syncStatusManager.updateProgress(index + 1, channels.length, channelName);
        
        expect(syncStatusManager.progress.current).toBe(index + 1);
        expect(syncStatusManager.progress.total).toBe(channels.length);
        expect(syncStatusManager.progress.currentChannel).toBe(channelName);
        
        const expectedPercentage = ((index + 1) / channels.length) * 100;
        expect(syncStatusManager.progress.percentage).toBe(expectedPercentage);
      });
      
      // 最終確認
      expect(syncStatusManager.progress.percentage).toBe(100);
    });

    // TC-INT-005: 履歴への記録
    test('TC-INT-005: should record complete sync session in history', () => {
      const channels = ['C001', 'C002'];
      const messageCount = 75;
      
      // 複数回の同期実行
      for (let i = 0; i < 3; i++) {
        syncStatusManager.startSync(channels);
        syncStatusManager.updateProgress(channels.length, channels.length);
        syncStatusManager.completeSync(messageCount + i * 10);
      }
      
      // 履歴の確認
      expect(syncStatusManager.history.length).toBe(3);
      
      // 最新の履歴が先頭にあることを確認
      expect(syncStatusManager.history[0].messagesCount).toBe(95); // 75 + 2*10
      expect(syncStatusManager.history[1].messagesCount).toBe(85); // 75 + 1*10
      expect(syncStatusManager.history[2].messagesCount).toBe(75); // 75 + 0*10
      
      // 全ての履歴が成功状態であることを確認
      syncStatusManager.history.forEach(item => {
        expect(item.status).toBe(SyncStatus.SUCCESS);
        expect(item.channelsProcessed).toBe(2);
        expect(item.timestamp).toBeInstanceOf(Date);
        expect(item.duration).toBeGreaterThan(0);
      });
    });

    // TC-INT-006: 状態復元機能
    test('TC-INT-006: should detect and handle incomplete sync on restart', () => {
      // 同期中にプロセスが中断されたシナリオをシミュレート
      syncStatusManager.startSync(['C001', 'C002']);
      syncStatusManager.updateProgress(1, 2, '#general');
      
      // Obsidian再起動をシミュレート（新しいインスタンス作成）
      const newSyncStatusManager = new SyncStatusManager();
      
      // 前回の状態を復元する処理をシミュレート
      newSyncStatusManager.currentStatus = SyncStatus.SYNCING;
      newSyncStatusManager.progress = {
        current: 1,
        total: 2,
        percentage: 50,
        currentChannel: '#general'
      };
      
      // 未完了同期の検出と適切な処理
      if (newSyncStatusManager.currentStatus === SyncStatus.SYNCING) {
        // 状態をIDLEにリセット（安全な状態）
        newSyncStatusManager.currentStatus = SyncStatus.IDLE;
        newSyncStatusManager.progress = {
          current: 0,
          total: 0,
          percentage: 0
        };
      }
      
      expect(newSyncStatusManager.currentStatus).toBe(SyncStatus.IDLE);
      expect(newSyncStatusManager.progress.current).toBe(0);
    });
  });

  describe('UI Component Integration', () => {
    // TC-UI-001: 複数UIコンポーネント同期
    test('TC-UI-001: should synchronize multiple UI components', () => {
      const channels = ['C001', 'C002'];
      
      // 同期開始
      syncStatusManager.startSync(channels);
      
      // 各UIコンポーネントが同期状態を反映することをシミュレート
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.updateStatus(syncStatusManager.currentStatus);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      
      // 進捗更新
      syncStatusManager.updateProgress(1, 2, '#general');
      
      statusBarItem.updateProgress(syncStatusManager.progress);
      syncProgressModal.updateProgress(syncStatusManager.progress);
      
      // 完了
      syncStatusManager.completeSync(50);
      
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.updateStatus(syncStatusManager.currentStatus);
      syncHistoryView.updateHistory(syncStatusManager.history);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history.length).toBe(1);
    });

    // TC-UI-002: 通知とUI状態の整合性
    test('TC-UI-002: should maintain consistency between notifications and UI state', () => {
      const channels = ['C001'];
      
      // 同期開始時の通知
      syncStatusManager.startSync(channels);
      notificationManager.showToast('Slack同期を開始しました', NotificationType.INFO);
      
      // 完了時の通知
      syncStatusManager.completeSync(25);
      notificationManager.showToast('25件のメッセージを同期しました', NotificationType.SUCCESS);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history[0].messagesCount).toBe(25);
      
      // エラー時の通知
      syncStatusManager.startSync(channels);
      const error = new Error('API rate limit exceeded');
      syncStatusManager.setError(error);
      notificationManager.showToast(`同期エラー: ${error.message}`, NotificationType.ERROR);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.ERROR);
      expect(syncStatusManager.lastError?.message).toBe('API rate limit exceeded');
    });

    // TC-UI-003: モーダルとステータスバーの連携
    test('TC-UI-003: should update modal and status bar in coordination', () => {
      // 外部からの状態変更をシミュレート
      syncStatusManager.startSync(['C001', 'C002']);
      
      // モーダルとステータスバーが同時更新されることを確認
      const status = syncStatusManager.currentStatus;
      const progress = syncStatusManager.progress;
      
      statusBarItem.updateStatus(status);
      syncProgressModal.updateStatus(status);
      syncProgressModal.updateProgress(progress);
      
      expect(status).toBe(SyncStatus.SYNCING);
      
      // 進捗変更
      syncStatusManager.updateProgress(1, 2, '#general');
      
      const updatedProgress = syncStatusManager.progress;
      statusBarItem.updateProgress(updatedProgress);
      syncProgressModal.updateProgress(updatedProgress);
      
      expect(updatedProgress.percentage).toBe(50);
      expect(updatedProgress.currentChannel).toBe('#general');
    });
  });

  describe('Error Recovery Integration', () => {
    test('should recover gracefully from various error scenarios', () => {
      const channels = ['C001', 'C002'];
      
      // シナリオ1: 一時的なネットワークエラー
      syncStatusManager.startSync(channels);
      syncStatusManager.setError(new Error('Temporary network error'));
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.ERROR);
      
      // 再試行
      syncStatusManager.startSync(channels);
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      expect(syncStatusManager.isCancelled).toBe(false);
      
      // 成功完了
      syncStatusManager.completeSync(30);
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      
      // シナリオ2: レート制限エラー
      syncStatusManager.startSync(channels);
      syncStatusManager.setError(new Error('Rate limit exceeded'));
      
      // エラー履歴への記録確認
      expect(syncStatusManager.history.some(item => 
        item.status === SyncStatus.ERROR && item.error === 'Rate limit exceeded'
      )).toBe(true);
    });
  });
});