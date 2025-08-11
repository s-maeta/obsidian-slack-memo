// TASK-302: ObsidianUI用の統合モック

/**
 * ObsidianのDOM拡張APIをモックする
 */
export class MockHTMLElement {
  public textContent: string = '';
  public innerHTML: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  private classes = new Set<string>();
  private attributes: Map<string, string> = new Map();
  private children: MockHTMLElement[] = [];
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(tagName?: string, options?: any) {
    if (options?.text) {
      this.textContent = options.text;
    }
    if (options?.cls) {
      this.className = options.cls;
      options.cls.split(' ').forEach(cls => this.classes.add(cls));
    }
  }

  // DOM操作メソッド
  createEl(tagName: string, options?: any): MockHTMLElement {
    const element = new MockHTMLElement(tagName, options);
    this.children.push(element);
    return element;
  }

  createDiv(options?: any): MockHTMLElement {
    return this.createEl('div', options);
  }

  appendChild(element: MockHTMLElement): void {
    this.children.push(element);
  }

  querySelector(selector: string): MockHTMLElement | null {
    // data-testid属性での検索をサポート
    if (selector.startsWith('[data-testid="')) {
      const testId = selector.match(/data-testid="([^"]*)"/)![1];
      return this.findByTestId(testId);
    }

    // クラス名での検索をサポート
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      return this.findByClassName(className);
    }

    // タグ名での検索
    return this.children.find(child => child.tagName === selector) || null;
  }

  querySelectorAll(selector: string): MockHTMLElement[] {
    const results: MockHTMLElement[] = [];

    if (selector.startsWith('[data-testid^="') && selector.includes('"]')) {
      const testIdPrefix = selector.match(/data-testid\^="([^"]*)"/)![1];
      this.collectByTestIdPrefix(testIdPrefix, results);
    }

    return results;
  }

  private findByTestId(testId: string): MockHTMLElement | null {
    if (this.attributes.get('data-testid') === testId) {
      return this;
    }

    for (const child of this.children) {
      const result = child.findByTestId(testId);
      if (result) return result;
    }

    return null;
  }

  private findByClassName(className: string): MockHTMLElement | null {
    if (this.classes.has(className)) {
      return this;
    }

    for (const child of this.children) {
      const result = child.findByClassName(className);
      if (result) return result;
    }

    return null;
  }

  private collectByTestIdPrefix(prefix: string, results: MockHTMLElement[]): void {
    const testId = this.attributes.get('data-testid');
    if (testId && testId.startsWith(prefix)) {
      results.push(this);
    }

    this.children.forEach(child => {
      child.collectByTestIdPrefix(prefix, results);
    });
  }

  // 属性管理
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);

    if (name === 'data-testid') {
      // テスト用の属性処理
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  // クラス管理
  get classList() {
    return {
      add: (...classNames: string[]) => {
        classNames.forEach(cls => {
          this.classes.add(cls);
        });
        this.className = Array.from(this.classes).join(' ');
      },
      remove: (...classNames: string[]) => {
        classNames.forEach(cls => {
          this.classes.delete(cls);
        });
        this.className = Array.from(this.classes).join(' ');
      },
      contains: (className: string) => this.classes.has(className),
      toggle: (className: string) => {
        if (this.classes.has(className)) {
          this.classes.delete(className);
        } else {
          this.classes.add(className);
        }
        this.className = Array.from(this.classes).join(' ');
      },
    };
  }

  // イベント管理
  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  // ヘルパーメソッド
  click(): void {
    this.dispatchEvent(new Event('click'));
  }

  // 表示制御
  empty(): void {
    this.innerHTML = '';
    this.children = [];
  }

  hide(): void {
    this.style.display = 'none';
  }

  show(): void {
    this.style.display = 'block';
  }

  setText(text: string): void {
    this.textContent = text;
  }

  get scrollHeight(): number {
    return 100; // モック値
  }

  get scrollTop(): number {
    return 0;
  }

  set scrollTop(value: number) {
    // モック実装
  }

  private tagName: string = 'div';
}

/**
 * Obsidian Modal クラスのモック
 */
export class MockModal {
  public isOpen: boolean = false;
  public containerEl: MockHTMLElement;
  public contentEl: MockHTMLElement;
  public titleEl: MockHTMLElement;

  constructor(app: any) {
    this.containerEl = new MockHTMLElement('div');
    this.contentEl = this.containerEl;
    this.titleEl = new MockHTMLElement('div');
  }

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  onOpen(): void {
    // Hook method
  }

  onClose(): void {
    // Hook method
  }
}

/**
 * Obsidian Notice クラスのモック
 */
export class MockNotice {
  public noticeEl: MockHTMLElement;

  constructor(message: string, duration?: number) {
    this.noticeEl = new MockHTMLElement('div');
    this.noticeEl.textContent = message;
  }

  hide(): void {
    // モック実装
  }
}
