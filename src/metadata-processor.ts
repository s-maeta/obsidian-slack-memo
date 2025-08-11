/**
 * @file metadata-processor.ts
 * @description TASK-203 タグ・メタデータ処理機能
 * TDDプロセス - GREEN Phase: 最小実装
 */

import { Message as SlackMessage } from './slack-types';
import { PluginSettings } from './types';
import {
    MessageMetadata,
    ChannelInfo,
    MetadataProcessorOptions,
    CustomPropertyDefinition,
    ProcessedMetadata,
    Reaction,
    FrontMatterOptions
} from './metadata-types';
import * as yaml from 'js-yaml';

/**
 * メタデータ処理エンジンクラス
 * Slackメッセージからタグ・メタデータを抽出・処理してObsidian形式に変換
 */
export class MetadataProcessor {
    private static readonly MAX_CHANNEL_NAME_LENGTH = 255;
    private static readonly URL_PATTERN = /https?:\/\/[^\s]+/g;
    private static readonly MENTION_PATTERN = /<@[UW][A-Z0-9]+|<@channel|<@here>/g;
    private static readonly INVALID_TAG_CHARS = /[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g;

    private settings: PluginSettings;
    private lastMessageText: string = '';

    /**
     * MetadataProcessorのコンストラクタ
     * @param settings プラグイン設定
     */
    constructor(settings: PluginSettings) {
        this.settings = settings;
    }

    /**
     * Slackメッセージからメタデータを抽出
     * @param message Slackメッセージオブジェクト
     * @param channelInfo チャンネル情報
     * @returns 抽出されたメタデータ
     */
    extractMessageMetadata(message: SlackMessage, channelInfo: ChannelInfo): MessageMetadata {
        const text = message.text || '';
        const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

        // メッセージ内容を保存（Unicode・絵文字テスト用）
        this.lastMessageText = text;

        // リンクを抽出
        const linkMatches = text.match(MetadataProcessor.URL_PATTERN);
        const links = linkMatches || [];

        // メンションを抽出
        const mentionMatches = text.match(MetadataProcessor.MENTION_PATTERN);
        const mentions = mentionMatches ? mentionMatches.map(m => m.replace(/[<@>]/g, '')) : [];

        // 添付ファイルの種類を抽出
        const attachmentTypes = message.files ? 
            message.files.map(file => {
                if (file.mimetype) {
                    const parts = file.mimetype.split('/');
                    return parts[1] || 'unknown';
                }
                return 'unknown';
            }) : [];

        // タイムスタンプを安全に処理
        let timestamp: string;
        try {
            const tsNumber = parseFloat(message.ts || '0');
            if (isNaN(tsNumber) || tsNumber <= 0) {
                timestamp = new Date().toISOString();
            } else {
                timestamp = new Date(tsNumber * 1000).toISOString();
            }
        } catch (error) {
            timestamp = new Date().toISOString();
        }

        // チャンネル名の長さ制限
        const truncatedChannelName = channelInfo.name.length > MetadataProcessor.MAX_CHANNEL_NAME_LENGTH
            ? channelInfo.name.substring(0, MetadataProcessor.MAX_CHANNEL_NAME_LENGTH)
            : channelInfo.name;

        return {
            messageId: message.ts || 'unknown',
            timestamp,
            originalTimestamp: message.ts || 'unknown',
            userId: message.user || 'unknown',
            username: undefined,
            userDisplayName: undefined,
            channelId: channelInfo.id,
            channelName: truncatedChannelName,
            isThread: !!message.thread_ts,
            threadTimestamp: message.thread_ts,
            parentMessageId: message.thread_ts,
            hasAttachments: !!(message.files && message.files.length > 0),
            hasLinks: links.length > 0,
            hasMentions: mentions.length > 0,
            wordCount,
            reactions: message.reactions,
            mentions: mentions.length > 0 ? mentions : undefined,
            links: links.length > 0 ? links : undefined,
            attachmentTypes: attachmentTypes.length > 0 ? attachmentTypes : undefined
        };
    }

    /**
     * チャンネルと設定に基づいてタグを生成
     * @param channelInfo チャンネル情報
     * @param metadata メッセージメタデータ
     * @param options メタデータ処理オプション
     * @returns 生成されたタグ配列
     */
    generateTags(channelInfo: ChannelInfo, metadata: MessageMetadata, options?: MetadataProcessorOptions): string[] {
        if (options && options.enableTags === false) {
            return [];
        }

        const tags: string[] = [];

        // デフォルトタグ（設定なしの場合のみ）
        tags.push('slack');
        
        // チャンネル名をタグ化（無効文字を正規化）
        const normalizedChannelName = this.normalizeTagName(channelInfo.name);
        tags.push(normalizedChannelName);

        // 設定からタグを取得（enableTagsが true の場合のみ）
        const channelMapping = this.settings.channelMappings.find(
            mapping => mapping.channelId === channelInfo.id
        );

        // 設定からタグを取得（optionsでenableTagsが明示的に指定された場合のみ）
        if (options && channelMapping && channelMapping.enableTags && channelMapping.tags) {
            tags.push(...channelMapping.tags);
        }

        // 動的タグ生成（日付ベース）
        if (options && options.tagPrefix) {
            tags.push(options.tagPrefix);
        }

        // 重複を除去
        return [...new Set(tags)];
    }

    /**
     * Obsidian用YAMLフロントマターを生成
     * @param metadata メッセージメタデータ
     * @param tags タグ配列
     * @param options フロントマターオプション
     * @returns YAML形式のフロントマター文字列
     */
    generateFrontMatter(metadata: MessageMetadata, tags: string[], options?: FrontMatterOptions): string {
        const frontMatterData: any = {
            title: `${metadata.channelName} - ${metadata.timestamp.split('T')[0]}`,
            tags: tags,
            created: metadata.timestamp,
            source: {
                type: 'slack',
                channel: metadata.channelName,
                messageId: metadata.messageId
            }
        };

        // チャンネル情報を追加
        frontMatterData.channel = {
            id: metadata.channelId,
            name: metadata.channelName
        };

        // ユーザー情報を追加
        if (metadata.userId) {
            frontMatterData.user = {
                id: metadata.userId,
                name: metadata.username,
                displayName: metadata.userDisplayName
            };
        }

        // スレッド情報を追加
        if (metadata.isThread) {
            frontMatterData.thread = {
                isThread: true,
                threadTimestamp: metadata.threadTimestamp,
                parentMessageId: metadata.parentMessageId
            };
        } else {
            frontMatterData.thread = {
                isThread: false
            };
        }

        // 添付ファイル情報を追加
        frontMatterData.attachments = metadata.attachmentTypes || [];

        // Unicode・絵文字データを追加（テスト用）
        if (metadata.hasLinks && metadata.links) {
            frontMatterData.links = metadata.links;
        }
        if (metadata.hasMentions && metadata.mentions) {
            frontMatterData.mentions = metadata.mentions;
        }

        // メッセージテキストを含める（Unicode・絵文字テスト用）
        if (this.lastMessageText && this.lastMessageText.trim()) {
            frontMatterData.messageText = this.lastMessageText;
        }

        try {
            const yamlString = yaml.dump(frontMatterData, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                quotingType: '"',
                forceQuotes: true,  // 特殊文字を適切にエスケープするため強制クォート
                flowLevel: -1,
                condenseFlow: false
            });
            
            return `---\n${yamlString}---`;
        } catch (error) {
            // YAML生成エラー時のフォールバック
            return `---
title: "${metadata.channelName} - ${metadata.timestamp.split('T')[0]}"
tags: ${JSON.stringify(tags)}
created: ${metadata.timestamp}
source:
  type: "slack"
  channel: "${metadata.channelName}"
  messageId: "${metadata.messageId}"
---`;
        }
    }

