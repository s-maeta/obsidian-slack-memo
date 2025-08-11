// TASK-501: 統合テストスイート - テストデータ生成
// REDフェーズ: テストデータ生成クラス

import { MockSlackMessage } from './mock-slack';
import { MockSlackEnvironment } from './mock-slack';

export interface MessageGenerationOptions {
  simpleMessages?: number;
  messagesWithMentions?: number;
  messagesWithAttachments?: number;
  codeBlocks?: number;
  threadMessages?: number;
  longMessages?: number;
  emojiMessages?: number;
  linkMessages?: number;
}

/**
 * 統合テスト用のテストデータ生成クラス
 * 多様なSlackメッセージパターンとシナリオデータを生成
 */
export class TestDataGenerator {
  private objectPool: MockObjectPool;
  private messageTemplates: MessageTemplate[];

  constructor() {
    this.objectPool = new MockObjectPool();
    this.messageTemplates = this.initializeMessageTemplates();
  }

  private initializeMessageTemplates(): MessageTemplate[] {
    return [
      {
        type: 'simple',
        textPattern: 'Hello everyone!',
        userPattern: 'U123456',
        hasFiles: false,
        hasThread: false
      },
      {
        type: 'mention',
        textPattern: '<@U123456> can you help with this?',
        userPattern: 'U789012',
        hasFiles: false,
        hasThread: true
      },
      {
        type: 'code',
        textPattern: '```javascript\nconsole.log("Hello World");\n```',
        userPattern: 'U345678',
        hasFiles: false,
        hasThread: false
      },
      {
        type: 'file',
        textPattern: 'Here\'s the document you requested.',
        userPattern: 'U456789',
        hasFiles: true,
        hasThread: false
      },
      {
        type: 'announcement',
        textPattern: '📢 Team meeting tomorrow at 3 PM in conference room A',
        userPattern: 'U567890',
        hasFiles: false,
        hasThread: true
      }
    ];
  }

  generateMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const template = this.messageTemplates[i % this.messageTemplates.length];
      const message = this.createMessageFromTemplate(template, i);
      messages.push(this.objectPool.createMessage(message));
    }
    
    return messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  }

  generateLargeMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const largeText = this.generateLargeText(1000 + Math.floor(Math.random() * 4000)); // 1-5KB messages
      const message = this.objectPool.createMessage({
        text: largeText,
        user: `U${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        ts: ((Date.now() / 1000) + i).toString(),
        files: Math.random() < 0.3 ? this.generateFiles(1 + Math.floor(Math.random() * 3)) : undefined
      });
      messages.push(message);
    }
    
    return messages;
  }

  generatePerformanceTestData(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const batchSize = 1000;
    
    for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
      const batchCount = Math.min(batchSize, count - (batch * batchSize));
      const batchMessages = this.generateOptimizedBatch(batchCount, batch);
      messages.push(...batchMessages);
    }
    
    return messages;
  }

  private generateOptimizedBatch(count: number, batchIndex: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const baseTimestamp = Date.now() / 1000 + (batchIndex * 3600); // 1 hour apart per batch
    
    for (let i = 0; i < count; i++) {
      const template = this.messageTemplates[i % this.messageTemplates.length];
      const message = {
        text: this.generateVariantText(template.textPattern, i),
        user: this.generateVariantUser(template.userPattern, i),
        ts: (baseTimestamp + i).toString(),
        thread_ts: template.hasThread && Math.random() < 0.2 ? (baseTimestamp + Math.floor(i / 10)).toString() : undefined,
        files: template.hasFiles && Math.random() < 0.4 ? this.generateFiles(1) : undefined
      };
      
      messages.push(this.objectPool.createMessage(message));
    }
    
    return messages;
  }

  generateComplexMessageSet(options: MessageGenerationOptions): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    let messageId = 0;
    
    // Generate different types of messages based on options
    if (options.simpleMessages) {
      const simple = this.generateMessagesByType('simple', options.simpleMessages, messageId);
      messages.push(...simple);
      messageId += simple.length;
    }
    
    if (options.messagesWithMentions) {
      const mentions = this.generateMessagesByType('mention', options.messagesWithMentions, messageId);
      messages.push(...mentions);
      messageId += mentions.length;
    }
    
    if (options.codeBlocks) {
      const code = this.generateMessagesByType('code', options.codeBlocks, messageId);
      messages.push(...code);
      messageId += code.length;
    }
    
    if (options.fileAttachments) {
      const files = this.generateMessagesByType('file', options.fileAttachments, messageId);
      messages.push(...files);
      messageId += files.length;
    }
    
    if (options.conversationThreads) {
      const threads = this.generateConversationThreads(options.conversationThreads, messageId);
      messages.push(...threads);
      messageId += threads.length;
    }
    
    if (options.richTextBlocks) {
      const richText = this.generateRichTextMessages(options.richTextBlocks, messageId);
      messages.push(...richText);
    }
    
    // Sort by timestamp to maintain chronological order
    return messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  }

  private generateMessagesByType(type: string, count: number, startId: number): MockSlackMessage[] {
    const template = this.messageTemplates.find(t => t.type === type) || this.messageTemplates[0];
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const message = this.createMessageFromTemplate(template, startId + i);
      messages.push(this.objectPool.createMessage(message));
    }
    
    return messages;
  }

  generateConversationThreads(count: number, startId: number = 0): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const baseTime = Date.now() / 1000;
    
    for (let i = 0; i < count; i++) {
      const threadTs = (baseTime + i * 100).toString(); // 100 seconds apart
      
      // Parent message
      const parentMessage = this.objectPool.createMessage({
        text: `Thread starter message ${i + 1}: What do you think about this proposal?`,
        user: `U${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        ts: threadTs
      });
      messages.push(parentMessage);
      
      // Thread replies (2-5 replies per thread)
      const replyCount = Math.floor(Math.random() * 4) + 2;
      for (let j = 0; j < replyCount; j++) {
        const replyMessage = this.objectPool.createMessage({
          text: `Reply ${j + 1} to thread: I think this is a great idea!`,
          user: `U${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          ts: (parseFloat(threadTs) + j + 1).toString(),
          thread_ts: threadTs
        });
        messages.push(replyMessage);
      }
    }
    
    return messages;
  }

  generateMessagesWithFiles(count: number, startId: number = 0): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const fileCount = Math.floor(Math.random() * 3) + 1; // 1-3 files
      const message = this.objectPool.createMessage({
        text: `File attachment message ${i + 1}`,
        user: `U${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        ts: ((Date.now() / 1000) + startId + i).toString(),
        files: this.generateFiles(fileCount)
      });
      messages.push(message);
    }
    
    return messages;
  }

  generateRichTextMessages(count: number, startId: number = 0): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const richTextTemplates = [
      'Here\'s a link: <https://example.com|Example Site>',
      'Channel reference: <#C1234567890|general>',
      'User mention: <@U1234567890> please review this',
      ':rocket: *Bold text* and _italic text_ with `inline code`',
      '> This is a quote\n> spanning multiple lines'
    ];
    
    for (let i = 0; i < count; i++) {
      const template = richTextTemplates[i % richTextTemplates.length];
      const message = this.objectPool.createMessage({
        text: template,
        user: `U${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        ts: ((Date.now() / 1000) + startId + i).toString(),
        blocks: this.generateBlocks()
      });
      messages.push(message);
    }
    
    return messages;
  }

  private createMessageFromTemplate(template: MessageTemplate, index: number): Partial<MockSlackMessage> {
    return {
      text: this.generateVariantText(template.textPattern, index),
      user: this.generateVariantUser(template.userPattern, index),
      ts: ((Date.now() / 1000) + index).toString(),
      thread_ts: template.hasThread && Math.random() < 0.3 ? ((Date.now() / 1000) + Math.floor(index / 5)).toString() : undefined,
      files: template.hasFiles ? this.generateFiles(1) : undefined
    };
  }

  private generateVariantText(pattern: string, index: number): string {
    if (pattern.includes('{}')) {
      return pattern.replace('{}', index.toString());
    }
    return `${pattern} (${index})`;
  }

  private generateVariantUser(pattern: string, index: number): string {
    const suffix = (index % 10).toString();
    return pattern.slice(0, -1) + suffix;
  }

  private generateLargeText(targetLength: number): string {
    const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do'];
    let text = '';
    
    while (text.length < targetLength) {
      const word = words[Math.floor(Math.random() * words.length)];
      text += word + ' ';
    }
    
    return text.trim();
  }

  private generateFiles(count: number): Array<{ name: string; url_private: string; mimetype?: string }> {
    const files = [];
    const fileTypes = [
      { name: 'document.pdf', mimetype: 'application/pdf' },
      { name: 'image.png', mimetype: 'image/png' },
      { name: 'spreadsheet.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'script.js', mimetype: 'application/javascript' },
      { name: 'data.csv', mimetype: 'text/csv' }
    ];
    
    for (let i = 0; i < count; i++) {
      const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
      files.push({
        name: `${i}_${fileType.name}`,
        url_private: `https://files.slack.com/files-pri/T1234567890-F${Math.random().toString(36).substring(2, 10).toUpperCase()}/${fileType.name}`,
        mimetype: fileType.mimetype
      });
    }
    
    return files;
  }

  private generateBlocks(): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a rich text block with *formatting*'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Another section with a button'
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Click Me'
          },
          action_id: 'button_click'
        }
      }
    ];
  }

  // Utility methods for performance testing
  releaseMessages(messages: MockSlackMessage[]): void {
    messages.forEach(msg => this.objectPool.releaseMessage(msg));
  }

  getPoolStatistics(): PoolStatistics {
    return this.objectPool.getStatistics();
  }

  resetPool(): void {
    this.objectPool.reset();
  }
}

