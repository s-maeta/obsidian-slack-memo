# TASK-103: 差分同期ロジック - テスト実装ノート

## エラー修正内容

### 1. インポートエラーの修正
- `SlackApiClient` → `SlackAPIClient` (正しいクラス名)
- `SlackMessage` → `Message` (slack-types.tsでの正しい型名)

### 2. APIメソッド名の修正
既存のSlackAPIClientを確認したところ、以下のメソッドが利用可能：
- `getHistory(channelId, options)` - チャンネルの履歴取得
- 戻り値は `Result<ConversationsHistoryResponse>` 型

### 3. モックの修正
- コンストラクタの引数を修正（authManagerを渡す必要がある）
- APIレスポンスの形式を修正（Result型でラップされている）

## 次のステップ
1. SlackAPIClientの既存メソッドに合わせてテストを修正
2. Result型を考慮したモックレスポンスの作成
3. 実際のAPIレスポンス形式に合わせた調整