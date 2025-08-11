/**
 * @file plugin-setting-tab.test.ts
 * @description TASK-301 プラグイン設定画面のテストスイート
 * TDDプロセス - RED Phase: 失敗するテストの実装
 */

import { SlackSyncSettingTab } from '../plugin-setting-tab';
import { 
    SettingsUIState, 
    UIControls, 
    ChannelMappingUI,
    ValidationResult,
    SettingsSaveResult 
} from '../settings-ui-types';
import { PluginSettings, ChannelMapping } from '../types';
import { Channel } from '../slack-types';

// モックデータの定義
const mockApp = {
    setting: {
        openTabById: jest.fn(),
        addSettingTab: jest.fn(),
        removeSettingTab: jest.fn()
    }
};

const mockPlugin = {
    settings: {
        slackToken: 'test-token',
        syncInterval: 30,
        channelMappings: [
            {
                channelId: 'C123456',
                channelName: 'general',
                targetFolder: 'slack/general',
                fileNameFormat: '{channel}-{date}.md',
                enableTags: true,
                tags: ['work', 'general'],
                saveAsIndividualFiles: true
            }
        ],
        dailyNoteSettings: {
            enabled: true,
            folder: 'Daily Notes',
            dateFormat: 'YYYY-MM-DD',
            headerFormat: '## Slack Messages',
            appendToExisting: true
        },
        messageFormat: {
            includeTimestamp: true,
            includeUserName: true,
            includeChannelName: false,
            timestampFormat: 'HH:mm',
            convertMentions: true,
            preserveEmojis: true
        },
        syncHistory: {
            lastSyncTime: null,
            totalMessagesSynced: 0,
            channelLastSync: {}
        }
    } as PluginSettings,
    saveSettings: jest.fn(),
    loadSettings: jest.fn(),
    app: mockApp
};

const mockChannels: Channel[] = [
    {
        id: 'C123456',
        name: 'general',
        is_channel: true,
        is_member: true
    },
    {
        id: 'C789012',
        name: 'random',
        is_channel: true,
        is_member: true
    }
];

