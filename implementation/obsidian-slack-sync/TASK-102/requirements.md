# TASK-102: Slack APIクライアント実装 - 要件定義

## 概要
Slack Web APIとの通信を管理するクライアントラッパーを実装する。

## 詳細要件

### 1. 基本機能
- Slack Web APIへのHTTPリクエスト管理
- 認証トークンの自動付与
- レスポンスの型安全な処理
- エラーハンドリング

### 2. 実装すべきAPIメソッド

#### conversations.list
- チャンネルリストの取得
- パブリック/プライベートチャンネル両方をサポート
- ページネーション対応

#### conversations.history
- チャンネルのメッセージ履歴取得
- タイムスタンプベースの差分取得
- ページネーション対応

#### conversations.replies
- スレッドの返信メッセージ取得
- 親メッセージとの関連付け

### 3. レート制限対応
- 429エラー（Too Many Requests）の検出
- Retry-Afterヘッダーの解析
- 自動リトライ機構（最大3回）
- 指数バックオフ

### 4. エラーハンドリング
- APIエラーレスポンスの適切な処理
- ネットワークエラーのハンドリング
- タイムアウト処理（30秒）
- 詳細なエラーメッセージ

### 5. 型定義
- APIレスポンスの型定義
- チャンネル、メッセージ、ユーザーの型
- エラーレスポンスの型

## 技術仕様

### クラス設計
```typescript
class SlackAPIClient {
  constructor(authManager: SlackAuthManager)
  
  // チャンネル操作
  async listChannels(options?: ListChannelsOptions): Promise<Result<Channel[]>>
  async getChannelHistory(channelId: string, options?: HistoryOptions): Promise<Result<Message[]>>
  async getThreadReplies(channelId: string, threadTs: string): Promise<Result<Message[]>>
  
  // 内部メソッド
  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<Result<T>>
  private handleRateLimit(retryAfter: number): Promise<void>
  private parseError(response: any): Error
}
```

### 依存関係
- SlackAuthManager（トークン取得用）
- fetch API（HTTP通信）
- Result型（エラーハンドリング）

## 受け入れ基準

1. **API呼び出し**
   - 認証トークンが自動的に付与される
   - 正しいエンドポイントにリクエストが送信される
   - レスポンスが型安全に処理される

2. **レート制限**
   - 429エラーで自動リトライが実行される
   - Retry-Afterヘッダーが尊重される
   - 最大リトライ回数を超えたらエラーを返す

3. **エラーハンドリング**
   - APIエラーが適切にパースされる
   - ネットワークエラーが捕捉される
   - タイムアウトが機能する

4. **ページネーション**
   - 次ページのカーソルが正しく処理される
   - すべてのページを取得できる

## 制約事項
- Slack APIの仕様に準拠
- 1リクエストあたり最大1000件のアイテム
- タイムアウトは30秒
- リトライは最大3回

## パフォーマンス要件
- API呼び出しの並列実行は避ける
- レート制限を考慮した適切な間隔
- 不要なリクエストを避ける