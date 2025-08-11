# TASK-103: 差分同期ロジック実装 - 要件定義

## 概要
Slackチャンネルからの差分取得と同期状態管理を実装する。前回同期以降の新規メッセージのみを取得し、重複を防ぎながら効率的な同期を実現する。

## 機能要件

### 1. 同期状態管理 (REQ-005)
- チャンネルごとの最終同期時刻を記録・管理する
- 同期履歴（成功/失敗、処理件数）を保持する
- プラグインの設定データに永続化する

### 2. 差分取得ロジック (REQ-106)
- Slack API の `oldest` パラメータを使用して差分取得を実装
- 最終同期時刻以降のメッセージのみを取得
- ページネーション対応（cursor使用）
- レート制限を考慮した取得処理

### 3. 同期処理フロー
1. チャンネルの最終同期時刻を取得
2. `oldest` パラメータに設定してAPI呼び出し
3. 取得したメッセージを処理
4. 同期成功時に最終同期時刻を更新
5. エラー時はロールバック

### 4. エラーハンドリング
- API エラー時のリトライ（最大3回）
- 部分的な成功時の状態管理
- エラーログの記録

## 技術要件

### データ構造

```typescript
interface SyncState {
  channelId: string;
  lastSyncTimestamp: number; // Unix timestamp (seconds)
  lastSyncStatus: 'success' | 'failed' | 'partial';
  lastSyncMessageCount: number;
  lastSyncError?: string;
}

interface SyncHistory {
  [channelId: string]: SyncState;
}
```

### API使用方法

```typescript
// conversations.history with oldest parameter
const response = await slack.conversations.history({
  channel: channelId,
  oldest: lastSyncTimestamp.toString(),
  limit: 100,
  cursor: nextCursor
});
```

## 受け入れ基準

1. **新規メッセージのみ取得**
   - 最終同期時刻以降のメッセージのみが取得される
   - 重複メッセージが発生しない

2. **同期状態の永続化**
   - プラグイン再起動後も同期状態が保持される
   - チャンネルごとに独立した同期状態管理

3. **エラー耐性**
   - ネットワークエラー時に自動リトライ
   - 部分的な失敗でもデータ整合性を保つ

4. **パフォーマンス**
   - 大量メッセージでもメモリ効率的に処理
   - UIをブロックしない非同期処理

## 制約事項

- Slack API のレート制限（Tier 2: 20 requests/minute）を遵守
- 最大100件/リクエストの制限
- タイムスタンプはSlack形式（秒単位の Unix timestamp）を使用

## 依存関係

- TASK-102で実装されたSlack APIクライアント
- Obsidianのプラグイン設定管理機能（loadData/saveData）

## テスト観点

1. 初回同期（履歴なし）のケース
2. 差分同期（履歴あり）のケース
3. エラー発生時のリトライとロールバック
4. 大量メッセージのページネーション処理
5. 同期状態の永続化と復元