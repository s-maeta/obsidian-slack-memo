import { Message as SlackMessage } from './slack-types';
import { convertSlackEmoji } from './emoji-map';

export interface MarkdownConversionOptions {
  convertMentions?: boolean;
  convertLinks?: boolean;
  convertEmojis?: boolean;
  preserveThreadStructure?: boolean;
  userNameResolver?: (userId: string) => string | Promise<string>;
  channelNameResolver?: (channelId: string) => string | Promise<string>;
}

export interface ConversionResult {
  markdown: string;
  attachments?: ConvertedAttachment[];
  metadata?: {
    originalTimestamp: string;
    threadTimestamp?: string;
    userId: string;
    channelId: string;
  };
}

export interface ConvertedAttachment {
  type: 'image' | 'file' | 'link';
  name: string;
  url: string;
  markdown: string;
}

interface ParsedTextPart {
  content: string;
  type: 'text' | 'codeblock';
}

/**
 * MarkdownConverter converts Slack messages to Obsidian-compatible Markdown format
 * Supports mentions, links, text decorations, emojis, and preserves code blocks
 */
export class MarkdownConverter {
  private options: MarkdownConversionOptions;

  // Pre-compiled regular expressions for better performance
  private static readonly REGEX = {
    CODE_BLOCK: /```[\s\S]*?```/g,
    USER_MENTION: /<@([UW][A-Z0-9]+)>/g,
    CHANNEL_MENTION: /<#([CD][A-Z0-9]+)(?:\|([^>]+))?>/g,
    LINK_WITH_LABEL: /<(https?:\/\/[^>|]+)\|([^>]+)>/g,
    SIMPLE_LINK: /<(https?:\/\/[^>]+)>/g,
    EMAIL_LINK: /<mailto:([^>]+)>/g,
    BOLD: /\*([^*]+)\*/g,
    ITALIC: /_([^_]+)_/g,
    STRIKETHROUGH: /~([^~]+)~/g,
    EMOJI: /:([a-zA-Z0-9_+-]+):/g,
  };

  constructor(options: MarkdownConversionOptions = {}) {
    this.options = {
      convertMentions: true,
      convertLinks: true,
      convertEmojis: true,
      preserveThreadStructure: true,
      ...options,
    };
  }

  /**
   * Convert a Slack message to Markdown format
   * @param message Slack message object
   * @param channelId Channel ID for context
   * @returns Conversion result with markdown, attachments, and metadata
   */
  async convertMessage(message: SlackMessage, channelId?: string): Promise<ConversionResult> {
    if (!message || !message.text) {
      return this.createEmptyResult(message, channelId);
    }

    let markdown = await this.convertText(message.text);

    // Handle thread indentation
    if (this.options.preserveThreadStructure && message.thread_ts) {
      markdown = this.indentForThread(markdown);
    }

    // Process attachments
    const attachments = message.files ? this.processAttachments(message) : undefined;

    return {
      markdown,
      attachments,
      metadata: this.extractMetadata(message, channelId),
    };
  }

  /**
   * Convert Slack text to Markdown, preserving code blocks
   * @param text Slack-formatted text
   * @returns Converted Markdown text
   */

