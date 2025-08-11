import { CryptoManager } from '../src/crypto';

describe('暗号化ユーティリティ', () => {
  let cryptoManager: CryptoManager;

  beforeEach(() => {
    cryptoManager = new CryptoManager();
  });

  describe('暗号化・復号化', () => {
    it('文字列を暗号化して復号化できる', () => {
      const plaintext = 'xoxb-test-token-12345';
      
      const encrypted = cryptoManager.encrypt(plaintext);
      const decrypted = cryptoManager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('空文字列を正しく処理する', () => {
      const plaintext = '';
      
      const encrypted = cryptoManager.encrypt(plaintext);
      const decrypted = cryptoManager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('同じ平文でも異なる暗号文が生成される（IV使用）', () => {
      const plaintext = 'test-token';
      
      const encrypted1 = cryptoManager.encrypt(plaintext);
      const encrypted2 = cryptoManager.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      
      // どちらも正しく復号化される
      expect(cryptoManager.decrypt(encrypted1)).toBe(plaintext);
      expect(cryptoManager.decrypt(encrypted2)).toBe(plaintext);
    });

    it('日本語文字列を正しく処理する', () => {
      const plaintext = 'テストトークン日本語文字列';
      
      const encrypted = cryptoManager.encrypt(plaintext);
      const decrypted = cryptoManager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('長い文字列を正しく処理する', () => {
      const plaintext = 'a'.repeat(1000);
      
      const encrypted = cryptoManager.encrypt(plaintext);
      const decrypted = cryptoManager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('エラーハンドリング', () => {
    it('不正な暗号文の復号化でエラーを投げる', () => {
      const invalidEncrypted = 'invalid-encrypted-data';

      expect(() => cryptoManager.decrypt(invalidEncrypted)).toThrow('復号化に失敗しました');
    });

    it('改ざんされた暗号文の復号化でエラーを投げる', () => {
      const plaintext = 'test-token';
      const encrypted = cryptoManager.encrypt(plaintext);
      
      // 暗号文を改ざん
      const tamperedEncrypted = encrypted.slice(0, -4) + '1234';

      expect(() => cryptoManager.decrypt(tamperedEncrypted)).toThrow('復号化に失敗しました');
    });

    it('空の暗号文でエラーを投げる', () => {
      expect(() => cryptoManager.decrypt('')).toThrow('復号化に失敗しました');
    });
  });

  describe('キー導出', () => {
    it('同じパスワードから同じキーが導出される', () => {
      const password = 'test-password';
      const salt = 'test-salt';

      const key1 = cryptoManager.deriveKey(password, salt);
      const key2 = cryptoManager.deriveKey(password, salt);

      expect(key1).toEqual(key2);
    });

    it('異なるパスワードから異なるキーが導出される', () => {
      const salt = 'test-salt';

      const key1 = cryptoManager.deriveKey('password1', salt);
      const key2 = cryptoManager.deriveKey('password2', salt);

      expect(key1).not.toEqual(key2);
    });

    it('異なるソルトから異なるキーが導出される', () => {
      const password = 'test-password';

      const key1 = cryptoManager.deriveKey(password, 'salt1');
      const key2 = cryptoManager.deriveKey(password, 'salt2');

      expect(key1).not.toEqual(key2);
    });
  });
});