import { Message as SlackMessage } from './slack-types';

// ファイル保存エンジン用の型定義

export interface FileStorageOptions {
    channelId: string;
    channelName: string;
    content: string;
    message: SlackMessage;
    appendToDailyNote?: boolean;
}

export interface StorageResult {
    success: boolean;
    filePath?: string;
    error?: Error;
    metadata: {
        fileSize: number;
        createdAt: Date;
        appendedToDailyNote: boolean;
    };
}

export interface FileStorageEngineOptions {
    defaultPath: string;
    fileNameFormat: string;
    dailyNoteEnabled: boolean;
    dailyNoteFolder: string;
    dailyNoteDateFormat: string;
}