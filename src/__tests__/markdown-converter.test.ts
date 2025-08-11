import { MarkdownConverter, MarkdownConversionOptions } from '../markdown-converter';
import { Message as SlackMessage } from '../slack-types';

describe('MarkdownConverter', () => {
    let converter: MarkdownConverter;

    beforeEach(() => {
        converter = new MarkdownConverter();
    });

    describe('convertText', () => {
        it('TC-001: should convert simple text unchanged', async () => {
            const result = await converter.convertText('Hello, World!');
            expect(result).toBe('Hello, World!');
        });

        it('TC-002: should preserve line breaks', async () => {
            const result = await converter.convertText('Line 1\nLine 2\nLine 3');
            expect(result).toBe('Line 1\nLine 2\nLine 3');
        });

        it('TC-003: should handle special characters', async () => {
            const result = await converter.convertText('Text with * and _ and ~');
            expect(result).toBe('Text with * and _ and ~');
        });
    });

    describe('mention conversion', () => {
        it('TC-010: should convert user mentions', async () => {
            const mockResolver = jest.fn().mockResolvedValue('John Doe');
            converter = new MarkdownConverter({ userNameResolver: mockResolver });
            
            const result = await converter.convertText('Hello <@U1234567>!');
            expect(result).toBe('Hello [[John Doe]]!');
            expect(mockResolver).toHaveBeenCalledWith('U1234567');
        });

        it('TC-011: should convert multiple user mentions', async () => {
            const mockResolver = jest.fn()
                .mockResolvedValueOnce('John Doe')
                .mockResolvedValueOnce('Jane Smith');
            converter = new MarkdownConverter({ userNameResolver: mockResolver });
            
            const result = await converter.convertText('<@U1234567> and <@U2345678> are here');
            expect(result).toBe('[[John Doe]] and [[Jane Smith]] are here');
        });

        it('TC-012: should preserve unresolvable user mentions', async () => {
            const mockResolver = jest.fn().mockResolvedValue(null);
            converter = new MarkdownConverter({ userNameResolver: mockResolver });
            
            const result = await converter.convertText('Hello <@U9999999>!');
            expect(result).toBe('Hello <@U9999999>!');
        });

        it('TC-015: should convert channel mentions with label', async () => {
            const result = await converter.convertText('Check <#C1234567|general>');
            expect(result).toBe('Check [[#general]]');
        });

        it('TC-016: should convert channel mentions without label', async () => {
            const mockResolver = jest.fn().mockResolvedValue('general');
            converter = new MarkdownConverter({ channelNameResolver: mockResolver });
            
            const result = await converter.convertText('Check <#C1234567>');
            expect(result).toBe('Check [[#general]]');
        });

        it('TC-020: should preserve special mentions', async () => {
            const result = await converter.convertText('<!channel> important message');
            expect(result).toBe('<!channel> important message');
        });
    });

    describe('link conversion', () => {
        it('TC-030: should convert simple URLs', async () => {
            const result = await converter.convertText('<https://example.com>');
            expect(result).toBe('[https://example.com](https://example.com)');
        });

        it('TC-031: should convert labeled URLs', async () => {
            const result = await converter.convertText('<https://example.com|Example Site>');
            expect(result).toBe('[Example Site](https://example.com)');
        });

        it('TC-032: should convert email addresses', async () => {
            const result = await converter.convertText('<mailto:test@example.com>');
            expect(result).toBe('[test@example.com](mailto:test@example.com)');
        });
    });

    describe('text decoration conversion', () => {
        it('TC-040: should convert bold text', async () => {
            const result = await converter.convertText('This is *bold* text');
            expect(result).toBe('This is **bold** text');
        });

        it('TC-041: should convert italic text', async () => {
            const result = await converter.convertText('This is _italic_ text');
            expect(result).toBe('This is *italic* text');
        });

        it('TC-042: should convert strikethrough text', async () => {
            const result = await converter.convertText('This is ~strikethrough~ text');
            expect(result).toBe('This is ~~strikethrough~~ text');
        });

        it('TC-043: should preserve inline code', async () => {
            const result = await converter.convertText('Use `console.log()` function');
            expect(result).toBe('Use `console.log()` function');
        });
    });

    describe('code block processing', () => {
        it('TC-050: should preserve simple code blocks', async () => {
            const result = await converter.convertText('```\ncode here\n```');
            expect(result).toBe('```\ncode here\n```');
        });

        it('TC-051: should preserve language-specific code blocks', async () => {
            const result = await converter.convertText('```javascript\nconsole.log(\'hello\');\n```');
            expect(result).toBe('```javascript\nconsole.log(\'hello\');\n```');
        });

        it('TC-055: should not convert mentions inside code blocks', async () => {
            const mockResolver = jest.fn().mockResolvedValue('John Doe');
            converter = new MarkdownConverter({ userNameResolver: mockResolver });
            
            const result = await converter.convertText('```\n<@U1234567> in code\n```');
            expect(result).toBe('```\n<@U1234567> in code\n```');
            expect(mockResolver).not.toHaveBeenCalled();
        });
    });

    describe('emoji conversion', () => {
        it('TC-060: should convert standard emojis', async () => {
            const result = await converter.convertText('Hello :smile: world!');
            expect(result).toBe('Hello 😄 world!');
        });

        it('TC-061: should convert multiple emojis', async () => {
            const result = await converter.convertText(':wave: :thumbsup: :heart:');
            expect(result).toBe('👋 👍 ❤️');
        });

        it('TC-065: should preserve custom emojis', async () => {
            const result = await converter.convertText('Custom :custom-emoji: here');
            expect(result).toBe('Custom :custom-emoji: here');
        });
    });

    describe('convertMessage', () => {
        const sampleMessage: SlackMessage = {
            ts: '1234567890.123456',
            user: 'U1234567',
            text: 'Hello <@U2345678>!',
            type: 'message'
        };

        it('TC-080: should convert message without thread', async () => {
            const result = await converter.convertMessage(sampleMessage, 'C1234567');
            
            expect(result.metadata).toEqual({
                originalTimestamp: '1234567890.123456',
                threadTimestamp: undefined,
                userId: 'U1234567',
                channelId: 'C1234567'
            });
        });

        it('TC-081: should handle thread messages with indentation', async () => {
            const threadMessage = {
                ...sampleMessage,
                thread_ts: '1234567890.000000'
            };
            
            const result = await converter.convertMessage(threadMessage, 'C1234567');
            
            expect(result.metadata?.threadTimestamp).toBe('1234567890.000000');
            expect(result.markdown).toMatch(/^  /); // Should start with 2 spaces
        });
    });

    describe('attachment processing', () => {
        it('TC-070: should process image attachments', async () => {
            const messageWithImage: SlackMessage = {
                ts: '1234567890.123456',
                user: 'U1234567',
                text: 'Check this image',
                type: 'message',
                files: [{
                    id: 'F1234567',
                    created: 1234567890,
                    timestamp: 1234567890,
                    name: 'image.png',
                    mimetype: 'image/png',
                    url_private: 'https://files.slack.com/image.png',
                    size: 12345
                }]
            };

            const result = await converter.convertMessage(messageWithImage);
            
            expect(result.attachments).toHaveLength(1);
            expect(result.attachments?.[0]).toEqual({
                type: 'image',
                name: 'image.png',
                url: 'https://files.slack.com/image.png',
                markdown: '![[image.png]]'
            });
        });
    });

    describe('complex integration tests', () => {
        it('TC-090: should convert complex message with multiple elements', async () => {
            const mockUserResolver = jest.fn().mockResolvedValue('John Doe');
            converter = new MarkdownConverter({ userNameResolver: mockUserResolver });

            const result = await converter.convertText('Hey <@U1234567>, check *this* <https://example.com|link>!');
            expect(result).toBe('Hey [[John Doe]], check **this** [link](https://example.com)!');
        });

        it('TC-091: should preserve mentions in code blocks', async () => {
            const mockUserResolver = jest.fn().mockResolvedValue('John Doe');
            converter = new MarkdownConverter({ userNameResolver: mockUserResolver });

            const result = await converter.convertText('Code: ```\nfunction test()\n``` by <@U1234567>');
            expect(result).toBe('Code: ```\nfunction test()\n``` by [[John Doe]]');
            expect(mockUserResolver).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        it('TC-100: should preserve incomplete mentions', async () => {
            const result = await converter.convertText('Hello <@U123');
            expect(result).toBe('Hello <@U123');
        });

        it('TC-101: should preserve incomplete links', async () => {
            const result = await converter.convertText('Check <https://example');
            expect(result).toBe('Check <https://example');
        });

        it('TC-105: should handle empty string', async () => {
            const result = await converter.convertText('');
            expect(result).toBe('');
        });

        it('TC-106: should handle null input gracefully', async () => {
            const result = await converter.convertText(null as any);
            expect(result).toBe('');
        });
    });
});