import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from 'obsidian';

// Slack Sync Plugin Interfaces
interface SlackSyncSettings {
  slackToken: string;
  defaultChannels: string[];
  syncInterval: number;
  notificationLevel: 'all' | 'errors' | 'none';
  autoSync: boolean;
}

const DEFAULT_SETTINGS: SlackSyncSettings = {
  slackToken: '',
  defaultChannels: [],
  syncInterval: 300000, // 5分
  notificationLevel: 'all',
  autoSync: false,
};

export default class SlackSyncPlugin extends Plugin {
  settings: SlackSyncSettings;

  async onload() {
    await this.loadSettings();

    // Slack同期アイコンをリボンに追加
    const ribbonIconEl = this.addRibbonIcon('sync', 'Slack同期', (evt: MouseEvent) => {
      this.startManualSync();
    });
    ribbonIconEl.addClass('slack-sync-ribbon-class');

    // ステータスバーアイテムを追加
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('Slack同期: 待機中');
    statusBarItemEl.addClass('slack-sync-status-bar');

    // コマンドパレット統合: 手動同期コマンド（Ctrl+Shift+S）
    this.addCommand({
      id: 'manual-sync',
      name: 'Slack: 手動同期を実行',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 's' }],
      callback: () => {
        this.startManualSync();
      },
    });

    // コマンドパレット統合: 特定チャンネル同期コマンド（Ctrl+Shift+C）
    this.addCommand({
      id: 'sync-specific-channel',
      name: 'Slack: 特定チャンネルを同期',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'c' }],
      callback: () => {
        this.openChannelSyncModal();
      },
    });

    // コマンドパレット統合: 同期履歴表示コマンド（Ctrl+Shift+H）
    this.addCommand({
      id: 'show-sync-history',
      name: 'Slack: 同期履歴を表示',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'h' }],
      callback: () => {
        this.showSyncHistory();
      },
    });

    // コマンドパレット統合: 設定画面を開くコマンド（Ctrl+Shift+P）
    this.addCommand({
      id: 'open-settings',
      name: 'Slack: 設定画面を開く',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'p' }],
      callback: () => {
        this.openSettings();
      },
    });

    // コマンドパレット統合: 同期状態確認コマンド（Ctrl+Shift+I）
    this.addCommand({
      id: 'check-sync-status',
      name: 'Slack: 同期状態を確認',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          this.checkSyncStatus();
        }
        return true;
      },
    });

    // コマンドパレット統合: 自動同期の開始/停止（Ctrl+Shift+A）
    this.addCommand({
      id: 'toggle-auto-sync',
      name: 'Slack: 自動同期のオン/オフ',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
      callback: () => {
        this.toggleAutoSync();
      },
    });

    // 設定タブを追加
    this.addSettingTab(new SlackSyncSettingTab(this.app, this));
  }

  onunload() {
    // 自動同期のクリーンアップ処理があればここに追加
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // コマンド実装: 手動同期を実行
  private async startManualSync(): Promise<void> {
    new Notice('Slack同期を開始します...');
    
    try {
      if (!this.settings.slackToken) {
        new Notice('SlackトークンがNeed設定されていません。設定画面で設定してください。', 5000);
        this.openSettings();
        return;
      }

      // TODO: 実際の同期処理をここに実装
      // - SyncStatusManager を使用した状態管理
      // - SlackClient を使用したデータ取得
      // - Obsidian vault への保存
      
      new Notice('Slack同期が完了しました！');
    } catch (error) {
      new Notice(`同期エラー: ${error.message}`, 5000);
      console.error('Slack sync error:', error);
    }
  }

  // コマンド実装: 特定チャンネル同期モーダルを開く
  private openChannelSyncModal(): void {
    new ChannelSyncModal(this.app, this.settings.defaultChannels, async (selectedChannel: string) => {
      new Notice(`チャンネル "${selectedChannel}" を同期します...`);
      
      try {
        // TODO: 特定チャンネルの同期処理を実装
        new Notice(`チャンネル "${selectedChannel}" の同期が完了しました！`);
      } catch (error) {
        new Notice(`チャンネル同期エラー: ${error.message}`, 5000);
      }
    }).open();
  }

  // コマンド実装: 同期履歴を表示
  private showSyncHistory(): void {
    new SyncHistoryModal(this.app).open();
  }

  // コマンド実装: 設定画面を開く
  private openSettings(): void {
    // Obsidian の設定画面でこのプラグインの設定タブを開く
    // @ts-ignore - Obsidian APIの型定義が不完全な場合があるため
    this.app.setting?.open?.();
    // @ts-ignore - Obsidian APIの型定義が不完全な場合があるため
    this.app.setting?.openTabById?.(this.manifest.id);
    
    // 代替案: 通知でユーザーに案内
    new Notice('設定 → Community plugins → Slack Sync で設定を変更してください');
  }

  // コマンド実装: 同期状態を確認
  private checkSyncStatus(): void {
    // TODO: 実際の同期状態を確認
    const status = '待機中'; // SyncStatusManager から取得
    const lastSync = '未実行'; // 最後の同期時刻を取得
    
    new Notice(`同期状態: ${status}\n最終同期: ${lastSync}`);
  }

  // コマンド実装: 自動同期のオン/オフ
  private async toggleAutoSync(): Promise<void> {
    this.settings.autoSync = !this.settings.autoSync;
    await this.saveSettings();
    
    const status = this.settings.autoSync ? 'オン' : 'オフ';
    new Notice(`自動同期を${status}にしました`);

    if (this.settings.autoSync) {
      // TODO: 自動同期のスケジューリング開始
    } else {
      // TODO: 自動同期のスケジューリング停止
    }
  }
}

