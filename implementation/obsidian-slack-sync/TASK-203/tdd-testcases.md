# TASK-203: タグ・メタデータ処理 - テストケース設計

## テスト戦略
- 単体テスト: 各機能の個別動作確認
- 統合テスト: 全機能を組み合わせたメタデータ生成テスト
- エラーテスト: 異常データやエラー条件での動作確認

## 単体テスト

### 1. MetadataProcessor - コンストラクタ
**TC-MD-001**: 正常なコンストラクタ呼び出し
- **前提条件**: 有効な PluginSettings
- **実行**: `new MetadataProcessor(settings)`
- **期待結果**: インスタンスが正常に作成される

### 2. extractMessageMetadata メソッド

**TC-MD-010**: 基本メッセージのメタデータ抽出
- **前提条件**: 標準的なSlackメッセージとチャンネル情報
- **実行**: `extractMessageMetadata(message, channelInfo)`
- **期待結果**: 全ての基本フィールドが正しく抽出される

**TC-MD-011**: スレッドメッセージのメタデータ抽出
- **前提条件**: thread_ts を持つスレッドメッセージ
- **実行**: `extractMessageMetadata(threadMessage, channelInfo)`
- **期待結果**: スレッド関連フィールドが正しく設定される

**TC-MD-012**: 添付ファイル付きメッセージのメタデータ抽出
- **前提条件**: files 配列を持つメッセージ
- **実行**: `extractMessageMetadata(messageWithFiles, channelInfo)`
- **期待結果**: 添付ファイル情報が正しく抽出される

**TC-MD-013**: リンク含有メッセージのメタデータ抽出
- **前提条件**: URL を含むテキストのメッセージ
- **実行**: `extractMessageMetadata(messageWithLinks, channelInfo)`
- **期待結果**: リンク情報が正しく検出される

**TC-MD-014**: メンション含有メッセージのメタデータ抽出
- **前提条件**: @user や @channel を含むメッセージ
- **実行**: `extractMessageMetadata(messageWithMentions, channelInfo)`
- **期待結果**: メンション情報が正しく抽出される

### 3. generateTags メソッド

**TC-MD-020**: デフォルトタグ生成
- **前提条件**: enableTags: true、タグ設定なし
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: ["slack", "channel-name"] が生成される

**TC-MD-021**: 設定済みタグの生成
- **前提条件**: tags: ["work", "team-a"] の設定あり
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: ["slack", "channel-name", "work", "team-a"] が生成される

**TC-MD-022**: タグ無効化の確認
- **前提条件**: enableTags: false
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: 空配列 [] が返される

**TC-MD-023**: 動的タグの生成
- **前提条件**: 日付ベースのタグ生成設定
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: 現在日付を含むタグが生成される

**TC-MD-024**: 無効文字を含むタグの正規化
- **前提条件**: "tag with spaces" や "tag/with/slashes" を含む設定
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: "tag-with-spaces", "tag-with-slashes" に正規化される

**TC-MD-025**: 重複タグの除去
- **前提条件**: 同一タグが複数の設定で指定されている
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: 重複なく一意のタグ配列が返される

### 4. generateFrontMatter メソッド

**TC-MD-030**: 基本フロントマターの生成
- **前提条件**: 基本メタデータとタグ
- **実行**: `generateFrontMatter(metadata, tags)`
- **期待結果**: 有効なYAML形式のフロントマターが生成される

**TC-MD-031**: 空タグでのフロントマター生成
- **前提条件**: tags: [] の空配列
- **実行**: `generateFrontMatter(metadata, [])`
- **期待結果**: tags: [] を含むYAMLが生成される

**TC-MD-032**: 特殊文字を含むデータのエスケープ
- **前提条件**: クォート、改行、特殊文字を含むメタデータ
- **実行**: `generateFrontMatter(specialCharMetadata, tags)`
- **期待結果**: 適切にエスケープされたYAMLが生成される

**TC-MD-033**: 日本語を含むメタデータの処理
- **前提条件**: 日本語のチャンネル名、ユーザー名を含むメタデータ
- **実行**: `generateFrontMatter(japaneseMetadata, tags)`
- **期待結果**: UTF-8で正しくエンコードされたYAMLが生成される

