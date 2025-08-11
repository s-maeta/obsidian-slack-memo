# 設定ファイル構造

## 概要

Obsidian Slack 同期プラグインは、Obsidian の Plugin Data API を使用して設定情報
と同期状態を管理します。すべてのデータは
`.obsidian/plugins/obsidian-slack-sync/data.json` に保存されます。

## ファイルパス

```
.obsidian/
└── plugins/
    └── obsidian-slack-sync/
        ├── main.js         (プラグイン本体)
        ├── manifest.json   (プラグイン情報)
        ├── styles.css      (スタイルシート)
        └── data.json       (設定ファイル)
```

## data.json の構造

```json
{
  "slackToken": "xoxb-...",
  "syncInterval": 30,
  "channelMappings": [
    {
      "channelId": "C1234567890",
      "channelName": "memo",
      "targetFolder": "Slack/Memos",
      "saveAsIndividualFiles": true,
      "fileNameFormat": "{date}-{time}-{user}",
      "enableTags": true,
      "tags": ["slack", "memo"]
    },
    {
      "channelId": "C0987654321",
      "channelName": "ideas",
      "targetFolder": "Slack/Ideas",
      "saveAsIndividualFiles": true,
      "fileNameFormat": "{date}-{title}",
      "enableTags": true,
      "tags": ["slack", "idea"]
    }
  ],
  "dailyNoteSettings": {
    "enabled": true,
    "folder": "Daily Notes",
    "dateFormat": "YYYY-MM-DD",
    "headerFormat": "## Slack Messages",
    "appendToExisting": true
  },
  "messageFormat": {
    "includeTimestamp": true,
    "includeUserName": true,
    "includeChannelName": false,
    "timestampFormat": "HH:mm:ss",
    "convertMentions": true,
    "preserveEmojis": true
  },
  "syncHistory": {
    "lastSyncTime": "2024-01-01T12:00:00Z",
    "totalMessagesSynced": 1234,
    "channelLastSync": {
      "C1234567890": "2024-01-01T11:30:00Z",
      "C0987654321": "2024-01-01T11:45:00Z"
    }
  }
}
```

## フィールド説明

### 基本設定

| フィールド     | 型             | 説明                         | デフォルト値 |
| -------------- | -------------- | ---------------------------- | ------------ |
| `slackToken`   | string \| null | Slack OAuth アクセストークン | null         |
| `syncInterval` | number         | 自動同期の間隔（分）         | 30           |

### チャンネルマッピング

各チャンネルの保存先と形式を定義：

| フィールド              | 型       | 説明                   | 例                     |
| ----------------------- | -------- | ---------------------- | ---------------------- |
| `channelId`             | string   | Slack チャンネル ID    | "C1234567890"          |
| `channelName`           | string   | チャンネル名（表示用） | "memo"                 |
| `targetFolder`          | string   | 保存先フォルダ         | "Slack/Memos"          |
| `saveAsIndividualFiles` | boolean  | 個別ファイルとして保存 | true                   |
| `fileNameFormat`        | string   | ファイル名フォーマット | "{date}-{time}-{user}" |
| `enableTags`            | boolean  | タグ付与の有無         | true                   |
| `tags`                  | string[] | 付与するタグ           | ["slack", "memo"]      |

### デイリーノート設定

| フィールド         | 型      | 説明                       | デフォルト値        |
| ------------------ | ------- | -------------------------- | ------------------- |
| `enabled`          | boolean | デイリーノート統合の有効化 | false               |
| `folder`           | string  | デイリーノートフォルダ     | "Daily Notes"       |
| `dateFormat`       | string  | 日付フォーマット           | "YYYY-MM-DD"        |
| `headerFormat`     | string  | セクションヘッダー         | "## Slack Messages" |
| `appendToExisting` | boolean | 既存ファイルへの追記       | true                |

### メッセージフォーマット