  async convertText(text: string): Promise<string> {
    if (!text) {
      return '';
    }

    let result = text;

    // Skip conversion inside code blocks - process parts outside code blocks
    const codeBlockRegex = MarkdownConverter.REGEX.CODE_BLOCK;
    const parts: Array<{ content: string; isCodeBlock: boolean }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          content: text.slice(lastIndex, match.index),
          isCodeBlock: false,
        });
      }
      // Add code block
      parts.push({
        content: match[0],
        isCodeBlock: true,
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last code block
    if (lastIndex < text.length) {
      parts.push({
        content: text.slice(lastIndex),
        isCodeBlock: false,
      });
    }

    // If no code blocks found, add entire text as non-code block
    if (parts.length === 0) {
      parts.push({
        content: text,
        isCodeBlock: false,
      });
    }

    // Process each part
    let processedText = '';
    for (const part of parts) {
      if (part.isCodeBlock) {
        // Preserve code blocks as-is
        processedText += part.content;
      } else {
        // Apply conversions to non-code parts
        let partResult = part.content;

        if (this.options.convertMentions) {
          partResult = await this.convertMentions(partResult);
        }

        if (this.options.convertLinks) {
          partResult = this.convertLinks(partResult);
        }

        partResult = this.convertTextDecorations(partResult);

        if (this.options.convertEmojis) {
          partResult = this.convertEmojis(partResult);
        }

        processedText += partResult;
      }
    }

    return processedText;
  }

  private async convertMentions(text: string): Promise<string> {
    let result = text;

    // User mentions: <@U1234567>
    const userMatches = [...result.matchAll(MarkdownConverter.REGEX.USER_MENTION)];

    for (const match of userMatches) {
      const userId = match[1];
      if (this.options.userNameResolver) {
        try {
          const userName = await this.options.userNameResolver(userId);
          if (userName) {
            result = result.replace(match[0], `[[${userName}]]`);
          }
        } catch (error) {
          // Keep original mention on error
        }
      }
    }

    // Channel mentions: <#C1234567|general> or <#C1234567>
    const channelMatches = [...result.matchAll(MarkdownConverter.REGEX.CHANNEL_MENTION)];

    for (const match of channelMatches) {
      const [fullMatch, channelId, channelName] = match;
      if (channelName) {
        result = result.replace(fullMatch, `[[#${channelName}]]`);
      } else if (this.options.channelNameResolver) {
        try {
          const resolvedName = await this.options.channelNameResolver(channelId);
          if (resolvedName) {
            result = result.replace(fullMatch, `[[#${resolvedName}]]`);
          }
        } catch (error) {
          // Keep original mention on error
        }
      }
    }

    return result;
  }

  private convertLinks(text: string): string {
    // URL with label: <https://example.com|Label>
    let result = text.replace(MarkdownConverter.REGEX.LINK_WITH_LABEL, '[$2]($1)');

    // Simple URL: <https://example.com>
    result = result.replace(MarkdownConverter.REGEX.SIMPLE_LINK, '[$1]($1)');

    // Email: <mailto:email@example.com>
    result = result.replace(MarkdownConverter.REGEX.EMAIL_LINK, '[$1](mailto:$1)');

    return result;
  }

  private convertTextDecorations(text: string): string {
    let result = text;

    // Bold: *text* -> **text**
    result = result.replace(MarkdownConverter.REGEX.BOLD, '**$1**');

    // Italic: _text_ -> *text*
    result = result.replace(MarkdownConverter.REGEX.ITALIC, '*$1*');

    // Strikethrough: ~text~ -> ~~text~~
    result = result.replace(MarkdownConverter.REGEX.STRIKETHROUGH, '~~$1~~');

    return result;
  }

  private convertEmojis(text: string): string {
    return text.replace(MarkdownConverter.REGEX.EMOJI, (match, emojiCode) => {
      return convertSlackEmoji(emojiCode);
    });
  }

  private processAttachments(message: SlackMessage): ConvertedAttachment[] {
    if (!message.files) return [];

    return message.files.map(file => {
      const isImage = file.mimetype?.startsWith('image/');

      if (isImage) {
        return {
          type: 'image' as const,
          name: file.name || `file-${file.id}`,
          url: file.url_private || '',
          markdown: `![[${file.name || `file-${file.id}`}]]`,
        };
      } else {
        return {
          type: 'file' as const,
          name: file.name || `file-${file.id}`,
          url: file.url_private || '',
          markdown: `[${file.name || `file-${file.id}`}](${file.url_private || ''})`,
        };
      }
    });
  }

  /**
   * Create empty conversion result for messages without text
   */
  private createEmptyResult(message?: SlackMessage, channelId?: string): ConversionResult {
    return {
      markdown: '',
      attachments: message?.files ? this.processAttachments(message) : undefined,
      metadata: message ? this.extractMetadata(message, channelId) : undefined,
    };
  }

  /**
   * Add thread indentation to markdown text
   */
  private indentForThread(markdown: string): string {
    return markdown
      .split('\n')
      .map(line => `  ${line}`)
      .join('\n');
  }

  /**
   * Extract metadata from Slack message
   */
  private extractMetadata(message: SlackMessage, channelId?: string) {
    return {
      originalTimestamp: message.ts,
      threadTimestamp: message.thread_ts,
      userId: message.user || '',
      channelId: channelId || '',
    };
  }
}
