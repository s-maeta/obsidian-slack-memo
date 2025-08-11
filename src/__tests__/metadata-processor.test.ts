/**
 * @file metadata-processor.test.ts
 * @description TASK-203 タグ・メタデータ処理機能のテストスイート
 * TDDプロセス - RED Phase: 失敗するテストの実装
 */

import { MetadataProcessor } from '../metadata-processor';
import { 
    MessageMetadata,
    ChannelInfo,
    MetadataProcessorOptions,
    CustomPropertyDefinition,
    ProcessedMetadata,
    Reaction,
    FrontMatterOptions
} from '../metadata-types';
import { Message as SlackMessage } from '../slack-types';
import { PluginSettings } from '../types';

// モックデータの定義
const mockChannelInfo: ChannelInfo = {
    id: 'C123456',
    name: 'general'
};

const mockSlackMessage: SlackMessage = {
    type: 'message',
    ts: '1701425400.000100',
    text: 'Hello, world!',
    user: 'U789012'
};

const mockPluginSettings: PluginSettings = {
    slackToken: 'test-token',
    syncInterval: 30,
    channelMappings: [
        {
            channelId: 'C123456',
            channelName: 'general',
            targetFolder: 'slack/general',
            fileNameFormat: '{channel}-{date}.md',
            enableTags: true,
            tags: ['work', 'team-a'],
            saveAsIndividualFiles: true
        }
    ],
    dailyNoteSettings: {
        enabled: false,
        folder: 'Daily Notes',
        dateFormat: 'YYYY-MM-DD',
        headerFormat: '## Slack Messages',
        appendToExisting: true
    },
    messageFormat: {
        includeTimestamp: true,
        includeUserName: true,
        includeChannelName: false,
        timestampFormat: 'HH:mm',
        convertMentions: true,
        preserveEmojis: true
    },
    syncHistory: {
        lastSyncTime: null,
        totalMessagesSynced: 0,
        channelLastSync: {}
    }
};

