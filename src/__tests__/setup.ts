/**
 * テストセットアップファイル
 * ObsidianのDOM拡張メソッドを標準のHTMLElementに追加
 */

declare global {
    interface HTMLElement {
        empty(): void;
        createEl<K extends keyof HTMLElementTagNameMap>(
            tagName: K,
            options?: { text?: string; cls?: string; value?: string; type?: string; placeholder?: string }
        ): HTMLElementTagNameMap[K];
        setText(text: string): void;
    }
    
    interface Window {
        confirm(message?: string): boolean;
        prompt(message?: string, defaultText?: string): string | null;
    }
}

// HTMLElement.prototype.empty - 要素のコンテンツをクリア
HTMLElement.prototype.empty = function(this: HTMLElement): void {
    this.innerHTML = '';
};

// HTMLElement.prototype.createEl - 子要素を作成して追加
HTMLElement.prototype.createEl = function<K extends keyof HTMLElementTagNameMap>(
    this: HTMLElement,
    tagName: K,
    options?: { text?: string; cls?: string; value?: string; type?: string; placeholder?: string }
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName) as HTMLElementTagNameMap[K];
    
    if (options) {
        if (options.text) {
            element.textContent = options.text;
        }
        if (options.cls) {
            element.className = options.cls;
        }
        if (options.value && 'value' in element) {
            (element as any).value = options.value;
        }
        if (options.type && 'type' in element) {
            (element as any).type = options.type;
        }
        if (options.placeholder && 'placeholder' in element) {
            (element as any).placeholder = options.placeholder;
        }
    }
    
    this.appendChild(element);
    return element;
};

// HTMLElement.prototype.setText - テキスト内容を設定
HTMLElement.prototype.setText = function(this: HTMLElement, text: string): void {
    this.textContent = text;
};

// globalオブジェクトにconfirmとpromptを追加
global.confirm = jest.fn().mockReturnValue(true);
global.prompt = jest.fn().mockReturnValue('test-tag');

export {};