**TC-MD-034**: null/undefined値の処理
- **前提条件**: 一部フィールドがnullまたはundefinedのメタデータ
- **実行**: `generateFrontMatter(incompleteMetadata, tags)`
- **期待結果**: nullフィールドがYAMLから除外または適切なデフォルト値が設定される

### 5. processCustomProperties メソッド

**TC-MD-040**: カスタムプロパティなしの処理
- **前提条件**: customProperties設定が空
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: 空オブジェクト {} が返される

**TC-MD-041**: 基本的なカスタムプロパティの処理
- **前提条件**: 文字列・数値・真偽値のカスタムプロパティ定義
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: 定義された型通りの値を持つオブジェクトが返される

**TC-MD-042**: JavaScript式の評価
- **前提条件**: expression: "new Date().toISOString()" のプロパティ定義
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: 現在時刻のISO文字列が値として設定される

**TC-MD-043**: 条件付きプロパティの処理
- **前提条件**: condition: "metadata.hasAttachments" のプロパティ定義
- **実行**: `processCustomProperties(metadata)` (添付ファイルあり/なし)
- **期待結果**: 条件に応じてプロパティが含まれる/除外される

**TC-MD-044**: デフォルト値の適用
- **前提条件**: defaultValue指定のプロパティ定義、式評価が失敗する場合
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: デフォルト値が設定される

**TC-MD-045**: 型変換の確認
- **前提条件**: type: "number"、式結果が文字列の場合
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: 適切に数値型に変換される

### 6. validateYaml メソッド

**TC-MD-050**: 有効なYAMLの検証
- **前提条件**: 正しい形式のYAML文字列
- **実行**: `validateYaml(validYaml)`
- **期待結果**: true が返される

**TC-MD-051**: 無効なYAMLの検証
- **前提条件**: 構文エラーを含むYAML文字列
- **実行**: `validateYaml(invalidYaml)`
- **期待結果**: false が返される

**TC-MD-052**: 空文字列の検証
- **前提条件**: "" 空文字列
- **実行**: `validateYaml("")`
- **期待結果**: false が返される

## 統合テスト

### 7. processMessage メソッド - 全体の処理フロー

**TC-MD-060**: 標準的なメッセージ処理
- **前提条件**: 一般的なSlackメッセージ、チャンネル設定
- **実行**: `processMessage(message, channelInfo)`
- **期待結果**: 
  - 適切なフロントマターが生成される
  - タグが正しく設定される
  - メタデータが完全に抽出される

**TC-MD-061**: 最大構成でのメッセージ処理
- **前提条件**: 全オプション有効、カスタムプロパティあり、添付ファイル・リンク・メンション全て含む
- **実行**: `processMessage(complexMessage, channelInfo, allOptionsEnabled)`
- **期待結果**: 全ての機能が動作し、完全なメタデータが生成される

**TC-MD-062**: 最小構成でのメッセージ処理
- **前提条件**: 全オプション無効、基本設定のみ
- **実行**: `processMessage(basicMessage, channelInfo, minimalOptions)`
- **期待結果**: 必要最小限のメタデータが生成される

**TC-MD-063**: スレッドメッセージの完全処理
- **前提条件**: 親メッセージとスレッドメッセージのペア
- **実行**: `processMessage(threadMessage, channelInfo)`
- **期待結果**: スレッド構造が正しく記録される

### 8. チャンネル別設定の処理

**TC-MD-070**: チャンネル固有設定の適用
- **前提条件**: チャンネルAとBで異なるタグ・カスタムプロパティ設定
- **実行**: 同じメッセージを異なるチャンネル設定で処理
- **期待結果**: チャンネルごとに異なるメタデータが生成される

**TC-MD-071**: デフォルト設定の適用
- **前提条件**: 特定設定のないチャンネル
- **実行**: `processMessage(message, unknownChannelInfo)`
- **期待結果**: デフォルト設定でメタデータが生成される

## エラーハンドリングテスト

### 9. 不正データの処理

**TC-MD-080**: 不正なSlackメッセージの処理
- **前提条件**: 必須フィールド欠損のSlackメッセージ
- **実行**: `processMessage(invalidMessage, channelInfo)`
- **期待結果**: エラーが発生するか、デフォルト値で処理が継続される

