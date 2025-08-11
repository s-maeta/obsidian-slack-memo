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
  private files: Map<string, ObsidianFile> = new Map();
  private secureData: Map<string, string> = new Map();
  private pluginSettings: PluginSettings;
  private isClean: boolean = true;
  private plugin: any = null;
  private writePermissionErrors: Set<string> = new Set();
  private diskFullSimulation: boolean = false;
  private corruptedFiles: Set<string> = new Set();

  constructor() {
    this.pluginSettings = {
      isAuthenticated: false,
      lastAuthTime: null,
      channelMappings: [],
      autoSyncEnabled: false,
      syncInterval: 300000, // 5分
      messageFormat: '{{timestamp}} - {{author}}: {{content}}'
    };
  }

  // State Management
  async resetToCleanState(): Promise<void> {
    this.files.clear();
    this.secureData.clear();
    this.pluginSettings = {
      isAuthenticated: false,
      lastAuthTime: null,
      channelMappings: [],
      autoSyncEnabled: false,
      syncInterval: 300000,
      messageFormat: '{{timestamp}} - {{author}}: {{content}}'
    };
    this.isClean = true;
    this.writePermissionErrors.clear();
    this.diskFullSimulation = false;
    this.corruptedFiles.clear();
  }

  isCleanState(): boolean {
    return this.isClean;
  }

  hasPluginData(): boolean {
    return this.files.size > 0 || this.secureData.size > 0;
  }

  async cleanup(): Promise<void> {
    if (this.plugin) {
      await this.plugin.unload();
    }
    await this.resetToCleanState();
  }

  // Plugin Management
  async enablePlugin(): Promise<any> {
    this.plugin = {
      id: 'obsidian-slack-memo',
      version: '1.0.0',
      loaded: true,
      unload: async () => {
        this.plugin.loaded = false;
      }
    };
    this.isClean = false;
    return this.plugin;
  }

  // File Operations
  async createFile(path: string, content: string): Promise<void> {
    if (this.writePermissionErrors.has(this.getDirectoryPath(path))) {
      throw new Error(`EACCES: permission denied, open '${path}'`);
    }

    if (this.diskFullSimulation) {
      throw new Error(`ENOSPC: no space left on device, write '${path}'`);
    }

    const file: ObsidianFile = {
      path,
      content,
      encoding: 'utf-8',
      created: new Date(),
      modified: new Date()
    };

    this.files.set(path, file);
    this.isClean = false;
  }

  async readFile(path: string): Promise<string> {
    if (this.corruptedFiles.has(path)) {
      throw new Error(`File corrupted: ${path}`);
    }

    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    return file.content;
  }

  async findFile(path: string): Promise<string | null> {
    return this.files.has(path) ? path : null;
  }

  async getCreatedFiles(): Promise<string[]> {
    return Array.from(this.files.keys());
  }

  async getFileEncoding(path: string): Promise<string> {
    const file = this.files.get(path);
    return file?.encoding || 'utf-8';
  }

  // Security & Settings
  async storeSecureData(key: string, value: string): Promise<void> {
    this.secureData.set(key, value);
  }

  async getSecureData(key: string): Promise<string | null> {
    return this.secureData.get(key) || null;
  }

  async clearSecureData(key: string): Promise<void> {
    this.secureData.delete(key);
  }

  hasSecureToken(): boolean {
    return this.secureData.has('slack_token');
  }

  async getPluginSettings(): Promise<PluginSettings> {
    return { ...this.pluginSettings };
  }

  async savePluginSettings(settings: PluginSettings): Promise<void> {
    this.pluginSettings = { ...settings };
  }

  // Error Simulation
  simulateWritePermissionError(path: string): void {
    this.writePermissionErrors.add(path);
  }

  simulateDiskFull(): void {
    this.diskFullSimulation = true;
  }

  simulateFileCorruption(path: string): void {
    this.corruptedFiles.add(path);
  }

  // Utility Methods
  private getDirectoryPath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
  }

  // Mock UI Components (will fail until real implementation)
  async getApp(): Promise<any> {
    throw new Error('Not implemented: getApp');
  }

  async getVault(): Promise<any> {
    throw new Error('Not implemented: getVault');
  }

  async getWorkspace(): Promise<any> {
    throw new Error('Not implemented: getWorkspace');
  }

  async getMetadataCache(): Promise<any> {
    throw new Error('Not implemented: getMetadataCache');
  }

  async showNotice(message: string, duration?: number): Promise<void> {
    throw new Error('Not implemented: showNotice');
  }

  async createModal(content: string): Promise<any> {
    throw new Error('Not implemented: createModal');
  }

  async addStatusBarItem(): Promise<any> {
    throw new Error('Not implemented: addStatusBarItem');
  }

  async addRibbonIcon(icon: string, title: string, callback: () => void): Promise<any> {
    throw new Error('Not implemented: addRibbonIcon');
  }

  async addCommand(command: any): Promise<void> {
    throw new Error('Not implemented: addCommand');
  }

  async registerView(viewType: string, viewCreator: any): Promise<void> {
    throw new Error('Not implemented: registerView');
  }

  async activateView(viewType: string): Promise<any> {
    throw new Error('Not implemented: activateView');
  }

  async openFile(file: any): Promise<void> {
    throw new Error('Not implemented: openFile');
  }

  async createFolder(path: string): Promise<void> {
    throw new Error('Not implemented: createFolder');
  }

  async deleteFile(path: string): Promise<void> {
    throw new Error('Not implemented: deleteFile');
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    throw new Error('Not implemented: renameFile');
  }

  async getFileStats(path: string): Promise<any> {
    throw new Error('Not implemented: getFileStats');
  }

  async watchFile(path: string, callback: () => void): Promise<void> {
    throw new Error('Not implemented: watchFile');
  }

  async unwatchFile(path: string): Promise<void> {
    throw new Error('Not implemented: unwatchFile');
  }
}