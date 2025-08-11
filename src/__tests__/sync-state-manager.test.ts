import { SyncStateManager, SyncState } from '../sync-state-manager';

// Mock Obsidian Plugin
class MockPlugin {
    data: any = {};
    
    async loadData() {
        return this.data;
    }
    
    async saveData(data: any) {
        this.data = data;
    }
}

describe('SyncStateManager', () => {
    let plugin: MockPlugin;
    let manager: SyncStateManager;

    beforeEach(() => {
        plugin = new MockPlugin();
        manager = new SyncStateManager(plugin as any);
    });

    describe('getSyncState', () => {
        it('TC-001: should return undefined for non-existent channel (first sync)', async () => {
            const state = await manager.getSyncState('C1234567890');
            expect(state).toBeUndefined();
        });

        it('TC-002: should return existing sync state', async () => {
            const existingState: SyncState = {
                channelId: 'C1234567890',
                lastSyncTimestamp: 1234567890,
                lastSyncStatus: 'success',
                lastSyncMessageCount: 42
            };
            plugin.data = { syncHistory: { 'C1234567890': existingState } };

            const state = await manager.getSyncState('C1234567890');
            expect(state).toEqual(existingState);
        });
    });

    describe('updateSyncState', () => {
        it('TC-003: should update sync state on success', async () => {
            const channelId = 'C1234567890';
            const newTimestamp = 1234567900;
            const messageCount = 10;

            await manager.updateSyncState(channelId, {
                lastSyncTimestamp: newTimestamp,
                lastSyncStatus: 'success',
                lastSyncMessageCount: messageCount
            });

            const state = await manager.getSyncState(channelId);
            expect(state).toMatchObject({
                channelId,
                lastSyncTimestamp: newTimestamp,
                lastSyncStatus: 'success',
                lastSyncMessageCount: messageCount
            });
        });

        it('TC-004: should update sync state on failure', async () => {
            const channelId = 'C1234567890';
            const errorMessage = 'Network error';

            await manager.updateSyncState(channelId, {
                lastSyncStatus: 'failed',
                lastSyncError: errorMessage
            });

            const state = await manager.getSyncState(channelId);
            expect(state).toMatchObject({
                lastSyncStatus: 'failed',
                lastSyncError: errorMessage
            });
        });

        it('TC-005: should update sync state on partial success', async () => {
            const channelId = 'C1234567890';
            const partialTimestamp = 1234567895;
            const partialCount = 5;

            await manager.updateSyncState(channelId, {
                lastSyncTimestamp: partialTimestamp,
                lastSyncStatus: 'partial',
                lastSyncMessageCount: partialCount,
                lastSyncError: 'Interrupted after page 1'
            });

            const state = await manager.getSyncState(channelId);
            expect(state).toMatchObject({
                lastSyncTimestamp: partialTimestamp,
                lastSyncStatus: 'partial',
                lastSyncMessageCount: partialCount
            });
        });
    });

    describe('getAllSyncStates', () => {
        it('should return all sync states', async () => {
            const states = {
                'C1111': { channelId: 'C1111', lastSyncTimestamp: 1000, lastSyncStatus: 'success' as const, lastSyncMessageCount: 10 },
                'C2222': { channelId: 'C2222', lastSyncTimestamp: 2000, lastSyncStatus: 'failed' as const, lastSyncMessageCount: 0 }
            };
            plugin.data = { syncHistory: states };

            const allStates = await manager.getAllSyncStates();
            expect(allStates).toEqual(states);
        });
    });

    describe('clearSyncState', () => {
        it('should remove sync state for a channel', async () => {
            plugin.data = {
                syncHistory: {
                    'C1111': { channelId: 'C1111', lastSyncTimestamp: 1000, lastSyncStatus: 'success', lastSyncMessageCount: 10 }
                }
            };

            await manager.clearSyncState('C1111');
            const state = await manager.getSyncState('C1111');
            expect(state).toBeUndefined();
        });
    });
});