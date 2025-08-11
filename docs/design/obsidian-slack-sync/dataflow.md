# データフロー図

## ユーザーインタラクションフロー

### 初期設定フロー

```mermaid
flowchart TD
    A[ユーザー] --> B[設定画面を開く]
    B --> C[Slack認証開始]
    C --> D[Slack OAuth画面]
    D --> E[認証トークン取得]
    E --> F[チャンネル設定]
    F --> G[保存先フォルダ設定]
    G --> H[同期間隔設定]
    H --> I[設定保存]
    I --> J[IndexedDBに保存]
```

### 自動同期フロー

```mermaid
flowchart TD
    A[タイマー起動] --> B{認証確認}
    B -->|有効| C[Slack API呼び出し]
    B -->|無効| D[エラー通知]
    C --> E[メッセージ取得]
    E --> F{新規メッセージ?}
    F -->|Yes| G[チャンネル判定]
    F -->|No| H[スキップ]
    G --> I[保存先決定]
    I --> J[Markdown変換]
    J --> K[ファイル保存]
    K --> L[履歴更新]
    L --> M[次のメッセージ]
    M --> F
```

### 手動同期フロー

```mermaid
flowchart TD
    A[ユーザー] --> B[同期ボタンクリック]
    B --> C[進行状況表示]
    C --> D[Slack API呼び出し]
    D --> E[メッセージ一括取得]
    E --> F[バッチ処理開始]
    F --> G[処理進捗更新]
    G --> H{完了?}
    H -->|No| F
    H -->|Yes| I[完了通知]
```

## データ処理フロー

### メッセージ取得シーケンス

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant P as プラグイン
    participant S as Slack API
    participant DB as IndexedDB
    participant V as Obsidian Vault

    U->>P: 同期開始
    P->>DB: 最終同期時刻取得
    DB-->>P: timestamp
    P->>S: conversations.history(since)
    S-->>P: メッセージリスト

    loop 各メッセージ
        P->>DB: 重複チェック
        alt 新規メッセージ
            P->>P: Markdown変換
            P->>V: ファイル作成/更新
            P->>DB: メッセージID保存
        end
    end

    P->>U: 同期完了通知
```

### チャンネル別振り分けフロー

```mermaid
flowchart LR
    A[Slackメッセージ] --> B{チャンネル判定}
    B -->|メモチャンネル| C[/Memos/フォルダ]
    B -->|アイデアチャンネル| D[/Ideas/フォルダ]
    B -->|デイリーノート設定| E[/Daily Notes/YYYY-MM-DD.md]
    B -->|その他| F[/Slack/フォルダ]

    C --> G[個別ファイル作成]
    D --> H[タグ付きファイル作成]
    E --> I[既存ファイルに追記]
    F --> J[チャンネル名フォルダ作成]
```

### エラー処理フロー

```mermaid
flowchart TD
    A[API呼び出し] --> B{レスポンス}
    B -->|200 OK| C[正常処理]
    B -->|401 Unauthorized| D[再認証要求]
    B -->|429 Rate Limited| E[待機処理]
    B -->|Network Error| F[リトライ処理]

    D --> G[ユーザー通知]
    E --> H[Retry-After待機]
    F --> I{リトライ回数}
    I -->|< 3| J[指数バックオフ]
    I -->|>= 3| K[エラー記録]

    H --> A
    J --> A
```

## データ変換フロー

### Slack メッセージ → Markdown 変換

````mermaid
flowchart TD
    A[Slackメッセージ] --> B[テキスト抽出]
    B --> C{要素判定}
    C -->|プレーンテキスト| D[そのまま出力]
    C -->|メンション| E[[[user]]形式に変換]
    C -->|リンク| F[Markdownリンクに変換]
    C -->|コードブロック| G[```で囲む]
    C -->|添付ファイル| H[![[file]]形式で参照]
    C -->|絵文字| I[Unicode変換]

    D --> J[結合処理]
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J

    J --> K[メタデータ追加]
    K --> L[最終Markdownファイル]
````

### スレッド処理フロー

```mermaid
flowchart TD
    A[親メッセージ] --> B{スレッドあり?}
    B -->|Yes| C[thread_ts取得]
    B -->|No| D[単独保存]

    C --> E[conversations.replies]
    E --> F[スレッドメッセージ取得]
    F --> G[階層構造生成]
    G --> H[インデント付きMarkdown]
    H --> I[親メッセージに統合]
    I --> J[ファイル保存]
```

## 同期状態管理フロー

```mermaid
stateDiagram-v2
    [*] --> 待機中
    待機中 --> 同期中: 同期開始
    同期中 --> 処理中: メッセージ取得
    処理中 --> 保存中: ファイル作成
    保存中 --> 完了: 全件処理

    同期中 --> エラー: API失敗
    処理中 --> エラー: 変換失敗
    保存中 --> エラー: 保存失敗

    エラー --> リトライ中: 再試行可能
    エラー --> 失敗: 再試行不可

    リトライ中 --> 同期中: 成功
    リトライ中 --> 失敗: 失敗

    完了 --> 待機中: 次回まで待機
    失敗 --> 待機中: ユーザー操作待ち
```
