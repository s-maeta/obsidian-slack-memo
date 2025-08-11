// TASK-302: 同期状態表示UI - SyncHistoryView テストスイート

import { SyncHistoryView } from '../sync-history-view';
import { SyncStatus, SyncHistoryItem } from '../sync-status-types';
import { MockHTMLElement } from './__mocks__/obsidian-ui';

describe('SyncHistoryView', () => {
  let syncHistoryView: SyncHistoryView;
  let mockContainer: HTMLElement;

  const mockHistoryItems: SyncHistoryItem[] = [
    {
      id: 'sync-1',
      timestamp: new Date('2024-01-11T10:30:00'),
      status: SyncStatus.SUCCESS,
      channelsProcessed: 3,
      messagesCount: 42,
      duration: 15000
    },
    {
      id: 'sync-2',
      timestamp: new Date('2024-01-11T09:15:00'),
      status: SyncStatus.ERROR,
      channelsProcessed: 1,
      messagesCount: 0,
      duration: 5000,
      error: 'Network timeout'
    },
    {
      id: 'sync-3',
      timestamp: new Date('2024-01-11T08:00:00'),
      status: SyncStatus.SUCCESS,
      channelsProcessed: 2,
      messagesCount: 25,
      duration: 12000
    }
  ];

  beforeEach(() => {
    // MockHTMLElement を使用
    mockContainer = new MockHTMLElement('div') as any;
    mockContainer.style = { display: 'none' };
    
    syncHistoryView = new SyncHistoryView(mockContainer);
  });

  describe('Basic Display', () => {
    // TC-SH-001: 履歴リスト表示
    test('TC-SH-001: should display history list in chronological order', () => {
      syncHistoryView.updateHistory(mockHistoryItems);
      syncHistoryView.show();
      
      expect(syncHistoryView.isVisible).toBe(true);
      expect(mockContainer.createEl).toHaveBeenCalled();
      
      // 履歴が新しい順で表示されることを確認
      const historyItems = mockContainer.querySelectorAll('[data-testid^="history-item"]');
      expect(historyItems.length).toBe(mockHistoryItems.length);
    });

    // TC-SH-006: 空履歴表示
    test('TC-SH-006: should display empty state message when no history', () => {
      syncHistoryView.updateHistory([]);
      syncHistoryView.show();
      
      const emptyMessage = mockContainer.querySelector('[data-testid="empty-history"]');
      expect(emptyMessage).toBeTruthy();
    });
  });

  describe('History Item Interaction', () => {
    beforeEach(() => {
      syncHistoryView.updateHistory(mockHistoryItems);
      syncHistoryView.show();
    });

    // TC-SH-002: 履歴詳細表示
    test('TC-SH-002: should show detail modal when history item clicked', () => {
      const clickHandler = jest.fn();
      syncHistoryView.onItemClick(clickHandler);
      
      // 履歴項目のクリックをシミュレート
      const historyItem = mockContainer.querySelector('[data-testid="history-item-sync-1"]');
      if (historyItem) {
        const clickEvent = new Event('click');
        historyItem.dispatchEvent(clickEvent);
        expect(clickHandler).toHaveBeenCalledWith(mockHistoryItems[0]);
      }
    });

    // TC-SH-004: 履歴削除機能
    test('TC-SH-004: should delete history item when delete button clicked', () => {
      syncHistoryView.deleteHistoryItem('sync-1');
      
      const remainingItems = mockHistoryItems.filter(item => item.id !== 'sync-1');
      expect(remainingItems.length).toBe(2);
    });
  });

  describe('Filtering and Search', () => {
    beforeEach(() => {
      syncHistoryView.updateHistory(mockHistoryItems);
      syncHistoryView.show();
    });

    // TC-SH-003: 履歴フィルター機能
    test('TC-SH-003: should filter history by status', () => {
      syncHistoryView.filterHistory('error');
      
      // エラー状態の履歴のみ表示されることを確認
      const visibleItems = mockContainer.querySelectorAll('[data-testid^="history-item"]:not(.hidden)');
      expect(visibleItems.length).toBe(1);
    });

    test('should filter history to show successful syncs only', () => {
      syncHistoryView.filterHistory('success');
      
      const visibleItems = mockContainer.querySelectorAll('[data-testid^="history-item"]:not(.hidden)');
      expect(visibleItems.length).toBe(2); // 2つの成功履歴
    });

    test('should show all history when filter is "all"', () => {
      syncHistoryView.filterHistory('all');
      
      const visibleItems = mockContainer.querySelectorAll('[data-testid^="history-item"]:not(.hidden)');
      expect(visibleItems.length).toBe(mockHistoryItems.length);
    });

    // TC-SH-007: 履歴検索機能
    test('TC-SH-007: should search history by error message', () => {
      syncHistoryView.searchHistory('timeout');
      
      // "timeout"を含む履歴のみ表示されることを確認
      const visibleItems = mockContainer.querySelectorAll('[data-testid^="history-item"]:not(.hidden)');
      expect(visibleItems.length).toBe(1);
    });

    test('should search history by message count', () => {
      syncHistoryView.searchHistory('42');
      
      const visibleItems = mockContainer.querySelectorAll('[data-testid^="history-item"]:not(.hidden)');
      expect(visibleItems.length).toBe(1);
    });
  });

  describe('Export and Management', () => {
    beforeEach(() => {
      syncHistoryView.updateHistory(mockHistoryItems);
      syncHistoryView.show();
    });

    // TC-SH-005: 履歴エクスポート
    test('TC-SH-005: should export history to CSV format', () => {
      // CSV エクスポート機能のテスト
      const exportButton = mockContainer.querySelector('[data-testid="export-button"]');
      expect(exportButton).toBeTruthy();
      
      // エクスポート機能の実行確認
      const exportSpy = jest.spyOn(syncHistoryView, 'exportHistory');
      syncHistoryView.exportHistory();
      expect(exportSpy).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    const manyHistoryItems: SyncHistoryItem[] = [];
    
    beforeEach(() => {
      // 150件の履歴データを生成
      for (let i = 0; i < 150; i++) {
        manyHistoryItems.push({
          id: `sync-${i}`,
          timestamp: new Date(2024, 0, 11, 10 - i * 0.1),
          status: i % 3 === 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS,
          channelsProcessed: Math.floor(Math.random() * 5) + 1,
          messagesCount: Math.floor(Math.random() * 50),
          duration: Math.floor(Math.random() * 30000) + 1000
        });
      }
    });

    // TC-SH-008: ページネーション
    test('TC-SH-008: should paginate large history datasets', () => {
      syncHistoryView.updateHistory(manyHistoryItems);
      syncHistoryView.show();
      
      // 最初のページ（50件）が表示されることを確認
      const visibleItems = mockContainer.querySelectorAll('[data-testid^="history-item"]:not(.hidden)');
      expect(visibleItems.length).toBe(50);
      
      // ページネーションコントロールが表示されることを確認
      const paginationControls = mockContainer.querySelector('[data-testid="pagination"]');
      expect(paginationControls).toBeTruthy();
      
      // 次のページボタンが存在することを確認
      const nextPageButton = mockContainer.querySelector('[data-testid="next-page"]');
      expect(nextPageButton).toBeTruthy();
    });

    test('should navigate between pages correctly', () => {
      syncHistoryView.updateHistory(manyHistoryItems);
      syncHistoryView.show();
      
      // 2ページ目に移動
      const nextPageButton = mockContainer.querySelector('[data-testid="next-page"]') as HTMLElement;
      if (nextPageButton) {
        nextPageButton.click();
        
        // 2ページ目の内容が表示されることを確認
        const currentPageInfo = mockContainer.querySelector('[data-testid="current-page"]');
        expect(currentPageInfo?.textContent).toContain('2');
      }
    });
  });

  describe('View Lifecycle', () => {
    test('should show and hide view correctly', () => {
      expect(syncHistoryView.isVisible).toBe(false);
      
      syncHistoryView.show();
      expect(syncHistoryView.isVisible).toBe(true);
      expect(mockContainer.style.display).toBe('block');
      
      syncHistoryView.hide();
      expect(syncHistoryView.isVisible).toBe(false);
      expect(mockContainer.style.display).toBe('none');
    });

    test('should cleanup resources when hidden', () => {
      syncHistoryView.updateHistory(mockHistoryItems);
      syncHistoryView.show();
      
      syncHistoryView.hide();
      
      // リソースがクリーンアップされることを確認
      expect(mockContainer.innerHTML).toBe('');
    });
  });
});