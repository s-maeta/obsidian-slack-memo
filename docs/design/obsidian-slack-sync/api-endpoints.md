# API エンドポイント仕様

## Slack Web API 利用仕様

### 認証エンドポイント

#### OAuth 2.0 認証フロー

**1. 認証開始**

```
GET https://slack.com/oauth/v2/authorize
```

パラメータ:

```
client_id: {SLACK_CLIENT_ID}
scope: channels:history,channels:read,groups:history,groups:read,im:history,im:read,users:read
redirect_uri: obsidian://slack-sync-callback
response_type: code
state: {RANDOM_STATE}
```

**2. トークン取得**

```
POST https://slack.com/api/oauth.v2.access
```

リクエスト:

```json
{
  "client_id": "{SLACK_CLIENT_ID}",
  "client_secret": "{SLACK_CLIENT_SECRET}",
  "code": "{AUTHORIZATION_CODE}",
  "redirect_uri": "obsidian://slack-sync-callback"
}
```

レスポンス:

```json
{
  "ok": true,
  "access_token": "xoxb-...",
  "token_type": "bearer",
  "scope": "channels:history,channels:read,...",
  "bot_user_id": "U...",
  "app_id": "A...",
  "team": {
    "id": "T...",
    "name": "Workspace Name"
  }
}
```

### メッセージ取得エンドポイント

#### チャンネルリスト取得

```
GET https://slack.com/api/conversations.list
```

ヘッダー:

```
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

パラメータ:

```
types: public_channel,private_channel,im
exclude_archived: true
limit: 200
cursor: {PAGINATION_CURSOR}
```

レスポンス:

```json
{
  "ok": true,
  "channels": [
    {
      "id": "C...",
      "name": "general",
      "is_channel": true,
      "is_group": false,
      "is_im": false,
      "is_member": true,
      "is_private": false,
      "is_archived": false
    }
  ],
  "response_metadata": {
    "next_cursor": "..."
  }
}
```

#### メッセージ履歴取得

```
GET https://slack.com/api/conversations.history
```

パラメータ:

```
channel: {CHANNEL_ID}
oldest: {UNIX_TIMESTAMP} // 最終同期時刻
latest: {UNIX_TIMESTAMP}
limit: 100
inclusive: false
```

レスポンス:

```json
{
  "ok": true,
  "messages": [
    {
      "type": "message",
      "user": "U...",
      "text": "メッセージ内容",
      "ts": "1234567890.123456",
      "thread_ts": "1234567890.123456",
      "reply_count": 3,
      "attachments": [],
      "files": []
    }
  ],
  "has_more": true,
  "response_metadata": {
    "next_cursor": "..."
  }
}
```

#### スレッドメッセージ取得

```
GET https://slack.com/api/conversations.replies
```

パラメータ:

```
channel: {CHANNEL_ID}
ts: {THREAD_TS}
oldest: {UNIX_TIMESTAMP}
latest: {UNIX_TIMESTAMP}
limit: 100
inclusive: true
```

### ユーザー情報エンドポイント

#### ユーザー情報取得

```
GET https://slack.com/api/users.info
```

パラメータ:

```
user: {USER_ID}
```

レスポンス:

```json
{
  "ok": true,
  "user": {
    "id": "U...",
    "name": "username",
    "real_name": "Real Name",
    "profile": {
      "display_name": "Display Name",
      "image_72": "https://..."
    },
    "is_bot": false
  }
}
```

#### ユーザーリスト取得（バッチ）

```
GET https://slack.com/api/users.list
```

パラメータ:

```
limit: 200
cursor: {PAGINATION_CURSOR}
```

## エラーハンドリング

### 一般的なエラーレスポンス

```json
{
  "ok": false,
  "error": "error_code",
  "response_metadata": {
    "messages": ["詳細なエラーメッセージ"]
  }
}
```

### 主要なエラーコード

- `invalid_auth`: 認証トークンが無効
- `channel_not_found`: チャンネルが見つからない
- `not_in_channel`: チャンネルのメンバーではない
- `rate_limited`: レート制限に到達
- `token_revoked`: トークンが取り消された
- `account_inactive`: アカウントが無効
- `no_permission`: 権限がない

### レート制限

- **Tier 2**: 20+ requests per minute
- **Tier 3**: 50+ requests per minute
- **Retry-After**: レスポンスヘッダーで待機時間を指定

## プラグイン内部 API

### 設定管理 API

#### 設定の取得

```typescript
async getSettings(): Promise<PluginSettings>
```

#### 設定の更新

```typescript
async updateSettings(settings: Partial<PluginSettings>): Promise<void>
```

### 同期制御 API

#### 手動同期開始

```typescript
async startSync(options?: {
  channels?: string[];
  since?: Date;
  force?: boolean;
}): Promise<SyncResult>
```

#### 同期状態取得

```typescript
getSyncStatus(): SyncProgress
```

#### 同期キャンセル

```typescript
cancelSync(): Promise<void>
```

### データ管理 API

#### メッセージ保存

```typescript
async saveMessage(
  message: ProcessedMessage,
  target: SaveTarget
): Promise<void>
```

#### 重複チェック

```typescript
async isMessageSynced(messageId: string): Promise<boolean>
```

#### 同期履歴取得

```typescript
async getSyncHistory(
  limit?: number
): Promise<SyncHistoryEntry[]>
```

## Webhook 対応（将来実装）

### イベントサブスクリプション

```
POST https://slack.com/api/apps.event.subscriptions
```

購読イベント:

- `message.channels`
- `message.groups`
- `message.im`
- `message_changed`
- `message_deleted`

### リアルタイム同期

```json
{
  "type": "event_callback",
  "event": {
    "type": "message",
    "channel": "C...",
    "user": "U...",
    "text": "新しいメッセージ",
    "ts": "1234567890.123456"
  }
}
```
