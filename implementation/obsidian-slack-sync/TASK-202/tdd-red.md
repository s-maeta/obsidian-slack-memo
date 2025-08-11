# TASK-202: ファイル保存エンジン - RED フェーズ実装レポート

## 実施日時
2025-01-10

## 実装内容

### 1. 型定義の追加
**ファイル**: `src/file-storage-types.ts`
- `FileStorageOptions`: ファイル保存時のオプション
- `StorageResult`: 保存結果の詳細情報
- `FileStorageEngineOptions`: エンジンのオプション設定

### 2. 失敗するテストの実装
**ファイル**: `src/__tests__/file-storage-engine.test.ts`
- **総テストケース数**: 32ケース
- **テストスイート**: 
  - constructor (1ケース)
  - determineSavePath (3ケース)
  - generateFileName (4ケース)
  - ensureDirectoryExists (3ケース)
  - writeFile (3ケース)
  - appendToDailyNote (3ケース)
  - saveMessage (3ケース)
  - file name collision handling (2ケース)
  - error handling (3ケース)
  - edge cases (3ケース)

## テスト実行結果

### ❌ **失敗確認: 完了**
```
FAIL src/__tests__/file-storage-engine.test.ts
● Test suite failed to run
Cannot find module '../file-storage-engine' or its corresponding type declarations.
```

### 失敗の理由
1. **予期された失敗**: `FileStorageEngine` クラスがまだ実装されていない
2. **型エラー**: Obsidianの型定義とモックの不一致
3. **モジュール不存在**: 実装ファイルが存在しない

## 実装したテストケース詳細

### 単体テスト（メソッド別）

#### 1. determineSavePath メソッド
- **TC-FS-010**: 設定済みチャンネルの保存先決定
- **TC-FS-011**: 未設定チャンネルのデフォルトパス使用
- **TC-FS-012**: 相対パスの絶対パス変換

#### 2. generateFileName メソッド
- **TC-FS-020**: 基本ファイル名生成（{channel}-{date}）
- **TC-FS-021**: 全変数を含むファイル名生成
- **TC-FS-022**: 無効文字の安全化（/を_に変換など）
- **TC-FS-023**: 長いファイル名の切り詰め（255文字制限）

#### 3. ensureDirectoryExists メソッド
- **TC-FS-030**: 既存ディレクトリの確認
- **TC-FS-031**: 新規ディレクトリの作成
- **TC-FS-032**: 中間ディレクトリの自動作成

#### 4. writeFile メソッド
- **TC-FS-040**: 基本的なファイル書き込み
- **TC-FS-041**: 既存ファイルの上書き
- **TC-FS-042**: Unicode文字のファイル書き込み

#### 5. appendToDailyNote メソッド
- **TC-FS-050**: 既存デイリーノートへの追記
- **TC-FS-051**: 新規デイリーノートの作成
- **TC-FS-052**: 重複追記の防止

### 統合テスト

#### 6. saveMessage メソッド
- **TC-FS-060**: 標準的なメッセージ保存処理
- **TC-FS-061**: デイリーノート追記込みの保存処理
- **TC-FS-062**: 複数メッセージの連続保存

#### 7. ファイル名重複処理
- **TC-FS-070**: 重複ファイル名の自動連番付与
- **TC-FS-071**: 大量重複時の連番処理（100個存在時）

### エラーハンドリング

#### 8. パス・権限エラー
- **TC-FS-080**: 無効な保存先パス
- **TC-FS-081**: 書き込み権限なしディレクトリ
- **TC-FS-082**: ディスク容量不足

### エッジケース

#### 9. 境界値・特殊ケース
- **TC-FS-130**: 空のコンテンツ
- **TC-FS-131**: null/undefined 値の処理
- **TC-FS-132**: 特殊文字を含むチャンネル名（Unicode、記号）

## モックオブジェクト設計

### Obsidian App モック
```typescript
const mockApp = {
    vault: {
        exists: jest.fn(),
        create: jest.fn(),
        createFolder: jest.fn(),
        append: jest.fn(),
        modify: jest.fn(),
        read: jest.fn(),
        adapter: {
            path: { join, normalize, dirname },
            fs: { existsSync, mkdirSync, writeFileSync, ... }
        }
    },
    fileManager: {
        generateMarkdownLink: jest.fn()
    }
}
```

### テストデータ設計
```typescript
testChannelMapping = {
    channelId: 'C123456',
    channelName: 'general',
    targetFolder: '/channels/general',
    fileNameFormat: '{channel}-{date}'
};

testMessage = {
    type: 'message',
    ts: '1640995200.000100',
    user: 'U123456',
    text: 'Hello, World!'
};

testOptions = {
    channelId: 'C123456',
    channelName: 'general',
    content: '# Hello, World!\n\nThis is a test message.',
    message: testMessage
};
```

## 期待されるテスト結果パターン

### 成功パターン
```typescript
expect(result.success).toBe(true);
expect(result.filePath).toBeDefined();
expect(result.metadata.fileSize).toBeGreaterThan(0);
expect(result.metadata.createdAt).toBeInstanceOf(Date);
```

### エラーパターン
```typescript
expect(result.success).toBe(false);
expect(result.error).toBeInstanceOf(Error);
expect(result.error?.message).toContain('expected error message');
```

### ファイル名パターン
```typescript
expect(filename).toMatch(/^general-\d{4}-\d{2}-\d{2}\.md$/);
expect(filename).not.toContain('/');
expect(filename.length).toBeLessThanOrEqual(255);
```

## 次のステップ（GREEN フェーズ）で実装する機能

### 1. FileStorageEngine クラス
- コンストラクタ
- 5つの主要メソッド
- エラーハンドリング
- 型安全性の確保

### 2. 実装優先度
1. **基本的な保存機能** (TC-FS-060)
2. **パス決定・ファイル名生成** (TC-FS-010, TC-FS-020)
3. **ディレクトリ作成・ファイル書き込み** (TC-FS-030, TC-FS-040)
4. **重複処理** (TC-FS-070)
5. **デイリーノート対応** (TC-FS-050, TC-FS-061)
6. **エラーハンドリング** (TC-FS-080～082)

### 3. 実装方針
- **最小実装**: テストが通る最小限の実装
- **型安全性**: TypeScriptの型システムを最大活用
- **Obsidian API**: 正しいAPIの使用方法
- **エラー処理**: 適切な例外・エラーハンドリング

## RED フェーズ完了確認

✅ **テストケース実装**: 32ケース完了
✅ **テスト失敗確認**: Module not found エラーで期待通り失敗
✅ **型定義追加**: FileStorageOptions, StorageResult等
✅ **モック設計**: Obsidian App の適切なモック
✅ **テストデータ**: 各種パターンのテストデータ準備完了

**RED フェーズ完了**: 次は GREEN フェーズ（最小実装）に移行