// チャンネル選択モーダル
class ChannelSyncModal extends Modal {
  channels: string[];
  onSubmit: (selectedChannel: string) => void;

  constructor(app: App, channels: string[], onSubmit: (selectedChannel: string) => void) {
    super(app);
    this.channels = channels;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'チャンネルを選択してください' });

    // チャンネル一覧を表示
    const channelList = contentEl.createEl('div', { cls: 'channel-list' });
    
    if (this.channels.length === 0) {
      channelList.createEl('p', { 
        text: '設定でデフォルトチャンネルを指定してください。', 
        cls: 'no-channels-message' 
      });
    } else {
      this.channels.forEach(channel => {
        const channelEl = channelList.createEl('div', { 
          cls: 'channel-item',
          text: `# ${channel}`
        });
        
        channelEl.addEventListener('click', () => {
          this.onSubmit(channel);
          this.close();
        });
      });
    }

    // 手動入力オプション
    const manualSection = contentEl.createEl('div', { cls: 'manual-input' });
    manualSection.createEl('h3', { text: 'または手動入力:' });
    
    const inputEl = manualSection.createEl('input', { 
      type: 'text',
      placeholder: 'チャンネル名を入力 (例: general)',
      cls: 'channel-input'
    });

    const submitBtn = manualSection.createEl('button', { 
      text: '同期実行',
      cls: 'mod-cta'
    });

    submitBtn.addEventListener('click', () => {
      const channelName = inputEl.value.trim();
      if (channelName) {
        this.onSubmit(channelName);
        this.close();
      }
    });

    // Enterキーでも実行
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 同期履歴モーダル
class SyncHistoryModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Slack同期履歴' });

    // TODO: 実際の履歴データを取得して表示
    const historyContainer = contentEl.createEl('div', { cls: 'sync-history' });
    
    // モックデータで表示例
    const mockHistory = [
      { time: '2025-01-11 14:30', status: 'success', channel: 'general', messages: 15 },
      { time: '2025-01-11 14:00', status: 'success', channel: 'random', messages: 8 },
      { time: '2025-01-11 13:30', status: 'error', channel: 'dev', messages: 0 },
    ];

    if (mockHistory.length === 0) {
      historyContainer.createEl('p', { text: '同期履歴がありません。' });
    } else {
      mockHistory.forEach(item => {
        const historyItem = historyContainer.createEl('div', { cls: `history-item ${item.status}` });
        
        const statusIcon = item.status === 'success' ? '✅' : '❌';
        historyItem.createEl('span', { 
          text: `${statusIcon} ${item.time}`,
          cls: 'history-time'
        });
        
        historyItem.createEl('span', { 
          text: `# ${item.channel}`,
          cls: 'history-channel'
        });
        
        historyItem.createEl('span', { 
          text: `${item.messages} メッセージ`,
          cls: 'history-messages'
        });
      });
    }

    // 閉じるボタン
    const closeBtn = contentEl.createEl('button', { 
      text: '閉じる',
      cls: 'mod-cta'
    });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Slack同期設定タブ
class SlackSyncSettingTab extends PluginSettingTab {
  plugin: SlackSyncPlugin;

  constructor(app: App, plugin: SlackSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Slack同期設定' });

    // Slackトークン設定
    new Setting(containerEl)
      .setName('Slackトークン')
      .setDesc('SlackアプリのBot User OAuth Tokenを入力してください')
      .addText(text =>
        text
          .setPlaceholder('xoxb-your-token-here')
          .setValue(this.plugin.settings.slackToken)
          .onChange(async (value) => {
            this.plugin.settings.slackToken = value;
            await this.plugin.saveSettings();
          })
      );

    // デフォルトチャンネル設定
    new Setting(containerEl)
      .setName('デフォルトチャンネル')
      .setDesc('同期するチャンネルをカンマ区切りで入力してください（例: general,random,dev）')
      .addText(text =>
        text
          .setPlaceholder('general,random,dev')
          .setValue(this.plugin.settings.defaultChannels.join(','))
          .onChange(async (value) => {
            this.plugin.settings.defaultChannels = value
              .split(',')
              .map(ch => ch.trim())
              .filter(ch => ch.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // 同期間隔設定
    new Setting(containerEl)
      .setName('自動同期間隔')
      .setDesc('自動同期を行う間隔を分単位で設定してください')
      .addSlider(slider =>
        slider
          .setLimits(1, 60, 1)
          .setValue(this.plugin.settings.syncInterval / 60000)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncInterval = value * 60000;
            await this.plugin.saveSettings();
          })
      );

    // 通知レベル設定
    new Setting(containerEl)
      .setName('通知レベル')
      .setDesc('表示する通知のレベルを選択してください')
      .addDropdown(dropdown =>
        dropdown
          .addOption('all', 'すべて')
          .addOption('errors', 'エラーのみ')
          .addOption('none', 'なし')
          .setValue(this.plugin.settings.notificationLevel)
          .onChange(async (value) => {
            this.plugin.settings.notificationLevel = value as 'all' | 'errors' | 'none';
            await this.plugin.saveSettings();
          })
      );

    // 自動同期有効/無効
    new Setting(containerEl)
      .setName('自動同期')
      .setDesc('バックグラウンドでの自動同期を有効にする')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.autoSync)
          .onChange(async (value) => {
            this.plugin.settings.autoSync = value;
            await this.plugin.saveSettings();

            if (value) {
              new Notice('自動同期を有効にしました');
            } else {
              new Notice('自動同期を無効にしました');
            }
          })
      );
  }
}
