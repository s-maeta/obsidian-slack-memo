// Standard emoji mappings for Slack to Unicode conversion
export const emojiMap: Record<string, string> = {
    'smile': '😄',
    'wave': '👋',
    'thumbsup': '👍',
    'heart': '❤️',
    'fire': '🔥',
    'tada': '🎉',
    'rocket': '🚀',
    'eyes': '👀',
    'laughing': '😆',
    'joy': '😂',
    'wink': '😉',
    'blush': '😊',
    'thinking_face': '🤔',
    'ok_hand': '👌',
    'clap': '👏',
    'pray': '🙏',
    'muscle': '💪',
    'raised_hands': '🙌'
};

export function convertSlackEmoji(emojiCode: string): string {
    return emojiMap[emojiCode] || `:${emojiCode}:`;
}