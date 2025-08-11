# TASK-202: ファイル保存エンジン - 要件定義

## 実装目的
Slackメッセージを変換されたMarkdown形式でObsidianのボルトに適切に保存するエンジンの実装

## 機能要件

### 1. 保存先パス決定機能
**目的**: チャンネルマッピング設定に基づいて適切な保存先パスを決定する

**詳細要件**:
- プラグイン設定の `channelMappings` を参照してチャンネルIDから保存先パスを特定
- 設定に存在しないチャンネルの場合はデフォルトパス (`defaultPath`) を使用
- パスの正規化（相対パス → 絶対パス変換）
- 無効なパス（存在しないディレクトリ、権限なし等）の検出と処理

**入力**: `channelId: string, settings: PluginSettings`
**出力**: `savePath: string`

### 2. ファイル名生成機能
**目的**: 設定されたファイル名フォーマットに基づいてユニークなファイル名を生成

**詳細要件**:
- `fileNameFormat` 設定を使用したファイル名の動的生成
- サポートする変数:
  - `{channel}` - チャンネル名
  - `{date}` - 日付 (YYYY-MM-DD)
  - `{timestamp}` - Unix timestamp
  - `{user}` - ユーザー名
- ファイル名の安全化（無効文字の除去・置換）
- ファイル名の重複回避（自動連番付与）
- 拡張子の自動付与（`.md`）

**入力**: `message: SlackMessage, channelName: string, settings: PluginSettings`
**出力**: `fileName: string`

### 3. ディレクトリ自動作成機能
**目的**: 保存先ディレクトリが存在しない場合の自動作成

**詳細要件**:
- 保存先パスのディレクトリ存在確認
- 不足している中間ディレクトリの自動作成
- ディレクトリ作成権限の確認
- 作成失敗時の適切なエラーハンドリング

**入力**: `directoryPath: string`
**出力**: `success: boolean, error?: string`

### 4. ファイル書き込み処理
**目的**: 変換されたMarkdownコンテンツをファイルに保存

**詳細要件**:
- Markdownコンテンツの安全な書き込み
- ファイル書き込み権限の確認
- アトミックな書き込み処理（一時ファイル経由）
- 書き込みエラーの適切なハンドリング
- ファイルサイズ制限のチェック

**入力**: `filePath: string, content: string`
**出力**: `Result<void, Error>`

### 5. デイリーノート追記機能
**目的**: 設定に基づいてデイリーノートにメッセージを追記

**詳細要件**:
- `appendToDailyNote` 設定が有効な場合の追記処理
- デイリーノート形式の検出（YYYY-MM-DD.md）
- 既存デイリーノートへの追記
- デイリーノートが存在しない場合の新規作成
- 追記位置の設定対応（末尾、特定セクション等）
- 重複追記の防止

**入力**: `content: string, date: string, settings: PluginSettings`
**出力**: `Result<void, Error>`

## 非機能要件

### パフォーマンス
- 大量ファイル保存時のメモリ使用量制限
- 並行書き込み処理の効率化
- ファイルI/O操作の最適化

### 信頼性
- ディスク容量不足への対応
- ファイルシステムエラーの回復
- 部分的書き込み失敗時のロールバック

### セキュリティ
- パストラバーサル攻撃の防止
- 書き込み権限の適切な確認
- 機密情報の意図しない保存防止

## データ構造

### FileStorageOptions
```typescript
interface FileStorageOptions {
    channelId: string;
    channelName: string;
    content: string;
    message: SlackMessage;
    appendToDailyNote?: boolean;
}
```

### StorageResult
```typescript
interface StorageResult {
    success: boolean;
    filePath?: string;
    error?: Error;
    metadata: {
        fileSize: number;
        createdAt: Date;
        appendedToDailyNote: boolean;
    };
}
```

## API設計

### FileStorageEngine クラス
```typescript
class FileStorageEngine {
    constructor(private app: App, private settings: PluginSettings);
    
    async saveMessage(options: FileStorageOptions): Promise<StorageResult>;
    
    private determineSavePath(channelId: string): string;
    private generateFileName(message: SlackMessage, channelName: string): string;
    private ensureDirectoryExists(path: string): Promise<void>;
    private writeFile(filePath: string, content: string): Promise<void>;
    private appendToDailyNote(content: string, date: string): Promise<void>;
}
```

## エラーハンドリング

### エラーの分類
1. **設定エラー**: 無効なパス設定、フォーマット設定
2. **ファイルシステムエラー**: 権限不足、容量不足、パス不正
3. **I/Oエラー**: 書き込み失敗、読み込み失敗
4. **検証エラー**: ファイル名不正、コンテンツ不正

### エラー処理戦略
- 適切なエラーメッセージとエラーコードの提供
- リトライ可能なエラーの自動再試行
- ユーザーへの分かりやすいエラー通知
- ログ出力による問題の追跡可能性

## 受け入れ基準

### 必須条件
1. ✅ チャンネルマッピングに基づく保存先が正しく決定される
2. ✅ ファイル名フォーマットが正確に適用される
3. ✅ 不足ディレクトリが自動作成される
4. ✅ Markdownファイルが正常に書き込まれる
5. ✅ デイリーノート追記が設定通りに動作する
6. ✅ 各種エラーが適切にハンドリングされる

### 品質条件  
1. ✅ 全ての機能に対する単体テストが存在する
2. ✅ 異常系を含む統合テストが通過する
3. ✅ エラー処理が適切に実装されている
4. ✅ パフォーマンス要件を満たしている

## 依存関係
- **前提条件**: TASK-201 (Markdown変換エンジン) が完了している
- **外部依存**: Obsidian App API, FileSystem API
- **内部依存**: PluginSettings, SlackMessage型定義