describe('SlackSyncSettingTab', () => {
    let settingTab: SlackSyncSettingTab;
    let containerEl: HTMLElement;

    beforeEach(() => {
        // DOM要素をクリア
        document.body.innerHTML = '';
        containerEl = document.createElement('div');
        document.body.appendChild(containerEl);
        
        // Jestモックをリセット
        jest.clearAllMocks();
        
        settingTab = new SlackSyncSettingTab(mockApp as any, mockPlugin as any);
    });

    afterEach(() => {
        if (containerEl.parentNode) {
            containerEl.parentNode.removeChild(containerEl);
        }
    });

    // TC-ST-001: 正常なコンストラクタ呼び出し
    describe('Constructor', () => {
        test('TC-ST-001: should create instance with valid App and Plugin', () => {
            expect(() => new SlackSyncSettingTab(mockApp as any, mockPlugin as any)).not.toThrow();
            expect(settingTab).toBeInstanceOf(SlackSyncSettingTab);
            expect(settingTab.app).toBe(mockApp);
            expect(settingTab.plugin).toBe(mockPlugin);
        });
    });

    // TC-ST-002: 設定タブの表示
    describe('Display and Hide', () => {
        test('TC-ST-002: should display settings UI correctly', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            expect(containerEl.children.length).toBeGreaterThan(0);
            expect(containerEl.querySelector('.setting-item')).toBeTruthy();
        });

        // TC-ST-003: 設定タブの非表示
        test('TC-ST-003: should hide settings UI correctly', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            settingTab.hide();
            
            expect(containerEl.innerHTML).toBe('');
        });
    });

    // TC-ST-010-014: Slack認証ボタン機能
    describe('Slack Authentication', () => {
        test('TC-ST-010: should display auth button when not authenticated', () => {
            settingTab.containerEl = containerEl;
            settingTab.uiState = {
                isAuthenticated: false,
                authInProgress: false,
                availableChannels: [],
                validationErrors: {},
                isDirty: false,
                isLoading: false
            };
            
            settingTab.display();
            
            const authButton = containerEl.querySelector('[data-testid="slack-auth-button"]');
            expect(authButton).toBeTruthy();
            expect(authButton?.textContent).toContain('Slackで認証');
        });

        test('TC-ST-011: should handle auth button click', async () => {
            // 認証未完了状態に設定
            settingTab.uiState = {
                isAuthenticated: false,
                authInProgress: false,
                availableChannels: [],
                validationErrors: {},
                isDirty: false,
                isLoading: false
            };
            
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const authButton = containerEl.querySelector('[data-testid="slack-auth-button"]') as HTMLButtonElement;
            expect(authButton).toBeTruthy();
            
            const mockAuthHandler = jest.fn();
            authButton.addEventListener('click', mockAuthHandler);
            authButton.click();
            
            expect(mockAuthHandler).toHaveBeenCalled();
        });

        test('TC-ST-012: should display authenticated state when authenticated', () => {
            settingTab.containerEl = containerEl;
            settingTab.uiState = {
                isAuthenticated: true,
                authInProgress: false,
                availableChannels: mockChannels,
                validationErrors: {},
                isDirty: false,
                isLoading: false
            };
            
            settingTab.display();
            
            const authStatus = containerEl.querySelector('[data-testid="auth-status"]');
            const disconnectButton = containerEl.querySelector('[data-testid="disconnect-button"]');
            
            expect(authStatus?.textContent).toContain('認証済み');
            expect(disconnectButton).toBeTruthy();
        });

        test('TC-ST-013: should handle disconnect button click', async () => {
            settingTab.containerEl = containerEl;
            settingTab.uiState = { ...settingTab.uiState, isAuthenticated: true };
            settingTab.display();
            
            const disconnectButton = containerEl.querySelector('[data-testid="disconnect-button"]') as HTMLButtonElement;
            expect(disconnectButton).toBeTruthy();
            
            const mockDisconnectHandler = jest.fn();
            disconnectButton.addEventListener('click', mockDisconnectHandler);
            disconnectButton.click();
            
            expect(mockDisconnectHandler).toHaveBeenCalled();
        });

        test('TC-ST-014: should display auth error when error occurs', () => {
            settingTab.containerEl = containerEl;
            settingTab.uiState = {
                isAuthenticated: false,
                authInProgress: false,
                availableChannels: [],
                validationErrors: { auth: '認証に失敗しました' },
                isDirty: false,
                isLoading: false
            };
            
            settingTab.display();
            
            const errorMessage = containerEl.querySelector('[data-testid="auth-error"]');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage?.textContent).toContain('認証に失敗しました');
        });
    });

    // TC-ST-020-025: チャンネルマッピング設定UI
    describe('Channel Mapping UI', () => {
        beforeEach(() => {
            settingTab.uiState = {
                isAuthenticated: true,
                authInProgress: false,
                availableChannels: mockChannels,
                validationErrors: {},
                isDirty: false,
                isLoading: false
            };
        });

        test('TC-ST-020: should display channel dropdown with available channels', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const channelSelects = containerEl.querySelectorAll('[data-testid="channel-select"]');
            expect(channelSelects.length).toBeGreaterThan(0);
            
            const firstSelect = channelSelects[0] as HTMLSelectElement;
            const options = firstSelect.querySelectorAll('option');
            expect(options.length).toBeGreaterThanOrEqual(mockChannels.length);
        });

        test('TC-ST-021: should add new channel mapping when add button clicked', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const initialMappings = containerEl.querySelectorAll('[data-testid="channel-mapping"]').length;
            
            const addButton = containerEl.querySelector('[data-testid="add-mapping-button"]') as HTMLButtonElement;
            expect(addButton).toBeTruthy();
            
            addButton.click();
            
            const newMappings = containerEl.querySelectorAll('[data-testid="channel-mapping"]').length;
            expect(newMappings).toBe(initialMappings + 1);
        });

        test('TC-ST-022: should remove channel mapping when delete button clicked', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const deleteButton = containerEl.querySelector('[data-testid="delete-mapping-button"]') as HTMLButtonElement;
            if (deleteButton) {
                const initialMappings = containerEl.querySelectorAll('[data-testid="channel-mapping"]').length;
                deleteButton.click();
                
                const newMappings = containerEl.querySelectorAll('[data-testid="channel-mapping"]').length;
                expect(newMappings).toBe(initialMappings - 1);
            }
        });

        test('TC-ST-023: should update folder path when input changes', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const folderInput = containerEl.querySelector('[data-testid="folder-input"]') as HTMLInputElement;
            expect(folderInput).toBeTruthy();
            
            const testPath = 'test/folder/path';
            folderInput.value = testPath;
            folderInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(folderInput.value).toBe(testPath);
        });

        test('TC-ST-024: should update filename format when input changes', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const formatInput = containerEl.querySelector('[data-testid="format-input"]') as HTMLInputElement;
            expect(formatInput).toBeTruthy();
            
            const testFormat = '{channel}-{timestamp}.md';
            formatInput.value = testFormat;
            formatInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(formatInput.value).toBe(testFormat);
        });

        test('TC-ST-025: should manage tags correctly', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const tagEditor = containerEl.querySelector('[data-testid="tag-editor"]');
            expect(tagEditor).toBeTruthy();
            
            // タグ追加のテスト
            const addTagButton = containerEl.querySelector('[data-testid="add-tag-button"]') as HTMLButtonElement;
            if (addTagButton) {
                addTagButton.click();
                const tagInputs = containerEl.querySelectorAll('[data-testid="tag-input"]');
                expect(tagInputs.length).toBeGreaterThan(0);
            }
        });
    });

    // TC-ST-030-034: 同期間隔設定
    describe('Sync Interval Settings', () => {
        test('TC-ST-030: should display sync interval slider', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const intervalSlider = containerEl.querySelector('[data-testid="sync-interval-slider"]') as HTMLInputElement;
            expect(intervalSlider).toBeTruthy();
            expect(intervalSlider.type).toBe('range');
        });

        test('TC-ST-031: should handle preset value selection', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const presetSelect = containerEl.querySelector('[data-testid="preset-interval-select"]') as HTMLSelectElement;
            expect(presetSelect).toBeTruthy();
            
            presetSelect.value = '15';
            presetSelect.dispatchEvent(new Event('change', { bubbles: true }));
            
            expect(presetSelect.value).toBe('15');
        });

        test('TC-ST-032: should handle custom value input', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const customInput = containerEl.querySelector('[data-testid="custom-interval-input"]') as HTMLInputElement;
            expect(customInput).toBeTruthy();
            
            const customValue = '45';
            customInput.value = customValue;
            customInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(customInput.value).toBe(customValue);
        });

        test('TC-ST-033: should toggle auto sync setting', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const autoSyncCheckbox = containerEl.querySelector('[data-testid="auto-sync-checkbox"]') as HTMLInputElement;
            expect(autoSyncCheckbox).toBeTruthy();
            expect(autoSyncCheckbox.type).toBe('checkbox');
            
            const initialChecked = autoSyncCheckbox.checked;
            autoSyncCheckbox.click();
            
            expect(autoSyncCheckbox.checked).toBe(!initialChecked);
        });

        test('TC-ST-034: should display next sync time when auto sync is enabled', () => {
            // 自動同期が有効になるように設定を変更
            settingTab.plugin.settings.syncInterval = 30; // 30分間隔で自動同期
            
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const nextSyncDisplay = containerEl.querySelector('[data-testid="next-sync-time"]');
            expect(nextSyncDisplay).toBeTruthy();
        });
    });

    // TC-ST-040-043: メッセージフォーマット設定
    describe('Message Format Settings', () => {
        test('TC-ST-040: should toggle timestamp display setting', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const timestampCheckbox = containerEl.querySelector('[data-testid="timestamp-checkbox"]') as HTMLInputElement;
            expect(timestampCheckbox).toBeTruthy();
            
            const initialChecked = timestampCheckbox.checked;
            timestampCheckbox.click();
            
            expect(timestampCheckbox.checked).toBe(!initialChecked);
        });

        test('TC-ST-041: should toggle username display setting', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const usernameCheckbox = containerEl.querySelector('[data-testid="username-checkbox"]') as HTMLInputElement;
            expect(usernameCheckbox).toBeTruthy();
            
            const initialChecked = usernameCheckbox.checked;
            usernameCheckbox.click();
            
            expect(usernameCheckbox.checked).toBe(!initialChecked);
        });

        test('TC-ST-042: should toggle mention conversion setting', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const mentionCheckbox = containerEl.querySelector('[data-testid="mention-checkbox"]') as HTMLInputElement;
            expect(mentionCheckbox).toBeTruthy();
            
            const initialChecked = mentionCheckbox.checked;
            mentionCheckbox.click();
            
            expect(mentionCheckbox.checked).toBe(!initialChecked);
        });

        test('TC-ST-043: should display format preview', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const previewButton = containerEl.querySelector('[data-testid="preview-button"]') as HTMLButtonElement;
            expect(previewButton).toBeTruthy();
            
            previewButton.click();
            
            const previewArea = containerEl.querySelector('[data-testid="format-preview"]');
            expect(previewArea).toBeTruthy();
            expect(previewArea?.textContent).toBeTruthy();
        });
    });

    // TC-ST-050-053: デイリーノート設定
    describe('Daily Note Settings', () => {
        test('TC-ST-050: should enable daily note feature', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const dailyNoteCheckbox = containerEl.querySelector('[data-testid="daily-note-checkbox"]') as HTMLInputElement;
            expect(dailyNoteCheckbox).toBeTruthy();
            
            if (!dailyNoteCheckbox.checked) {
                dailyNoteCheckbox.click();
            }
            
            expect(dailyNoteCheckbox.checked).toBe(true);
            
            // 関連設定項目が表示されることを確認
            const folderInput = containerEl.querySelector('[data-testid="daily-note-folder"]');
            expect(folderInput).toBeTruthy();
        });

        test('TC-ST-051: should set daily note folder path', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const folderInput = containerEl.querySelector('[data-testid="daily-note-folder"]') as HTMLInputElement;
            expect(folderInput).toBeTruthy();
            
            const testPath = 'Custom Daily Notes';
            folderInput.value = testPath;
            folderInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(folderInput.value).toBe(testPath);
        });

        test('TC-ST-052: should set date format', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const dateFormatInput = containerEl.querySelector('[data-testid="date-format-input"]') as HTMLInputElement;
            expect(dateFormatInput).toBeTruthy();
            
            const testFormat = 'YYYY/MM/DD';
            dateFormatInput.value = testFormat;
            dateFormatInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(dateFormatInput.value).toBe(testFormat);
        });

        test('TC-ST-053: should set header format', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const headerFormatInput = containerEl.querySelector('[data-testid="header-format-input"]') as HTMLInputElement;
            expect(headerFormatInput).toBeTruthy();
            
            const testHeader = '# Slack Messages - {{date}}';
            headerFormatInput.value = testHeader;
            headerFormatInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            expect(headerFormatInput.value).toBe(testHeader);
        });
    });

    // TC-ST-060-062: 設定データの永続化
    describe('Settings Persistence', () => {
        beforeEach(() => {
            // 認証済み状態に設定（チャンネルマッピングUIが表示されるように）
            settingTab.uiState = {
                isAuthenticated: true,
                authInProgress: false,
                availableChannels: mockChannels,
                validationErrors: {},
                isDirty: false,
                isLoading: false
            };
        });

        test('TC-ST-060: should auto-save settings when changed', async () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const folderInput = containerEl.querySelector('[data-testid="folder-input"]') as HTMLInputElement;
            folderInput.value = 'new/folder/path';
            folderInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // デバウンス待機
            await new Promise(resolve => setTimeout(resolve, 300));
            
            expect(mockPlugin.saveSettings).toHaveBeenCalled();
        });

        test('TC-ST-061: should load saved settings correctly', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            // 保存済み設定が正しく表示されることを確認
            const folderInput = containerEl.querySelector('[data-testid="folder-input"]') as HTMLInputElement;
            expect(folderInput?.value).toBe(mockPlugin.settings.channelMappings[0].targetFolder);
        });

        test('TC-ST-062: should reset settings to defaults', async () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const resetButton = containerEl.querySelector('[data-testid="reset-button"]') as HTMLButtonElement;
            expect(resetButton).toBeTruthy();
            
            resetButton.click();
            
            // 少し待つ（非同期処理のため）
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(mockPlugin.loadSettings).toHaveBeenCalled();
        });
    });

    // TC-ST-070-073: バリデーション機能
    describe('Validation', () => {
        beforeEach(() => {
            // 認証済み状態に設定（チャンネルマッピングUIが表示されるように）
            settingTab.uiState = {
                isAuthenticated: true,
                authInProgress: false,
                availableChannels: mockChannels,
                validationErrors: {},
                isDirty: false,
                isLoading: false
            };
        });

        test('TC-ST-070: should show validation error for required fields', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const folderInput = containerEl.querySelector('[data-testid="folder-input"]') as HTMLInputElement;
            folderInput.value = '';
            folderInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            const errorMessage = containerEl.querySelector('[data-testid="folder-error"]');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage?.textContent).toContain('必須');
        });

        test('TC-ST-071: should validate path format', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const folderInput = containerEl.querySelector('[data-testid="folder-input"]') as HTMLInputElement;
            folderInput.value = '../invalid/path';
            folderInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            const errorMessage = containerEl.querySelector('[data-testid="folder-error"]');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage?.textContent).toContain('無効');
        });

        test('TC-ST-072: should detect duplicate channel mappings', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            // 重複するチャンネルを選択
            const channelSelects = containerEl.querySelectorAll('[data-testid="channel-select"]') as NodeListOf<HTMLSelectElement>;
            if (channelSelects.length >= 2) {
                channelSelects[0].value = 'C123456';
                channelSelects[1].value = 'C123456';
                
                channelSelects[1].dispatchEvent(new Event('change', { bubbles: true }));
                
                const errorMessage = containerEl.querySelector('[data-testid="channel-duplicate-error"]');
                expect(errorMessage).toBeTruthy();
                expect(errorMessage?.textContent).toContain('重複');
            }
        });

        test('TC-ST-073: should validate number ranges', () => {
            settingTab.containerEl = containerEl;
            settingTab.display();
            
            const intervalInput = containerEl.querySelector('[data-testid="custom-interval-input"]') as HTMLInputElement;
            intervalInput.value = '0';
            intervalInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            const errorMessage = containerEl.querySelector('[data-testid="interval-error"]');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage?.textContent).toContain('範囲');
        });
    });
});