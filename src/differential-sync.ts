import { SlackAPIClient } from './slack-api-client';
import { SyncStateManager } from './sync-state-manager';
import { Message as SlackMessage } from './slack-types';
import { HistoryOptions } from './slack-types';

export interface SyncOptions {
    maxRetries?: number;
    pageSize?: number;
}

export interface SyncResult {
    success: boolean;
    messagesRetrieved: number;
    lastTimestamp?: number;
    error?: string;
}

/**
 * DifferentialSync handles incremental synchronization of Slack messages
 * It tracks sync state and only fetches new messages since the last sync
 */
export class DifferentialSync {
    private readonly maxRetries: number;
    private readonly pageSize: number;

    constructor(
        private slackClient: SlackAPIClient,
        private syncStateManager: SyncStateManager,
        options: SyncOptions = {}
    ) {
        this.maxRetries = options.maxRetries || 3;
        this.pageSize = options.pageSize || 100;
    }

    /**
     * Synchronize a Slack channel, fetching only new messages since the last sync
     * @param channelId Slack channel ID to synchronize
     * @returns SyncResult containing success status, message count, and last timestamp
     */
    async syncChannel(channelId: string): Promise<SyncResult> {
        try {
            // Get last sync state
            const syncState = await this.syncStateManager.getSyncState(channelId);
            const lastSyncTimestamp = syncState?.lastSyncTimestamp;

            // Prepare API options for differential sync
            const options = this.buildHistoryOptions(lastSyncTimestamp);

            // Fetch messages with retry logic
            const messages = await this.fetchMessagesWithRetry(channelId, options);

            if (messages.length === 0) {
                // No new messages, return success with existing timestamp
                return this.createSuccessResult(0, lastSyncTimestamp);
            }

            // Calculate the latest timestamp from retrieved messages
            const lastTimestamp = this.calculateLatestTimestamp(messages);

            // Update sync state with success
            await this.updateSyncStateSuccess(channelId, lastTimestamp, messages.length);

            return this.createSuccessResult(messages.length, lastTimestamp);

        } catch (error) {
            // Update sync state as failed and return error result
            return await this.handleSyncError(channelId, error);
        }
    }

    /**
     * Build HistoryOptions for Slack API call based on last sync timestamp
     */
    private buildHistoryOptions(lastSyncTimestamp?: number): HistoryOptions {
        const options: HistoryOptions = {
            limit: this.pageSize
        };

        if (lastSyncTimestamp) {
            options.oldest = lastSyncTimestamp.toString();
        }

        return options;
    }

    /**
     * Calculate the latest timestamp from an array of messages
     */
    private calculateLatestTimestamp(messages: SlackMessage[]): number {
        const timestamps = messages.map(m => parseFloat(m.ts));
        return Math.max(...timestamps);
    }

    /**
     * Create a success result object
     */
    private createSuccessResult(messageCount: number, lastTimestamp?: number): SyncResult {
        return {
            success: true,
            messagesRetrieved: messageCount,
            lastTimestamp
        };
    }

    /**
     * Update sync state on successful sync
     */
    private async updateSyncStateSuccess(channelId: string, lastTimestamp: number, messageCount: number): Promise<void> {
        await this.syncStateManager.updateSyncState(channelId, {
            lastSyncTimestamp: lastTimestamp,
            lastSyncStatus: 'success',
            lastSyncMessageCount: messageCount
        });
    }

    /**
     * Handle sync error by updating sync state and returning error result
     */
    private async handleSyncError(channelId: string, error: unknown): Promise<SyncResult> {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await this.syncStateManager.updateSyncState(channelId, {
            lastSyncStatus: 'failed',
            lastSyncError: errorMessage
        });

        return {
            success: false,
            messagesRetrieved: 0,
            error: errorMessage
        };
    }

    /**
     * Fetch messages from Slack API with retry logic for transient errors and rate limiting
     * @param channelId Slack channel ID
     * @param options History options for the API call
     * @param attempt Current attempt number (for internal use)
     * @returns Array of Slack messages
     */
    private async fetchMessagesWithRetry(
        channelId: string,
        options: HistoryOptions,
        attempt: number = 1
    ): Promise<SlackMessage[]> {
        try {
            const result = await this.slackClient.getChannelHistory(channelId, options);
            
            if (result.success) {
                return result.value;
            } else {
                // Handle failure
                const error = (result as { success: false; error: Error }).error;
                if (this.isRateLimitError(error)) {
                    const retryAfter = this.getRetryAfter(error);
                    if (retryAfter) {
                        await this.handleRateLimit(retryAfter);
                        return this.fetchMessagesWithRetry(channelId, options, attempt);
                    }
                }

                // Retry on failure
                if (attempt < this.maxRetries) {
                    return this.fetchMessagesWithRetry(channelId, options, attempt + 1);
                }

                throw error;
            }

        } catch (error) {
            if (attempt < this.maxRetries) {
                return this.fetchMessagesWithRetry(channelId, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Handle rate limit by waiting for the specified time
     * @param retryAfter Retry-After header value in seconds
     */
    private async handleRateLimit(retryAfter: string): Promise<void> {
        const waitTime = parseInt(retryAfter) * 1000; // Convert to milliseconds
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    /**
     * Check if an error is a rate limit error
     * @param error Error object to check
     * @returns true if it's a rate limit error, false otherwise
     */
    private isRateLimitError(error: Error): boolean {
        return 'response' in error && 
               (error as any).response?.status === 429;
    }

    /**
     * Get retry-after header value from a rate limit error
     * @param error Rate limit error
     * @returns Retry-after value in seconds, or null if not found
     */
    private getRetryAfter(error: Error): string | null {
        if (this.isRateLimitError(error)) {
            return (error as any).response?.headers?.['retry-after'] || null;
        }
        return null;
    }
}