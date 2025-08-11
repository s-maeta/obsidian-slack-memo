// TASK-302: 同期状態表示UI - NotificationManager 実装

import { Notice } from 'obsidian';
import { INotificationManager, NotificationType, NotificationAction } from './sync-status-types';

/**
 * 通知管理クラス
 */
export class NotificationManager implements INotificationManager {
  private currentNotifications: Notice[] = [];
  private notificationLevel: NotificationType = NotificationType.INFO;
  private readonly maxNotifications = 3;

  /**
   * トースト通知を表示する
   */
  public showToast(message: string, type: NotificationType, duration: number = 5000): void {
    // 通知レベルチェック
    if (!this.shouldShowNotification(type)) {
      return;
    }

    // アイコン付きメッセージの作成
    const formattedMessage = this.formatMessage(message, type);

    // 通知作成
    const notice = new Notice(formattedMessage, duration);
    this.currentNotifications.push(notice);

    // 通知数制限の管理
    this.manageNotificationLimit();

    // 通知の自動削除（duration > 0の場合）
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(notice);
      }, duration);
    }
  }

  /**
   * エラーダイアログを表示する
   */
  public showError(message: string, details?: string): void {
    const fullMessage = details ? `${message}\n詳細: ${details}` : message;
    const formattedMessage = this.formatMessage(fullMessage, NotificationType.ERROR);
    
    // エラーは自動消去しない（duration: 0）
    const notice = new Notice(formattedMessage, 0);
    this.currentNotifications.push(notice);
    
    this.manageNotificationLimit();
  }

  /**
   * 通知レベルを設定する
   */
  public setNotificationLevel(level: NotificationType): void {
    this.notificationLevel = level;
  }

  /**
   * カスタムアクション付き通知を表示する
   */
  public showActionNotification(message: string, actions: NotificationAction[]): void {
    const formattedMessage = this.formatMessage(message, NotificationType.INFO);
    const notice = new Notice(formattedMessage, 10000); // 10秒間表示

    // アクションボタンを追加
    actions.forEach((action, index) => {
      const button = notice.noticeEl.createEl('button', {
        text: action.label,
        cls: 'notification-action-button'
      });
      button.setAttribute('data-action', action.label.toLowerCase().replace(/\s+/g, '-'));
      
      button.addEventListener('click', () => {
        action.handler();
        notice.hide();
        this.removeNotification(notice);
      });
    });

    this.currentNotifications.push(notice);
    this.manageNotificationLimit();
  }

  /**
   * 全通知をクリアする
   */
  public clearAllNotifications(): void {
    this.currentNotifications.forEach(notice => {
      notice.hide();
    });
    this.currentNotifications = [];
  }

  /**
   * 通知レベルに基づいて表示判定
   */
  private shouldShowNotification(type: NotificationType): boolean {
    const levelOrder = {
      [NotificationType.INFO]: 0,
      [NotificationType.SUCCESS]: 1,
      [NotificationType.WARNING]: 2,
      [NotificationType.ERROR]: 3
    };

    return levelOrder[type] >= levelOrder[this.notificationLevel];
  }

  /**
   * メッセージにタイプ別アイコンを付与
   */
  private formatMessage(message: string, type: NotificationType): string {
    const icons = {
      [NotificationType.SUCCESS]: '✅',
      [NotificationType.ERROR]: '❌',
      [NotificationType.WARNING]: '⚠️',
      [NotificationType.INFO]: 'ℹ️'
    };

    const icon = icons[type];
    return `${icon} ${message}`;
  }

  /**
   * 通知数の制限管理
   */
  private manageNotificationLimit(): void {
    while (this.currentNotifications.length > this.maxNotifications) {
      const oldestNotification = this.currentNotifications.shift();
      if (oldestNotification) {
        oldestNotification.hide();
      }
    }
  }

  /**
   * 通知を配列から削除
   */
  private removeNotification(notice: Notice): void {
    const index = this.currentNotifications.indexOf(notice);
    if (index > -1) {
      this.currentNotifications.splice(index, 1);
    }
  }
}