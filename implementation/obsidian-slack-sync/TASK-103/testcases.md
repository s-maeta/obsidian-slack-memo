# TASK-103: 差分同期ロジック実装 - テストケース設計

## テストケース一覧

### 1. SyncStateManager クラスのテスト

#### 1.1 同期状態の取得
- **TC-001**: 初回同期時（履歴なし）のデフォルト値取得
  - Input: 存在しないチャンネルID
  - Expected: lastSyncTimestamp = 0, lastSyncStatus = undefined

- **TC-002**: 既存の同期状態取得
  - Input: 同期履歴があるチャンネルID
  - Expected: 保存された同期状態が返される

#### 1.2 同期状態の更新
- **TC-003**: 成功時の同期状態更新
  - Input: チャンネルID、新しいタイムスタンプ、メッセージ数
  - Expected: status = 'success', 新しいタイムスタンプが保存される

- **TC-004**: 失敗時の同期状態更新
  - Input: チャンネルID、エラーメッセージ
  - Expected: status = 'failed', エラーメッセージが保存される

- **TC-005**: 部分成功時の同期状態更新
  - Input: チャンネルID、処理済みタイムスタンプ、部分的なメッセージ数
  - Expected: status = 'partial', 部分的な進捗が保存される

### 2. DifferentialSync クラスのテスト

#### 2.1 差分取得ロジック
- **TC-006**: 初回同期（全メッセージ取得）
  - Input: 同期履歴なしのチャンネル
  - Expected: oldest パラメータなしでAPI呼び出し

- **TC-007**: 差分同期（新規メッセージのみ）
  - Input: 最終同期時刻 = 1234567890
  - Expected: oldest = "1234567890" でAPI呼び出し

- **TC-008**: ページネーション処理
  - Input: has_more = true のレスポンス
  - Expected: cursor を使用して次ページを取得

#### 2.2 エラーハンドリング
- **TC-009**: APIエラー時のリトライ（成功）
  - Input: 1回目エラー、2回目成功
  - Expected: 2回目で正常に処理継続

- **TC-010**: APIエラー時のリトライ（最大回数到達）
  - Input: 3回連続エラー
  - Expected: エラーをスローし、同期状態を'failed'に更新

- **TC-011**: レート制限エラーの処理
  - Input: 429エラー with Retry-After header
  - Expected: 指定時間待機後にリトライ

### 3. 統合テスト

#### 3.1 完全な同期フロー
- **TC-012**: 新規チャンネルの初回同期
  - Scenario: 履歴なし → 全メッセージ取得 → 状態保存
  - Expected: すべてのメッセージが取得され、同期状態が更新される

- **TC-013**: 既存チャンネルの差分同期
  - Scenario: 前回同期から10件の新規メッセージ
  - Expected: 10件のみ取得、重複なし

- **TC-014**: 複数ページにまたがる差分同期
  - Scenario: 150件の新規メッセージ（2ページ）
  - Expected: すべてのメッセージが順次取得される

#### 3.2 エラーシナリオ
- **TC-015**: 部分的な成功後のリカバリー
  - Scenario: 2ページ目でエラー → 次回同期で1ページ目から再開しない
  - Expected: 1ページ目の最終タイムスタンプから継続

- **TC-016**: 同期中のプラグイン再起動
  - Scenario: 同期途中でプラグイン停止 → 再起動
  - Expected: 最後に成功した地点から再開

### 4. エッジケース

- **TC-017**: 空のチャンネル（メッセージなし）
  - Expected: エラーなく完了、lastSyncTimestamp = 現在時刻

- **TC-018**: 削除されたメッセージの処理
  - Input: subtype = "message_deleted" のメッセージ
  - Expected: スキップまたは適切に処理

- **TC-019**: 同時実行の防止
  - Scenario: 同じチャンネルで同期を2回同時実行
  - Expected: 2回目は実行されないか待機

## モックデータ

```typescript
// 成功レスポンス
const mockSuccessResponse = {
  ok: true,
  messages: [
    { ts: "1234567891.000100", text: "Hello" },
    { ts: "1234567892.000200", text: "World" }
  ],
  has_more: false
};

// エラーレスポンス
const mockErrorResponse = {
  ok: false,
  error: "rate_limited",
  headers: { "Retry-After": "30" }
};

// ページネーションレスポンス
const mockPaginatedResponse = {
  ok: true,
  messages: [...Array(100)].map((_, i) => ({
    ts: `123456789${i}.000000`,
    text: `Message ${i}`
  })),
  has_more: true,
  response_metadata: {
    next_cursor: "next_page_cursor"
  }
};
```

## テスト実行順序

1. 単体テスト（SyncStateManager）
2. 単体テスト（DifferentialSync）
3. 統合テスト（正常系）
4. 統合テスト（異常系）
5. エッジケーステスト