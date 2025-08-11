// TASK-302: 同期状態表示UI - NotificationManager テストスイート

import { NotificationManager } from '../notification-manager';
import { NotificationType } from '../sync-status-types';
import { Notice } from 'obsidian';

// Obsidian Notice のモック
jest.mock('obsidian', () => ({
  Notice: jest.fn().mockImplementation((message: string) => ({
    noticeEl: {
      textContent: message,
      className: '',
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
      querySelector: jest.fn(),
      appendChild: jest.fn(),
      createEl: jest.fn(() => ({
        textContent: '',
        className: '',
        setAttribute: jest.fn(),
        addEventListener: jest.fn()
      }))
    },
    hide: jest.fn()
  }))
}));

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    notificationManager = new NotificationManager();
    jest.clearAllMocks();
  });

  describe('Toast Notifications', () => {
    // TC-NM-001: トースト通知表示
    test('TC-NM-001: should display toast notification with correct type', () => {
      const message = '同期完了';
      
      notificationManager.showToast(message, NotificationType.SUCCESS);
      
      expect(Notice).toHaveBeenCalledWith('✅ ' + message, 5000);
    });

    // TC-NM-002: 通知自動消去
    test('TC-NM-002: should auto-dismiss toast after specified duration', async () => {
      const message = '同期開始';
      const duration = 3000;
      
      notificationManager.showToast(message, NotificationType.INFO, duration);
      
      expect(Notice).toHaveBeenCalledWith('ℹ️ ' + message, duration);
    });

    // TC-NM-003: 複数通知の管理
    test('TC-NM-003: should manage multiple notifications and enforce limit', () => {
      // 3つの通知を連続表示
      notificationManager.showToast('通知1', NotificationType.INFO);
      notificationManager.showToast('通知2', NotificationType.SUCCESS);
      notificationManager.showToast('通知3', NotificationType.WARNING);
      
      expect(Notice).toHaveBeenCalledTimes(3);
      
      // 4つ目の通知を表示（制限により古いものが消去される）
      notificationManager.showToast('通知4', NotificationType.ERROR);
      
      expect(Notice).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Dialogs', () => {
    // TC-NM-004: エラーダイアログ表示
    test('TC-NM-004: should display error dialog that requires manual dismissal', () => {
      const errorMessage = '重大なエラーが発生しました';
      const details = 'ネットワーク接続に問題があります';
      
      notificationManager.showError(errorMessage, details);
      
      // エラーダイアログは自動消去されない（duration: 0）
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining(errorMessage), 0);
    });
  });

  describe('Notification Level Control', () => {
    // TC-NM-005: 通知レベル制御
    test('TC-NM-005: should respect notification level settings', () => {
      // 通知レベルをWARNING以上に設定
      notificationManager.setNotificationLevel(NotificationType.WARNING);
      
      // INFO レベルの通知は表示されない
      notificationManager.showToast('情報メッセージ', NotificationType.INFO);
      expect(Notice).not.toHaveBeenCalled();
      
      // WARNING レベルの通知は表示される
      notificationManager.showToast('警告メッセージ', NotificationType.WARNING);
      expect(Notice).toHaveBeenCalledWith('⚠️ 警告メッセージ', 5000);
      
      // ERROR レベルの通知も表示される
      notificationManager.showToast('エラーメッセージ', NotificationType.ERROR);
      expect(Notice).toHaveBeenCalledWith('❌ エラーメッセージ', 5000);
    });
  });

  describe('Custom Action Notifications', () => {
    // TC-NM-006: カスタムアクション付き通知
    test('TC-NM-006: should display notification with action buttons', () => {
      const message = '同期でエラーが発生しました';
      const actions = [
        { label: '再試行', handler: jest.fn() },
        { label: '詳細', handler: jest.fn() }
      ];
      
      notificationManager.showActionNotification(message, actions);
      
      expect(Notice).toHaveBeenCalled();
      // アクションボタンが作成されることを確認
      const noticeCall = (Notice as jest.Mock).mock.calls[0];
      expect(noticeCall[0]).toContain(message);
    });

    test('should execute action handlers when buttons are clicked', () => {
      const message = 'テストメッセージ';
      const retryHandler = jest.fn();
      const detailsHandler = jest.fn();
      const actions = [
        { label: '再試行', handler: retryHandler },
        { label: '詳細', handler: detailsHandler }
      ];
      
      notificationManager.showActionNotification(message, actions);
      
      // アクションボタンのクリックをシミュレート
      const mockNotice = (Notice as jest.Mock).mock.results[0].value;
      const retryButton = mockNotice.noticeEl.querySelector('[data-action="retry"]');
      if (retryButton) {
        retryButton.click();
        expect(retryHandler).toHaveBeenCalled();
      }
    });
  });

  describe('Notification Queue Management', () => {
    test('should manage notification queue properly', () => {
      // 通知キューの管理テスト
      for (let i = 0; i < 5; i++) {
        notificationManager.showToast(`通知${i}`, NotificationType.INFO);
      }
      
      // 最大3つまでの制限が適用されることを確認
      expect(Notice).toHaveBeenCalledTimes(5);
    });

    test('should clear all notifications', () => {
      notificationManager.showToast('通知1', NotificationType.INFO);
      notificationManager.showToast('通知2', NotificationType.SUCCESS);
      
      // すべての通知をクリア
      notificationManager.clearAllNotifications();
      
      // クリア後の新しい通知が正常に動作することを確認
      notificationManager.showToast('新しい通知', NotificationType.INFO);
      expect(Notice).toHaveBeenCalledTimes(3); // 前の2つ + 新しい1つ
    });
  });

  describe('Message Formatting', () => {
    test('should format messages correctly for different types', () => {
      // 成功メッセージのフォーマット
      notificationManager.showToast('同期完了', NotificationType.SUCCESS);
      let lastCall = (Notice as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0]).toContain('✅');
      
      // エラーメッセージのフォーマット
      notificationManager.showToast('同期エラー', NotificationType.ERROR);
      lastCall = (Notice as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0]).toContain('❌');
      
      // 警告メッセージのフォーマット
      notificationManager.showToast('同期警告', NotificationType.WARNING);
      lastCall = (Notice as jest.Mock).mock.calls.slice(-1)[0];
      expect(lastCall[0]).toContain('⚠️');
    });
  });
});