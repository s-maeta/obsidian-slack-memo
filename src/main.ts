import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { SlackAuthManager } from './slack-auth';
import { SlackAPIClient } from './slack-api-client';
import { MarkdownConverter } from './markdown-converter';
import { isError } from './types';

// Slack Sync Plugin Interfaces
interface SlackSyncSettings {
  slackToken: string;
  defaultChannels: string[];
  syncInterval: number;
  notificationLevel: 'all' | 'errors' | 'none';
  autoSync: boolean;
  channelMappings: any[];
  dailyNoteSettings: any;
  messageFormat: any;
  syncHistory?: {
    lastSyncTime: string | null;
    totalMessagesSynced: number;
    channelLastSync: Record<string, string>;
  };
  storageSettings?: {
    baseFolder: string;
    organizationType: string;
    dailyPageSettings: any;
    channelPageSettings: any;
  };
}

const DEFAULT_SETTINGS: SlackSyncSettings = {
  slackToken: '',
  defaultChannels: [],
  syncInterval: 300000, // 5分
  notificationLevel: 'all',
  autoSync: false,
  channelMappings: [],
  dailyNoteSettings: {},
  messageFormat: {},
  syncHistory: {
    lastSyncTime: null,
    totalMessagesSynced: 0,
    channelLastSync: {}
  },
  storageSettings: {
    baseFolder: 'Slack Sync',
    organizationType: 'daily',
    dailyPageSettings: {},
    channelPageSettings: {}
  }
};

export default class SlackSyncPlugin extends Plugin {
  settings: SlackSyncSettings;
  private authManager: SlackAuthManager;
  private apiClient: SlackAPIClient;
  private markdownConverter: MarkdownConverter;
  private autoSyncInterval: NodeJS.Timeout | null = null;

