/**
 * Obsidianモジュールのモック
 * テスト実行のために必要な最小限のObsidian APIをモック
 */

export class App {
  setting = {
    openTabById: jest.fn(),
    addSettingTab: jest.fn(),
    removeSettingTab: jest.fn(),
  };
}

export class PluginSettingTab {
  app: App;
  plugin: any;
  containerEl: HTMLElement;

  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  setName(name: string): Setting {
    const nameEl = this.containerEl.createEl('div', { text: name });
    nameEl.className = 'setting-item-name';
    return this;
  }

  setDesc(desc: string): Setting {
    const descEl = this.containerEl.createEl('div', { text: desc });
    descEl.className = 'setting-item-description';
    return this;
  }

  addToggle(callback: (toggle: ToggleComponent) => void): Setting {
    const toggle = new ToggleComponent(this.containerEl);
    callback(toggle);
    return this;
  }

  addDropdown(callback: (dropdown: DropdownComponent) => void): Setting {
    const dropdown = new DropdownComponent(this.containerEl);
    callback(dropdown);
    return this;
  }

  addSlider(callback: (slider: SliderComponent) => void): Setting {
    const slider = new SliderComponent(this.containerEl);
    callback(slider);
    return this;
  }
}

export class ToggleComponent {
  toggleEl: HTMLInputElement;
  containerEl: HTMLElement;
  private value = false;
  private changeCallback: (value: boolean) => void = () => {};

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.toggleEl = containerEl.createEl('input', { type: 'checkbox' });
  }

  setValue(value: boolean): ToggleComponent {
    this.value = value;
    this.toggleEl.checked = value;
    return this;
  }

  onChange(callback: (value: boolean) => void): ToggleComponent {
    this.changeCallback = callback;
    this.toggleEl.addEventListener('change', () => {
      this.value = this.toggleEl.checked;
      callback(this.value);
    });
    return this;
  }
}

export class DropdownComponent {
  selectEl: HTMLSelectElement;
  containerEl: HTMLElement;
  private value = '';
  private changeCallback: (value: string) => void = () => {};

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.selectEl = containerEl.createEl('select');
  }

  addOption(value: string, text: string): DropdownComponent {
    const option = this.selectEl.createEl('option', { value, text });
    return this;
  }

  setValue(value: string): DropdownComponent {
    this.value = value;
    this.selectEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => void): DropdownComponent {
    this.changeCallback = callback;
    this.selectEl.addEventListener('change', () => {
      this.value = this.selectEl.value;
      callback(this.value);
    });
    return this;
  }
}

export class SliderComponent {
  sliderEl: HTMLInputElement;
  containerEl: HTMLElement;
  private value = 0;
  private changeCallback: (value: number) => void = () => {};

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.sliderEl = containerEl.createEl('input', { type: 'range' });
  }

  setLimits(min: number, max: number, step: number): SliderComponent {
    this.sliderEl.min = min.toString();
    this.sliderEl.max = max.toString();
    this.sliderEl.step = step.toString();
    return this;
  }

  setValue(value: number): SliderComponent {
    this.value = value;
    this.sliderEl.value = value.toString();
    return this;
  }

  onChange(callback: (value: number) => void): SliderComponent {
    this.changeCallback = callback;
    this.sliderEl.addEventListener('input', () => {
      this.value = parseInt(this.sliderEl.value);
      callback(this.value);
    });
    return this;
  }

  setDynamicTooltip(): SliderComponent {
    // ツールチップ機能のモック
    return this;
  }
}
