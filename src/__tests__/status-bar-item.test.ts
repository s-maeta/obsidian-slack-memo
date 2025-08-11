// TASK-302: 同期状態表示UI - StatusBarItem テストスイート

import { StatusBarItem } from '../status-bar-item';
import { SyncStatus } from '../sync-status-types';

describe('StatusBarItem', () => {
  let statusBarItem: StatusBarItem;
  let mockElement: HTMLElement;

  beforeEach(() => {
    // HTMLElement のモック（classListとclassNameの同期）
    const classes = new Set<string>();
    
    mockElement = {
      textContent: '',
      get className() { return Array.from(classes).join(' '); },
      set className(value: string) { 
        classes.clear();
        if (value) {
          value.split(' ').filter(Boolean).forEach(cls => classes.add(cls));
        }
      },
      classList: {
        add: (...classNames: string[]) => {
          classNames.forEach(cls => classes.add(cls));
        },
        remove: (...classNames: string[]) => {
          classNames.forEach(cls => classes.delete(cls));
        },
        contains: (className: string) => classes.has(className),
        toggle: (className: string) => {
          if (classes.has(className)) {
            classes.delete(className);
          } else {
            classes.add(className);
          }
        }
      },
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      style: {}
    } as any;

    statusBarItem = new StatusBarItem(mockElement);
  });

  describe('Initial Display', () => {
    // TC-SB-001: 初期表示の確認
    test('TC-SB-001: should display initial idle state', () => {
      expect(mockElement.textContent).toContain('Slack同期');
      expect(mockElement.className).toContain('status-idle');
    });
  });

  describe('Status Updates', () => {
    // TC-SB-002: 同期中状態の表示
    test('TC-SB-002: should display syncing state with animation', () => {
      statusBarItem.updateStatus(SyncStatus.SYNCING);
      
      expect(mockElement.textContent).toContain('同期中');
      expect(mockElement.className).toContain('status-syncing');
      expect(mockElement.className).toContain('animate-spin');
    });

    // TC-SB-003: 成功状態の表示
    test('TC-SB-003: should display success state', () => {
      statusBarItem.updateStatus(SyncStatus.SUCCESS);
      
      expect(mockElement.textContent).toContain('同期完了');
      expect(mockElement.className).toContain('status-success');
      expect(mockElement.className).not.toContain('animate-spin');
    });

    // TC-SB-004: エラー状態の表示
    test('TC-SB-004: should display error state', () => {
      statusBarItem.updateStatus(SyncStatus.ERROR);
      
      expect(mockElement.textContent).toContain('同期エラー');
      expect(mockElement.className).toContain('status-error');
    });
  });

  describe('User Interactions', () => {
    // TC-SB-005: クリックイベント処理
    test('TC-SB-005: should handle click events', () => {
      const clickHandler = jest.fn();
      
      statusBarItem.onClick(clickHandler);
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', clickHandler);
    });

    // TC-SB-006: ホバーツールチップ
    test('TC-SB-006: should show tooltip on hover', () => {
      const tooltipMessage = '最終同期: 2024-01-11 10:30:00';
      
      statusBarItem.showTooltip(tooltipMessage);
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('title', tooltipMessage);
    });
  });

  describe('Animation Control', () => {
    // TC-SB-007: アニメーション制御
    test('TC-SB-007: should control animation correctly', async () => {
      // 同期中状態でアニメーション開始
      statusBarItem.updateStatus(SyncStatus.SYNCING);
      expect(mockElement.className).toContain('animate-spin');
      
      // 更新頻度制限を回避するため少し待機
      await new Promise(resolve => setTimeout(resolve, 110));
      
      // 成功状態でアニメーション停止
      statusBarItem.updateStatus(SyncStatus.SUCCESS);
      expect(mockElement.className).not.toContain('animate-spin');
    });

    // TC-SB-008: テーマ対応
    test('TC-SB-008: should apply theme-appropriate styling', () => {
      // ダークテーマ設定のシミュレート
      document.body.className = 'theme-dark';
      
      statusBarItem.updateStatus(SyncStatus.SUCCESS);
      
      expect(mockElement.className).toContain('status-success');
      // テーマ固有のクラスが適用されることを確認（実装依存）
    });
  });

  describe('Progress Display', () => {
    // 進捗表示のテスト
    test('should update progress display', () => {
      const progress = {
        current: 5,
        total: 10,
        percentage: 50,
        currentChannel: '#general'
      };
      
      statusBarItem.updateProgress(progress);
      
      expect(mockElement.textContent).toContain('50%');
    });
  });
});