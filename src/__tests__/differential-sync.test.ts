import { SlackAPIClient } from '../slack-api-client';
import { SyncStateManager } from '../sync-state-manager';
import { DifferentialSync } from '../differential-sync';
import { Message as SlackMessage } from '../slack-types';

// Mock implementations
jest.mock('../slack-api-client');
jest.mock('../sync-state-manager');

describe('DifferentialSync', () => {
    let slackClient: jest.Mocked<SlackAPIClient>;
    let syncStateManager: jest.Mocked<SyncStateManager>;
    let differentialSync: DifferentialSync;

    beforeEach(() => {
        slackClient = new SlackAPIClient({} as any) as jest.Mocked<SlackAPIClient>;
        syncStateManager = new SyncStateManager({} as any) as jest.Mocked<SyncStateManager>;
        differentialSync = new DifferentialSync(slackClient, syncStateManager);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('syncChannel', () => {
        it('TC-006: should perform initial sync without oldest parameter', async () => {
            const channelId = 'C1234567890';
            
            // No sync history
            syncStateManager.getSyncState.mockResolvedValue(undefined);
            
            // Mock successful API response
            slackClient.getChannelHistory.mockResolvedValue({
                success: true,
                value: [
                    { ts: '1234567891.000100', text: 'Message 1' },
                    { ts: '1234567892.000200', text: 'Message 2' }
                ] as SlackMessage[]
            });

            const result = await differentialSync.syncChannel(channelId);

            // Verify API was called without oldest parameter
            expect(slackClient.getChannelHistory).toHaveBeenCalledWith(channelId, {
                limit: 100
            });

            expect(result).toEqual({
                success: true,
                messagesRetrieved: 2,
                lastTimestamp: 1234567892.0002
            });
        });

        it('TC-007: should use oldest parameter for differential sync', async () => {
            const channelId = 'C1234567890';
            const lastSyncTimestamp = 1234567890;
            
            // Existing sync history
            syncStateManager.getSyncState.mockResolvedValue({
                channelId,
                lastSyncTimestamp,
                lastSyncStatus: 'success',
                lastSyncMessageCount: 10
            });
            
            // Mock API response
            slackClient.getChannelHistory.mockResolvedValue({
                success: true,
                value: [
                    { ts: '1234567891.000100', text: 'New message' }
                ] as SlackMessage[]
            });

            const result = await differentialSync.syncChannel(channelId);

            // Verify API was called with oldest parameter
            expect(slackClient.getChannelHistory).toHaveBeenCalledWith(channelId, {
                oldest: '1234567890',
                limit: 100
            });

            expect(result.success).toBe(true);
            expect(result.messagesRetrieved).toBe(1);
        });

        it('TC-008: should handle pagination', async () => {
            const channelId = 'C1234567890';
            
            syncStateManager.getSyncState.mockResolvedValue(undefined);
            
            // Mock pagination - getChannelHistory will be called once but internally handles pagination
            const allMessages = Array(150).fill({}).map((_, i) => ({
                ts: `123456789${i.toString().padStart(3, '0')}.000000`,
                text: `Message ${i}`
            })) as SlackMessage[];

            slackClient.getChannelHistory.mockResolvedValue({
                success: true,
                value: allMessages
            });

            const result = await differentialSync.syncChannel(channelId);

            expect(slackClient.getChannelHistory).toHaveBeenCalledTimes(1);
            
            expect(result.success).toBe(true);
            expect(result.messagesRetrieved).toBe(150);
        });

        it('TC-009: should retry on transient errors', async () => {
            const channelId = 'C1234567890';
            
            syncStateManager.getSyncState.mockResolvedValue(undefined);
            
            // First call fails, second succeeds
            slackClient.getChannelHistory
                .mockResolvedValueOnce({
                    success: false,
                    error: new Error('Network error')
                })
                .mockResolvedValueOnce({
                    success: true,
                    value: [{ ts: '1234567891.000100', text: 'Message' }] as SlackMessage[]
                });

            const result = await differentialSync.syncChannel(channelId);

            expect(slackClient.getChannelHistory).toHaveBeenCalledTimes(2);
            expect(result.success).toBe(true);
            expect(result.messagesRetrieved).toBe(1);
        });

        it('TC-010: should fail after max retries', async () => {
            const channelId = 'C1234567890';
            
            syncStateManager.getSyncState.mockResolvedValue(undefined);
            
            // All calls fail
            slackClient.getChannelHistory.mockResolvedValue({
                success: false,
                error: new Error('Persistent error')
            });

            const result = await differentialSync.syncChannel(channelId);

            expect(slackClient.getChannelHistory).toHaveBeenCalledTimes(3); // max retries
            expect(result.success).toBe(false);
            expect(result.error).toContain('Persistent error');
            
            // Verify sync state was updated to failed
            expect(syncStateManager.updateSyncState).toHaveBeenCalledWith(channelId, {
                lastSyncStatus: 'failed',
                lastSyncError: expect.any(String)
            });
        });

        it('TC-011: should handle rate limit with retry', async () => {
            const channelId = 'C1234567890';
            
            syncStateManager.getSyncState.mockResolvedValue(undefined);
            
            // First call hits rate limit
            const rateLimitError: any = new Error('Rate limited');
            rateLimitError.response = {
                status: 429,
                headers: { 'retry-after': '2' }
            };
            
            slackClient.getChannelHistory
                .mockResolvedValueOnce({
                    success: false,
                    error: rateLimitError
                })
                .mockResolvedValueOnce({
                    success: true,
                    value: [] as SlackMessage[]
                });

            const result = await differentialSync.syncChannel(channelId);

            expect(result.success).toBe(true);
            // Verify it waited and retried
            expect(slackClient.getChannelHistory).toHaveBeenCalledTimes(2);
        }, 15000); // Increase timeout to 15 seconds
    });

    describe('Integration tests', () => {
        it('TC-013: should sync only new messages on differential sync', async () => {
            const channelId = 'C1234567890';
            const lastSync = 1234567890;
            
            // Previous sync state
            syncStateManager.getSyncState.mockResolvedValue({
                channelId,
                lastSyncTimestamp: lastSync,
                lastSyncStatus: 'success',
                lastSyncMessageCount: 100
            });
            
            // 10 new messages
            const newMessages = Array(10).fill({}).map((_, i) => ({
                ts: `${lastSync + i + 1}.000000`,
                text: `New message ${i}`
            })) as SlackMessage[];
            
            slackClient.getChannelHistory.mockResolvedValue({
                success: true,
                value: newMessages
            });

            const result = await differentialSync.syncChannel(channelId);

            expect(result.success).toBe(true);
            expect(result.messagesRetrieved).toBe(10);
            expect(result.lastTimestamp).toBe(lastSync + 10);
            
            // Verify state was updated
            expect(syncStateManager.updateSyncState).toHaveBeenCalledWith(channelId, {
                lastSyncTimestamp: lastSync + 10,
                lastSyncStatus: 'success',
                lastSyncMessageCount: 10
            });
        });

        it('TC-015: should recover from partial sync on next run', async () => {
            const channelId = 'C1234567890';
            
            // Previous partial sync
            syncStateManager.getSyncState.mockResolvedValue({
                channelId,
                lastSyncTimestamp: 1234567895,
                lastSyncStatus: 'partial',
                lastSyncMessageCount: 50,
                lastSyncError: 'Interrupted after page 1'
            });
            
            // Continue from last successful point
            slackClient.getChannelHistory.mockResolvedValue({
                success: true,
                value: Array(30).fill({}).map((_, i) => ({
                    ts: `${1234567896 + i}.000000`,
                    text: `Remaining message ${i}`
                })) as SlackMessage[]
            });

            const result = await differentialSync.syncChannel(channelId);

            // Should continue from last partial sync timestamp
            expect(slackClient.getChannelHistory).toHaveBeenCalledWith(channelId, {
                oldest: '1234567895',
                limit: 100
            });
            
            expect(result.success).toBe(true);
            expect(syncStateManager.updateSyncState).toHaveBeenCalledWith(channelId, {
                lastSyncTimestamp: expect.any(Number),
                lastSyncStatus: 'success',
                lastSyncMessageCount: 30
            });
        });
    });
});