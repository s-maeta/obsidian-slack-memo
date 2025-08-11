import * as crypto from 'crypto';

export class CryptoManager {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 32;

  private masterKey: Buffer | null = null;

  constructor(password?: string) {
    if (password) {
      this.setPassword(password);
    } else {
      // デフォルトパスワード（本来は環境固有の値を使用）
      this.setPassword('obsidian-slack-sync-default-key');
    }
  }

  setPassword(password: string): void {
    const salt = crypto.createHash('sha256').update('obsidian-slack-sync-salt').digest();
    this.masterKey = this.deriveKey(password, salt.toString('hex'));
  }

  encrypt(plaintext: string): string {
    if (!this.masterKey) {
      throw new Error('暗号化キーが設定されていません');
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // IV + Tag + 暗号化データを結合
      const result = iv.toString('hex') + tag.toString('hex') + encrypted;
      return result;
    } catch (error) {
      throw new Error('暗号化に失敗しました: ' + error.message);
    }
  }

  decrypt(encryptedData: string): string {
    if (!this.masterKey) {
      throw new Error('復号化キーが設定されていません');
    }

    if (!encryptedData || encryptedData.length < (this.ivLength + this.tagLength) * 2) {
      throw new Error('復号化に失敗しました: 無効なデータ形式');
    }

    try {
      // IV、Tag、暗号化データを分離
      const ivHex = encryptedData.slice(0, this.ivLength * 2);
      const tagHex = encryptedData.slice(this.ivLength * 2, (this.ivLength + this.tagLength) * 2);
      const encrypted = encryptedData.slice((this.ivLength + this.tagLength) * 2);

      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('復号化に失敗しました: ' + error.message);
    }
  }

  deriveKey(password: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }
}