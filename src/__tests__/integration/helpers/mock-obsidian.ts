// TASK-501: 統合テストスイート - Obsidianモック環境
// REDフェーズ: Obsidian API モック実装

export interface ObsidianFile {
  path: string;
  content: string;
  encoding: string;
  created: Date;
  modified: Date;
}

export interface PluginSettings {
  isAuthenticated: boolean;
  lastAuthTime: Date | null;
  channelMappings: Array<{
    slackChannel: string;
    obsidianPath: string;
    format: string;
  }>;
  autoSyncEnabled: boolean;
  syncInterval: number;
  messageFormat: string;
}

/**
 * Obsidian環境のモック実装
 * ファイルシステム、設定管理、UI要素をシミュレート
 */
export class MockObsidianEnvironment {
  private vaultState: ObsidianVaultState;
  private pluginLifecycle: PluginLifecycleManager;
  private uiStateManager: UIStateManager;
  private files: Map<string, string> = new Map();
  private folders: Set<string> = new Set();
  private pluginSettings: any = {};
  private app: MockObsidianApp;
  private workspace: MockObsidianWorkspace;
  private vault: MockObsidianVault;
  private statusBarItems: MockStatusBarItem[] = [];
  private commands: Array<{ id: string; name: string; callback: Function }> = [];
  private views: Map<string, any> = new Map();

  constructor() {
    this.vaultState = new ObsidianVaultState();
    this.pluginLifecycle = new PluginLifecycleManager();
    this.uiStateManager = new UIStateManager();
    this.app = new MockObsidianApp(this);
    this.workspace = new MockObsidianWorkspace(this);
    this.vault = new MockObsidianVault(this);
    this.initializeDefaultStructure();
  }

  private initializeDefaultStructure(): void {
    // Initialize with basic vault structure
    this.folders.add('');
    this.folders.add('Daily Notes');
    this.folders.add('Templates');
    this.folders.add('Attachments');
    
    // Set default plugin settings
    this.pluginSettings = {
      slackToken: '',
      selectedChannels: [],
      autoSync: false,
      syncInterval: 300000,
      outputFolder: 'Slack Messages'
    };
  }

  async resetToCleanState(): Promise<void> {
    this.files.clear();
    this.folders.clear();
    this.commands.clear();
    this.views.clear();
    this.statusBarItems = [];
    this.pluginSettings = {};
    this.initializeDefaultStructure();
    this.uiStateManager.reset();
  }

  async cleanup(): Promise<void> {
    await this.resetToCleanState();
  }

  // Enhanced Obsidian API Implementation
  async getApp(): Promise<ObsidianApp> {
    return this.app;
  }

  async getVault(): Promise<ObsidianVault> {
    return this.vault;
  }

  async getWorkspace(): Promise<ObsidianWorkspace> {
    return this.workspace;
  }

  // UI Operations with realistic behavior
  async showNotice(message: string): Promise<void> {
    this.uiStateManager.addNotification({
      message,
      type: 'info',
      timestamp: Date.now(),
      duration: 4000
    });
  }

  async createModal(content: string): Promise<ObsidianModal> {
    const modal = new MockObsidianModal(content);
    this.uiStateManager.addModal(modal);
    return modal;
  }

  async addStatusBarItem(): Promise<StatusBarItem> {
    const item = new MockStatusBarItem();
    this.statusBarItems.push(item);
    
    // Simulate realistic UI update cycle
    item.onUpdate((content: string) => {
      this.uiStateManager.updateStatusBar({
        content,
        timestamp: Date.now(),
        visible: true
      });
    });
    
    this.uiStateManager.registerStatusBarItem(item);
    return item;
  }

  // Enhanced File Operations
  async createFile(path: string, content: string): Promise<void> {
    await this.ensureDirectoryExists(this.getParentPath(path));
    
    if (await this.vaultState.exists(path)) {
      throw new Error(`File already exists: ${path}`);
    }
    
    this.files.set(path, content);
    await this.vaultState.createEntry(path, {
      type: 'file',
      created: Date.now(),
      modified: Date.now(),
      size: content.length
    });
    
    await this.notifyVaultListeners('file-created', { path, content });
  }