// Enhanced Supporting Classes and Interfaces
interface MessageTemplate {
  type: string;
  textPattern: string;
  userPattern: string;
  hasFiles: boolean;
  hasThread: boolean;
}

export interface MessageGenerationOptions {
  simpleMessages?: number;
  messagesWithMentions?: number;
  codeBlocks?: number;
  fileAttachments?: number;
  conversationThreads?: number;
  richTextBlocks?: number;
}

class MockObjectPool {
  private messagePool: MockSlackMessage[] = [];
  private poolHits: number = 0;
  private poolMisses: number = 0;

  createMessage(template: Partial<MockSlackMessage>): MockSlackMessage {
    let message = this.messagePool.pop();
    
    if (message) {
      this.poolHits++;
      // Reset the message
      Object.keys(message).forEach(key => {
        delete (message as any)[key];
      });
    } else {
      this.poolMisses++;
      message = {} as MockSlackMessage;
    }
    
    // Apply template properties
    Object.assign(message, template);
    
    // Ensure required properties are set
    if (!message.text) message.text = 'Default message';
    if (!message.user) message.user = 'U123456';
    if (!message.ts) message.ts = (Date.now() / 1000).toString();
    
    return message;
  }

  releaseMessage(message: MockSlackMessage): void {
    // Only pool messages that don't have complex attachments to avoid memory leaks
    if (!message.files || message.files.length === 0) {
      this.messagePool.push(message);
    }
    
    // Limit pool size to prevent memory growth
    if (this.messagePool.length > 1000) {
      this.messagePool = this.messagePool.slice(-500); // Keep only the last 500
    }
  }

  getStatistics(): PoolStatistics {
    const total = this.poolHits + this.poolMisses;
    return {
      poolSize: this.messagePool.length,
      hitRate: total > 0 ? this.poolHits / total : 0,
      totalHits: this.poolHits,
      totalMisses: this.poolMisses
    };
  }

  reset(): void {
    this.messagePool = [];
    this.poolHits = 0;
    this.poolMisses = 0;
  }
}

interface PoolStatistics {
  poolSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}
