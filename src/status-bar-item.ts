// TASK-302: 同期状態表示UI - StatusBarItem 実装（REFACTORフェーズで改善）

import { IStatusBarItem, SyncStatus, SyncProgress, TooltipInfo } from './sync-status-types';

/**
 * Obsidianステータスバーアイテム実装 - 品質向上版
 */
export class StatusBarItem implements IStatusBarItem {
  public element: HTMLElement;
  private clickHandler?: () => void;
  private animationInterval?: NodeJS.Timeout;
  private lastUpdateTime: number = 0;
  private readonly updateThrottleMs = 100; // 更新頻度制限

  constructor(element: HTMLElement) {
    this.validateElement(element);
    this.element = element;
    this.initializeElement();
  }

  /**
   * 要素の妥当性チェック
   */
  private validateElement(element: HTMLElement): void {
    if (!element || typeof element !== 'object') {
      throw new Error('StatusBarItem requires a valid HTMLElement');
    }
  }

  /**
   * 要素を初期化する
   */
  private initializeElement(): void {
    this.element.textContent = 'Slack同期';
    this.element.className = 'status-bar-item status-idle';
    this.element.setAttribute('data-testid', 'status-bar-item');
  }

  /**
   * 同期状態を更新する - REFACTORで改善
   */
  public updateStatus(status: SyncStatus): void {
    if (!this.shouldUpdate()) return; // 更新頻度制限
    
    this.clearCurrentStatus();
    this.applyStatusUpdate(status);
    this.manageAnimations(status);
    
    this.lastUpdateTime = Date.now();
  }

  /**
   * 更新頻度制限チェック
   */
  private shouldUpdate(): boolean {
    return Date.now() - this.lastUpdateTime >= this.updateThrottleMs;
  }

  /**
   * 現在のステータスをクリア
   */
  private clearCurrentStatus(): void {
    const statusClasses = [
      'status-idle', 
      'status-syncing', 
      'status-success', 
      'status-error',
      'status-warning',
      'animate-spin',
      'progress-low',
      'progress-medium',
      'progress-high'
    ];
    this.element.classList.remove(...statusClasses);
  }

  /**
   * ステータス別の更新を適用
   */
  private applyStatusUpdate(status: SyncStatus): void {
    const statusConfig = this.getStatusConfig(status);
    
    this.element.textContent = statusConfig.text;
    this.element.classList.add(...statusConfig.classes);
    
    if (statusConfig.tooltip) {
      this.showTooltip(statusConfig.tooltip);
    }
  }

  /**
   * ステータス設定を取得
   */
  private getStatusConfig(status: SyncStatus): {
    text: string;
    classes: string[];
    tooltip?: string;
  } {
    const configs = {
      [SyncStatus.IDLE]: {
        text: 'Slack同期',
        classes: ['status-idle'],
        tooltip: 'クリックして同期詳細を表示'
      },
      [SyncStatus.SYNCING]: {
        text: '同期中...',
        classes: ['status-syncing'],
        tooltip: '同期処理中です'
      },
      [SyncStatus.SUCCESS]: {
        text: '同期完了',
        classes: ['status-success'],
        tooltip: '同期が正常に完了しました'
      },
      [SyncStatus.ERROR]: {
        text: '同期エラー',
        classes: ['status-error'],
        tooltip: 'エラーが発生しました。クリックで詳細を確認'
      },
      [SyncStatus.WARNING]: {
        text: '同期警告',
        classes: ['status-warning'],
        tooltip: '警告があります。クリックで詳細を確認'
      }
    };
    
    return configs[status];
  }

  /**
   * アニメーション管理
   */
  private manageAnimations(status: SyncStatus): void {
    this.stopAnimations();
    
    if (status === SyncStatus.SYNCING) {
      this.startSyncAnimation();
    }
  }

  /**
   * 同期中アニメーションを開始
   */
  private startSyncAnimation(): void {
    this.element.classList.add('animate-spin');
    
    // パフォーマンスを考慮した軽量アニメーション
    let rotation = 0;
    this.animationInterval = setInterval(() => {
      rotation = (rotation + 15) % 360;
      this.element.style.transform = `rotate(${rotation}deg)`;
    }, 100);
  }

  /**
   * アニメーションを停止
   */
  private stopAnimations(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = undefined;
    }
    