  async readFile(path: string): Promise<string> {
    if (!await this.vaultState.exists(path)) {
      throw new Error(`File not found: ${path}`);
    }
    
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`Could not read file: ${path}`);
    }
    
    return content;
  }

  async updateFile(path: string, content: string): Promise<void> {
    if (!await this.vaultState.exists(path)) {
      throw new Error(`File not found: ${path}`);
    }
    
    this.files.set(path, content);
    await this.vaultState.updateEntry(path, {
      modified: Date.now(),
      size: content.length
    });
    
    await this.notifyVaultListeners('file-modified', { path, content });
  }

  async deleteFile(path: string): Promise<void> {
    if (!await this.vaultState.exists(path)) {
      throw new Error(`File not found: ${path}`);
    }
    
    this.files.delete(path);
    await this.vaultState.removeEntry(path);
    await this.notifyVaultListeners('file-deleted', { path });
  }

  async createFolder(path: string): Promise<void> {
    if (await this.vaultState.exists(path)) {
      throw new Error(`Folder already exists: ${path}`);
    }
    
    const parentPath = this.getParentPath(path);
    if (parentPath && !await this.vaultState.exists(parentPath)) {
      await this.createFolder(parentPath); // Recursive parent creation
    }
    
    this.folders.add(path);
    await this.vaultState.createEntry(path, {
      type: 'folder',
      created: Date.now()
    });
    
    await this.notifyVaultListeners('folder-created', { path });
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (!await this.vaultState.exists(oldPath)) {
      throw new Error(`File not found: ${oldPath}`);
    }
    
    if (await this.vaultState.exists(newPath)) {
      throw new Error(`Destination already exists: ${newPath}`);
    }
    
    const content = this.files.get(oldPath);
    if (content !== undefined) {
      this.files.delete(oldPath);
      this.files.set(newPath, content);
    }
    
    await this.vaultState.moveEntry(oldPath, newPath);
    await this.notifyVaultListeners('file-renamed', { oldPath, newPath });
  }

  async getFileStats(path: string): Promise<FileStats> {
    const entry = await this.vaultState.getEntry(path);
    if (!entry) {
      throw new Error(`Path not found: ${path}`);
    }
    
    return {
      size: entry.size || 0,
      created: entry.created,
      modified: entry.modified || entry.created,
      type: entry.type
    };
  }

  async listFiles(folderPath: string = ''): Promise<string[]> {
    const files: string[] = [];
    
    for (const [path] of this.files) {
      if (path.startsWith(folderPath)) {
        const relativePath = folderPath ? path.substring(folderPath.length + 1) : path;
        if (!relativePath.includes('/')) {
          files.push(path);
        }
      }
    }
    
    return files.sort();
  }

  async getCreatedFiles(): Promise<string[]> {
    return Array.from(this.files.keys()).sort();
  }

  // Enhanced Plugin Integration
  async addCommand(command: { id: string; name: string; callback: Function }): Promise<void> {
    this.commands.push(command);
    this.pluginLifecycle.notifyCommandRegistered(command);
  }

  async registerView(viewType: string, creator: any): Promise<void> {
    this.views.set(viewType, creator);
    this.pluginLifecycle.notifyViewRegistered(viewType);
  }

  async activateView(viewType: string): Promise<ViewInstance> {
    const creator = this.views.get(viewType);
    if (!creator) {
      throw new Error(`View type not registered: ${viewType}`);
    }
    
    const instance = new MockViewInstance(viewType);
    this.workspace.addActiveView(instance);
    return instance;
  }

  async savePluginSettings(settings: any): Promise<void> {
    this.pluginSettings = { ...this.pluginSettings, ...settings };
    this.pluginLifecycle.notifySettingsSaved(settings);
  }

  async getPluginSettings(): Promise<any> {
    return { ...this.pluginSettings };
  }

  async loadPluginData(): Promise<any> {
    return this.pluginSettings;
  }

  async savePluginData(data: any): Promise<void> {
    await this.savePluginSettings(data);
  }

  // Utility methods
  private getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : '';
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    if (path && !await this.vaultState.exists(path)) {
      await this.createFolder(path);
    }
  }

  private async notifyVaultListeners(event: string, data: any): Promise<void> {
    // Simulate vault event notifications
    console.debug(`Vault event: ${event}`, data);
  }

  // Status and monitoring
  getStatusBarItems(): MockStatusBarItem[] {
    return [...this.statusBarItems];
  }

  getCommands(): Array<{ id: string; name: string; callback: Function }> {
    return [...this.commands];
  }

  getRegisteredViews(): string[] {
    return Array.from(this.views.keys());
  }

  // Test utilities
  simulateUserInteraction(action: string, params: any): Promise<any> {
    return this.uiStateManager.simulateInteraction(action, params);
  }
}

