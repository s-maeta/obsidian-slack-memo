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
  private userNames = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
    'Iris', 'Jack', 'Kate', 'Leo', 'Mary', 'Nick', 'Olivia', 'Paul'
  ];

  private channelNames = [
    '#general', '#random', '#dev', '#design', '#marketing', '#support',
    '#announcements', '#watercooler', '#project-alpha', '#project-beta'
  ];

  private sampleTexts = [
    'Hello everyone!',
    'How is the project going?',
    'Can we schedule a meeting?',
    'Great work on the last release!',
    'I need help with this issue.',
    'Does anyone know about this?',
    'Let\'s discuss this in more detail.',
    'Thanks for the quick response!',
    'Looking forward to the demo.',
    'The deadline is next week.'
  ];

  private codeSnippets = [
    'console.log("Hello, world!");',
    'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}',
    'SELECT * FROM users WHERE active = true;',
    'git commit -m "Fix critical bug"',
    'npm install --save-dev jest',
    'docker run -p 3000:3000 myapp',
    'curl -X POST https://api.example.com/data',
    'const result = await fetch("/api/data");'
  ];

  private attachmentTypes = [
    { name: 'document.pdf', mimetype: 'application/pdf' },
    { name: 'image.png', mimetype: 'image/png' },
    { name: 'spreadsheet.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { name: 'presentation.pptx', mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { name: 'archive.zip', mimetype: 'application/zip' },
    { name: 'video.mp4', mimetype: 'video/mp4' }
  ];

  // Basic Message Generation
  generateMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      messages.push({
        text: this.getRandomSampleText(),
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName()
      });
    }

    return messages;
  }

  generateMessagesWithMentions(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const mentionedUser = this.getRandomUserId();
      const text = `Hey <@${mentionedUser}>, ${this.getRandomSampleText()}`;
      
      messages.push({
        text,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName()
      });
    }

    return messages;
  }

  generateMessagesWithAttachments(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const attachment = this.getRandomAttachment();
      
      messages.push({
        text: `Check out this file: ${attachment.name}`,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName(),
        files: [attachment]
      });
    }

    return messages;
  }

  generateCodeBlockMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const codeSnippet = this.getRandomCodeSnippet();
      const language = this.guessCodeLanguage(codeSnippet);
      const text = `Here's the code:\n\`\`\`${language}\n${codeSnippet}\n\`\`\``;
      
      messages.push({
        text,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName()
      });
    }

    return messages;
  }

  generateThreadMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const parentTs = this.generateTimestamp(0);
    
    // Parent message
    messages.push({
      text: 'This is the main topic for discussion.',
      user: this.getRandomUserId(),
      ts: parentTs,
      channel: this.getRandomChannelName()
    });

    // Thread replies
    for (let i = 1; i < count; i++) {
      messages.push({
        text: `Reply ${i}: ${this.getRandomSampleText()}`,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName(),
        thread_ts: parentTs
      });
    }

    return messages;
  }

  generateLargeMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const largeText = this.generateLargeText(5000 + Math.random() * 5000); // 5KB-10KB
      
      messages.push({
        text: largeText,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName()
      });
    }

    return messages;
  }

  // Complex Message Sets
  generateComplexMessageSet(options: MessageGenerationOptions): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];

    if (options.simpleMessages) {
      messages.push(...this.generateMessages(options.simpleMessages));
    }

    if (options.messagesWithMentions) {
      messages.push(...this.generateMessagesWithMentions(options.messagesWithMentions));
    }

    if (options.messagesWithAttachments) {
      messages.push(...this.generateMessagesWithAttachments(options.messagesWithAttachments));
    }

    if (options.codeBlocks) {
      messages.push(...this.generateCodeBlockMessages(options.codeBlocks));
    }

    if (options.threadMessages) {
      messages.push(...this.generateThreadMessages(options.threadMessages));
    }

    if (options.longMessages) {
      messages.push(...this.generateLargeMessages(options.longMessages));
    }

    if (options.emojiMessages) {
      messages.push(...this.generateEmojiMessages(options.emojiMessages));
    }

    if (options.linkMessages) {
      messages.push(...this.generateLinkMessages(options.linkMessages));
    }

    // Sort by timestamp
    return messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  }

  generateEmojiMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const emojis = ['🚀', '🌟', '✨', '💫', '🎉', '👍', '❤️', '🔥', '💡', '🎯'];
    
    for (let i = 0; i < count; i++) {
      const randomEmojis = emojis
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .join(' ');
      
      const text = `${randomEmojis} ${this.getRandomSampleText()} ${randomEmojis}`;
      
      messages.push({
        text,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName()
      });
    }

    return messages;
  }

  generateLinkMessages(count: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const domains = ['github.com', 'docs.google.com', 'stackoverflow.com', 'medium.com', 'dev.to'];
    
    for (let i = 0; i < count; i++) {
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const url = `https://${domain}/some/path/to/resource`;
      const text = `Check this out: ${url} - ${this.getRandomSampleText()}`;
      
      messages.push({
        text,
        user: this.getRandomUserId(),
        ts: this.generateTimestamp(i),
        channel: this.getRandomChannelName()
      });
    }

    return messages;
  }

  // Channel Management
  generateChannelMappings(count: number): Array<{
    slackChannel: string;
    obsidianPath: string;
    format: string;
  }> {
    const mappings = [];
    
    for (let i = 0; i < count && i < this.channelNames.length; i++) {
      const channel = this.channelNames[i];
      const folderName = channel.slice(1); // Remove #
      
      mappings.push({
        slackChannel: channel,
        obsidianPath: `/notes/${folderName}/{{date}}.md`,
        format: 'daily'
      });
    }

    return mappings;
  }

  // Environment Population
  populateChannelsWithInitialMessages(slackEnv: MockSlackEnvironment): void {
    const channels = ['#general', '#random', '#dev'];
    
    channels.forEach(channel => {
      const messages = this.generateComplexMessageSet({
        simpleMessages: 20,
        messagesWithMentions: 5,
        messagesWithAttachments: 3,
        codeBlocks: 2,
        threadMessages: 8
      });
      
      slackEnv.addChannelMessages(channel, messages);
    });
  }

  populateChannelWithLargeDataset(slackEnv: MockSlackEnvironment, channel: string, messageCount: number): void {
    const batchSize = 1000;
    
    for (let i = 0; i < messageCount; i += batchSize) {
      const remainingMessages = Math.min(batchSize, messageCount - i);
      const messages = this.generateMessages(remainingMessages);
      slackEnv.addChannelMessages(channel, messages);
    }
  }

  // Utility Methods
  private getRandomUserId(): string {
    const userName = this.userNames[Math.floor(Math.random() * this.userNames.length)];
    return `U${userName.toUpperCase()}12345`;
  }

  private getRandomChannelName(): string {
    return this.channelNames[Math.floor(Math.random() * this.channelNames.length)];
  }

  private getRandomSampleText(): string {
    return this.sampleTexts[Math.floor(Math.random() * this.sampleTexts.length)];
  }

  private getRandomCodeSnippet(): string {
    return this.codeSnippets[Math.floor(Math.random() * this.codeSnippets.length)];
  }

  private getRandomAttachment() {
    const attachment = this.attachmentTypes[Math.floor(Math.random() * this.attachmentTypes.length)];
    return {
      ...attachment,
      url_private: `https://files.slack.com/files-pri/T1234567890-F${Math.random().toString(36).substring(2, 12).toUpperCase()}/${attachment.name}`
    };
  }

  private generateTimestamp(offset: number): string {
    const baseTime = Date.now() / 1000;
    const timestamp = baseTime + (offset * 60); // 1 minute intervals
    return timestamp.toFixed(6);
  }

  private generateLargeText(targetLength: number): string {
    const words = [
      'Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'Ut', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
      'exercitation', 'ullamco', 'laboris', 'nisi', 'ut', 'aliquip', 'ex', 'ea',
      'commodo', 'consequat', 'Duis', 'aute', 'irure', 'dolor', 'in', 'reprehenderit',
      'voluptate', 'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur'
    ];

    let text = '';
    while (text.length < targetLength) {
      const word = words[Math.floor(Math.random() * words.length)];
      text += word + ' ';
      
      // Add paragraphs occasionally
      if (text.length % 500 < 50 && text.length > 100) {
        text += '\n\n';
      }
    }

    return text.trim().substring(0, targetLength);
  }

  private guessCodeLanguage(code: string): string {
    if (code.includes('console.log') || code.includes('function')) return 'javascript';
    if (code.includes('SELECT') || code.includes('FROM')) return 'sql';
    if (code.includes('git ')) return 'bash';
    if (code.includes('npm ') || code.includes('docker ')) return 'bash';
    if (code.includes('curl ')) return 'bash';
    return 'text';
  }

  // Error Data Generation
  generateMalformedMessages(): MockSlackMessage[] {
    return [
      { text: null as any, user: 'U12345', ts: '1634567890.123456' },
      { text: 'test', user: null as any, ts: '1634567891.123456' },
      { text: 'test', user: 'U12345', ts: null as any },
      { text: 'test', user: 'U12345', ts: 'invalid_timestamp' },
      { text: '\uFFFD\uFFFD\uFFFD', user: 'U12345', ts: '1634567892.123456' },
      { text: 'a'.repeat(1000000), user: 'U12345', ts: '1634567893.123456' }, // 1MB message
      { text: '', user: 'U12345', ts: '1634567894.123456' } // Empty message
    ];
  }

  generateEncodingTestMessages(): MockSlackMessage[] {
    return [
      { text: 'Hello 🌍 World!', user: 'U12345', ts: '1634567890.123456' },
      { text: 'こんにちは世界', user: 'U12345', ts: '1634567891.123456' },
      { text: 'Тест на русском', user: 'U12345', ts: '1634567892.123456' },
      { text: '🚀🌟✨💫', user: 'U12345', ts: '1634567893.123456' },
      { text: 'Mixed: English + 日本語 + русский + العربية', user: 'U12345', ts: '1634567894.123456' },
      { text: 'Special chars: <>&"\'`\\', user: 'U12345', ts: '1634567895.123456' },
      { text: 'Unicode: 🔥💯⚡🎯🚀', user: 'U12345', ts: '1634567896.123456' }
    ];
  }

  // Performance Test Data
  generatePerformanceTestData(itemCount: number): MockSlackMessage[] {
    const messages: MockSlackMessage[] = [];
    const batchSize = 1000;

    for (let i = 0; i < itemCount; i++) {
      const complexity = i % 4; // Vary complexity
      
      let message: MockSlackMessage;
      switch (complexity) {
        case 0:
          message = this.generateMessages(1)[0];
          break;
        case 1:
          message = this.generateMessagesWithMentions(1)[0];
          break;
        case 2:
          message = this.generateMessagesWithAttachments(1)[0];
          break;
        case 3:
          message = this.generateCodeBlockMessages(1)[0];
          break;
        default:
          message = this.generateMessages(1)[0];
      }

      message.ts = this.generateTimestamp(i);
      messages.push(message);
    }

    return messages;
  }

  // Scenario-Specific Data
  generateRegressionTestData(): {
    oauth: any;
    channels: any[];
    messages: MockSlackMessage[];
    settings: any;
  } {
    return {
      oauth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'obsidian://slack-callback',
        scopes: ['channels:read', 'channels:history', 'users:read']
      },
      channels: this.generateChannelMappings(3),
      messages: this.generateComplexMessageSet({
        simpleMessages: 10,
        messagesWithMentions: 5,
        messagesWithAttachments: 3,
        codeBlocks: 2
      }),
      settings: {
        syncInterval: 300000,
        messageFormat: '{{timestamp}} - {{author}}: {{content}}',
        autoSyncEnabled: true,
        includeAttachments: true
      }
    };
  }
}