    this.element.classList.remove('animate-spin');
    this.element.style.transform = '';
  }

  /**
   * 進捗情報を更新する - REFACTORで改善
   */
  public updateProgress(progress: SyncProgress): void {
    if (!this.shouldUpdate()) return;
    
    this.updateProgressText(progress);
    this.updateProgressTooltip(progress);
    
    this.lastUpdateTime = Date.now();
  }

  /**
   * 進捗テキストを更新
   */
  private updateProgressText(progress: SyncProgress): void {
    if (progress.percentage > 0) {
      const roundedPercent = Math.round(progress.percentage);
      this.element.textContent = `同期中... ${roundedPercent}%`;
      
      // 進捗に応じたビジュアル調整
      this.applyProgressStyling(progress.percentage);
    }
  }

  /**
   * 進捗に応じたスタイル適用
   */
  private applyProgressStyling(percentage: number): void {
    // 既存の進捗クラスを削除
    this.element.classList.remove('progress-low', 'progress-medium', 'progress-high');
    
    // 進捗段階に応じた視覚的フィードバック
    if (percentage >= 90) {
      this.element.classList.add('progress-high');
    } else if (percentage >= 50) {
      this.element.classList.add('progress-medium');
    } else {
      this.element.classList.add('progress-low');
    }
  }

  /**
   * 進捗ツールチップを更新
   */
  private updateProgressTooltip(progress: SyncProgress): void {
    const tooltipParts: string[] = [];
    
    if (progress.currentChannel) {
      tooltipParts.push(`処理中: ${progress.currentChannel}`);
    }
    
    tooltipParts.push(`進捗: ${progress.current}/${progress.total} (${Math.round(progress.percentage)}%)`);
    
    const estimatedTime = this.calculateEstimatedTime(progress);
    if (estimatedTime) {
      tooltipParts.push(`推定残り時間: ${estimatedTime}`);
    }
    
    this.showTooltip(tooltipParts.join('\n'));
  }

  /**
   * 推定残り時間を計算
   */
  private calculateEstimatedTime(progress: SyncProgress): string | null {
    if (progress.current === 0 || progress.percentage <= 0) return null;
    
    const elapsed = Date.now() - this.lastUpdateTime;
    const estimatedTotal = (elapsed / progress.percentage) * 100;
    const remaining = estimatedTotal - elapsed;
    
    if (remaining > 60000) {
      return `${Math.round(remaining / 60000)}分`;
    } else if (remaining > 1000) {
      return `${Math.round(remaining / 1000)}秒`;
    }
    
    return null;
  }

  /**
   * ツールチップを表示する - REFACTORで改善
   */
  public showTooltip(message: string): void {
    if (!message || typeof message !== 'string') return;
    
    this.element.setAttribute('title', message);
    this.element.setAttribute('aria-label', message);
  }

  /**
   * クリックイベントハンドラーを設定する - REFACTORで改善
   */
  public onClick(handler: () => void): void {
    if (typeof handler !== 'function') {
      throw new Error('Click handler must be a function');
    }
    
    // 既存ハンドラーのクリーンアップ
    this.cleanup();
    
    this.clickHandler = handler;
    this.element.addEventListener('click', handler);
    
    // アクセシビリティ向上
    this.element.setAttribute('role', 'button');
    this.element.setAttribute('tabindex', '0');
    this.element.style.cursor = 'pointer';
  }

  /**
   * リソースをクリーンアップする - REFACTORで改善
   */
  public cleanup(): void {
    // アニメーション停止
    this.stopAnimations();
    
    // イベントリスナー削除
    if (this.clickHandler) {
      this.element.removeEventListener('click', this.clickHandler);
      this.clickHandler = undefined;
    }
    
    // 属性とスタイルのクリーンアップ
    this.element.removeAttribute('role');
    this.element.removeAttribute('tabindex');
    this.element.style.cursor = '';
    this.element.style.transform = '';
  }

  /**
   * パフォーマンス統計を取得
   */
  public getPerformanceStats(): {
    updateCount: number;
    lastUpdate: number;
    averageUpdateInterval: number;
  } {
    return {
      updateCount: Math.floor(this.lastUpdateTime / this.updateThrottleMs),
      lastUpdate: this.lastUpdateTime,
      averageUpdateInterval: this.updateThrottleMs
    };
  }
}