// Enhanced Supporting Classes
class ObsidianVaultState {
  private entries: Map<string, VaultEntry> = new Map();

  async exists(path: string): Promise<boolean> {
    return this.entries.has(path);
  }

  async createEntry(path: string, metadata: Partial<VaultEntry>): Promise<void> {
    this.entries.set(path, {
      type: 'file',
      created: Date.now(),
      ...metadata
    } as VaultEntry);
  }

  async getEntry(path: string): Promise<VaultEntry | undefined> {
    return this.entries.get(path);
  }

  async updateEntry(path: string, updates: Partial<VaultEntry>): Promise<void> {
    const existing = this.entries.get(path);
    if (existing) {
      this.entries.set(path, { ...existing, ...updates });
    }
  }

  async removeEntry(path: string): Promise<void> {
    this.entries.delete(path);
  }

  async moveEntry(oldPath: string, newPath: string): Promise<void> {
    const entry = this.entries.get(oldPath);
    if (entry) {
      this.entries.delete(oldPath);
      this.entries.set(newPath, { ...entry, modified: Date.now() });
    }
  }
}

interface VaultEntry {
  type: 'file' | 'folder';
  created: number;
  modified?: number;
  size?: number;
}

class PluginLifecycleManager {
  private commands: Set<string> = new Set();
  private views: Set<string> = new Set();
  private settingsHistory: any[] = [];

  notifyCommandRegistered(command: { id: string; name: string; callback: Function }): void {
    this.commands.add(command.id);
  }

  notifyViewRegistered(viewType: string): void {
    this.views.add(viewType);
  }

  notifySettingsSaved(settings: any): void {
    this.settingsHistory.push({
      timestamp: Date.now(),
      settings: { ...settings }
    });
  }

  getRegisteredCommands(): string[] {
    return Array.from(this.commands);
  }

  getRegisteredViews(): string[] {
    return Array.from(this.views);
  }

  getSettingsHistory(): any[] {
    return [...this.settingsHistory];
  }
}

class UIStateManager {
  private notifications: Notification[] = [];
  private modals: MockObsidianModal[] = [];
  private statusBarState: StatusBarState = {
    content: '',
    timestamp: 0,
    visible: false
  };
  private statusBarItems: MockStatusBarItem[] = [];

