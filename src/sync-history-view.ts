// TASK-302: 同期状態表示UI - SyncHistoryView 実装

import { ISyncHistoryView, SyncHistoryItem, SyncStatus, HistoryFilter } from './sync-status-types';

/**
 * 同期履歴表示ビュー
 */
export class SyncHistoryView implements ISyncHistoryView {
  public isVisible: boolean = false;
  
  private container: HTMLElement;
  private historyData: SyncHistoryItem[] = [];
  private filteredData: SyncHistoryItem[] = [];
  private currentFilter: 'all' | 'success' | 'error' = 'all';
  private searchQuery: string = '';
  private currentPage: number = 1;
  private itemsPerPage: number = 50;
  private itemClickHandler?: (item: SyncHistoryItem) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * ビューを表示する
   */
  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'block';
    this.render();
  }

  /**
   * ビューを非表示にする
   */
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }

  /**
   * 履歴データを更新する
   */
  public updateHistory(history: SyncHistoryItem[]): void {
    this.historyData = [...history];
    this.applyFilters();
    
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * 履歴をフィルタリングする
   */
  public filterHistory(filter: 'all' | 'success' | 'error'): void {
    this.currentFilter = filter;
    this.currentPage = 1;
    this.applyFilters();
    
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * 履歴を検索する
   */
  public searchHistory(query: string): void {
    this.searchQuery = query.toLowerCase();
    this.currentPage = 1;
    this.applyFilters();
    
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * 履歴項目を削除する
   */
  public deleteHistoryItem(id: string): void {
    this.historyData = this.historyData.filter(item => item.id !== id);
    this.applyFilters();
    
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * 履歴をエクスポートする
   */
  public exportHistory(): void {
    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `slack-sync-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * 項目クリックハンドラーを設定する
   */
  public onItemClick(handler: (item: SyncHistoryItem) => void): void {
    this.itemClickHandler = handler;
  }

  /**
   * フィルターと検索を適用する
   */
  private applyFilters(): void {
    let filtered = this.historyData;

    // ステータスフィルター
    if (this.currentFilter !== 'all') {
      const targetStatus = this.currentFilter === 'success' ? SyncStatus.SUCCESS : SyncStatus.ERROR;
      filtered = filtered.filter(item => item.status === targetStatus);
    }

    // 検索クエリ
    if (this.searchQuery) {
      filtered = filtered.filter(item => {
        return (
          item.error?.toLowerCase().includes(this.searchQuery) ||
          item.messagesCount.toString().includes(this.searchQuery) ||
          item.timestamp.toLocaleString().toLowerCase().includes(this.searchQuery)
        );
      });
    }

    this.filteredData = filtered;
  }

  /**
   * ビューをレンダリングする
   */
  private render(): void {
    this.container.innerHTML = '';

    if (this.filteredData.length === 0) {
      this.renderEmptyState();
      return;
    }

    // ヘッダー
    this.renderHeader();

    // フィルター・検索
    this.renderControls();

    // 履歴リスト
    this.renderHistoryList();

    // ページネーション
    if (this.filteredData.length > this.itemsPerPage) {
      this.renderPagination();
    }
  }

  /**
   * 空状態を描画する
   */
  private renderEmptyState(): void {
    const emptyEl = this.container.createDiv({ cls: 'empty-history' });
    emptyEl.setAttribute('data-testid', 'empty-history');
    emptyEl.textContent = '履歴がありません';
  }

  /**
   * ヘッダーを描画する
   */
  private renderHeader(): void {
    const header = this.container.createDiv({ cls: 'history-header' });
    
    const title = header.createEl('h3', { text: '同期履歴' });
    
    const exportButton = header.createEl('button', { 
      cls: 'mod-cta',
      text: 'エクスポート'
    });
    exportButton.setAttribute('data-testid', 'export-button');
    exportButton.addEventListener('click', () => this.exportHistory());
  }

  /**
   * コントロールを描画する
   */
  private renderControls(): void {
    const controls = this.container.createDiv({ cls: 'history-controls' });

    // フィルター
    const filterSelect = controls.createEl('select');
    ['all', 'success', 'error'].forEach(value => {
      const option = filterSelect.createEl('option', { value, text: 
        value === 'all' ? 'すべて' : value === 'success' ? '成功' : 'エラー'
      });
      if (value === this.currentFilter) {
        option.selected = true;
      }
    });
    
    filterSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.filterHistory(target.value as 'all' | 'success' | 'error');
    });

    // 検索ボックス
    const searchInput = controls.createEl('input', { 
      type: 'text',
      placeholder: '検索...',
      value: this.searchQuery
    });
    
    searchInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.searchHistory(target.value);
    });
  }

  /**
   * 履歴リストを描画する
   */
  private renderHistoryList(): void {
    const listContainer = this.container.createDiv({ cls: 'history-list' });

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredData.slice(startIndex, endIndex);

    pageItems.forEach(item => {
      this.renderHistoryItem(listContainer, item);
    });
  }

  /**
   * 履歴項目を描画する
   */
  private renderHistoryItem(container: HTMLElement, item: SyncHistoryItem): void {
    const itemEl = container.createDiv({ cls: 'history-item' });
    itemEl.setAttribute('data-testid', `history-item-${item.id}`);

    // ステータスアイコン
    const statusIcon = itemEl.createDiv({ cls: 'status-icon' });
    statusIcon.textContent = item.status === SyncStatus.SUCCESS ? '✅' : '❌';

    // 詳細情報
    const details = itemEl.createDiv({ cls: 'item-details' });
    
    const timestamp = details.createDiv({ cls: 'timestamp' });
    timestamp.textContent = item.timestamp.toLocaleString();

    const info = details.createDiv({ cls: 'sync-info' });
    info.textContent = `${item.messagesCount}件のメッセージ / ${item.channelsProcessed}チャンネル`;

    if (item.error) {
      const error = details.createDiv({ cls: 'error-text' });
      error.textContent = item.error;
    }

    // 削除ボタン
    const deleteButton = itemEl.createEl('button', { 
      cls: 'delete-button',
      text: '削除'
    });
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('この履歴を削除しますか？')) {
        this.deleteHistoryItem(item.id);
      }
    });

    // クリックイベント
    itemEl.addEventListener('click', () => {
      if (this.itemClickHandler) {
        this.itemClickHandler(item);
      }
    });
  }

  /**
   * ページネーションを描画する
   */
  private renderPagination(): void {
    const pagination = this.container.createDiv({ cls: 'pagination' });
    pagination.setAttribute('data-testid', 'pagination');

    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);

    // 前のページボタン
    const prevButton = pagination.createEl('button', { 
      text: '前',
      cls: this.currentPage === 1 ? 'disabled' : ''
    });
    prevButton.disabled = this.currentPage === 1;
    prevButton.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.render();
      }
    });

    // ページ情報
    const pageInfo = pagination.createDiv({ cls: 'page-info' });
    pageInfo.setAttribute('data-testid', 'current-page');
    pageInfo.textContent = `${this.currentPage} / ${totalPages}`;

    // 次のページボタン
    const nextButton = pagination.createEl('button', { 
      text: '次',
      cls: this.currentPage === totalPages ? 'disabled' : ''
    });
    nextButton.setAttribute('data-testid', 'next-page');
    nextButton.disabled = this.currentPage === totalPages;
    nextButton.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.render();
      }
    });
  }

  /**
   * CSV形式のコンテンツを生成する
   */
  private generateCSVContent(): string {
    const headers = ['日時', 'ステータス', 'チャンネル数', 'メッセージ数', '所要時間(秒)', 'エラー'];
    const rows = this.historyData.map(item => [
      item.timestamp.toISOString(),
      item.status,
      item.channelsProcessed.toString(),
      item.messagesCount.toString(),
      (item.duration / 1000).toString(),
      item.error || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}