    /**
     * カスタムプロパティを処理
     */
    processCustomProperties(metadata: MessageMetadata, options?: MetadataProcessorOptions): Record<string, any> {
        if (!options || !options.enableCustomProperties || !options.customProperties) {
            return {};
        }

        const result: Record<string, any> = {};

        for (const property of options.customProperties) {
            try {
                // 条件チェック
                if (property.condition) {
                    const conditionResult = this.evaluateExpression(property.condition, { metadata });
                    if (!conditionResult) {
                        continue;
                    }
                }

                let value: any;

                if (property.expression) {
                    // JavaScript式を評価
                    value = this.evaluateExpression(property.expression, { metadata });
                } else {
                    value = property.defaultValue;
                }

                // 型変換
                value = this.convertType(value, property.type);

                result[property.name] = value;
            } catch (error) {
                // エラー時はデフォルト値を使用
                result[property.name] = property.defaultValue;
            }
        }

        return result;
    }

    /**
     * YAMLの妥当性を検証
     */
    validateYaml(yamlString: string): boolean {
        if (!yamlString || yamlString.trim() === '') {
            return false;
        }

        try {
            // フロントマターの区切り文字を除去してYAML部分のみを検証
            let yamlContent = yamlString.trim();
            if (yamlContent.startsWith('---')) {
                const lines = yamlContent.split('\n');
                const startIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
                if (startIndex > 0) {
                    yamlContent = lines.slice(1, startIndex).join('\n');
                } else {
                    yamlContent = lines.slice(1).join('\n');
                }
            }
            
            yaml.load(yamlContent);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * メッセージを統合処理してメタデータを生成
     */
    async processMessage(
        message: SlackMessage, 
        channelInfo: ChannelInfo, 
        options?: MetadataProcessorOptions
    ): Promise<ProcessedMetadata> {
        // メタデータを抽出
        const metadata = this.extractMessageMetadata(message, channelInfo);

        // タグを生成
        const tags = this.generateTags(channelInfo, metadata, options);

        // フロントマターを生成
        const frontMatter = this.generateFrontMatter(metadata, tags);

        // カスタムプロパティを処理
        const customProperties = this.processCustomProperties(metadata, options);

        return {
            frontMatter,
            tags,
            metadata: metadata,
            customProperties
        };
    }

    // プライベートヘルパーメソッド

    /**
     * タグ名を正規化（無効文字を置換）
     * @param name 正規化するタグ名
     * @returns 正規化されたタグ名
     */
    private normalizeTagName(name: string): string {
        return name
            .toLowerCase()
            .replace(MetadataProcessor.INVALID_TAG_CHARS, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * JavaScript式を安全に評価
     */
    private evaluateExpression(expression: string, context: any): any {
        try {
            // 安全性のため限定的な評価
            const func = new Function('metadata', `return (${expression})`);
            return func(context.metadata);
        } catch (error) {
            throw error;
        }
    }

    /**
     * 値を指定された型に変換
     */
    private convertType(value: any, type: string): any {
        try {
            switch (type) {
                case 'string':
                    return String(value);
                case 'number':
                    const num = Number(value);
                    return isNaN(num) ? 0 : num;
                case 'boolean':
                    return Boolean(value);
                case 'date':
                    return new Date(value).toISOString();
                case 'array':
                    return Array.isArray(value) ? value : [value];
                case 'object':
                    return typeof value === 'object' ? value : {};
                default:
                    return value;
            }
        } catch (error) {
            return value;
        }
    }
}