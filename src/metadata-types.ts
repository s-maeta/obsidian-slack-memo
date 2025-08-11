import { Message as SlackMessage } from './slack-types';
import { PluginSettings } from './types';

// メタデータ処理用の型定義

export interface ChannelInfo {
    id: string;
    name: string;
}

export interface MessageMetadata {
    // 基本情報
    messageId: string;
    timestamp: string;
    originalTimestamp: string;
    
    // ユーザー情報
    userId: string;
    username?: string;
    userDisplayName?: string;
    
    // チャンネル情報
    channelId: string;
    channelName: string;
    
    // スレッド情報
    isThread: boolean;
    threadTimestamp?: string;
    parentMessageId?: string;
    
    // コンテンツ情報
    hasAttachments: boolean;
    hasLinks: boolean;
    hasMentions: boolean;
    wordCount: number;
    
    // 追加情報
    reactions?: Reaction[];
    mentions?: string[];
    links?: string[];
    attachmentTypes?: string[];
}

export interface Reaction {
    name: string;
    count: number;
    users: string[];
}

export interface MetadataProcessorOptions {
    enableTags?: boolean;
    enableFrontMatter?: boolean;
    enableCustomProperties?: boolean;
    tagPrefix?: string;
    customProperties?: CustomPropertyDefinition[];
}

export interface CustomPropertyDefinition {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    defaultValue?: any;
    expression?: string; // JavaScript評価式
    condition?: string;  // 条件式
    validation?: ValidationRule[];
}

export interface ValidationRule {
    type: 'required' | 'minLength' | 'maxLength' | 'pattern';
    value?: any;
    message?: string;
}

export interface ProcessedMetadata {
    frontMatter: string;
    tags: string[];
    metadata: Record<string, any>;
    customProperties: Record<string, any>;
}

export interface FrontMatterOptions {
    includeTimestamp?: boolean;
    includeChannel?: boolean;
    includeUser?: boolean;
    includeThread?: boolean;
    includeAttachments?: boolean;
}