describe('MetadataProcessor', () => {
    let metadataProcessor: MetadataProcessor;

    beforeEach(() => {
        metadataProcessor = new MetadataProcessor(mockPluginSettings);
    });

    // TC-MD-001: 正常なコンストラクタ呼び出し
    describe('Constructor', () => {
        test('TC-MD-001: should create instance with valid PluginSettings', () => {
            expect(() => new MetadataProcessor(mockPluginSettings)).not.toThrow();
            expect(metadataProcessor).toBeInstanceOf(MetadataProcessor);
        });
    });

    // TC-MD-010-014: extractMessageMetadata メソッド
    describe('extractMessageMetadata', () => {
        test('TC-MD-010: should extract basic message metadata', () => {
            const result = metadataProcessor.extractMessageMetadata(mockSlackMessage, mockChannelInfo);
            
            expect(result.messageId).toBe('1701425400.000100');
            expect(result.timestamp).toBeDefined();
            expect(result.originalTimestamp).toBe('1701425400.000100');
            expect(result.userId).toBe('U789012');
            expect(result.channelId).toBe('C123456');
            expect(result.channelName).toBe('general');
            expect(result.isThread).toBe(false);
            expect(result.hasAttachments).toBe(false);
            expect(result.hasLinks).toBe(false);
            expect(result.hasMentions).toBe(false);
            expect(result.wordCount).toBe(2);
        });

        test('TC-MD-011: should extract thread message metadata', () => {
            const threadMessage: SlackMessage = {
                ...mockSlackMessage,
                thread_ts: '1701425400.000050',
                ts: '1701425400.000100'
            };

            const result = metadataProcessor.extractMessageMetadata(threadMessage, mockChannelInfo);
            
            expect(result.isThread).toBe(true);
            expect(result.threadTimestamp).toBe('1701425400.000050');
            expect(result.parentMessageId).toBe('1701425400.000050');
        });

        test('TC-MD-012: should extract message with attachments metadata', () => {
            const messageWithFiles: SlackMessage = {
                ...mockSlackMessage,
                files: [
                    { id: 'F1', name: 'document.pdf', mimetype: 'application/pdf', created: 1701425400, timestamp: 1701425400 },
                    { id: 'F2', name: 'image.jpg', mimetype: 'image/jpeg', created: 1701425401, timestamp: 1701425401 }
                ]
            };

            const result = metadataProcessor.extractMessageMetadata(messageWithFiles, mockChannelInfo);
            
            expect(result.hasAttachments).toBe(true);
            expect(result.attachmentTypes).toEqual(['pdf', 'jpeg']);
        });

        test('TC-MD-013: should extract message with links metadata', () => {
            const messageWithLinks: SlackMessage = {
                ...mockSlackMessage,
                text: 'Check this out: https://example.com and https://github.com'
            };

            const result = metadataProcessor.extractMessageMetadata(messageWithLinks, mockChannelInfo);
            
            expect(result.hasLinks).toBe(true);
            expect(result.links).toEqual(['https://example.com', 'https://github.com']);
        });

        test('TC-MD-014: should extract message with mentions metadata', () => {
            const messageWithMentions: SlackMessage = {
                ...mockSlackMessage,
                text: 'Hello <@U123456> and <@channel>!'
            };

            const result = metadataProcessor.extractMessageMetadata(messageWithMentions, mockChannelInfo);
            
            expect(result.hasMentions).toBe(true);
            expect(result.mentions).toEqual(['U123456', 'channel']);
        });
    });

    // TC-MD-020-025: generateTags メソッド
    describe('generateTags', () => {
        const mockMetadata: MessageMetadata = {
            messageId: '1701425400.000100',
            timestamp: '2023-12-01T09:30:00Z',
            originalTimestamp: '1701425400.000100',
            userId: 'U789012',
            channelId: 'C123456',
            channelName: 'general',
            isThread: false,
            hasAttachments: false,
            hasLinks: false,
            hasMentions: false,
            wordCount: 2
        };

        test('TC-MD-020: should generate default tags', () => {
            // optionsなしでデフォルトタグのみを生成
            const result = metadataProcessor.generateTags(mockChannelInfo, mockMetadata);
            
            expect(result).toEqual(['slack', 'general']);
        });

        test('TC-MD-021: should generate configured tags', () => {
            const options: MetadataProcessorOptions = {
                enableTags: true
            };
            
            const result = metadataProcessor.generateTags(mockChannelInfo, mockMetadata, options);
            
            expect(result).toContain('slack');
            expect(result).toContain('general');
            expect(result).toContain('work');
            expect(result).toContain('team-a');
        });

        test('TC-MD-022: should return empty array when tags disabled', () => {
            const options: MetadataProcessorOptions = {
                enableTags: false
            };
            
            const result = metadataProcessor.generateTags(mockChannelInfo, mockMetadata, options);
            
            expect(result).toEqual([]);
        });

        test('TC-MD-023: should generate dynamic date-based tags', () => {
            const today = new Date().toISOString().split('T')[0];
            const options: MetadataProcessorOptions = {
                enableTags: true,
                tagPrefix: `date-${today}`
            };
            
            const result = metadataProcessor.generateTags(mockChannelInfo, mockMetadata, options);
            
            expect(result.some((tag: string) => tag.includes(today))).toBe(true);
        });

        test('TC-MD-024: should normalize invalid characters in tags', () => {
            const channelInfoWithSpaces: ChannelInfo = {
                id: 'C123456',
                name: 'channel with spaces/and/slashes'
            };
            
            const result = metadataProcessor.generateTags(channelInfoWithSpaces, mockMetadata);
            
            expect(result).toContain('channel-with-spaces-and-slashes');
        });

        test('TC-MD-025: should remove duplicate tags', () => {
            const options: MetadataProcessorOptions = {
                enableTags: true
            };
            
            const result = metadataProcessor.generateTags(mockChannelInfo, mockMetadata, options);
            
            const uniqueResult = [...new Set(result)];
            expect(result.length).toBe(uniqueResult.length);
        });
    });

    // TC-MD-030-034: generateFrontMatter メソッド
    describe('generateFrontMatter', () => {
        const mockMetadata: MessageMetadata = {
            messageId: '1701425400.000100',
            timestamp: '2023-12-01T09:30:00Z',
            originalTimestamp: '1701425400.000100',
            userId: 'U789012',
            username: 'john.doe',
            userDisplayName: 'John Doe',
            channelId: 'C123456',
            channelName: 'general',
            isThread: false,
            hasAttachments: false,
            hasLinks: false,
            hasMentions: false,
            wordCount: 2
        };

        const mockTags = ['slack', 'general', 'work'];

        test('TC-MD-030: should generate basic front matter', () => {
            const result = metadataProcessor.generateFrontMatter(mockMetadata, mockTags);
            
            expect(result).toContain('---');
            expect(result).toContain('title:');
            expect(result).toContain('tags:');
            expect(result).toContain('created:');
            expect(result).toContain('source:');
            expect(result).toContain('- "slack"');
            expect(result).toContain('- "general"');
            expect(result).toContain('- "work"');
        });

        test('TC-MD-031: should generate front matter with empty tags', () => {
            const result = metadataProcessor.generateFrontMatter(mockMetadata, []);
            
            expect(result).toContain('tags: []');
        });

        test('TC-MD-032: should properly escape special characters', () => {
            const specialCharMetadata: MessageMetadata = {
                ...mockMetadata,
                userDisplayName: 'User "With" Quotes',
                channelName: 'channel:with:colons'
            };
            
            const result = metadataProcessor.generateFrontMatter(specialCharMetadata, mockTags);
            
            expect(result).not.toContain('User "With" Quotes');
            expect(result).toContain('"User \\"With\\" Quotes"');
        });

        test('TC-MD-033: should handle Japanese characters', () => {
            const japaneseMetadata: MessageMetadata = {
                ...mockMetadata,
                channelName: 'チャンネル名',
                userDisplayName: '田中太郎'
            };
            
            const result = metadataProcessor.generateFrontMatter(japaneseMetadata, ['タグ']);
            
            expect(result).toContain('チャンネル名');
            expect(result).toContain('田中太郎');
            expect(result).toContain('タグ');
        });

        test('TC-MD-034: should handle null/undefined values', () => {
            const incompleteMetadata: MessageMetadata = {
                ...mockMetadata,
                username: undefined,
                userDisplayName: undefined
            };
            
            const result = metadataProcessor.generateFrontMatter(incompleteMetadata, mockTags);
            
            expect(result).toBeDefined();
            expect(result).toContain('---');
        });
    });

    // TC-MD-040-045: processCustomProperties メソッド
    describe('processCustomProperties', () => {
        const mockMetadata: MessageMetadata = {
            messageId: '1701425400.000100',
            timestamp: '2023-12-01T09:30:00Z',
            originalTimestamp: '1701425400.000100',
            userId: 'U789012',
            channelId: 'C123456',
            channelName: 'general',
            isThread: false,
            hasAttachments: true,
            hasLinks: false,
            hasMentions: false,
            wordCount: 10
        };

        test('TC-MD-040: should return empty object when no custom properties', () => {
            const options: MetadataProcessorOptions = {
                enableCustomProperties: false,
                customProperties: []
            };
            
            const result = metadataProcessor.processCustomProperties(mockMetadata, options);
            
            expect(result).toEqual({});
        });

        test('TC-MD-041: should process basic custom properties', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { name: 'priority', type: 'string', defaultValue: 'normal' },
                { name: 'wordLimit', type: 'number', defaultValue: 100 },
                { name: 'isImportant', type: 'boolean', defaultValue: false }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockMetadata, options);
            
            expect(result.priority).toBe('normal');
            expect(result.wordLimit).toBe(100);
            expect(result.isImportant).toBe(false);
        });

        test('TC-MD-042: should evaluate JavaScript expressions', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'processedAt', 
                    type: 'string', 
                    expression: 'new Date().toISOString()' 
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockMetadata, options);
            
            expect(result.processedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
        });

        test('TC-MD-043: should handle conditional properties', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'hasFiles', 
                    type: 'boolean', 
                    expression: 'true',
                    condition: 'metadata.hasAttachments' 
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockMetadata, options);
            
            expect(result.hasFiles).toBe(true);
        });

        test('TC-MD-044: should apply default values on expression failure', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'errorProperty', 
                    type: 'string',
                    expression: 'invalid.javascript.expression',
                    defaultValue: 'fallback'
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockMetadata, options);
            
            expect(result.errorProperty).toBe('fallback');
        });

        test('TC-MD-045: should convert types properly', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'stringNumber', 
                    type: 'number',
                    expression: '"123"'
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockMetadata, options);
            
            expect(result.stringNumber).toBe(123);
            expect(typeof result.stringNumber).toBe('number');
        });
    });

    // TC-MD-050-052: validateYaml メソッド
    describe('validateYaml', () => {
        test('TC-MD-050: should validate correct YAML', () => {
            const validYaml = `---
title: "Test Title"
tags:
  - slack
  - general
created: 2023-12-01T09:30:00Z
---`;
            
            const result = metadataProcessor.validateYaml(validYaml);
            
            expect(result).toBe(true);
        });

        test('TC-MD-051: should reject invalid YAML', () => {
            const invalidYaml = `---
title: "Test Title
tags:
  - slack
  - general
invalid: [unclosed array
---`;
            
            const result = metadataProcessor.validateYaml(invalidYaml);
            
            expect(result).toBe(false);
        });

        test('TC-MD-052: should reject empty string', () => {
            const result = metadataProcessor.validateYaml('');
            
            expect(result).toBe(false);
        });
    });

    // TC-MD-060-063: processMessage メソッド - 統合テスト
    describe('processMessage - Integration Tests', () => {
        test('TC-MD-060: should process standard message completely', async () => {
            const result = await metadataProcessor.processMessage(mockSlackMessage, mockChannelInfo);
            
            expect(result).toBeDefined();
            expect(result.frontMatter).toContain('---');
            expect(result.tags).toContain('slack');
            expect(result.metadata).toBeDefined();
            expect(result.customProperties).toBeDefined();
        });

        test('TC-MD-061: should process message with all features enabled', async () => {
            const complexMessage: SlackMessage = {
                ...mockSlackMessage,
                text: 'Complex message with <@U123456> and https://example.com',
                files: [{ id: 'F1', name: 'doc.pdf', mimetype: 'application/pdf', created: 1701425400, timestamp: 1701425400 }],
                reactions: [{ name: 'thumbsup', count: 5, users: ['U123456'] }]
            };
            
            const options: MetadataProcessorOptions = {
                enableTags: true,
                enableFrontMatter: true,
                enableCustomProperties: true,
                customProperties: [
                    { name: 'complexity', type: 'string', defaultValue: 'high' }
                ]
            };
            
            const result = await metadataProcessor.processMessage(complexMessage, mockChannelInfo, options);
            
            expect(result.metadata.hasMentions).toBe(true);
            expect(result.metadata.hasLinks).toBe(true);
            expect(result.metadata.hasAttachments).toBe(true);
            expect(result.customProperties.complexity).toBe('high');
        });

        test('TC-MD-062: should process message with minimal configuration', async () => {
            const options: MetadataProcessorOptions = {
                enableTags: false,
                enableFrontMatter: true,
                enableCustomProperties: false
            };
            
            const result = await metadataProcessor.processMessage(mockSlackMessage, mockChannelInfo, options);
            
            expect(result.tags).toEqual([]);
            expect(result.frontMatter).toContain('---');
            expect(result.customProperties).toEqual({});
        });

        test('TC-MD-063: should process thread message completely', async () => {
            const threadMessage: SlackMessage = {
                ...mockSlackMessage,
                thread_ts: '1701425400.000050'
            };
            
            const result = await metadataProcessor.processMessage(threadMessage, mockChannelInfo);
            
            expect(result.metadata.isThread).toBe(true);
            expect(result.metadata.threadTimestamp).toBe('1701425400.000050');
        });
    });

    // TC-MD-080-082: エラーハンドリングテスト
    describe('Error Handling', () => {
        test('TC-MD-080: should handle invalid Slack message', async () => {
            const invalidMessage = {} as SlackMessage;
            
            const result = await metadataProcessor.processMessage(invalidMessage, mockChannelInfo);
            
            expect(result.frontMatter).toBeDefined();
            expect(result.metadata).toBeDefined();
        });

        test('TC-MD-081: should handle invalid channel info', async () => {
            const invalidChannelInfo = { id: '', name: '' } as ChannelInfo;
            
            const result = await metadataProcessor.processMessage(mockSlackMessage, invalidChannelInfo);
            
            expect(result).toBeDefined();
        });

        test('TC-MD-082: should handle YAML generation error', () => {
            const circularMetadata = {
                messageId: 'test',
                timestamp: '2023-12-01T09:30:00Z',
                originalTimestamp: '1701425400.000100',
                userId: 'U789012',
                channelId: 'C123456',
                channelName: 'general',
                isThread: false,
                hasAttachments: false,
                hasLinks: false,
                hasMentions: false,
                wordCount: 2
            } as MessageMetadata;
            // Cannot create circular reference with MessageMetadata interface
            
            expect(() => {
                metadataProcessor.generateFrontMatter(circularMetadata, []);
            }).not.toThrow();
        });
    });

    // TC-MD-090-092: カスタムプロパティエラー
    describe('Custom Property Errors', () => {
        test('TC-MD-090: should handle JavaScript expression evaluation error', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'errorProp', 
                    type: 'string',
                    expression: 'throw new Error("Test error")',
                    defaultValue: 'safe default'
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockSlackMessage as any, options);
            
            expect(result.errorProp).toBe('safe default');
        });

        test('TC-MD-091: should handle type conversion error', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'unconvertible', 
                    type: 'number',
                    expression: '"not a number"',
                    defaultValue: 0
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockSlackMessage as any, options);
            
            expect(result.unconvertible).toBe(0);
        });

        test('TC-MD-092: should handle infinite loop expressions with timeout', () => {
            const customProperties: CustomPropertyDefinition[] = [
                { 
                    name: 'infiniteLoop', 
                    type: 'string',
                    expression: 'while(true) {}',
                    defaultValue: 'timeout fallback'
                }
            ];
            
            const options: MetadataProcessorOptions = {
                enableCustomProperties: true,
                customProperties
            };
            
            const result = metadataProcessor.processCustomProperties(mockSlackMessage as any, options);
            
            expect(result.infiniteLoop).toBe('timeout fallback');
        }, 10000); // 10 second timeout
    });

    // TC-MD-110-113: エッジケーステスト
    describe('Edge Cases', () => {
        test('TC-MD-110: should handle empty message', async () => {
            const emptyMessage: SlackMessage = {
                type: 'message',
                ts: '1701425400.000100',
                text: '',
                user: 'U789012'
            };
            
            const result = await metadataProcessor.processMessage(emptyMessage, mockChannelInfo);
            
            expect(result.metadata.wordCount).toBe(0);
            expect(result.frontMatter).toBeDefined();
        });

        test('TC-MD-111: should handle Unicode and emoji in message', async () => {
            const unicodeMessage: SlackMessage = {
                ...mockSlackMessage,
                text: 'Hello 👋 世界 🌍 emoji and unicode test'
            };
            
            const result = await metadataProcessor.processMessage(unicodeMessage, mockChannelInfo);
            
            expect(result.frontMatter).toContain('👋');
            expect(result.frontMatter).toContain('世界');
            expect(result.frontMatter).toContain('🌍');
        });

        test('TC-MD-112: should handle very long channel and user names', async () => {
            const longName = 'a'.repeat(300);
            const longNameChannelInfo: ChannelInfo = {
                id: 'C123456',
                name: longName
            };
            
            const result = await metadataProcessor.processMessage(mockSlackMessage, longNameChannelInfo);
            
            expect(result.metadata.channelName.length).toBeLessThanOrEqual(255);
        });

        test('TC-MD-113: should handle special characters in tag names', () => {
            const specialChannelInfo: ChannelInfo = {
                id: 'C123456',
                name: 'channel:with|special*chars?'
            };
            
            const result = metadataProcessor.generateTags(specialChannelInfo, mockSlackMessage as any);
            
            const hasInvalidChars = result.some((tag: string) => /[:|\*\?]/.test(tag));
            expect(hasInvalidChars).toBe(false);
        });
    });
});