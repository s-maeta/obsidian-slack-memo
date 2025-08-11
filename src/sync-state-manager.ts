import { Plugin } from 'obsidian';

export interface SyncState {
    channelId: string;
    lastSyncTimestamp: number; // Unix timestamp (seconds)
    lastSyncStatus: 'success' | 'failed' | 'partial';
    lastSyncMessageCount: number;
    lastSyncError?: string;
}

export interface SyncHistory {
    [channelId: string]: SyncState;
}

interface PluginData {
    syncHistory?: SyncHistory;
}

export class SyncStateManager {
    constructor(private plugin: Plugin) {}

    async getSyncState(channelId: string): Promise<SyncState | undefined> {
        const data = await this.plugin.loadData() as PluginData;
        return data?.syncHistory?.[channelId];
    }

    async updateSyncState(channelId: string, state: Partial<SyncState>): Promise<void> {
        const data = await this.plugin.loadData() as PluginData || {};
        
        if (!data.syncHistory) {
            data.syncHistory = {};
        }

        const currentState = data.syncHistory[channelId] || {
            channelId,
            lastSyncTimestamp: 0,
            lastSyncStatus: 'success' as const,
            lastSyncMessageCount: 0
        };

        data.syncHistory[channelId] = {
            ...currentState,
            ...state,
            channelId // Ensure channelId is never overwritten
        };

        await this.plugin.saveData(data);
    }

    async getAllSyncStates(): Promise<SyncHistory> {
        const data = await this.plugin.loadData() as PluginData;
        return data?.syncHistory || {};
    }

    async clearSyncState(channelId: string): Promise<void> {
        const data = await this.plugin.loadData() as PluginData || {};
        
        if (data.syncHistory && data.syncHistory[channelId]) {
            delete data.syncHistory[channelId];
            await this.plugin.saveData(data);
        }
    }
}