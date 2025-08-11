# TASK-203: タグ・メタデータ処理 - 要件定義

## 実装目的
SlackメッセージをObsidianファイルに保存する際に、適切なタグ・メタデータを付与し、検索性と整理性を向上させる

## 機能要件

### 1. タグ付与機能
**目的**: チャンネル設定に基づいてファイルに自動的にタグを付与する

**詳細要件**:
- プラグイン設定の `channelMappings` の `enableTags` フラグによる制御
- `tags` 配列で指定されたタグの自動付与
- デフォルトタグ（`#slack`、チャンネル名など）の付与
- タグ名の正規化（無効文字の処理、小文字統一等）
- 動的タグ生成（日付、ユーザー名等）

**入力**: `channelId: string, channelName: string, message: SlackMessage, settings: PluginSettings`
**出力**: `tags: string[]`

### 2. フロントマター生成機能
**目的**: Obsidianで標準的なYAMLフロントマターを生成してメタデータを埋め込む

**詳細要件**:
- YAML形式でのメタデータ構造化
- 必須フィールドの定義と値設定
- オプションフィールドの条件付き追加
- 特殊文字・改行文字の適切なエスケープ
- 生成されたYAMLの妥当性検証

**必須フィールド**:
- `title`: ファイルタイトル
- `tags`: タグ配列
- `created`: 作成日時（ISO 8601形式）
- `source`: データソース情報

**オプションフィールド**:
- `channel`: Slackチャンネル情報
- `user`: 投稿ユーザー情報  
- `thread`: スレッド情報
- `attachments`: 添付ファイル情報
- `custom`: カスタムプロパティ

**入力**: `metadata: MessageMetadata, options: FrontMatterOptions`
**出力**: `frontMatter: string`

### 3. メッセージメタデータ埋め込み機能
**目的**: Slackメッセージから重要な情報を抽出してメタデータとして構造化

**詳細要件**:
- メッセージの基本情報抽出（タイムスタンプ、ユーザー、テキスト等）
- チャンネル情報の付与
- スレッド構造の記録
- 添付ファイル・リンク情報の保存
- リアクション情報の記録（オプション）
- メンション・引用情報の抽出

**抽出するメタデータ**:
```typescript
interface MessageMetadata {
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
```

### 4. カスタムプロパティ追加機能
**目的**: ユーザー定義のカスタムプロパティをメタデータに追加

**詳細要件**:
- 設定ファイルでのカスタムプロパティ定義
- プロパティ名・型・デフォルト値の指定
- 動的値生成（JavaScript式評価）
- 条件付きプロパティ追加
- プロパティ値の検証とサニタイゼーション

**サポートする型**:
- `string`: 文字列値
- `number`: 数値
- `boolean`: 真偽値
- `date`: 日付（ISO 8601形式）
- `array`: 配列
- `object`: オブジェクト

**入力**: `customProperties: CustomPropertyDefinition[], context: MessageContext`
**出力**: `properties: Record<string, any>`

### 5. メタデータ統合機能
**目的**: 各種メタデータを統合してMarkdownファイルに埋め込む

**詳細要件**:
- フロントマターの生成と配置
- メタデータとMarkdownコンテンツの結合
- 既存メタデータとの統合・マージ
- メタデータの更新・追記
- インデントとフォーマットの統一

**出力フォーマット**:
```markdown
---
title: "チャンネル名 - 2023-12-01"
tags: ["slack", "general", "daily"]
created: 2023-12-01T09:30:00Z
source:
  type: "slack"
  channel: "general"
  messageId: "1701425400.000100"
channel:
  id: "C123456"
  name: "general"
user:
  id: "U789012"
  name: "john.doe"
  displayName: "John Doe"
thread:
  isThread: false
attachments: []
---

# メッセージ内容がここに続く
```

## 非機能要件

### パフォーマンス
- 大量メッセージ処理時のメモリ効率
- YAML生成処理の高速化
- メタデータ抽出の最適化

### 信頼性
- 不正なYAMLフォーマットの防止
- 特殊文字によるパースエラーの回避
- 必須フィールドの保証

### 拡張性
- 新しいメタデータフィールドの追加容易性
- カスタムプロパティの柔軟な定義
- 将来的なObsidianプラグインとの連携

## データ構造

### MetadataProcessorOptions
```typescript
interface MetadataProcessorOptions {
    enableTags: boolean;
    enableFrontMatter: boolean;
    enableCustomProperties: boolean;
    tagPrefix?: string;
    customProperties?: CustomPropertyDefinition[];
}
```

### CustomPropertyDefinition
```typescript
interface CustomPropertyDefinition {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    defaultValue?: any;
    expression?: string; // JavaScript評価式
    condition?: string;  // 条件式
    validation?: ValidationRule[];
}
```

### ProcessedMetadata
```typescript
interface ProcessedMetadata {
    frontMatter: string;
    tags: string[];
    metadata: Record<string, any>;
    customProperties: Record<string, any>;
}
```

## API設計

### MetadataProcessor クラス
```typescript
class MetadataProcessor {
    constructor(private settings: PluginSettings);
    
    async processMessage(
        message: SlackMessage, 
        channelInfo: ChannelInfo, 
        options?: MetadataProcessorOptions
    ): Promise<ProcessedMetadata>;
    
    private extractMessageMetadata(message: SlackMessage, channelInfo: ChannelInfo): MessageMetadata;
    private generateTags(channelInfo: ChannelInfo, metadata: MessageMetadata): string[];
    private generateFrontMatter(metadata: MessageMetadata, tags: string[]): string;
    private processCustomProperties(metadata: MessageMetadata): Record<string, any>;
    private validateYaml(yamlString: string): boolean;
}
```

## エラーハンドリング

### エラーの分類
1. **設定エラー**: 無効なタグ設定、カスタムプロパティ定義不正
2. **データ形式エラー**: 無効なSlackメッセージ形式、必須フィールド不足
3. **YAML生成エラー**: 不正な文字によるYAMLパースエラー
4. **カスタムプロパティエラー**: JavaScript式評価エラー、型不整合

### エラー処理戦略
- フォールバックデータによる処理続行
- 部分的失敗時の警告ログ出力
- 必須データの保証と検証
- ユーザーへの分かりやすいエラー通知

## 受け入れ基準

### 必須条件
1. ✅ チャンネル設定に基づくタグが正しく生成される
2. ✅ 有効なYAMLフロントマターが生成される
3. ✅ メッセージメタデータが適切に抽出される
4. ✅ カスタムプロパティが設定通りに追加される
5. ✅ 特殊文字を含むデータが正しく処理される
6. ✅ エラーが適切にハンドリングされる

### 品質条件
1. ✅ 全ての機能に対する単体テストが存在する
2. ✅ 異常系を含む統合テストが通過する
3. ✅ パフォーマンス要件を満たしている
4. ✅ 生成されるYAMLがObsidianで正しく認識される

## 依存関係
- **前提条件**: TASK-202 (ファイル保存エンジン) が完了している
- **外部依存**: js-yaml ライブラリ、Obsidian のフロントマター処理
- **内部依存**: SlackMessage型定義、PluginSettings