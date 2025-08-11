/**
 * @file settings-ui-types.ts
 * @description TASK-301 プラグイン設定画面用の型定義
 */

import { Channel } from './slack-types';
import { ChannelMapping } from './types';

/**
 * 設定画面のUI状態管理型
 */
export interface SettingsUIState {
    /** Slack認証状態 */
    isAuthenticated: boolean;
    /** 認証処理中フラグ */
    authInProgress: boolean;
    /** 利用可能なSlackチャンネル一覧 */
    availableChannels: Channel[];
    /** バリデーションエラー情報 */
    validationErrors: Record<string, string>;
    /** 設定変更フラグ */
    isDirty: boolean;
    /** ローディング状態フラグ */
    isLoading: boolean;
}

/**
 * UIコントロール要素の参照型
 */
export interface UIControls {
    /** Slack認証ボタン */
    authButton?: HTMLButtonElement;
    /** 認証解除ボタン */
    disconnectButton?: HTMLButtonElement;
    /** チャンネル選択セレクトボックス群 */
    channelSelects: HTMLSelectElement[];
    /** フォルダパス入力フィールド群 */
    folderInputs: HTMLInputElement[];
    /** ファイル名フォーマット入力フィールド群 */
    formatInputs: HTMLInputElement[];
    /** 同期間隔スライダー */
    syncIntervalSlider?: HTMLInputElement;
    /** 自動同期有効化チェックボックス */
    autoSyncCheckbox?: HTMLInputElement;
    /** メッセージフォーマット設定チェックボックス群 */
    formatCheckboxes: HTMLInputElement[];
    /** デイリーノート有効化チェックボックス */
    dailyNoteCheckbox?: HTMLInputElement;
}

/**
 * チャンネルマッピングUI用の拡張型
 */
export interface ChannelMappingUI extends ChannelMapping {
    /** UI上での一意ID */
    uiId: string;
    /** 削除予定フラグ */
    markedForDeletion?: boolean;
    /** 新規追加フラグ */
    isNew?: boolean;
}

/**
 * タグエディタコンポーネントのデータ型
 */
export interface TagEditorData {
    /** タグの配列 */
    tags: string[];
    /** 入力中のタグテキスト */
    inputValue: string;
    /** 編集可能フラグ */
    isEditable: boolean;
}

/**
 * フォーマットプレビューのデータ型
 */
export interface FormatPreviewData {
    /** プレビュー用サンプルメッセージ */
    sampleMessage: {
        user: string;
        channel: string;
        timestamp: string;
        text: string;
    };
    /** 現在の設定 */
    currentFormat: {
        includeTimestamp: boolean;
        includeUserName: boolean;
        includeChannelName: boolean;
        timestampFormat: string;
    };
    /** 生成されたプレビューテキスト */
    preview: string;
}

/**
 * バリデーション結果の型
 */
export interface ValidationResult {
    /** バリデーション成功フラグ */
    isValid: boolean;
    /** エラーメッセージ */
    errors: ValidationError[];
    /** 警告メッセージ */
    warnings: ValidationWarning[];
}

/**
 * バリデーションエラーの詳細型
 */
export interface ValidationError {
    /** エラーが発生したフィールド */
    field: string;
    /** エラーメッセージ */
    message: string;
    /** エラーコード */
    code: string;
    /** 修正のヒント */
    hint?: string;
}

/**
 * バリデーション警告の詳細型
 */
export interface ValidationWarning {
    /** 警告が発生したフィールド */
    field: string;
    /** 警告メッセージ */
    message: string;
    /** 警告コード */
    code: string;
}

/**
 * 設定保存結果の型
 */
export interface SettingsSaveResult {
    /** 保存成功フラグ */
    success: boolean;
    /** エラー情報（失敗時） */
    error?: Error;
    /** 保存されたデータのハッシュ */
    dataHash?: string;
    /** 保存完了時刻 */
    savedAt?: Date;
}

/**
 * 設定画面のイベント型
 */
export type SettingsUIEvent = 
    | { type: 'AUTH_START' }
    | { type: 'AUTH_SUCCESS'; token: string }
    | { type: 'AUTH_FAILURE'; error: Error }
    | { type: 'AUTH_DISCONNECT' }
    | { type: 'CHANNELS_LOADED'; channels: Channel[] }
    | { type: 'VALIDATION_ERROR'; errors: ValidationError[] }
    | { type: 'SETTINGS_SAVE'; settings: any }
    | { type: 'SETTINGS_RESET' }
    | { type: 'UI_STATE_UPDATE'; state: Partial<SettingsUIState> };

/**
 * 設定画面コンポーネントのプロパティ型
 */
export interface SettingsComponentProps {
    /** コンポーネントのルートDOM要素 */
    containerEl: HTMLElement;
    /** 現在の設定データ */
    settings: any;
    /** 設定更新コールバック */
    onSettingsChange: (settings: any) => void;
    /** UI状態 */
    uiState: SettingsUIState;
    /** UI状態更新コールバック */
    onUIStateChange: (state: Partial<SettingsUIState>) => void;
}

/**
 * 設定項目の基本インターフェース
 */
export interface SettingItem {
    /** 設定項目の一意キー */
    key: string;
    /** 表示名 */
    name: string;
    /** 説明文 */
    description: string;
    /** 設定項目のタイプ */
    type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'slider' | 'custom';
    /** デフォルト値 */
    defaultValue?: any;
    /** 必須フラグ */
    required?: boolean;
    /** バリデーション関数 */
    validate?: (value: any) => ValidationResult;
    /** 依存する設定項目 */
    dependsOn?: string[];
    /** ヘルプテキスト */
    help?: string;
}

/**
 * テキスト入力設定項目
 */
export interface TextSettingItem extends SettingItem {
    type: 'text';
    /** プレースホルダーテキスト */
    placeholder?: string;
    /** 最大文字数 */
    maxLength?: number;
    /** 入力パターン */
    pattern?: string;
}

/**
 * 数値入力設定項目
 */
export interface NumberSettingItem extends SettingItem {
    type: 'number';
    /** 最小値 */
    min?: number;
    /** 最大値 */
    max?: number;
    /** ステップ値 */
    step?: number;
    /** 単位 */
    unit?: string;
}

/**
 * 選択設定項目
 */
export interface SelectSettingItem extends SettingItem {
    type: 'select' | 'multiselect';
    /** 選択肢 */
    options: { value: any; label: string; description?: string }[];
    /** 複数選択の最大数 */
    maxSelections?: number;
}

/**
 * スライダー設定項目
 */
export interface SliderSettingItem extends SettingItem {
    type: 'slider';
    /** 最小値 */
    min: number;
    /** 最大値 */
    max: number;
    /** ステップ値 */
    step?: number;
    /** 値のラベル生成関数 */
    labelFormatter?: (value: number) => string;
}

/**
 * 設定セクションの型
 */
export interface SettingSection {
    /** セクションID */
    id: string;
    /** セクション名 */
    title: string;
    /** セクション説明 */
    description?: string;
    /** 設定項目の配列 */
    items: SettingItem[];
    /** 折りたたみ可能フラグ */
    collapsible?: boolean;
    /** デフォルト展開状態 */
    defaultExpanded?: boolean;
}

/**
 * 設定画面の全体構成型
 */
export interface SettingsConfiguration {
    /** 設定画面のタイトル */
    title: string;
    /** セクション一覧 */
    sections: SettingSection[];
    /** カスタムCSS */
    customCSS?: string;
    /** 高度な設定の表示フラグ */
    showAdvanced?: boolean;
}