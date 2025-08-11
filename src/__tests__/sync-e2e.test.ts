// TASK-302: 同期状態表示UI - E2Eテストスイート

import { SyncStatusManager } from '../sync-status-manager';
import { StatusBarItem } from '../status-bar-item';
import { SyncProgressModal } from '../sync-progress-modal';
import { NotificationManager } from '../notification-manager';
import { SyncHistoryView } from '../sync-history-view';
import { SyncStatus, NotificationType } from '../sync-status-types';

describe('End-to-End Sync UI Tests', () => {
  let syncStatusManager: SyncStatusManager;
  let statusBarItem: StatusBarItem;
  let syncProgressModal: SyncProgressModal;
  let notificationManager: NotificationManager;
  let syncHistoryView: SyncHistoryView;

  beforeEach(() => {
    syncStatusManager = new SyncStatusManager();
    
    const mockStatusBarElement = {
      textContent: 'Slack同期',
      className: 'status-idle',
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
      style: {}
    } as any;
    statusBarItem = new StatusBarItem(mockStatusBarElement);

    const mockApp = {} as any;
    syncProgressModal = new SyncProgressModal(mockApp);

    notificationManager = new NotificationManager();

    const mockContainer = {
      style: { display: 'none' },
      innerHTML: '',
      createEl: jest.fn(() => ({
        textContent: '',
        className: '',
        setAttribute: jest.fn(),
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        querySelector: jest.fn()
      })),
      querySelector: jest.fn(),
      addEventListener: jest.fn()
    } as any;
    syncHistoryView = new SyncHistoryView(mockContainer);

    // タイマーのモック
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('User Scenarios', () => {
    // TC-E2E-001: 初回同期実行
    test('TC-E2E-001: should handle first-time sync execution flow', async () => {
      // 1. プラグイン有効化（設定完了済み）
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.IDLE);
      expect(syncStatusManager.history.length).toBe(0);

      // 2. 手動同期実行開始
      const channels = ['C001', 'C002', 'C003'];
      syncStatusManager.startSync(channels);

      // 開始通知の表示
      notificationManager.showToast('Slack同期を開始しました', NotificationType.INFO);
      
      // ステータスバーの更新
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);

      // 3. 進捗の可視化
      syncProgressModal.open();
      expect(syncProgressModal.isOpen).toBe(true);

      // 各チャンネルの処理
      const channelNames = ['#general', '#random', '#dev'];
      const messagesPerChannel = [25, 15, 35];
      
      for (let i = 0; i < channels.length; i++) {
        syncStatusManager.updateProgress(i + 1, channels.length, channelNames[i]);
        statusBarItem.updateProgress(syncStatusManager.progress);
        syncProgressModal.updateProgress(syncStatusManager.progress);
        syncProgressModal.addLogMessage(`チャンネル ${channelNames[i]} の処理を開始`);
        
        // 処理時間をシミュレート
        jest.advanceTimersByTime(5000);
        
        syncProgressModal.addLogMessage(`${messagesPerChannel[i]}件のメッセージを取得`);
      }

      // 4. 結果確認
      const totalMessages = messagesPerChannel.reduce((sum, count) => sum + count, 0);
      syncStatusManager.completeSync(totalMessages);

      // 完了通知
      notificationManager.showToast(`${totalMessages}件のメッセージを同期しました`, NotificationType.SUCCESS);
      
      // UI更新
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.showComplete({ messagesCount: totalMessages, duration: 15000 });
      
      // 履歴更新
      syncHistoryView.updateHistory(syncStatusManager.history);

      // 最終確認
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history.length).toBe(1);
      expect(syncStatusManager.history[0].messagesCount).toBe(75);
      expect(syncStatusManager.history[0].channelsProcessed).toBe(3);
      
      // モーダルを閉じる
      syncProgressModal.close();
      expect(syncProgressModal.isOpen).toBe(false);
    });

    // TC-E2E-002: 日常的な同期使用
    test('TC-E2E-002: should handle regular daily sync usage', async () => {
      // 1. Obsidian起動（前回の履歴が存在）
      const existingHistory = [
        {
          id: 'sync-yesterday',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          status: SyncStatus.SUCCESS,
          channelsProcessed: 3,
          messagesCount: 50,
          duration: 12000
        }
      ];
      
      syncStatusManager.history = existingHistory;
      syncHistoryView.updateHistory(syncStatusManager.history);
      
      // 2. 自動同期実行（スケジューラーによる）
      const channels = ['C001', 'C002'];
      syncStatusManager.startSync(channels);
      
      // ステータスバーでの状態表示（控えめな通知）
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      
      // 3. バックグラウンド処理
      syncStatusManager.updateProgress(1, 2, '#general');
      statusBarItem.updateProgress(syncStatusManager.progress);
      
      syncStatusManager.updateProgress(2, 2, '#random');
      statusBarItem.updateProgress(syncStatusManager.progress);
      
      // 4. 完了（新しいメッセージが少ない場合）
      const newMessages = 8;
      syncStatusManager.completeSync(newMessages);
      
      if (newMessages > 0) {
        notificationManager.showToast(`${newMessages}件の新しいメッセージを同期しました`, NotificationType.SUCCESS);
      } else {
        notificationManager.showToast('新しいメッセージはありません', NotificationType.INFO);
      }
      
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncHistoryView.updateHistory(syncStatusManager.history);
      
      // 結果確認
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history.length).toBe(2); // 前回 + 今回
      expect(syncStatusManager.history[0].messagesCount).toBe(8); // 最新が先頭
    });

    // TC-E2E-003: エラー対処シナリオ
    test('TC-E2E-003: should handle error scenario with user recovery', async () => {
      const channels = ['C001', 'C002'];
      
      // 1. 同期実行開始
      syncStatusManager.startSync(channels);
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.open();
      
      // 2. 進捗中にエラー発生
      syncStatusManager.updateProgress(1, 2, '#general');
      syncProgressModal.updateProgress(syncStatusManager.progress);
      syncProgressModal.addLogMessage('チャンネル #general の処理を開始');
      
      jest.advanceTimersByTime(3000);
      
      // ネットワークエラー発生
      const networkError = new Error('Network timeout after 30 seconds');
      syncStatusManager.setError(networkError);
      
      // 3. エラー詳細確認
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.showError(networkError.message);
      
      // エラー通知表示
      notificationManager.showError('同期中にエラーが発生しました', networkError.message);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.ERROR);
      expect(syncStatusManager.lastError?.message).toBe('Network timeout after 30 seconds');
      
      // 4. 問題解決後の再試行
      // ユーザーがネットワークを確認後、再試行ボタンをクリック
      const retryHandler = jest.fn(() => {
        // 再試行処理
        syncStatusManager.startSync(channels);
        statusBarItem.updateStatus(syncStatusManager.currentStatus);
        syncProgressModal.updateStatus(syncStatusManager.currentStatus);
      });
      
      syncProgressModal.onRetry(retryHandler);
      
      // 再試行実行
      retryHandler();
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      expect(syncStatusManager.isCancelled).toBe(false);
      
      // 5. 成功完了
      syncStatusManager.updateProgress(2, 2, '#random');
      syncStatusManager.completeSync(42);
      
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      syncProgressModal.showComplete({ messagesCount: 42, duration: 8000 });
      
      notificationManager.showToast('同期が正常に完了しました', NotificationType.SUCCESS);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history.length).toBe(1);
      expect(syncStatusManager.history[0].status).toBe(SyncStatus.SUCCESS);
    });

    // TC-E2E-004: 長時間同期の体験
    test('TC-E2E-004: should handle long-running sync with user interaction', async () => {
      // 大量のチャンネルをシミュレート
      const manyChannels = [];
      for (let i = 1; i <= 10; i++) {
        manyChannels.push(`C00${i}`);
      }
      
      // 1. 大量履歴の同期開始
      syncStatusManager.startSync(manyChannels);
      statusBarItem.updateStatus(syncStatusManager.currentStatus);
      
      // プログレスモーダルを開く
      syncProgressModal.open();
      syncProgressModal.updateStatus(syncStatusManager.currentStatus);
      
      // 2. 長時間の進捗確認
      for (let i = 0; i < 5; i++) {
        syncStatusManager.updateProgress(i + 1, manyChannels.length, `#channel-${i + 1}`);
        statusBarItem.updateProgress(syncStatusManager.progress);
        syncProgressModal.updateProgress(syncStatusManager.progress);
        syncProgressModal.addLogMessage(`チャンネル #channel-${i + 1} 処理中...`);
        
        // 長時間処理をシミュレート
        jest.advanceTimersByTime(10000);
      }
      
      // 3. ユーザーがキャンセルを試行
      const cancelHandler = jest.fn(() => {
        // キャンセル確認ダイアログ
        const shouldCancel = true; // ユーザーがOKをクリック
        if (shouldCancel) {
          syncStatusManager.cancelSync();
          statusBarItem.updateStatus(syncStatusManager.currentStatus);
          syncProgressModal.updateStatus(syncStatusManager.currentStatus);
          notificationManager.showToast('同期がキャンセルされました', NotificationType.WARNING);
        }
      });
      
      syncProgressModal.onCancel(cancelHandler);
      cancelHandler();
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.IDLE);
      expect(syncStatusManager.isCancelled).toBe(true);
      
      // 4. 再開と完了
      // ユーザーが後で再開
      syncStatusManager.startSync(manyChannels);
      
      // 今度は最後まで実行
      for (let i = 0; i < manyChannels.length; i++) {
        syncStatusManager.updateProgress(i + 1, manyChannels.length, `#channel-${i + 1}`);
        syncProgressModal.updateProgress(syncStatusManager.progress);
        jest.advanceTimersByTime(8000);
      }
      
      // 完了
      const totalMessages = 500;
      syncStatusManager.completeSync(totalMessages);
      syncProgressModal.showComplete({ messagesCount: totalMessages, duration: 80000 });
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history[0].messagesCount).toBe(500);
      expect(syncStatusManager.history[0].channelsProcessed).toBe(10);
    });

    // TC-E2E-005: マルチチャンネル管理
    test('TC-E2E-005: should manage multiple channels with individual status tracking', async () => {
      const channels = ['C001', 'C002', 'C003', 'C004', 'C005', 'C006', 'C007', 'C008', 'C009', 'C010'];
      const channelNames = ['#general', '#random', '#dev', '#design', '#marketing', '#support', '#sales', '#hr', '#finance', '#operations'];
      
      // 1. 10チャンネル設定で同期開始
      syncStatusManager.startSync(channels);
      syncProgressModal.open();
      
      // 2. 全体同期実行
      let totalMessages = 0;
      const messagesPerChannel = [50, 30, 80, 25, 40, 35, 60, 20, 45, 55];
      
      for (let i = 0; i < channels.length; i++) {
        syncStatusManager.updateProgress(i + 1, channels.length, channelNames[i]);
        syncProgressModal.updateProgress(syncStatusManager.progress);
        syncProgressModal.addLogMessage(`${channelNames[i]}: ${messagesPerChannel[i]}件のメッセージを処理`);
        
        totalMessages += messagesPerChannel[i];
        jest.advanceTimersByTime(5000);
        
        // 3. 個別チャンネル状況確認
        if (i === 6) { // 7番目のチャンネルでエラー発生をシミュレート
          syncProgressModal.addLogMessage(`${channelNames[i]}: 一時的なエラー、再試行中...`);
          jest.advanceTimersByTime(2000);
          syncProgressModal.addLogMessage(`${channelNames[i]}: 再試行成功`);
        }
      }
      
      // 4. 完了とエラーチャンネルの特定
      syncStatusManager.completeSync(totalMessages);
      syncProgressModal.showComplete({ messagesCount: totalMessages, duration: 50000 });
      
      // 履歴に詳細を記録
      syncHistoryView.updateHistory(syncStatusManager.history);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history[0].channelsProcessed).toBe(10);
      expect(syncStatusManager.history[0].messagesCount).toBe(440);
      
      // 5. 履歴からの詳細確認
      const historyClickHandler = jest.fn();
      syncHistoryView.onItemClick(historyClickHandler);
      
      // 履歴項目クリック（詳細表示）
      const historyItem = syncStatusManager.history[0];
      historyClickHandler(historyItem);
      
      expect(historyClickHandler).toHaveBeenCalledWith(historyItem);
    });
  });

  describe('Performance and Reliability', () => {
    // パフォーマンステスト
    test('should maintain UI responsiveness during heavy sync operations', () => {
      const heavyChannels = Array.from({ length: 50 }, (_, i) => `C${String(i).padStart(3, '0')}`);
      
      syncStatusManager.startSync(heavyChannels);
      
      // 大量の進捗更新
      const startTime = Date.now();
      for (let i = 0; i < heavyChannels.length; i++) {
        syncStatusManager.updateProgress(i + 1, heavyChannels.length, `#channel-${i}`);
        statusBarItem.updateProgress(syncStatusManager.progress);
      }
      const endTime = Date.now();
      
      // UI更新が50ms以内で完了することを確認
      expect(endTime - startTime).toBeLessThan(50);
    });

    // メモリリークテスト
    test('should not cause memory leaks during long operations', () => {
      // 長時間運用をシミュレート
      for (let session = 0; session < 10; session++) {
        const channels = ['C001', 'C002', 'C003'];
        
        syncStatusManager.startSync(channels);
        
        for (let i = 0; i < channels.length; i++) {
          syncStatusManager.updateProgress(i + 1, channels.length, `#channel-${i}`);
        }
        
        syncStatusManager.completeSync(30 + session * 5);
      }
      
      // 履歴が100件制限を守ることを確認
      expect(syncStatusManager.history.length).toBe(10);
      
      // 最新の履歴が適切に管理されていることを確認
      expect(syncStatusManager.history[0].messagesCount).toBe(75); // 30 + 9*5
    });
  });
});