  addNotification(notification: Notification): void {
    this.notifications.push(notification);
    
    // Auto-remove after duration
    if (notification.duration) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, notification.duration);
    }
  }

  removeNotification(notification: Notification): void {
    const index = this.notifications.indexOf(notification);
    if (index >= 0) {
      this.notifications.splice(index, 1);
    }
  }

  addModal(modal: MockObsidianModal): void {
    this.modals.push(modal);
  }

  removeModal(modal: MockObsidianModal): void {
    const index = this.modals.indexOf(modal);
    if (index >= 0) {
      this.modals.splice(index, 1);
    }
  }

  updateStatusBar(state: Partial<StatusBarState>): void {
    this.statusBarState = { ...this.statusBarState, ...state };
  }

  registerStatusBarItem(item: MockStatusBarItem): void {
    this.statusBarItems.push(item);
  }

  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  getModals(): MockObsidianModal[] {
    return [...this.modals];
  }

  getStatusBarState(): StatusBarState {
    return { ...this.statusBarState };
  }

  async simulateInteraction(action: string, params: any): Promise<any> {
    switch (action) {
      case 'click-status-bar':
        return this.simulateStatusBarClick();
      case 'open-command-palette':
        return this.simulateCommandPaletteOpen();
      case 'close-modal':
        return this.simulateModalClose(params.modalId);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private simulateStatusBarClick(): any {
    return { action: 'status-bar-clicked', timestamp: Date.now() };
  }

  private simulateCommandPaletteOpen(): any {
    return { action: 'command-palette-opened', timestamp: Date.now() };
  }

  private simulateModalClose(modalId: string): any {
    return { action: 'modal-closed', modalId, timestamp: Date.now() };
  }

  reset(): void {
    this.notifications = [];
    this.modals = [];
    this.statusBarItems = [];
    this.statusBarState = {
      content: '',
      timestamp: 0,
      visible: false
    };
  }
}

interface Notification {
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: number;
  duration?: number;
}

interface StatusBarState {
  content: string;
  timestamp: number;
  visible: boolean;
}

interface FileStats {
  size: number;
  created: number;
  modified: number;
  type: string;
}

// Mock Obsidian API Classes
class MockObsidianApp {
  constructor(private env: MockObsidianEnvironment) {}

  get vault() {
    return this.env.getVault();
  }

  get workspace() {
    return this.env.getWorkspace();
  }
}

class MockObsidianVault {
  constructor(private env: MockObsidianEnvironment) {}

  async create(path: string, content: string): Promise<any> {
    await this.env.createFile(path, content);
    return { path, stat: { size: content.length } };
  }

  async read(path: string): Promise<string> {
    return await this.env.readFile(path);
  }

  async modify(path: string, content: string): Promise<void> {
    await this.env.updateFile(path, content);
  }

  async delete(path: string): Promise<void> {
    await this.env.deleteFile(path);
  }
}

class MockObsidianWorkspace {
  private activeViews: ViewInstance[] = [];

  constructor(private env: MockObsidianEnvironment) {}

  addActiveView(view: ViewInstance): void {
    this.activeViews.push(view);
  }

  getActiveViews(): ViewInstance[] {
    return [...this.activeViews];
  }
}

class MockObsidianModal {
  private content: string;
  private isOpen: boolean = true;

  constructor(content: string) {
    this.content = content;
  }

  getContent(): string {
    return this.content;
  }

  setContent(content: string): void {
    this.content = content;
  }

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  isModalOpen(): boolean {
    return this.isOpen;
  }
}

class MockStatusBarItem {
  private content: string = '';
  private updateCallback?: (content: string) => void;

  setText(text: string): void {
    this.content = text;
    if (this.updateCallback) {
      this.updateCallback(text);
    }
  }

  getText(): string {
    return this.content;
  }

  onUpdate(callback: (content: string) => void): void {
    this.updateCallback = callback;
  }

  remove(): void {
    this.content = '';
    this.updateCallback = undefined;
  }
}

class MockViewInstance {
  private viewType: string;
  private isActive: boolean = true;

  constructor(viewType: string) {
    this.viewType = viewType;
  }

  getViewType(): string {
    return this.viewType;
  }

  isViewActive(): boolean {
    return this.isActive;
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }
}

// Type definitions for external interfaces
interface ObsidianApp extends MockObsidianApp {}
interface ObsidianVault extends MockObsidianVault {}
interface ObsidianWorkspace extends MockObsidianWorkspace {}
interface ObsidianModal extends MockObsidianModal {}
interface StatusBarItem extends MockStatusBarItem {}
interface ViewInstance extends MockViewInstance {}
