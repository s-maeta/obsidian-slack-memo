# TASK-201: Markdown 変換エンジン実装 - テストケース設計

## テストケース一覧

### 1. MarkdownConverter クラスの基本テスト

#### 1.1 プレーンテキスト変換
- **TC-001**: 単純なテキストの変換
  - Input: "Hello, World!"
  - Expected: "Hello, World!"

- **TC-002**: 改行の処理
  - Input: "Line 1\nLine 2\nLine 3"
  - Expected: "Line 1\nLine 2\nLine 3"

- **TC-003**: 特殊文字のエスケープ
  - Input: "Text with * and _ and ~"
  - Expected: "Text with * and _ and ~" (適切にエスケープ)

### 2. メンション変換テスト

#### 2.1 ユーザーメンション
- **TC-010**: 基本的なユーザーメンション
  - Input: "Hello <@U1234567>!"
  - Expected: "Hello [[John Doe]]!"
  - Mock: userId "U1234567" → "John Doe"

- **TC-011**: 複数のユーザーメンション
  - Input: "<@U1234567> and <@U2345678> are here"
  - Expected: "[[John Doe]] and [[Jane Smith]] are here"

- **TC-012**: 解決できないユーザーメンション
  - Input: "Hello <@U9999999>!"
  - Expected: "Hello <@U9999999>!" (元のまま保持)

#### 2.2 チャンネルメンション
- **TC-015**: 基本的なチャンネルメンション
  - Input: "Check <#C1234567|general>"
  - Expected: "Check [[#general]]"

- **TC-016**: チャンネル名なしのメンション
  - Input: "Check <#C1234567>"
  - Expected: "Check [[#general]]"
  - Mock: channelId "C1234567" → "general"

#### 2.3 特別メンション
- **TC-020**: チャンネル全体メンション
  - Input: "<!channel> important message"
  - Expected: "<!channel> important message"

- **TC-021**: here/everyoneメンション
  - Input: "<!here> and <!everyone>"
  - Expected: "<!here> and <!everyone>"

### 3. リンク変換テスト

#### 3.1 通常のURL
- **TC-030**: 単純なURL
  - Input: "<https://example.com>"
  - Expected: "[https://example.com](https://example.com)"

- **TC-031**: ラベル付きURL
  - Input: "<https://example.com|Example Site>"
  - Expected: "[Example Site](https://example.com)"

- **TC-032**: メールアドレス
  - Input: "<mailto:test@example.com>"
  - Expected: "[test@example.com](mailto:test@example.com)"

#### 3.2 複雑なリンク
- **TC-035**: URL内の特殊文字
  - Input: "<https://example.com/path?param=value&other=123>"
  - Expected: "[https://example.com/path?param=value&other=123](https://example.com/path?param=value&other=123)"

### 4. テキスト装飾変換テスト

#### 4.1 基本装飾
- **TC-040**: 太字変換
  - Input: "This is *bold* text"
  - Expected: "This is **bold** text"

- **TC-041**: イタリック変換
  - Input: "This is _italic_ text"
  - Expected: "This is *italic* text"

- **TC-042**: 取り消し線変換
  - Input: "This is ~strikethrough~ text"
  - Expected: "This is ~~strikethrough~~ text"

- **TC-043**: インラインコード（変換なし）
  - Input: "Use `console.log()` function"
  - Expected: "Use `console.log()` function"

#### 4.2 装飾の組み合わせ
- **TC-045**: 複数の装飾
  - Input: "*bold* and _italic_ and ~strike~"
  - Expected: "**bold** and *italic* and ~~strike~~"

### 5. コードブロック処理テスト

#### 5.1 基本コードブロック
- **TC-050**: 単純なコードブロック
  - Input: "```\ncode here\n```"
  - Expected: "```\ncode here\n```"

- **TC-051**: 言語指定コードブロック
  - Input: "```javascript\nconsole.log('hello');\n```"
  - Expected: "```javascript\nconsole.log('hello');\n```"

#### 5.2 コードブロック内の変換無効化
- **TC-055**: コードブロック内のメンション
  - Input: "```\n<@U1234567> in code\n```"
  - Expected: "```\n<@U1234567> in code\n```" (変換されない)

### 6. 絵文字処理テスト

