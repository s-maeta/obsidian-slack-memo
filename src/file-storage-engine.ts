import { App, TFile, TFolder } from 'obsidian';
import { PluginSettings, ChannelMapping } from './types';
import { Message as SlackMessage } from './slack-types';
import { FileStorageOptions, StorageResult } from './file-storage-types';

/**
 * File storage engine for saving Slack messages to Obsidian vault
 * Handles path resolution, filename generation, and file operations
 */
export class FileStorageEngine {
    // File name length limit (OS dependent, using conservative value)
    private static readonly MAX_FILENAME_LENGTH = 255;
    
    // Character sanitization pattern for cross-platform compatibility
    private static readonly INVALID_FILENAME_CHARS = /[<>:"|?*\/\\]/g;
    
    // Variable replacement patterns for filename generation
    private static readonly FILENAME_VARIABLES = {
        CHANNEL: '{channel}',
        DATE: '{date}', 
        TIMESTAMP: '{timestamp}',
        USER: '{user}'
    };

    constructor(
        private readonly app: App,
        private readonly settings: PluginSettings
    ) {}

    /**
     * Determines the save path for a given channel
     * @param channelId - Slack channel ID
     * @returns Absolute path to save directory
     * @throws Error if no mapping found and no default path configured
     */
    determineSavePath(channelId: string): string {
        const mapping = this.findChannelMapping(channelId);
        const targetPath = mapping?.targetFolder ?? this.getDefaultPath();
        
        if (!targetPath) {
            throw new Error(`No mapping found for channel ${channelId} and no default path configured`);
        }

        return this.normalizeToAbsolutePath(targetPath);
    }

    /**
     * Finds channel mapping configuration by channel ID
     * @param channelId - Slack channel ID
     * @returns Channel mapping or undefined
     */
    private findChannelMapping(channelId: string): ChannelMapping | undefined {
        return this.settings.channelMappings.find(m => m.channelId === channelId);
    }

    /**
     * Gets default path from settings
     * @returns Default path or undefined
     */
    private getDefaultPath(): string | undefined {
        return (this.settings as any).defaultPath;
    }

    /**
     * Normalizes path to absolute path format
     * @param path - Original path (relative or absolute)
     * @returns Absolute path
     */
    private normalizeToAbsolutePath(path: string): string {
        return path.startsWith('/') ? path : '/' + path;
    }

    /**
     * Generates a filename based on message and channel information
     * @param message - Slack message object
     * @param channelName - Channel name
     * @returns Sanitized filename with .md extension
     */
    generateFileName(message: SlackMessage, channelName: string): string {
        const format = this.getFileNameFormat(channelName);
        const variables = this.extractMessageVariables(message, channelName);
        
        let fileName = this.replaceVariablesInFormat(format, variables);
        fileName = this.ensureMarkdownExtension(fileName);
        fileName = this.truncateToLengthLimit(fileName);
        
        return fileName;
    }

    /**
     * Gets filename format for the given channel
     * @param channelName - Channel name
     * @returns Filename format string
     */
    private getFileNameFormat(channelName: string): string {
        const mapping = this.findChannelMappingByName(channelName);
        return mapping?.fileNameFormat ?? '{channel}-{date}';
    }

    /**
     * Finds channel mapping by channel name
     * @param channelName - Channel name
     * @returns Channel mapping or undefined
     */
    private findChannelMappingByName(channelName: string): ChannelMapping | undefined {
        return this.settings.channelMappings.find(m => m.channelName === channelName);
    }

    /**
     * Extracts variables from message for filename generation
     * @param message - Slack message object
     * @param channelName - Channel name
     * @returns Object containing variable values
     */
    private extractMessageVariables(message: SlackMessage, channelName: string): Record<string, string> {
        const timestamp = parseFloat(message.ts);
        const date = new Date(timestamp * 1000);
        
        return {
            [FileStorageEngine.FILENAME_VARIABLES.CHANNEL]: this.sanitizeFileName(channelName),
            [FileStorageEngine.FILENAME_VARIABLES.DATE]: this.formatDate(date),
            [FileStorageEngine.FILENAME_VARIABLES.TIMESTAMP]: Math.floor(timestamp).toString(),
            [FileStorageEngine.FILENAME_VARIABLES.USER]: message.user || 'unknown'
        };
    }

    /**
     * Formats date as YYYY-MM-DD string
     * @param date - Date object
     * @returns Formatted date string
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Replaces variables in format string
     * @param format - Format string with variables
     * @param variables - Variable values
     * @returns String with variables replaced
     */
    private replaceVariablesInFormat(format: string, variables: Record<string, string>): string {
        let result = format;
        for (const [variable, value] of Object.entries(variables)) {
            result = result.replace(variable, value);
        }
        return result;
    }

    /**
     * Ensures filename has .md extension
     * @param fileName - Original filename
     * @returns Filename with .md extension
     */
    private ensureMarkdownExtension(fileName: string): string {
        return fileName.endsWith('.md') ? fileName : fileName + '.md';
    }

    /**
     * Truncates filename to system length limits
     * @param fileName - Original filename
     * @returns Truncated filename
     */
    private truncateToLengthLimit(fileName: string): string {
        if (fileName.length <= FileStorageEngine.MAX_FILENAME_LENGTH) {
            return fileName;
        }

        const extension = '.md';
        const maxLength = FileStorageEngine.MAX_FILENAME_LENGTH - extension.length;
        return fileName.substring(0, maxLength) + extension;
    }

    /**
     * Sanitizes filename by replacing invalid characters
     * @param name - Original name
     * @returns Sanitized name
     */
    private sanitizeFileName(name: string): string {
        return name.replace(FileStorageEngine.INVALID_FILENAME_CHARS, '_');
    }

    /**
     * Ensures directory exists, creating it if necessary
     * @param path - Directory path to ensure
     * @throws Error if directory creation fails
     */
    async ensureDirectoryExists(path: string): Promise<void> {
        try {
            const exists = await this.app.vault.adapter.exists(path);
            if (!exists) {
                await this.app.vault.createFolder(path);
            }
        } catch (error) {
            throw new Error(`Failed to create directory ${path}: ${error}`);
        }
    }

    /**
     * Writes content to file, creating or modifying as needed
     * @param filePath - Full path to file
     * @param content - Content to write
     * @throws Error if file operation fails
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            const fileExists = await this.app.vault.adapter.exists(filePath);
            
            if (fileExists) {
                await this.modifyExistingFile(filePath, content);
            } else {
                await this.createNewFile(filePath, content);
            }
        } catch (error) {
            throw new Error(`Failed to write file ${filePath}: ${error}`);
        }
    }

    /**
     * Modifies existing file with new content
     * @param filePath - Path to existing file
     * @param content - New content
     */
    private async modifyExistingFile(filePath: string, content: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
        await this.app.vault.modify(file, content);
    }

    /**
     * Creates new file with content
     * @param filePath - Path for new file
     * @param content - File content
     */
    private async createNewFile(filePath: string, content: string): Promise<void> {
        await this.app.vault.create(filePath, content);
    }

    /**
     * Appends content to daily note if enabled
     * @param content - Content to append
     * @param date - Date string (YYYY-MM-DD)
     * @throws Error if daily note operation fails
     */
    async appendToDailyNote(content: string, date: string): Promise<void> {
        if (!this.settings.dailyNoteSettings.enabled) {
            return;
        }

        const dailyNotePath = this.buildDailyNotePath(date);

        try {
            const fileExists = await this.app.vault.adapter.exists(dailyNotePath);
            
            if (fileExists) {
                await this.appendToExistingDailyNote(dailyNotePath, content);
            } else {
                await this.createNewDailyNote(dailyNotePath, content, date);
            }
        } catch (error) {
            throw new Error(`Failed to append to daily note ${dailyNotePath}: ${error}`);
        }
    }

    /**
     * Builds daily note file path
     * @param date - Date string (YYYY-MM-DD)
     * @returns Full path to daily note
     */
    private buildDailyNotePath(date: string): string {
        const folder = this.settings.dailyNoteSettings.folder;
        return `${folder}/${date}.md`;
    }

    /**
     * Appends content to existing daily note if not duplicate
     * @param dailyNotePath - Path to daily note
     * @param content - Content to append
     */
    private async appendToExistingDailyNote(dailyNotePath: string, content: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(dailyNotePath) as TFile;
        const existingContent = await this.app.vault.read(file);
        
        if (!existingContent.includes(content)) {
            await this.app.vault.append(file, '\n' + content);
        }
    }

    /**
     * Creates new daily note with header and content
     * @param dailyNotePath - Path for new daily note
     * @param content - Content to include
     * @param date - Date for header formatting
     */
    private async createNewDailyNote(dailyNotePath: string, content: string, date: string): Promise<void> {
        const header = this.settings.dailyNoteSettings.headerFormat.replace('{{date}}', date);
        const fullContent = `${header}\n\n${content}`;
        await this.app.vault.create(dailyNotePath, fullContent);
    }

    /**
     * Finds unique filename by adding sequence numbers if conflicts exist
     * @param basePath - Directory path
     * @param fileName - Desired filename
     * @returns Unique filename
     */
    private async findUniqueFileName(basePath: string, fileName: string): Promise<string> {
        let uniqueFileName = fileName;
        let counter = 1;

        while (await this.app.vault.adapter.exists(`${basePath}/${uniqueFileName}`)) {
            uniqueFileName = this.generateSequencedFilename(fileName, counter);
            counter++;
        }

        return uniqueFileName;
    }

    /**
     * Generates filename with sequence number
     * @param fileName - Original filename
     * @param counter - Sequence number
     * @returns Filename with sequence number
     */
    private generateSequencedFilename(fileName: string, counter: number): string {
        const nameWithoutExt = fileName.replace('.md', '');
        return `${nameWithoutExt} (${counter}).md`;
    }

    /**
     * Saves Slack message to file with all necessary processing
     * @param options - File storage options
     * @returns Storage result with success status and metadata
     */
    async saveMessage(options: FileStorageOptions): Promise<StorageResult> {
        try {
            this.validateSaveOptions(options);
            
            const savePath = this.determineSavePath(options.channelId);
            await this.ensureDirectoryExists(savePath);
            
            const fileName = await this.generateUniqueFileName(options, savePath);
            const fullFilePath = `${savePath}/${fileName}`;
            
            await this.writeFile(fullFilePath, options.content);
            
            const appendedToDailyNote = await this.handleDailyNoteAppending(options);
            
            return this.createSuccessResult(fullFilePath, options.content, appendedToDailyNote);
            
        } catch (error) {
            return this.createErrorResult(error as Error);
        }
    }

    /**
     * Validates save message options
     * @param options - Options to validate
     * @throws Error if validation fails
     */
    private validateSaveOptions(options: FileStorageOptions): void {
        if (!options.channelName || options.content === undefined) {
            throw new Error('Invalid input: channelName and content are required');
        }
    }

    /**
     * Generates unique filename for the message
     * @param options - File storage options
     * @param savePath - Save directory path
     * @returns Unique filename
     */
    private async generateUniqueFileName(options: FileStorageOptions, savePath: string): Promise<string> {
        const fileName = this.generateFileName(options.message, options.channelName);
        return await this.findUniqueFileName(savePath, fileName);
    }

    /**
     * Handles daily note appending if enabled
     * @param options - File storage options
     * @returns True if content was appended to daily note
     */
    private async handleDailyNoteAppending(options: FileStorageOptions): Promise<boolean> {
        if (!options.appendToDailyNote || !this.settings.dailyNoteSettings.enabled) {
            return false;
        }

        const timestamp = parseFloat(options.message.ts);
        const date = new Date(timestamp * 1000);
        const dateString = this.formatDate(date);
        
        await this.appendToDailyNote(options.content, dateString);
        return true;
    }

    /**
     * Creates successful storage result
     * @param filePath - Path to saved file
     * @param content - File content
     * @param appendedToDailyNote - Whether appended to daily note
     * @returns Success storage result
     */
    private createSuccessResult(filePath: string, content: string, appendedToDailyNote: boolean): StorageResult {
        return {
            success: true,
            filePath,
            metadata: {
                fileSize: new Blob([content]).size,
                createdAt: new Date(),
                appendedToDailyNote
            }
        };
    }

    /**
     * Creates error storage result
     * @param error - Error that occurred
     * @returns Error storage result
     */
    private createErrorResult(error: Error): StorageResult {
        return {
            success: false,
            error,
            metadata: {
                fileSize: 0,
                createdAt: new Date(),
                appendedToDailyNote: false
            }
        };
    }
}