**TC-MD-081**: 不正なチャンネル情報の処理
- **前提条件**: 不完全なChannelInfoオブジェクト
- **実行**: `processMessage(message, invalidChannelInfo)`
- **期待結果**: エラーハンドリングが適切に動作する

**TC-MD-082**: YAML生成エラーの処理
- **前提条件**: YAML化不可能な循環参照オブジェクト
- **実行**: `generateFrontMatter(circularMetadata, tags)`
- **期待結果**: エラーが適切にキャッチされ、フォールバック処理が実行される

### 10. カスタムプロパティエラー

**TC-MD-090**: JavaScript式評価エラー
- **前提条件**: 構文エラーを含むexpression
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: エラーをキャッチし、デフォルト値またはundefinedが設定される

**TC-MD-091**: 型変換エラー
- **前提条件**: 数値型指定だが変換不可能な文字列値
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: 型変換エラーがハンドリングされる

**TC-MD-092**: 無限ループ・長時間実行の式
- **前提条件**: while(true)等の無限ループ式
- **実行**: `processCustomProperties(metadata)`
- **期待結果**: タイムアウトまたは実行制限でエラーとなる

### 11. メモリ・パフォーマンステスト

**TC-MD-100**: 大量データの処理
- **前提条件**: 非常に長いテキスト、大量の添付ファイルを含むメッセージ
- **実行**: `processMessage(largeMessage, channelInfo)`
- **期待結果**: メモリオーバーフローせずに処理が完了する

**TC-MD-101**: 大量カスタムプロパティの処理
- **前提条件**: 100個のカスタムプロパティ定義
- **実行**: `processMessage(message, channelInfo)`
- **期待結果**: 合理的な時間（5秒以内）で処理が完了する

## エッジケーステスト

### 12. 境界値・特殊ケース

**TC-MD-110**: 空メッセージの処理
- **前提条件**: text: "" の空メッセージ
- **実行**: `processMessage(emptyMessage, channelInfo)`
- **期待結果**: 空コンテンツでも適切にメタデータが生成される

**TC-MD-111**: Unicode・絵文字を含むメッセージ
- **前提条件**: 多様なUnicode文字・絵文字を含むメッセージ
- **実行**: `processMessage(unicodeMessage, channelInfo)`
- **期待結果**: 文字化けなくYAMLが生成される

**TC-MD-112**: 非常に長いチャンネル名・ユーザー名
- **前提条件**: 255文字を超える長さの名前
- **実行**: `processMessage(message, longNameChannelInfo)`
- **期待結果**: 適切に切り詰められるか、エラーハンドリングされる

**TC-MD-113**: 特殊文字を含むタグ名
- **前提条件**: YAML予約文字を含むタグ設定
- **実行**: `generateTags(channelInfo, metadata)`
- **期待結果**: 特殊文字が適切にエスケープまたは除去される

## 実際のObsidian連携テスト

### 13. フロントマター互換性テスト

**TC-MD-120**: Obsidianでのフロントマター認識
- **前提条件**: 生成されたフロントマター付きMarkdownファイル
- **実行**: Obsidianでファイルを開く
- **期待結果**: フロントマターが正しく解析され、プロパティが表示される

**TC-MD-121**: タグの正しい認識
- **前提条件**: 生成されたタグを含むファイル
- **実行**: Obsidianのタグパネルで確認
- **期待結果**: 全てのタグが正しく認識される

**TC-MD-122**: 検索・フィルター機能の動作
- **前提条件**: メタデータ付きファイルを複数作成
- **実行**: Obsidianの検索・フィルター機能を使用
- **期待結果**: メタデータベースの検索が正常に動作する

## テスト環境設定

### モックオブジェクト
- **SlackMessage**: 様々なパターンのメッセージオブジェクト
- **ChannelInfo**: チャンネル情報のテストデータ
- **PluginSettings**: テスト用設定パターン

### テストデータ
- **基本メッセージ**: 標準的なテキストメッセージ
- **複合メッセージ**: 添付ファイル・リンク・メンション含有
- **スレッドメッセージ**: 親子関係のあるメッセージ
- **特殊文字メッセージ**: Unicode・特殊文字・YAML予約文字含有

### カバレッジ目標
- **ラインカバレッジ**: 95%以上
- **ブランチカバレッジ**: 90%以上
- **関数カバレッジ**: 100%
- **YAML生成テスト**: 全パターンの構文正当性確認