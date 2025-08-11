# TASK-201: Markdown 変換エンジン実装 - 要件定義

## 概要
SlackメッセージをObsidian形式のMarkdownに変換するエンジンを実装する。Slackの各種要素（メンション、リンク、コードブロック、絵文字、添付ファイル、スレッド）を適切なMarkdown形式に変換し、Obsidianで正しく表示・リンクできるようにする。

## 機能要件

### 1. 基本メッセージ変換 (REQ-002)
- プレーンテキストの変換
- 改行の処理（Slack → Markdown）
- 特殊文字のエスケープ処理

### 2. メンション変換 (REQ-104)
- **ユーザーメンション**: `<@U1234567>` → `[[User Name]]`
- **チャンネルメンション**: `<#C1234567|general>` → `[[#general]]`
- **ユーザーグループメンション**: `<!subteam^S1234567>` → `@group-name`
- **特別メンション**: `<!channel>`, `<!here>`, `<!everyone>` → そのまま

### 3. リンク変換 (REQ-105)
- **通常のURL**: `<https://example.com>` → `[https://example.com](https://example.com)`
- **ラベル付きURL**: `<https://example.com|Example>` → `[Example](https://example.com)`
- **メールアドレス**: `<mailto:test@example.com>` → `[test@example.com](mailto:test@example.com)`

### 4. テキスト装飾変換
- **太字**: `*text*` → `**text**`
- **イタリック**: `_text_` → `*text*`
- **取り消し線**: `~text~` → `~~text~~`
- **インラインコード**: `` `code` `` → `` `code` `` (そのまま)

### 5. コードブロック処理
- **複数行コード**: `\`\`\`code\`\`\`` → `\`\`\`code\`\`\``
- **言語指定コード**: `\`\`\`javascript\ncode\`\`\`` → `\`\`\`javascript\ncode\`\`\``

### 6. 絵文字処理 (REQ-302)
- **標準絵文字**: `:smile:` → `😄` (Unicode絵文字に変換)
- **カスタム絵文字**: `:custom-emoji:` → `:custom-emoji:` (そのまま保持)

### 7. 添付ファイル処理
- **画像ファイル**: Obsidianの画像リンク形式 `![[filename.png]]` に変換
- **その他ファイル**: 通常のリンク形式 `[filename.pdf](url)` に変換

### 8. スレッドの階層表現
- **親メッセージ**: 通常の変換
- **返信メッセージ**: インデント（2スペース）で階層表現
- **スレッドタイムスタンプ**: 返信メッセージの識別に使用

## 技術要件

### データ構造

```typescript
interface MarkdownConversionOptions {
  convertMentions?: boolean;
  convertLinks?: boolean;
  convertEmojis?: boolean;
  preserveThreadStructure?: boolean;
  userNameResolver?: (userId: string) => string | Promise<string>;
  channelNameResolver?: (channelId: string) => string | Promise<string>;
}

interface ConversionResult {
  markdown: string;
  attachments?: ConvertedAttachment[];
  metadata?: {
    originalTimestamp: string;
    threadTimestamp?: string;
    userId: string;
    channelId: string;
  };
}

interface ConvertedAttachment {
  type: 'image' | 'file' | 'link';
  name: string;
  url: string;
  markdown: string;
}
```

### 変換ルール

1. **優先順位**: 
   - コードブロック内は変換しない
   - リンク内は変換しない
   - 既にMarkdown形式のものは重複変換しない

2. **エラーハンドリング**:
   - 変換できない要素は元のまま保持
   - エラー時もMarkdownを出力（部分的な変換）

3. **パフォーマンス**:
   - 大量メッセージの一括変換に対応
   - 非同期処理でUIブロッキングを防ぐ

## 受け入れ基準

### 1. すべてのSlack要素が適切に変換される
- [x] ユーザーメンション → Obsidianリンク
- [x] チャンネルメンション → Obsidianリンク
- [x] URL → Markdownリンク
- [x] テキスト装飾 → Markdown形式
- [x] コードブロック → Markdown形式
- [x] 絵文字 → Unicode or 保持

### 2. Obsidianで正しく表示される
- [x] リンクがクリック可能
- [x] 画像が表示される
- [x] コードブロックがハイライトされる
- [x] 装飾が正しく反映される

### 3. エラー耐性
- [x] 不正な形式でもクラッシュしない
- [x] 部分的な変換でも出力する
- [x] 元のメッセージ情報を保持

### 4. パフォーマンス
- [x] 1000件のメッセージを30秒以内で変換
- [x] メモリ効率的な処理
- [x] UIがブロックされない

## 制約事項

- Slack API からの情報のみを使用（外部API不要）
- ユーザー名・チャンネル名の解決は呼び出し元が提供
- 添付ファイルのダウンロードは別コンポーネントで処理
- カスタム絵文字の画像取得は対象外

## 依存関係

- Slack Message型 (slack-types.ts)
- Obsidianのファイル形式仕様
- Unicode絵文字マッピングライブラリ

## テスト観点

1. **基本変換機能**
   - 各種要素の個別変換
   - 複合要素の変換（メンション+リンクなど）
   - エッジケース（空文字、特殊文字等）

2. **統合テスト**
   - 実際のSlackメッセージでの変換
   - Obsidianでの表示確認
   - パフォーマンステスト

3. **エラーハンドリング**
   - 不正な形式のメッセージ
   - 解決できないメンション・チャンネル
   - ネットワークエラー時の動作