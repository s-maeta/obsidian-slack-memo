// TASK-302: 同期状態表示UI - SyncProgressModal 実装

import { Modal, App } from 'obsidian';
import { ISyncProgressModal, SyncStatus, SyncProgress } from './sync-status-types';

/**
 * 同期進捗表示モーダル
 */
export class SyncProgressModal extends Modal implements ISyncProgressModal {
  public isOpen: boolean = false;
  
  private progressBarEl?: HTMLElement;
  private progressTextEl?: HTMLElement;
  private currentChannelEl?: HTMLElement;
  private logAreaEl?: HTMLElement;
  private cancelButtonEl?: HTMLElement;
  private retryButtonEl?: HTMLElement;
  private closeButtonEl?: HTMLElement;
  private errorMessageEl?: HTMLElement;
  private completeMessageEl?: HTMLElement;

  private cancelHandler?: () => void;
  private retryHandler?: () => void;

  constructor(app: App) {
    super(app);
  }

  /**
   * モーダルを開く
   */
  public open(): void {
    super.open();
    this.isOpen = true;
    this.onOpen();
  }

  /**
   * モーダル開始時のフック
   */
  public onOpen(): void {
    this.createUI();
  }

  /**
   * モーダルを閉じる
   */
  public close(): void {
    super.close();
    this.isOpen = false;
  }

  /**
   * モーダルUIを作成する
   */
  private createUI(): void {
    this.titleEl.textContent = 'Slack同期状態';

    // メインコンテナ
    const container = this.contentEl.createDiv({ cls: 'sync-progress-container' });

    // 進捗セクション
    this.createProgressSection(container);

    // ログセクション
    this.createLogSection(container);

    // ボタンセクション
    this.createButtonSection(container);

    // エラー・完了メッセージセクション
    this.createMessageSection(container);
  }

  /**
   * 進捗セクションを作成
   */
  private createProgressSection(container: HTMLElement): void {
    const progressSection = container.createDiv({ cls: 'progress-section' });

    // 進捗バー
    const progressContainer = progressSection.createDiv({ cls: 'progress-container' });
    this.progressBarEl = progressContainer.createDiv({ cls: 'progress-bar' });
    this.progressBarEl.setAttribute('data-testid', 'progress-bar');

    // 進捗テキスト
    this.progressTextEl = progressSection.createDiv({ cls: 'progress-text' });
    this.progressTextEl.setAttribute('data-testid', 'progress-text');
    this.progressTextEl.textContent = '0%';

    // 現在処理中のチャンネル
    this.currentChannelEl = progressSection.createDiv({ cls: 'current-channel' });
    this.currentChannelEl.setAttribute('data-testid', 'current-channel');
  }

  /**
   * ログセクションを作成
   */
  private createLogSection(container: HTMLElement): void {
    const logSection = container.createDiv({ cls: 'log-section' });
    
    const logTitle = logSection.createDiv({ cls: 'log-title' });
    logTitle.textContent = 'ログ:';

    this.logAreaEl = logSection.createDiv({ cls: 'log-area' });
    this.logAreaEl.setAttribute('data-testid', 'log-area');
  }

  /**
   * ボタンセクションを作成
   */
  private createButtonSection(container: HTMLElement): void {
    const buttonSection = container.createDiv({ cls: 'button-section' });

    // キャンセルボタン
    this.cancelButtonEl = buttonSection.createEl('button', { 
      cls: 'mod-warning',
      text: 'キャンセル'
    });
    this.cancelButtonEl.setAttribute('data-testid', 'cancel-button');
    this.cancelButtonEl.style.display = 'none';
    this.cancelButtonEl.addEventListener('click', () => {
      if (this.cancelHandler) {
        this.cancelHandler();
      }
    });

    // 再試行ボタン
    this.retryButtonEl = buttonSection.createEl('button', { 
      cls: 'mod-cta',
      text: '再試行'
    });
    this.retryButtonEl.setAttribute('data-testid', 'retry-button');
    this.retryButtonEl.style.display = 'none';
    this.retryButtonEl.addEventListener('click', () => {
      if (this.retryHandler) {
        this.retryHandler();
      }
    });

    // 閉じるボタン
    this.closeButtonEl = buttonSection.createEl('button', { 
      text: '閉じる'
    });
    this.closeButtonEl.setAttribute('data-testid', 'close-button');
    this.closeButtonEl.addEventListener('click', () => {
      this.close();
    });
  }

  /**
   * メッセージセクションを作成
   */
  private createMessageSection(container: HTMLElement): void {
    // エラーメッセージ
    this.errorMessageEl = container.createDiv({ cls: 'error-message' });
    this.errorMessageEl.setAttribute('data-testid', 'error-message');
    this.errorMessageEl.style.display = 'none';

    // 完了メッセージ
    this.completeMessageEl = container.createDiv({ cls: 'complete-message' });
    this.completeMessageEl.setAttribute('data-testid', 'complete-message');
    this.completeMessageEl.style.display = 'none';
  }

  /**
   * 進捗を更新する
   */
  public updateProgress(progress: SyncProgress): void {
    if (this.progressBarEl) {
      this.progressBarEl.style.width = `${progress.percentage}%`;
    }

    if (this.progressTextEl) {
      this.progressTextEl.textContent = `${Math.round(progress.percentage)}%`;
    }

    if (this.currentChannelEl && progress.currentChannel) {
      this.currentChannelEl.textContent = `処理中: ${progress.currentChannel}`;
    }
  }

  /**
   * 状態を更新する
   */
  public updateStatus(status: SyncStatus): void {
    if (!this.cancelButtonEl || !this.retryButtonEl) return;

    // ボタンの表示/非表示を制御
    switch (status) {
      case SyncStatus.SYNCING:
        this.cancelButtonEl.style.display = 'inline-block';
        this.retryButtonEl.style.display = 'none';
        break;

      case SyncStatus.ERROR:
        this.cancelButtonEl.style.display = 'none';
        this.retryButtonEl.style.display = 'inline-block';
        break;

      default:
        this.cancelButtonEl.style.display = 'none';
        this.retryButtonEl.style.display = 'none';
        break;
    }
  }

  /**
   * ログメッセージを追加する
   */
  public addLogMessage(message: string): void {
    if (!this.logAreaEl) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = this.logAreaEl.createDiv({ cls: 'log-entry' });
    logEntry.textContent = `${timestamp} - ${message}`;

    // ログエリアを最下部にスクロール
    this.logAreaEl.scrollTop = this.logAreaEl.scrollHeight;
  }

  /**
   * エラーメッセージを表示する
   */
  public showError(error: string): void {
    if (this.errorMessageEl) {
      this.errorMessageEl.textContent = error;
      this.errorMessageEl.style.display = 'block';
    }
  }

  /**
   * 完了メッセージを表示する
   */
  public showComplete(stats: { messagesCount: number; duration: number }): void {
    if (this.completeMessageEl) {
      const durationSeconds = Math.round(stats.duration / 1000);
      this.completeMessageEl.textContent = 
        `同期が完了しました！${stats.messagesCount}件のメッセージを${durationSeconds}秒で処理しました。`;
      this.completeMessageEl.style.display = 'block';
    }
  }

  /**
   * キャンセルハンドラーを設定する
   */
  public onCancel(handler: () => void): void {
    this.cancelHandler = handler;
  }

  /**
   * 再試行ハンドラーを設定する
   */
  public onRetry(handler: () => void): void {
    this.retryHandler = handler;
  }
}