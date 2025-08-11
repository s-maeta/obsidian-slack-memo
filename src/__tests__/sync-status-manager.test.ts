// TASK-302: 同期状態表示UI - SyncStatusManager テストスイート

import { SyncStatusManager } from '../sync-status-manager';
import { SyncStatus, SyncHistoryItem } from '../sync-status-types';

describe('SyncStatusManager', () => {
  let syncStatusManager: SyncStatusManager;

  beforeEach(() => {
    syncStatusManager = new SyncStatusManager();
  });

  describe('Initial State', () => {
    // TC-SS-001: 初期状態の確認
    test('TC-SS-001: should have correct initial state', () => {
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.IDLE);
      expect(syncStatusManager.progress.current).toBe(0);
      expect(syncStatusManager.progress.total).toBe(0);
      expect(syncStatusManager.progress.percentage).toBe(0);
      expect(syncStatusManager.history).toEqual([]);
      expect(syncStatusManager.isCancelled).toBe(false);
      expect(syncStatusManager.lastError).toBeUndefined();
    });
  });

  describe('Sync Operations', () => {
    // TC-SS-002: 同期開始時の状態更新
    test('TC-SS-002: should update state when sync starts', () => {
      const channels = ['C001', 'C002', 'C003'];
      
      syncStatusManager.startSync(channels);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SYNCING);
      expect(syncStatusManager.startTime).toBeDefined();
      expect(syncStatusManager.startTime).toBeInstanceOf(Date);
      expect(syncStatusManager.isCancelled).toBe(false);
    });

    // TC-SS-003: 進捗更新処理
    test('TC-SS-003: should update progress correctly', () => {
      syncStatusManager.startSync(['C001', 'C002']);
      
      syncStatusManager.updateProgress(3, 10, '#general');
      
      expect(syncStatusManager.progress.current).toBe(3);
      expect(syncStatusManager.progress.total).toBe(10);
      expect(syncStatusManager.progress.percentage).toBe(30);
      expect(syncStatusManager.progress.currentChannel).toBe('#general');
    });

    // TC-SS-004: 同期完了時の処理
    test('TC-SS-004: should complete sync and add to history', () => {
      syncStatusManager.startSync(['C001', 'C002']);
      
      syncStatusManager.completeSync(50);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history.length).toBe(1);
      expect(syncStatusManager.history[0].status).toBe(SyncStatus.SUCCESS);
      expect(syncStatusManager.history[0].messagesCount).toBe(50);
      expect(syncStatusManager.history[0].channelsProcessed).toBe(2);
    });

    // TC-SS-005: エラー発生時の処理
    test('TC-SS-005: should handle error correctly', () => {
      syncStatusManager.startSync(['C001']);
      
      const error = new Error('Network error');
      syncStatusManager.setError(error);
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.ERROR);
      expect(syncStatusManager.lastError).toBeDefined();
      expect(syncStatusManager.lastError?.message).toBe('Network error');
      expect(syncStatusManager.lastError?.timestamp).toBeInstanceOf(Date);
    });

    // TC-SS-006: 同期キャンセル処理
    test('TC-SS-006: should cancel sync correctly', () => {
      syncStatusManager.startSync(['C001']);
      
      syncStatusManager.cancelSync();
      
      expect(syncStatusManager.currentStatus).toBe(SyncStatus.IDLE);
      expect(syncStatusManager.isCancelled).toBe(true);
    });
  });

  describe('History Management', () => {
    // TC-SS-007: 履歴管理（追加）
    test('TC-SS-007: should add history items correctly', () => {
      // 99件の履歴を追加
      for (let i = 0; i < 99; i++) {
        const item: SyncHistoryItem = {
          id: `sync-${i}`,
          timestamp: new Date(),
          status: SyncStatus.SUCCESS,
          channelsProcessed: 1,
          messagesCount: 10,
          duration: 1000
        };
        syncStatusManager.addHistoryItem(item);
      }
      
      expect(syncStatusManager.history.length).toBe(99);
      
      // 100件目を追加
      const item: SyncHistoryItem = {
        id: 'sync-99',
        timestamp: new Date(),
        status: SyncStatus.SUCCESS,
        channelsProcessed: 1,
        messagesCount: 10,
        duration: 1000
      };
      syncStatusManager.addHistoryItem(item);
      
      expect(syncStatusManager.history.length).toBe(100);
      expect(syncStatusManager.history[0].id).toBe('sync-99'); // 最新が先頭
    });

    // TC-SS-008: 履歴管理（上限超過）
    test('TC-SS-008: should maintain 100 item limit', () => {
      // 100件の履歴を追加
      for (let i = 0; i < 100; i++) {
        const item: SyncHistoryItem = {
          id: `sync-${i}`,
          timestamp: new Date(),
          status: SyncStatus.SUCCESS,
          channelsProcessed: 1,
          messagesCount: 10,
          duration: 1000
        };
        syncStatusManager.addHistoryItem(item);
      }
      
      expect(syncStatusManager.history.length).toBe(100);
      
      // 101件目を追加
      const newItem: SyncHistoryItem = {
        id: 'sync-100',
        timestamp: new Date(),
        status: SyncStatus.SUCCESS,
        channelsProcessed: 1,
        messagesCount: 10,
        duration: 1000
      };
      syncStatusManager.addHistoryItem(newItem);
      
      expect(syncStatusManager.history.length).toBe(100);
      expect(syncStatusManager.history[0].id).toBe('sync-100');
      expect(syncStatusManager.history.find(item => item.id === 'sync-0')).toBeUndefined(); // 最古が削除
    });
  });
});