  async onload() {
    await this.loadSettings();
    
    // Initialize core components
    await this.initializeComponents();

    // Slack同期アイコンをリボンに追加
    const ribbonIconEl = this.addRibbonIcon('sync', 'Slack同期', () => {
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
    // 自動同期のクリーンアップ処理
    this.stopAutoSync();
  }

  async loadSettings() {
    // レガシー設定システム用（下位互換性のため）
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    // レガシー設定システム用（下位互換性のため）
    await this.saveData(this.settings);
  }

  // Initialize core components
  private async initializeComponents(): Promise<void> {
    this.authManager = new SlackAuthManager(this);
    this.apiClient = new SlackAPIClient(this.authManager);
    this.markdownConverter = new MarkdownConverter({
      convertMentions: true,
      convertLinks: true,
      convertEmojis: true,
    });

    // 自動同期が有効な場合は起動時に開始
    if (this.settings.slackToken && this.settings.autoSync) {
      await this.startAutoSync();
    }
  }

  // コマンド実装: 手動同期を実行
  private async startManualSync(): Promise<void> {
    new Notice('Slack同期を開始します...');

    try {
      if (!this.settings.slackToken) {
        new Notice('Slackトークンが設定されていません。設定画面で設定してください。', 5000);
        this.openSettings();
        return;
      }

      // トークンの有効性を最初にテスト
      new Notice('Slackトークンを検証しています...');
      const token = await this.authManager.getDecryptedToken();
      if (token) {
        const validation = await this.authManager.validateToken(token);
        if (isError(validation)) {
          new Notice('Slackトークンが無効です。設定を確認してください。', 5000);
          console.error('Token validation failed:', validation.error);
          return;
        }
        new Notice('トークン検証成功。チャンネル一覧を取得しています...');
      }

      // Get channels list
      const channelsResult = await this.apiClient.listChannels({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });

      if (isError(channelsResult)) {
        throw channelsResult.error;
      }

      const channels = channelsResult.value;
      console.log(`Found ${channels.length} channels:`, channels.map(c => ({ name: c.name, id: c.id, is_member: c.is_member })));
      
      let totalMessages = 0;

      // Process each channel
      for (const channel of channels) {
        console.log(`Processing channel: ${channel.name} (${channel.id}), is_member: ${channel.is_member}`);
        
        // メンバーでない場合は参加を試みる
        if (!channel.is_member) {
          console.log(`Attempting to join channel ${channel.name}...`);
          try {
            const joinResult = await this.apiClient.joinChannel(channel.id);
            if (isError(joinResult)) {
              console.warn(`Failed to join channel ${channel.name}: ${joinResult.error.message}`);
              console.log(`Skipping channel ${channel.name} - could not join`);
              continue;
            } else {
              console.log(`✓ Successfully joined channel ${channel.name}`);
              new Notice(`チャンネル ${channel.name} に参加しました`);
            }
          } catch (error) {
            console.warn(`Error joining channel ${channel.name}:`, error);
            continue;
          }
        }
        
        // チャンネル同期を実行
        try {
          const messageCount = await this.syncChannel(channel.id, channel.name || channel.id);
          console.log(`Channel ${channel.name} processed ${messageCount} messages`);
          totalMessages += messageCount;
        } catch (error) {
          console.error(`Error syncing channel ${channel.name}:`, error);
          new Notice(`チャンネル ${channel.name} の同期でエラー: ${error.message}`, 3000);
        }
      }

      // Update global sync statistics
      const completedAt = new Date().toISOString();
      console.log(`Sync completed at: ${completedAt}`);
      
      // Display completion notice with sync statistics
      const lastSyncInfo = this.settings.syncHistory?.lastSyncTime 
        ? ` (前回同期: ${new Date(this.settings.syncHistory.lastSyncTime).toLocaleString()})`
        : '';
      
      new Notice(`Slack同期が完了しました！ ${totalMessages} メッセージを処理しました${lastSyncInfo}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`同期エラー: ${errorMessage}`, 5000);
      console.error('Slack sync error:', error);
    }
  }

  // チャンネル別・日付別にメッセージをファイルに保存
  private async saveMessageToFile(channelName: string, messageContent: string): Promise<void> {
    const baseFolder = this.settings.storageSettings?.baseFolder || 'Slack Sync';
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 新しいフォルダ構成: {baseFolder}/{channelName}/{date}.md
    const channelFolder = `${baseFolder}/${channelName}`;
    const filePath = `${channelFolder}/${today}.md`;
    
    // チャンネルフォルダを作成（存在しない場合）
    const folder = this.app.vault.getAbstractFileByPath(channelFolder);
    if (!folder) {
      console.log(`Creating channel folder: ${channelFolder}`);
      await this.app.vault.createFolder(channelFolder);
    }
    
    // ファイルが存在するかチェック
    const file = this.app.vault.getAbstractFileByPath(filePath);
    let content = '';
    
    if (file && file instanceof TFile) {
      content = await this.app.vault.read(file);
    } else {
      // 新しいファイルのヘッダーを作成（タグ付き）
      content = `# ${channelName} - ${today}\n\n`;
      content += `Tags: #slack-sync/${channelName}/${today}\n\n`;
    }
    
    // メッセージを追加
    content += `${messageContent}\n\n`;
    
    // ファイルを作成または更新
    if (file && file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
    
    console.log(`Saved to: ${filePath} with tag: #slack-sync/${channelName}/${today}`);
  }

  // チャンネル同期処理
  private async syncChannel(channelId: string, channelName: string): Promise<number> {
    console.log(`Starting sync for channel: ${channelName} (${channelId})`);
    
    // 最終同期時刻を取得（チャンネル別または全体の最終同期時刻）
    const channelLastSync = this.settings.syncHistory?.channelLastSync?.[channelId];
    const globalLastSync = this.settings.syncHistory?.lastSyncTime;
    
    let lastSyncTime: string;
    let lastSyncDate: Date;
    
    if (channelLastSync) {
      // チャンネル別の最終同期時刻がある場合
      lastSyncDate = new Date(channelLastSync);
      lastSyncTime = (lastSyncDate.getTime() / 1000).toString();
      console.log(`Using channel-specific last sync: ${lastSyncDate.toISOString()}`);
    } else if (globalLastSync) {
      // グローバルの最終同期時刻がある場合
      lastSyncDate = new Date(globalLastSync);
      lastSyncTime = (lastSyncDate.getTime() / 1000).toString();
      console.log(`Using global last sync: ${lastSyncDate.toISOString()}`);
    } else {
      // 初回同期の場合：過去24時間分を取得
      lastSyncDate = new Date();
      lastSyncDate.setHours(lastSyncDate.getHours() - 24);
      lastSyncTime = (lastSyncDate.getTime() / 1000).toString();
      console.log(`First sync for channel: fetching messages since ${lastSyncDate.toISOString()}`);
    }
    
    console.log(`Fetching messages since: ${lastSyncDate.toISOString()} (timestamp: ${lastSyncTime})`);
    
    // Get channel history
    const historyOptions: any = {
      limit: 100
    };
    
    // Get messages after last sync time
    historyOptions.oldest = lastSyncTime;

    const historyResult = await this.apiClient.getChannelHistory(channelId, historyOptions);
    
    if (isError(historyResult)) {
      throw historyResult.error;
    }

    const messages = historyResult.value;
    console.log(`Found ${messages.length} messages in channel ${channelName}`);
    
    let processedCount = 0;

    // Process each message
    for (const message of messages) {
      const messageTime = parseFloat(message.ts) * 1000; // Slackのタイムスタンプはsecond、JavaScriptはmillisecond
      const messageDate = new Date(messageTime);
      
      console.log(`Processing message: ${message.ts}, time: ${messageDate.toISOString()}, text: ${message.text?.substring(0, 50)}..., subtype: ${message.subtype}, user: ${message.user}`);
      
      // 重複チェック: メッセージが最終同期時刻より古い場合はスキップ
      if (messageTime <= lastSyncDate.getTime()) {
        console.log(`Skipping message ${message.ts} - already synced (${messageDate.toISOString()} <= ${lastSyncDate.toISOString()})`);
        continue;
      }
      
      // テスト用: より多くのメッセージタイプを処理する
      if (message.text) { // subtypeの条件を一時的に削除してテスト
        try {
          // Convert message to markdown
          const conversionResult = await this.markdownConverter.convertMessage(message, channelId);
          
          // Format the message content
          const messageContent = await this.formatMessageContent(message, channelName, conversionResult.markdown);
          
          // Save the message - テスト用に実際にファイルに保存
          try {
            await this.saveMessageToFile(channelName, messageContent);
            console.log(`✓ Saved message from ${channelName}: ${messageContent.substring(0, 100)}...`);
            processedCount++;
          } catch (saveError) {
            console.error(`Failed to save message to file:`, saveError);
          }
        } catch (error) {
          console.warn(`Failed to process message ${message.ts} in channel ${channelName}:`, error);
        }
      }
    }

    // Update channel sync history
    const currentTime = new Date().toISOString();
    
    // 同期履歴の初期化（設定が存在しない場合）
    if (!this.settings.syncHistory) {
      this.settings.syncHistory = {
        lastSyncTime: null,
        totalMessagesSynced: 0,
        channelLastSync: {}
      };
    }
    
    // チャンネル別の最終同期時刻を更新
    if (!this.settings.syncHistory.channelLastSync) {
      this.settings.syncHistory.channelLastSync = {};
    }
    this.settings.syncHistory.channelLastSync[channelId] = currentTime;
    
    // グローバルの最終同期時刻を更新
    this.settings.syncHistory.lastSyncTime = currentTime;
    
    // 同期されたメッセージ数を累計
    this.settings.syncHistory.totalMessagesSynced += processedCount;
    
    // 設定を保存
    await this.saveSettings();
    
    console.log(`Channel ${channelName} sync completed: ${processedCount} messages (Last sync: ${currentTime})`);

    return processedCount;
  }

  // Format message content for display
  private async formatMessageContent(message: any, channelName: string, markdownText: string): Promise<string> {
    const timestamp = new Date(parseFloat(message.ts) * 1000);
    const timeString = timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const userName = message.user ? `@${message.user}` : '';
    
    // Build the formatted content
    const metadata = [timeString, userName].filter(Boolean).join(' ');
    const content = `**${metadata}**\n\n${markdownText}`;
    
    return content;
  }

  // コマンド実装: 特定チャンネル同期モーダルを開く
  private openChannelSyncModal(): void {
    new ChannelSyncModal(
      this.app,
      this.settings.defaultChannels,
      async (selectedChannel: string) => {
        await this.syncSpecificChannel(selectedChannel);
      }
    ).open();
  }

  // 特定チャンネルの同期処理
  private async syncSpecificChannel(channelName: string): Promise<void> {
    new Notice(`チャンネル "${channelName}" を同期します...`);

    try {
      if (!this.settings.slackToken) {
        new Notice('Slackトークンが設定されていません。設定画面で設定してください。', 5000);
        this.openSettings();
        return;
      }

      // Find channel by name
      const channelsResult = await this.apiClient.listChannels({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });

      if (isError(channelsResult)) {
        throw channelsResult.error;
      }

      const channel = channelsResult.value.find(ch => 
        ch.name === channelName.replace('#', '') || ch.id === channelName
      );

      if (!channel) {
        new Notice(`チャンネル "${channelName}" が見つかりませんでした。`, 3000);
        return;
      }

      if (!channel.is_member) {
        new Notice(`チャンネル "${channelName}" のメンバーではありません。`, 3000);
        return;
      }

      const messageCount = await this.syncChannel(channel.id, channel.name || channel.id);
      new Notice(`チャンネル "${channelName}" の同期が完了しました！${messageCount} メッセージを処理しました。`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`チャンネル同期エラー: ${errorMessage}`, 5000);
      console.error('Channel sync error:', error);
    }
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
    const status = this.autoSyncInterval ? '自動同期中' : '待機中';
    const lastSync = '未実行'; // 簡略化

    new Notice(`同期状態: ${status}\n最終同期: ${lastSync}`);
  }

  // コマンド実装: 自動同期のオン/オフ
  private async toggleAutoSync(): Promise<void> {
    this.settings.autoSync = !this.settings.autoSync;
    await this.saveSettings();

    const status = this.settings.autoSync ? 'オン' : 'オフ';
    new Notice(`自動同期を${status}にしました`);

    if (this.settings.autoSync) {
      await this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  // 自動同期の開始
  private async startAutoSync(): Promise<void> {
    if (!this.settings.slackToken) {
      new Notice('Slackトークンが設定されていません。自動同期を開始できません。', 5000);
      return;
    }

    this.stopAutoSync(); // 既存のタイマーをクリア

    const intervalMs = this.settings.syncInterval; // ミリ秒
    
    this.autoSyncInterval = setInterval(async () => {
      try {
        console.log('Auto sync started');
        await this.performBackgroundSync();
      } catch (error) {
        console.error('Auto sync error:', error);
        new Notice('自動同期でエラーが発生しました。ログを確認してください。', 3000);
      }
    }, intervalMs);

    new Notice(`自動同期を開始しました（${this.settings.syncInterval / 60000}分間隔）`);
  }

  // 自動同期の停止
  private stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  // バックグラウンド同期処理（通知を最小限に）
  private async performBackgroundSync(): Promise<void> {
    if (!this.settings.slackToken) {
      return;
    }

    try {
      // Get channels list
      const channelsResult = await this.apiClient.listChannels({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });

      if (isError(channelsResult)) {
        throw channelsResult.error;
      }

      const channels = channelsResult.value;
      let totalMessages = 0;

      // Process each channel (limit to reduce load)
      const memberChannels = channels.filter(ch => ch.is_member).slice(0, 10); // 最大10チャンネル
      
      for (const channel of memberChannels) {
        try {
          const messageCount = await this.syncChannel(channel.id, channel.name || channel.id);
          totalMessages += messageCount;
        } catch (error) {
          console.warn(`Background sync error for channel ${channel.name}:`, error);
        }
      }

      // Update sync history (simplified)
      console.log(`Sync completed at: ${new Date().toISOString()}`);
      
      // Only show notification if messages were found
      if (totalMessages > 0) {
        new Notice(`自動同期完了: ${totalMessages} 新着メッセージ`, 2000);
      }
      
      console.log(`Background sync completed: ${totalMessages} messages processed`);
    } catch (error) {
      console.error('Background sync error:', error);
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
        cls: 'no-channels-message',
      });
    } else {
      this.channels.forEach(channel => {
        const channelEl = channelList.createEl('div', {
          cls: 'channel-item',
          text: `# ${channel}`,
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
      cls: 'channel-input',
    });

    const submitBtn = manualSection.createEl('button', {
      text: '同期実行',
      cls: 'mod-cta',
    });

    submitBtn.addEventListener('click', () => {
      const channelName = inputEl.value.trim();
      if (channelName) {
        this.onSubmit(channelName);
        this.close();
      }
    });

    // Enterキーでも実行
    inputEl.addEventListener('keypress', e => {
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
        const historyItem = historyContainer.createEl('div', {
          cls: `history-item ${item.status}`,
        });

        const statusIcon = item.status === 'success' ? '✅' : '❌';
        historyItem.createEl('span', {
          text: `${statusIcon} ${item.time}`,
          cls: 'history-time',
        });

        historyItem.createEl('span', {
          text: `# ${item.channel}`,
          cls: 'history-channel',
        });

        historyItem.createEl('span', {
          text: `${item.messages} メッセージ`,
          cls: 'history-messages',
        });
      });
    }

    // 閉じるボタン
    const closeBtn = contentEl.createEl('button', {
      text: '閉じる',
      cls: 'mod-cta',
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
          .setValue(this.plugin.settings.slackToken || '')
          .onChange(async value => {
            try {
              console.log('Setting Slack token, length:', value.length);
              this.plugin.settings.slackToken = value;
              await this.plugin.saveSettings();
              console.log('Token saved successfully');
              new Notice('Slackトークンが保存されました', 2000);
            } catch (error) {
              console.error('Error saving token:', error);
              new Notice('トークンの保存に失敗しました', 3000);
            }
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
          .onChange(async value => {
            this.plugin.settings.defaultChannels = value
              .split(',')
              .map(ch => ch.trim())
              .filter(ch => ch.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // ベースフォルダ設定
    new Setting(containerEl)
      .setName('保存先フォルダ')
      .setDesc('Slackメッセージの保存先フォルダ名を設定してください')
      .addText(text => {
        const currentBaseFolder = this.plugin.settings.storageSettings?.baseFolder || 'Slack Sync';
        text
          .setPlaceholder('例: Slack Sync, My Slack Messages')
          .setValue(currentBaseFolder)
          .onChange(async value => {
            // 設定の初期化（必要な場合）
            if (!this.plugin.settings.storageSettings) {
              this.plugin.settings.storageSettings = {
                baseFolder: 'Slack Sync',
                organizationType: 'channel-daily',
                dailyPageSettings: {},
                channelPageSettings: {}
              };
            }
            
            // 空文字列の場合はデフォルト値を使用
            const folderName = value.trim() || 'Slack Sync';
            this.plugin.settings.storageSettings.baseFolder = folderName;
            
            await this.plugin.saveSettings();
            new Notice(`保存先フォルダを「${folderName}」に変更しました`, 2000);
          });
      });

    // 同期間隔設定
    new Setting(containerEl)
      .setName('自動同期間隔')
      .setDesc('自動同期を行う間隔を分単位で設定してください')
      .addSlider(slider =>
        slider
          .setLimits(1, 60, 1)
          .setValue(this.plugin.settings.syncInterval / 60000)
          .setDynamicTooltip()
          .onChange(async value => {
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
          .onChange(async value => {
            this.plugin.settings.notificationLevel = value as 'all' | 'errors' | 'none';
            await this.plugin.saveSettings();
          })
      );

    // 自動同期有効/無効
    new Setting(containerEl)
      .setName('自動同期')
      .setDesc('バックグラウンドでの自動同期を有効にする')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async value => {
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