#### 6.1 標準絵文字
- **TC-060**: 基本的な絵文字変換
  - Input: "Hello :smile: world!"
  - Expected: "Hello 😄 world!"

- **TC-061**: 複数の絵文字
  - Input: ":wave: :thumbsup: :heart:"
  - Expected: "👋 👍 ❤️"

#### 6.2 カスタム絵文字
- **TC-065**: カスタム絵文字の保持
  - Input: "Custom :custom-emoji: here"
  - Expected: "Custom :custom-emoji: here"

### 7. 添付ファイル処理テスト

#### 7.1 画像ファイル
- **TC-070**: 画像添付
  - Input: Message with image attachment
  - Expected: "![[image.png]]" added to markdown
  - ConvertedAttachment: { type: 'image', name: 'image.png', markdown: '![[image.png]]' }

#### 7.2 その他ファイル
- **TC-075**: PDFファイル添付
  - Input: Message with PDF attachment
  - Expected: "[document.pdf](https://files.slack.com/...)"
  - ConvertedAttachment: { type: 'file', name: 'document.pdf' }

### 8. スレッド処理テスト

#### 8.1 親メッセージ
- **TC-080**: 通常のメッセージ
  - Input: Message without thread_ts
  - Expected: Normal conversion without indentation

#### 8.2 返信メッセージ
- **TC-081**: スレッド返信
  - Input: Message with thread_ts
  - Expected: "  Reply message" (2スペースインデント)

### 9. 統合テスト（複合要素）

#### 9.1 複雑なメッセージ
- **TC-090**: メンション+リンク+装飾
  - Input: "Hey <@U1234567>, check *this* <https://example.com|link>!"
  - Expected: "Hey [[John Doe]], check **this** [link](https://example.com)!"

- **TC-091**: コードブロック+メンション混在
  - Input: "Code: ```\nfunction test()\n``` by <@U1234567>"
  - Expected: "Code: ```\nfunction test()\n``` by [[John Doe]]"

#### 9.2 実際のSlackメッセージサンプル
- **TC-095**: 実際のSlackからのメッセージ構造
  - Input: 完全なSlack Message オブジェクト
  - Expected: 適切なMarkdown + メタデータ + 添付ファイル情報

### 10. エラーハンドリングテスト

#### 10.1 不正な形式
- **TC-100**: 不完全なメンション
  - Input: "Hello <@U123"
  - Expected: "Hello <@U123" (元のまま保持)

- **TC-101**: 不完全なリンク
  - Input: "Check <https://example"
  - Expected: "Check <https://example" (元のまま保持)

#### 10.2 空・null値
- **TC-105**: 空文字列
  - Input: ""
  - Expected: ""

- **TC-106**: null/undefined
  - Input: null
  - Expected: "" or エラーハンドリング

### 11. パフォーマンステスト

#### 11.1 大量データ
- **TC-110**: 1000件のメッセージ変換
  - Input: Array of 1000 messages
  - Expected: 30秒以内に完了

- **TC-111**: 長いテキスト
  - Input: 10,000文字のメッセージ
  - Expected: 1秒以内に変換完了

## モックデータ

```typescript
// ユーザー名解決モック
const mockUserResolver = {
  'U1234567': 'John Doe',
  'U2345678': 'Jane Smith',
  'U3456789': 'Bob Wilson'
};

// チャンネル名解決モック
const mockChannelResolver = {
  'C1234567': 'general',
  'C2345678': 'random',
  'C3456789': 'development'
};

// 絵文字マッピングモック
const mockEmojiMap = {
  'smile': '😄',
  'wave': '👋',
  'thumbsup': '👍',
  'heart': '❤️'
};

// Slackメッセージサンプル
const sampleSlackMessage = {
  ts: '1234567890.123456',
  user: 'U1234567',
  text: 'Hello <@U2345678>! Check this *awesome* <https://example.com|link> :smile:',
  thread_ts: null,
  files: [
    {
      name: 'screenshot.png',
      mimetype: 'image/png',
      url_private: 'https://files.slack.com/...'
    }
  ]
};
```

## テスト実行順序

1. **単体テスト** - 各機能の個別テスト
2. **統合テスト** - 機能の組み合わせテスト  
3. **エラーハンドリング** - 異常系テスト
4. **パフォーマンス** - 性能要件テスト