| フィールド           | 型      | 説明                    | デフォルト値 |
| -------------------- | ------- | ----------------------- | ------------ |
| `includeTimestamp`   | boolean | タイムスタンプを含める  | true         |
| `includeUserName`    | boolean | ユーザー名を含める      | true         |
| `includeChannelName` | boolean | チャンネル名を含める    | false        |
| `timestampFormat`    | string  | 時刻フォーマット        | "HH:mm:ss"   |
| `convertMentions`    | boolean | @メンションを[[]]に変換 | true         |
| `preserveEmojis`     | boolean | 絵文字を保持            | true         |

### 同期履歴

| フィールド            | 型                     | 説明                           |
| --------------------- | ---------------------- | ------------------------------ |
| `lastSyncTime`        | string \| null         | 全体の最終同期日時（ISO 8601） |
| `totalMessagesSynced` | number                 | 総同期メッセージ数             |
| `channelLastSync`     | Record<string, string> | チャンネル ID 別の最終同期時刻 |

## ファイル名フォーマット変数

ファイル名フォーマットで使用可能な変数：

- `{date}` - 日付（YYYY-MM-DD）
- `{time}` - 時刻（HHmmss）
- `{user}` - ユーザー名
- `{channel}` - チャンネル名
- `{title}` - メッセージの最初の 20 文字
- `{ts}` - Slack タイムスタンプ

## 重複管理の仕組み

チャンネルごとの最終同期時刻を使用して効率的に新規メッセージを取得：

1. 各チャンネルの最終同期時刻を`channelLastSync`に保存
2. Slack API の`oldest`パラメータで該当時刻以降のメッセージのみ取得
3. 初回同期時は全メッセージを取得

```typescript
// チャンネルの最終同期時刻を取得
function getChannelLastSync(channelId: string): string | undefined {
  return settings.syncHistory.channelLastSync[channelId];
}

// 同期完了後に時刻を更新
function updateChannelLastSync(channelId: string, timestamp: string): void {
  settings.syncHistory.channelLastSync[channelId] = timestamp;
}

// Slack APIの呼び出し例
async function fetchNewMessages(channelId: string) {
  const lastSync = getChannelLastSync(channelId);
  const params = {
    channel: channelId,
    oldest: lastSync || '0', // 最終同期時刻以降のメッセージのみ取得
    limit: 100,
  };

  const messages = await slack.conversations.history(params);
  // 処理後、最新メッセージのタイムスタンプで更新
  if (messages.length > 0) {
    updateChannelLastSync(channelId, messages[0].ts);
  }
}
```

## 設定の読み書き

```typescript
// 設定の読み込み
const settings = (await this.loadData()) || getDefaultSettings();

// 設定の保存
await this.saveData(settings);

// デフォルト設定
function getDefaultSettings(): PluginSettings {
  return {
    slackToken: null,
    syncInterval: 30,
    channelMappings: [],
    dailyNoteSettings: {
      enabled: false,
      folder: 'Daily Notes',
      dateFormat: 'YYYY-MM-DD',
      headerFormat: '## Slack Messages',
      appendToExisting: true,
    },
    messageFormat: {
      includeTimestamp: true,
      includeUserName: true,
      includeChannelName: false,
      timestampFormat: 'HH:mm:ss',
      convertMentions: true,
      preserveEmojis: true,
    },
    syncHistory: {
      lastSyncTime: null,
      totalMessagesSynced: 0,
      channelLastSync: {},
    },
  };
}
```

## セキュリティ考慮事項

1. **トークンの保護**: Slack トークンは Obsidian の管理下で保存
2. **ファイルアクセス**: プラグインディレクトリ内のみアクセス
3. **同期データ**: 個人情報を含む可能性があるため、適切に管理

## マイグレーション

将来的な設定構造の変更に備えて、バージョン管理を考慮：

```json
{
  "version": "1.0.0",
  "settings": { ... }
}
```
