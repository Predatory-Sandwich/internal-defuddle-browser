import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting, TFolder, WorkspaceLeaf, normalizePath } from "obsidian";
import Defuddle, { type DefuddleResponse } from "defuddle";
import { createMarkdownContent } from "defuddle/full";
import { fetchTranscript, type TranscriptResponse } from "youtube-transcript";

export const DEFUDDLE_BROWSER_VIEW_TYPE = "internal-defuddle-browser-browser";
const DEFAULT_BROWSER_TITLE = "Internal Defuddle Browser";

type InternalDefuddleClipperSettings = {
  defaultHomePage: string;
  defaultClippingFolder: string;
  toolbarButtonBackgroundColor: string;
  toolbarButtonTextColor: string;
  toolbarButtonBorderColor: string;
};

const DEFAULT_SETTINGS: InternalDefuddleClipperSettings = {
  defaultHomePage: "https://example.com",
  defaultClippingFolder: "Clippings",
  toolbarButtonBackgroundColor: "#2f2f2f",
  toolbarButtonTextColor: "#ffffff",
  toolbarButtonBorderColor: "#555555",
};

type WebviewTag = HTMLElement & {
  src: string;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  getURL: () => string;
  executeJavaScript: <T = unknown>(code: string, userGesture?: boolean) => Promise<T>;
};

type CaptureDebugPayload = {
  url: string;
  title: string;
  selectedText: string;
  html: string;
  bodyTextPreview: string;
  htmlLength: number;
  bodyTextLength: number;
  capturedAt: string;
};

type PreviewContentType = "article" | "youtube-transcript";

type DefuddlePreviewPayload = {
  url: string;
  pageTitle: string;
  title: string;
  author: string;
  authorUrl: string;
  site: string;
  domain: string;
  language: string;
  description: string;
  published: string;
  wordCount: number;
  extractorType: string;
  extractionSource: string;
  htmlLength: number;
  extractedHtmlLength: number;
  markdownLength: number;
  markdown: string;
  capturedAt: string;
  contentType?: PreviewContentType;
  videoId?: string;
  durationSeconds?: number;
};

type YoutubePagePayload = {
  url: string;
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string;
  description: string;
  published: string;
  capturedAt: string;
};

export default class InternalDefuddleClipperPlugin extends Plugin {
  settings: InternalDefuddleClipperSettings = DEFAULT_SETTINGS;
  private emptyTabObserver?: MutationObserver;

  async onload() {
    await this.loadSettings();

    this.registerView(
      DEFUDDLE_BROWSER_VIEW_TYPE,
      (leaf) => new DefuddleBrowserView(leaf, this)
    );

    this.addRibbonIcon("scissors", "Open Internal Defuddle Browser", () => {
      void this.activateBrowserView();
    });

    this.addCommand({
      id: "open-internal-defuddle-browser",
      name: "Open Internal Defuddle Browser",
      callback: () => {
        void this.activateBrowserView();
      },
    });

    this.addCommand({
      id: "clip-current-defuddle-browser-page",
      name: "Clip current Internal Defuddle Browser page",
      callback: () => {
        new Notice("Open Internal Defuddle Browser and use its Clip button.");
      },
    });

    this.addSettingTab(new InternalDefuddleClipperSettingTab(this.app, this));

    this.installEmptyTabLauncher();

    console.log("Internal Defuddle Browser loaded");
  }

  onunload() {
    this.emptyTabObserver?.disconnect();
    document.querySelectorAll(".internal-defuddle-browser-empty-tab-launcher").forEach((el) => el.remove());
    this.app.workspace.detachLeavesOfType(DEFUDDLE_BROWSER_VIEW_TYPE);
    console.log("Internal Defuddle Browser unloaded");
  }

  async activateBrowserView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(DEFUDDLE_BROWSER_VIEW_TYPE);

    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: DEFUDDLE_BROWSER_VIEW_TYPE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);
  }

  async activateBrowserViewInCurrentLeaf() {
    const activeLeaf = this.app.workspace.activeLeaf;
    const leaf = activeLeaf?.getViewState().type === "empty" ? activeLeaf : this.app.workspace.getLeaf("tab");

    await leaf.setViewState({
      type: DEFUDDLE_BROWSER_VIEW_TYPE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applySettingsToOpenViews();
  }

  applySettingsToOpenViews() {
    this.app.workspace.getLeavesOfType(DEFUDDLE_BROWSER_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof DefuddleBrowserView) {
        leaf.view.applySettings();
      }
    });
  }

  private installEmptyTabLauncher() {
    const inject = () => this.injectEmptyTabLauncher();

    this.emptyTabObserver = new MutationObserver(inject);
    this.emptyTabObserver.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.emptyTabObserver?.disconnect());

    window.setTimeout(inject, 250);
  }

  private injectEmptyTabLauncher() {
    const emptyLeaves = document.querySelectorAll<HTMLElement>(".workspace-leaf-content[data-type='empty'], .workspace-leaf-content.empty-state");

    emptyLeaves.forEach((leafContent) => {
      if (leafContent.querySelector(".internal-defuddle-browser-empty-tab-launcher")) {
        return;
      }

      const emptyActions = Array.from(
        leafContent.querySelectorAll<HTMLElement>(".empty-state-action, .empty-state-action-list > *, .empty-state-actions > *")
      );
      const goToFile = emptyActions.find((child) => child.textContent?.includes("Go to file"));
      const closeAction = emptyActions.find((child) => child.textContent?.trim() === "Close" || child.textContent?.includes("Close"));
      const templateAction = goToFile ?? closeAction;
      const parent = templateAction?.parentElement ?? leafContent;

      const launcher = document.createElement(templateAction?.tagName.toLowerCase() || "div");
      launcher.className = [templateAction?.className || "empty-state-action", "internal-defuddle-browser-empty-tab-launcher"].filter(Boolean).join(" ");
      launcher.textContent = DEFAULT_BROWSER_TITLE;
      launcher.setAttribute("role", "button");
      launcher.tabIndex = 0;
      launcher.addEventListener("click", () => {
        void this.activateBrowserViewInCurrentLeaf();
      });
      launcher.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void this.activateBrowserViewInCurrentLeaf();
        }
      });

      if (closeAction?.parentElement) {
        closeAction.parentElement.insertBefore(launcher, closeAction);
      } else if (goToFile?.parentElement && goToFile.nextSibling) {
        goToFile.parentElement.insertBefore(launcher, goToFile.nextSibling);
      } else {
        parent.appendChild(launcher);
      }
    });
  }
}

class InternalDefuddleClipperSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: InternalDefuddleClipperPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Internal Defuddle Browser settings" });

    new Setting(containerEl)
      .setName("Default home page")
      .setDesc("The page the Internal Defuddle Browser opens to by default.")
      .addText((text) => {
        text
          .setPlaceholder("https://example.com")
          .setValue(this.plugin.settings.defaultHomePage)
          .onChange(async (value) => {
            this.plugin.settings.defaultHomePage = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Default clipping folder")
      .setDesc("The folder selected by default when saving clipped Markdown. Example: Clippings or Articles/Web Clips.")
      .addText((text) => {
        text
          .setPlaceholder("Clippings")
          .setValue(this.plugin.settings.defaultClippingFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultClippingFolder = normalizePath(value.trim());
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Button background color")
      .setDesc("Background color for Back, Forward, Reload, Go, Folder, Clip, and Save buttons.")
      .addColorPicker((color) => {
        color
          .setValue(this.plugin.settings.toolbarButtonBackgroundColor)
          .onChange(async (value) => {
            this.plugin.settings.toolbarButtonBackgroundColor = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Button text color")
      .setDesc("Text color for the browser toolbar buttons.")
      .addColorPicker((color) => {
        color
          .setValue(this.plugin.settings.toolbarButtonTextColor)
          .onChange(async (value) => {
            this.plugin.settings.toolbarButtonTextColor = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Button border color")
      .setDesc("Border color for the browser toolbar buttons.")
      .addColorPicker((color) => {
        color
          .setValue(this.plugin.settings.toolbarButtonBorderColor)
          .onChange(async (value) => {
            this.plugin.settings.toolbarButtonBorderColor = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Reset button colors")
      .setDesc("Restore the default toolbar button colors.")
      .addButton((button) => {
        button
          .setButtonText("Reset colors")
          .onClick(async () => {
            this.plugin.settings.toolbarButtonBackgroundColor = DEFAULT_SETTINGS.toolbarButtonBackgroundColor;
            this.plugin.settings.toolbarButtonTextColor = DEFAULT_SETTINGS.toolbarButtonTextColor;
            this.plugin.settings.toolbarButtonBorderColor = DEFAULT_SETTINGS.toolbarButtonBorderColor;
            await this.plugin.saveSettings();
            this.display();
          });
      });
  }
}

class FolderTreeModal extends Modal {
  private expandedPaths = new Set<string>();

  constructor(
    app: App,
    private onChooseFolder: (folder: TFolder) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("internal-defuddle-folder-tree-modal");

    contentEl.createEl("h2", { text: "Choose a destination folder for clipped Markdown" });

    const root = this.app.vault.getRoot();
    const topLevelFolders = this.getChildFolders(root);

    if (topLevelFolders.length === 0) {
      contentEl.createEl("p", {
        cls: "internal-defuddle-folder-tree-empty",
        text: "No folders found in this vault.",
      });
      return;
    }

    const treeEl = contentEl.createDiv({ cls: "internal-defuddle-folder-tree" });
    topLevelFolders.forEach((folder) => this.renderFolderRow(treeEl, folder, 0));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private getChildFolders(folder: TFolder): TFolder[] {
    const explorerOrder = this.getFileExplorerFolderOrder();

    return folder.children
      .filter((child): child is TFolder => child instanceof TFolder)
      .map((child, index) => ({ child, index }))
      .sort((a, b) => {
        const aOrder = explorerOrder.get(a.child.path);
        const bOrder = explorerOrder.get(b.child.path);

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }

        if (aOrder !== undefined) {
          return -1;
        }

        if (bOrder !== undefined) {
          return 1;
        }

        return a.index - b.index;
      })
      .map(({ child }) => child);
  }

  private getFileExplorerFolderOrder(): Map<string, number> {
    const order = new Map<string, number>();
    const folderTitles = document.querySelectorAll<HTMLElement>(
      ".nav-folder-title[data-path], .tree-item-self[data-path]"
    );

    folderTitles.forEach((folderTitle) => {
      const path = folderTitle.getAttribute("data-path");
      if (!path || order.has(path)) {
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFolder) {
        order.set(path, order.size);
      }
    });

    return order;
  }

  private renderFolderRow(parentEl: HTMLElement, folder: TFolder, depth: number): void {
    const children = this.getChildFolders(folder);
    const isExpanded = this.expandedPaths.has(folder.path);

    const itemEl = parentEl.createDiv({ cls: "internal-defuddle-folder-tree-item" });
    itemEl.toggleClass("is-expanded", isExpanded);

    const rowEl = itemEl.createDiv({ cls: "internal-defuddle-folder-tree-row" });
    rowEl.style.setProperty("--internal-defuddle-folder-depth", String(depth));

    const toggleEl = rowEl.createEl("button", {
      cls: "internal-defuddle-folder-tree-toggle",
      attr: {
        type: "button",
        "aria-label": children.length > 0 ? `${isExpanded ? "Collapse" : "Expand"} ${folder.name}` : "No subfolders",
        "aria-expanded": String(isExpanded),
      },
    });
    toggleEl.setText(children.length > 0 ? (isExpanded ? "▾" : "▸") : "");
    toggleEl.disabled = children.length === 0;
    toggleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.expandedPaths.has(folder.path)) {
        this.expandedPaths.delete(folder.path);
      } else {
        this.expandedPaths.add(folder.path);
      }
      this.onOpen();
    });

    const labelEl = rowEl.createEl("button", {
      cls: "internal-defuddle-folder-tree-label",
      attr: {
        type: "button",
        title: folder.path,
      },
    });
    labelEl.createSpan({ cls: "internal-defuddle-folder-tree-icon", text: "📁" });
    labelEl.createSpan({ cls: "internal-defuddle-folder-tree-name", text: folder.name });
    labelEl.addEventListener("click", () => {
      this.onChooseFolder(folder);
      this.close();
    });

    if (isExpanded && children.length > 0) {
      const childrenEl = itemEl.createDiv({ cls: "internal-defuddle-folder-tree-children" });
      children.forEach((child) => this.renderFolderRow(childrenEl, child, depth + 1));
    }
  }
}

class DefuddleBrowserView extends ItemView {
  private urlInputEl?: HTMLInputElement;
  private webviewEl?: WebviewTag;
  private statusEl?: HTMLElement;
  private backButtonEl?: HTMLButtonElement;
  private forwardButtonEl?: HTMLButtonElement;
  private reloadButtonEl?: HTMLButtonElement;
  private folderButtonEl?: HTMLButtonElement;
  private transcriptButtonEl?: HTMLButtonElement;
  private saveButtonEl?: HTMLButtonElement;
  private previewEl?: HTMLPreElement;
  private rootEl?: HTMLElement;
  private isPreviewMode = false;
  private currentDisplayTitle = DEFAULT_BROWSER_TITLE;
  private selectedFolderPath = "Inbox";
  private currentPreview?: DefuddlePreviewPayload;

  constructor(leaf: WorkspaceLeaf, private plugin: InternalDefuddleClipperPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return DEFUDDLE_BROWSER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.currentDisplayTitle;
  }

  getIcon(): string {
    return "globe-2";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("internal-defuddle-browser-root");
    this.rootEl = container;
    this.applySettings();

    const toolbar = container.createDiv({ cls: "internal-defuddle-browser-toolbar" });
    this.selectedFolderPath = normalizePath(this.plugin.settings.defaultClippingFolder.trim() || DEFAULT_SETTINGS.defaultClippingFolder);

    this.backButtonEl = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: "←", attr: { "aria-label": "Back" } });
    this.forwardButtonEl = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: "→", attr: { "aria-label": "Forward" } });
    this.reloadButtonEl = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: "⟳", attr: { "aria-label": "Reload" } });

    this.backButtonEl.addEventListener("click", () => this.goBack());
    this.forwardButtonEl.addEventListener("click", () => this.goForward());
    this.reloadButtonEl.addEventListener("click", () => this.reload());

    this.urlInputEl = toolbar.createEl("input", {
      cls: "internal-defuddle-browser-url",
      attr: {
        type: "text",
        placeholder: "Enter a URL, then press Enter",
        value: this.plugin.settings.defaultHomePage,
      },
    });

    this.urlInputEl.addEventListener("focus", () => this.urlInputEl?.select());
    this.urlInputEl.addEventListener("click", () => this.urlInputEl?.select());

    this.urlInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.loadUrl(this.urlInputEl?.value ?? "");
      }
    });

    const goButton = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: "Go" });
    goButton.addEventListener("click", () => this.loadUrl(this.urlInputEl?.value ?? ""));

    this.folderButtonEl = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: this.getFolderButtonText() });
    this.folderButtonEl.addEventListener("click", () => this.openFolderPicker());

    const clipButton = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: "Clip" });
    clipButton.addEventListener("click", () => {
      void this.captureRenderedDomDebug();
    });

    this.transcriptButtonEl = toolbar.createEl("button", {
      cls: "internal-defuddle-browser-toolbar-button",
      text: "YouTube Transcript",
      attr: {
        title: "Available on YouTube video pages",
        "aria-label": "Fetch YouTube transcript",
      },
    });
    this.transcriptButtonEl.disabled = true;
    this.transcriptButtonEl.addEventListener("click", () => {
      void this.captureYoutubeTranscript();
    });

    this.saveButtonEl = toolbar.createEl("button", { cls: "internal-defuddle-browser-toolbar-button", text: "Save" });
    this.saveButtonEl.disabled = true;
    this.saveButtonEl.addEventListener("click", () => {
      void this.saveCurrentPreviewToVault();
    });

    this.statusEl = container.createDiv({
      cls: "internal-defuddle-browser-status",
      text: "Ready. Load a page, click Clip for articles or Transcript for YouTube videos, then Save to write Markdown into the selected folder.",
    });

    const content = container.createDiv({ cls: "internal-defuddle-browser-content" });

    this.webviewEl = document.createElement("webview") as WebviewTag;
    this.webviewEl.addClass("internal-defuddle-browser-webview");
    this.webviewEl.setAttribute("partition", "persist:internal-defuddle-browser");
    this.webviewEl.setAttribute("webpreferences", "contextIsolation=yes,nodeIntegration=no,sandbox=yes");

    this.webviewEl.addEventListener("new-window", (event: Event) => {
      const detail = event as Event & { url?: string; preventDefault: () => void };
      detail.preventDefault();

      if (detail.url) {
        this.setStatus(`Opening popup/link inside Internal Defuddle Browser: ${detail.url}`);
        this.loadUrl(detail.url);
      }
    });

    this.webviewEl.addEventListener("did-create-window", (event: Event) => {
      const detail = event as Event & { url?: string };

      if (detail.url) {
        this.setStatus(`A page tried to open a new window: ${detail.url}`);
      }
    });

    this.webviewEl.addEventListener("dom-ready", () => {
      void this.installInPageNavigationShim();
      void this.updateTitleFromWebview();
      this.setStatus("Page rendered in the internal webview.");
      this.updateNavigationState();
    });

    this.webviewEl.addEventListener("did-start-loading", () => {
      this.setStatus("Loading…");
      this.updateNavigationState();
    });

    this.webviewEl.addEventListener("did-stop-loading", () => {
      this.setStatus("Finished loading.");
      this.updateUrlFromWebview();
      void this.updateTitleFromWebview();
      this.updateNavigationState();
    });

    this.webviewEl.addEventListener("did-navigate", () => {
      this.updateUrlFromWebview();
      this.updateNavigationState();
    });

    this.webviewEl.addEventListener("did-navigate-in-page", () => {
      this.updateUrlFromWebview();
      this.updateNavigationState();
    });

    this.webviewEl.addEventListener("did-fail-load", (event: Event) => {
      const detail = event as Event & { errorDescription?: string; validatedURL?: string };
      const failedUrl = detail.validatedURL ? ` ${detail.validatedURL}` : "";
      const reason = detail.errorDescription ? `: ${detail.errorDescription}` : "";
      this.setStatus(`Failed to load${failedUrl}${reason}`);
      this.updateNavigationState();
    });

    content.appendChild(this.webviewEl);

    this.previewEl = content.createEl("pre", {
      cls: "internal-defuddle-browser-reader-preview internal-defuddle-browser-hidden",
    });
    this.previewEl.tabIndex = 0;

    this.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
      if (!this.isPreviewMode || event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      event.preventDefault();
      this.returnToBrowserPage();
    });

    const homePage = this.plugin.settings.defaultHomePage.trim();
    if (homePage) {
      this.loadUrl(homePage);
    }

    this.updateNavigationState();
  }

  applySettings() {
    if (!this.rootEl) {
      return;
    }

    this.rootEl.style.setProperty("--internal-defuddle-toolbar-button-bg", this.plugin.settings.toolbarButtonBackgroundColor);
    this.rootEl.style.setProperty("--internal-defuddle-toolbar-button-color", this.plugin.settings.toolbarButtonTextColor);
    this.rootEl.style.setProperty("--internal-defuddle-toolbar-button-border", this.plugin.settings.toolbarButtonBorderColor);
  }

  async onClose() {
    this.urlInputEl = undefined;
    this.webviewEl = undefined;
    this.statusEl = undefined;
    this.backButtonEl = undefined;
    this.forwardButtonEl = undefined;
    this.reloadButtonEl = undefined;
    this.folderButtonEl = undefined;
    this.transcriptButtonEl = undefined;
    this.saveButtonEl = undefined;
    this.previewEl = undefined;
    this.rootEl = undefined;
    this.isPreviewMode = false;
    this.currentPreview = undefined;
  }

  private loadUrl(rawUrl: string) {
    const normalizedUrl = this.normalizeUrl(rawUrl);

    if (!normalizedUrl) {
      new Notice("Enter a URL first.");
      return;
    }

    if (!this.webviewEl) {
      new Notice("The internal webview is not ready yet.");
      return;
    }

    this.returnToBrowserPage(false);
    this.currentPreview = undefined;
    if (this.saveButtonEl) {
      this.saveButtonEl.disabled = true;
    }
    this.setStatus(`Loading ${normalizedUrl}…`);
    this.webviewEl.src = normalizedUrl;
  }

  private normalizeUrl(rawUrl: string): string | null {
    const trimmed = rawUrl.trim();

    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  private goBack() {
    if (this.isPreviewMode) {
      this.returnToBrowserPage();
      return;
    }

    if (this.webviewEl?.canGoBack()) {
      this.webviewEl.goBack();
    }
  }

  private goForward() {
    if (this.webviewEl?.canGoForward()) {
      this.webviewEl.goForward();
    }
  }

  private reload() {
    if (this.webviewEl?.src) {
      this.webviewEl.reload();
    }
  }

  private async installInPageNavigationShim() {
    if (!this.webviewEl?.src) {
      return;
    }

    try {
      await this.webviewEl.executeJavaScript(
        `(() => {
          if (window.__internalDefuddleNavigationShimInstalled) {
            return "already-installed";
          }

          Object.defineProperty(window, "__internalDefuddleNavigationShimInstalled", {
            value: true,
            configurable: true,
          });

          const navigateInsideThisWebview = (url) => {
            if (!url) return false;

            const resolvedUrl = new URL(url, location.href);
            if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
              return false;
            }

            location.href = resolvedUrl.href;
            return true;
          };

          const originalOpen = window.open;
          window.open = function(url, target, features) {
            if (typeof url === "string" && navigateInsideThisWebview(url)) {
              return null;
            }

            return originalOpen.call(window, url, target, features);
          };

          document.addEventListener("click", (event) => {
            if (event.defaultPrevented) {
              return;
            }

            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }

            const target = event.target instanceof Element ? event.target : null;
            const anchor = target?.closest?.("a[href]");

            if (!anchor) {
              return;
            }

            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
              return;
            }

            const resolvedUrl = new URL(href, location.href);
            if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            location.href = resolvedUrl.href;
          }, true);

          document.addEventListener("submit", (event) => {
            const form = event.target instanceof HTMLFormElement ? event.target : null;

            if (!form) {
              return;
            }

            const targetName = form.getAttribute("target");
            if (targetName && targetName.toLowerCase() !== "_self") {
              form.setAttribute("target", "_self");
            }
          }, true);

          for (const anchor of document.querySelectorAll("a[target]")) {
            const targetName = anchor.getAttribute("target");
            if (targetName && targetName.toLowerCase() !== "_self") {
              anchor.setAttribute("target", "_self");
            }
          }

          return "installed";
        })();`,
        true
      );
    } catch (error) {
      console.warn("Internal Defuddle navigation shim failed", error);
    }
  }

  private getFolderButtonText(): string {
    return `Folder: ${this.selectedFolderPath || "Vault root"} ▾`;
  }

  private openFolderPicker() {
    new FolderTreeModal(this.app, (folder) => {
      this.selectedFolderPath = folder.path;
      this.folderButtonEl?.setText(this.getFolderButtonText());
      this.setStatus(`Selected clipping folder: ${folder.path || "Vault root"}`);
    }).open();
  }

  private async saveCurrentPreviewToVault() {
    if (!this.currentPreview) {
      new Notice("Clip a page first, then click Save.");
      return;
    }

    const folderPath = normalizePath(this.selectedFolderPath || "");
    await this.ensureFolderExists(folderPath);

    const baseName = this.sanitizeFileName(this.currentPreview.title || this.currentPreview.pageTitle || "Untitled clip");
    const filePath = await this.getAvailableClipPath(folderPath, baseName);
    const markdown = this.buildPreviewDocument(this.currentPreview);

    await this.app.vault.create(filePath, markdown);
    this.setStatus(`Saved Defuddle Markdown to ${filePath}`);
    new Notice(`Saved clip: ${filePath}`);
  }

  private async ensureFolderExists(folderPath: string) {
    if (!folderPath || this.app.vault.getAbstractFileByPath(folderPath) instanceof TFolder) {
      return;
    }

    const parts = folderPath.split("/").filter(Boolean);
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);

      if (existing instanceof TFolder) {
        continue;
      }

      if (existing) {
        throw new Error(`Cannot create folder because a file already exists at ${currentPath}`);
      }

      await this.app.vault.createFolder(currentPath);
    }
  }

  private async getAvailableClipPath(folderPath: string, baseName: string): Promise<string> {
    const prefix = folderPath ? `${folderPath}/` : "";
    let candidate = normalizePath(`${prefix}${baseName}.md`);
    let index = 2;

    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = normalizePath(`${prefix}${baseName}-${index}.md`);
      index += 1;
    }

    return candidate;
  }

  private sanitizeFileName(value: string): string {
    const sanitized = value
      .replace(/[\\/:*?"<>|#^[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    return sanitized || "Untitled clip";
  }


  private async captureYoutubeTranscript() {
    const currentUrl = this.getCurrentBrowserUrl();
    const videoId = this.getYoutubeVideoId(currentUrl);

    if (!videoId) {
      new Notice("Load a YouTube video before fetching a transcript.");
      this.setStatus("Transcript is only available for YouTube video URLs.");
      return;
    }

    this.setStatus("Fetching YouTube transcript…");

    try {
      const page = await this.captureYoutubePageMetadata(currentUrl, videoId);
      const transcript = await this.fetchYoutubeTranscriptWithFallback(currentUrl);

      if (transcript.length === 0) {
        throw new Error("No transcript lines were returned for this video.");
      }

      const preview = this.buildYoutubeTranscriptPreview(page, transcript);
      this.showDefuddlePreviewPage(preview);
    } catch (error) {
      console.error("Internal Defuddle YouTube transcript failed", error);
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`YouTube transcript failed: ${message}`);
      new Notice(`YouTube transcript failed: ${message}`);
    }
  }

  private async captureYoutubePageMetadata(currentUrl: string, videoId: string): Promise<YoutubePagePayload> {
    const fallbackUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (!this.webviewEl?.src) {
      return {
        url: currentUrl || fallbackUrl,
        videoId,
        title: "YouTube transcript",
        channel: "",
        channelUrl: "",
        description: "",
        published: "",
        capturedAt: new Date().toISOString(),
      };
    }

    try {
      return await this.webviewEl.executeJavaScript<YoutubePagePayload>(
        `(() => {
          const pickText = (selectors) => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              const text = el?.textContent?.replace(/\s+/g, " ").trim();
              if (text) return text;
            }
            return "";
          };
          const pickAttr = (selectors, attr) => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              const value = el?.getAttribute?.(attr);
              if (value) return value;
            }
            return "";
          };
          const title = pickAttr(["meta[property='og:title']", "meta[name='title']"], "content") || document.title.replace(/ - YouTube$/, "");
          const description = pickAttr(["meta[property='og:description']", "meta[name='description']"], "content");
          const channel = pickText(["#owner #channel-name a", "ytd-video-owner-renderer #channel-name a", "#upload-info #channel-name a", "meta[itemprop='author'] [itemprop='name']"]);
          const channelUrlRaw = pickAttr(["#owner #channel-name a", "ytd-video-owner-renderer #channel-name a", "#upload-info #channel-name a", "link[itemprop='url']"], "href");
          let channelUrl = "";
          try { channelUrl = channelUrlRaw ? new URL(channelUrlRaw, location.href).href : ""; } catch {}
          return {
            url: location.href,
            videoId: ${JSON.stringify(videoId)},
            title: title || "YouTube transcript",
            channel,
            channelUrl,
            description: description || "",
            published: "",
            capturedAt: new Date().toISOString(),
          };
        })();`,
        true
      );
    } catch (error) {
      console.warn("YouTube metadata capture failed", error);
      return {
        url: currentUrl || fallbackUrl,
        videoId,
        title: "YouTube transcript",
        channel: "",
        channelUrl: "",
        description: "",
        published: "",
        capturedAt: new Date().toISOString(),
      };
    }
  }

  private async fetchYoutubeTranscriptWithFallback(url: string): Promise<TranscriptResponse[]> {
    const obsidianFetch = this.createObsidianFetchAdapter();

    try {
      return await fetchTranscript(url, { lang: "en", fetch: obsidianFetch });
    } catch (firstError) {
      console.warn("English YouTube transcript fetch failed; retrying with default language", firstError);
      return await fetchTranscript(url, { fetch: obsidianFetch });
    }
  }

  private createObsidianFetchAdapter(): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const headers: Record<string, string> = {};

      if (init?.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init?.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else if (init?.headers) {
        const initHeaders = init.headers as Record<string, string>;
        Object.keys(initHeaders).forEach((key) => {
          headers[key] = String(initHeaders[key]);
        });
      }

      const response = await requestUrl({
        url,
        method: init?.method || "GET",
        headers,
        body: typeof init?.body === "string" ? init.body : undefined,
        throw: false,
      });

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: String(response.status),
        text: async () => response.text,
        json: async () => response.json,
      } as Response;
    }) as typeof fetch;
  }

  private buildYoutubeTranscriptPreview(page: YoutubePagePayload, transcript: TranscriptResponse[]): DefuddlePreviewPayload {
    const normalizedTranscript = this.normalizeTranscriptTiming(transcript);
    const transcriptBlocks = this.groupTranscriptIntoParagraphs(normalizedTranscript);
    const transcriptMarkdownLines = this.addBlankLinesBetweenBlocks(transcriptBlocks);

    const durationSeconds = normalizedTranscript.reduce((max, entry) => Math.max(max, (entry.offset || 0) + (entry.duration || 0)), 0);
    const markdown = [`# ${page.title}`, "", `Source: ${page.url}`, page.channel ? `Channel: ${page.channel}` : "", "", "## Transcript", "", ...transcriptMarkdownLines]
      .filter((line, index, array) => line || array[index - 1])
      .join("\n")
      .trim();

    return {
      url: page.url,
      pageTitle: page.title,
      title: page.title,
      author: page.channel,
      authorUrl: page.channelUrl,
      site: "YouTube",
      domain: "youtube.com",
      language: transcript[0]?.lang || "",
      description: page.description,
      published: page.published,
      wordCount: this.countWords(markdown),
      extractorType: "youtube-transcript",
      extractionSource: "YouTube transcript captions",
      htmlLength: 0,
      extractedHtmlLength: 0,
      markdownLength: markdown.length,
      markdown,
      capturedAt: page.capturedAt,
      contentType: "youtube-transcript",
      videoId: page.videoId,
      durationSeconds,
    };
  }

  private groupTranscriptIntoParagraphs(transcript: TranscriptResponse[]): string[] {
    const blocks: string[] = [];
    let currentText = "";
    let currentStart = 0;
    let previousEnd = 0;

    const flush = () => {
      const text = currentText.replace(/\s+/g, " ").trim();
      if (text) {
        blocks.push(`[${this.formatTimestamp(currentStart)}] ${text}`);
      }
      currentText = "";
    };

    transcript.forEach((entry) => {
      const text = this.cleanTranscriptText(entry.text);
      if (!text) {
        return;
      }

      const entryStart = entry.offset || 0;
      const entryEnd = entryStart + (entry.duration || 0);
      const gapSeconds = currentText ? entryStart - previousEnd : 0;
      const currentEndsSentence = this.endsSentence(currentText);
      const shouldStartNewParagraph = Boolean(
        currentText
        && (
          gapSeconds > 8
          || (currentEndsSentence && currentText.length >= 240)
          || currentText.length >= 900
        )
      );

      if (shouldStartNewParagraph) {
        flush();
      }

      if (!currentText) {
        currentStart = entryStart;
        currentText = text;
      } else {
        currentText = `${currentText} ${text}`;
      }

      previousEnd = entryEnd;
    });

    flush();

    return blocks;
  }

  private endsSentence(text: string): boolean {
    return /[.!?…]["')\]]?$/.test(text.trim());
  }

  private addBlankLinesBetweenBlocks(blocks: string[]): string[] {
    const lines: string[] = [];

    blocks.forEach((block, index) => {
      if (index > 0) {
        lines.push("");
      }
      lines.push(block);
    });

    return lines;
  }

  private normalizeTranscriptTiming(transcript: TranscriptResponse[]): TranscriptResponse[] {
    const maxOffset = transcript.reduce((max, entry) => Math.max(max, entry.offset || 0), 0);
    const appearsToUseMilliseconds = maxOffset > 60 * 60 * 6;

    if (!appearsToUseMilliseconds) {
      return transcript;
    }

    return transcript.map((entry) => ({
      ...entry,
      offset: (entry.offset || 0) / 1000,
      duration: (entry.duration || 0) / 1000,
    }));
  }

  private cleanTranscriptText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  }

  private formatTimestamp(secondsValue: number): string {
    const totalSeconds = Math.max(0, Math.floor(secondsValue || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const twoDigit = (value: number) => value < 10 ? `0${value}` : String(value);

    if (hours > 0) {
      return `${hours}:${twoDigit(minutes)}:${twoDigit(seconds)}`;
    }

    return `${minutes}:${twoDigit(seconds)}`;
  }

  private getYoutubeVideoId(rawUrl: string): string | null {
    const trimmed = rawUrl.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      const hostname = url.hostname.replace(/^www\./, "");

      if (hostname === "youtu.be") {
        return this.normalizeYoutubeId(url.pathname.split("/").filter(Boolean)[0] || "");
      }

      if (hostname.endsWith("youtube.com")) {
        const watchId = url.searchParams.get("v");
        if (watchId) {
          return this.normalizeYoutubeId(watchId);
        }

        const parts = url.pathname.split("/").filter(Boolean);
        const markerIndex = parts.findIndex((part) => ["shorts", "embed", "live"].includes(part));
        if (markerIndex >= 0 && parts[markerIndex + 1]) {
          return this.normalizeYoutubeId(parts[markerIndex + 1]);
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private normalizeYoutubeId(value: string): string | null {
    const id = value.trim().match(/^[a-zA-Z0-9_-]{11}/)?.[0] || "";
    return id || null;
  }

  private async captureRenderedDomDebug() {
    if (!this.webviewEl?.src) {
      new Notice("Load a page before clipping.");
      return;
    }

    this.setStatus("Capturing rendered HTML and running Defuddle…");

    try {
      const capture = await this.webviewEl.executeJavaScript<CaptureDebugPayload>(
        `(() => {
          const selectedText = String(window.getSelection?.() ?? "");
          const bodyText = document.body?.innerText ?? "";
          const html = document.documentElement?.outerHTML ?? "";

          return {
            url: location.href,
            title: document.title,
            selectedText,
            html,
            bodyTextPreview: bodyText.slice(0, 2000),
            htmlLength: html.length,
            bodyTextLength: bodyText.length,
            capturedAt: new Date().toISOString(),
          };
        })();`,
        true
      );

      const preview = await this.extractDefuddlePreview(capture);
      this.showDefuddlePreviewPage(preview);
    } catch (error) {
      console.error("Internal Defuddle extraction failed", error);
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Defuddle extraction failed: ${message}`);
      new Notice(`Defuddle extraction failed: ${message}`);
    }
  }

  private async extractDefuddlePreview(capture: CaptureDebugPayload): Promise<DefuddlePreviewPayload> {
    const renderedCandidate = await this.extractDefuddleCandidate(capture.html, capture.url, capture.title, capture.htmlLength, "rendered webview DOM");
    const fetchedCandidate = await this.tryExtractFetchedCandidate(capture);
    const bestCandidate = this.chooseBestDefuddleCandidate(renderedCandidate, fetchedCandidate);

    return {
      ...bestCandidate,
      capturedAt: capture.capturedAt,
    };
  }

  private async tryExtractFetchedCandidate(capture: CaptureDebugPayload): Promise<Omit<DefuddlePreviewPayload, "capturedAt"> | null> {
    try {
      this.setStatus("Fetching clean source HTML for Defuddle comparison…");
      const response = await requestUrl({
        url: capture.url,
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.text || response.text.length < 500) {
        return null;
      }

      return await this.extractDefuddleCandidate(response.text, capture.url, capture.title, response.text.length, "clean source fetch");
    } catch (error) {
      console.warn("Internal Defuddle clean source fetch failed; using rendered DOM", error);
      return null;
    }
  }

  private async extractDefuddleCandidate(
    html: string,
    url: string,
    pageTitle: string,
    htmlLength: number,
    extractionSource: string
  ): Promise<Omit<DefuddlePreviewPayload, "capturedAt">> {
    const parsedDocument = new DOMParser().parseFromString(html, "text/html");
    const defuddle = new Defuddle(parsedDocument, {
      url,
      separateMarkdown: true,
      markdown: true,
      language: "en",
    });

    const result = await this.parseWithTimeout(defuddle, 10000);
    const markdown = this.cleanMarkdown(this.getMarkdownFromDefuddleResult(result, url));
    const author = result.author || "";

    return {
      url,
      pageTitle,
      title: result.title || pageTitle || "Untitled",
      author,
      authorUrl: this.getAuthorUrl(parsedDocument, author, url),
      site: result.site || "",
      domain: result.domain || this.getDomain(url),
      language: result.language || "en",
      description: result.description || "",
      published: result.published || "",
      wordCount: result.wordCount || this.countWords(markdown),
      extractorType: result.extractorType || "default",
      extractionSource,
      htmlLength,
      extractedHtmlLength: result.content?.length || 0,
      markdownLength: markdown.length,
      markdown,
    };
  }

  private getAuthorUrl(document: Document, author: string, pageUrl: string): string {
    const selectors = [
      "a[rel~='author']",
      "a[href*='/author/']",
      "a[href*='/authors/']",
      ".author a[href]",
      ".byline a[href]",
      "[class*='author'] a[href]",
      "[class*='byline'] a[href]",
    ];

    const normalizedAuthor = author.toLowerCase().replace(/\s+/g, " ").trim();

    for (const selector of selectors) {
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(selector))) {
        const href = anchor.getAttribute("href") || "";
        const text = anchor.textContent?.replace(/\s+/g, " ").trim() || "";

        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
          continue;
        }

        const normalizedText = text.toLowerCase();
        const looksLikeAuthor = !normalizedAuthor
          || normalizedText.includes(normalizedAuthor)
          || normalizedAuthor.includes(normalizedText)
          || selector.includes("author");

        if (!looksLikeAuthor) {
          continue;
        }

        try {
          return new URL(href, pageUrl).href;
        } catch {
          continue;
        }
      }
    }

    return "";
  }

  private getMarkdownFromDefuddleResult(result: DefuddleResponse, url: string): string {
    const contentMarkdown = (result.contentMarkdown || "").trim();

    if (contentMarkdown && !this.looksLikeHtml(contentMarkdown)) {
      return contentMarkdown;
    }

    const content = (result.content || contentMarkdown || "").trim();

    if (!content) {
      return "";
    }

    if (this.looksLikeHtml(content)) {
      return createMarkdownContent(content, url).trim();
    }

    return content;
  }

  private looksLikeHtml(value: string): boolean {
    return /<\/?(?:article|section|div|p|a|svg|blockquote|ul|ol|li|h[1-6]|figure|img|table|strong|em|span)\b/i.test(value);
  }

  private chooseBestDefuddleCandidate(
    renderedCandidate: DefuddlePreviewPayload | Omit<DefuddlePreviewPayload, "capturedAt">,
    fetchedCandidate: DefuddlePreviewPayload | Omit<DefuddlePreviewPayload, "capturedAt"> | null
  ): Omit<DefuddlePreviewPayload, "capturedAt"> {
    if (!fetchedCandidate) {
      return renderedCandidate;
    }

    if (fetchedCandidate.wordCount >= 100 && fetchedCandidate.markdownLength >= 1000) {
      return fetchedCandidate;
    }

    const renderedScore = this.scoreDefuddleCandidate(renderedCandidate);
    const fetchedScore = this.scoreDefuddleCandidate(fetchedCandidate);

    return fetchedScore >= renderedScore ? fetchedCandidate : renderedCandidate;
  }

  private scoreDefuddleCandidate(candidate: Pick<DefuddlePreviewPayload, "wordCount" | "markdownLength" | "title" | "description" | "site">): number {
    return candidate.wordCount * 4
      + Math.min(candidate.markdownLength / 40, 500)
      + (candidate.title ? 100 : 0)
      + (candidate.description ? 75 : 0)
      + (candidate.site ? 25 : 0);
  }

  private cleanMarkdown(markdown: string): string {
    return markdown
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private countWords(markdown: string): number {
    return markdown.trim().split(/\s+/).filter(Boolean).length;
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  private async parseWithTimeout(defuddle: Defuddle, timeoutMs: number): Promise<DefuddleResponse> {
    const timeout = new Promise<DefuddleResponse>((_, reject) => {
      window.setTimeout(() => reject(new Error(`Defuddle timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const parse = defuddle.parseAsync().catch(() => defuddle.parse());
    return Promise.race([parse, timeout]);
  }

  private showDefuddlePreviewPage(preview: DefuddlePreviewPayload) {
    if (!this.webviewEl || !this.previewEl) {
      new Notice("Preview surface is not ready.");
      return;
    }

    this.previewEl.setText(this.buildPreviewDocument(preview));
    this.currentPreview = preview;
    if (this.saveButtonEl) {
      this.saveButtonEl.disabled = false;
    }
    this.setBrowserTitle(preview.title || preview.site || DEFAULT_BROWSER_TITLE);
    this.webviewEl.addClass("internal-defuddle-browser-hidden");
    this.previewEl.removeClass("internal-defuddle-browser-hidden");
    this.isPreviewMode = true;
    this.previewEl.scrollTop = 0;
    this.previewEl.focus();
    this.setStatus(`Showing ${preview.contentType === "youtube-transcript" ? "YouTube transcript" : "Defuddle"} preview from ${preview.extractionSource}. Press Backspace or ← to return to the original webpage.`);
    this.updateNavigationState();
  }

  private returnToBrowserPage(showNotice = true) {
    if (!this.isPreviewMode) {
      return;
    }

    this.previewEl?.addClass("internal-defuddle-browser-hidden");
    this.webviewEl?.removeClass("internal-defuddle-browser-hidden");
    this.isPreviewMode = false;
    void this.updateTitleFromWebview();
    this.setStatus("Returned to the original webpage.");
    this.updateNavigationState();

    if (showNotice) {
      new Notice("Returned to webpage");
    }
  }

  private buildPreviewDocument(preview: DefuddlePreviewPayload): string {
    const authorValue = this.getAuthorPropertyValue(preview);
    const yamlLines = [
      "---",
      `title: ${this.toYamlString(preview.title)}`,
      `source: ${this.toYamlString(preview.url)}`,
      authorValue ? `author: ${this.toYamlString(authorValue)}` : "",
      preview.published ? `published: ${this.toYamlDate(preview.published)}` : "",
      `created: ${this.toYamlDate(preview.capturedAt)}`,
      preview.description ? `description: ${this.toYamlString(preview.description)}` : "",
      "tags:",
      "  - clippings",
      "---",
    ].filter(Boolean);

    return `${yamlLines.join("\n")}\n\n${preview.markdown || "[No Markdown generated]"}`;
  }

  private getAuthorPropertyValue(preview: DefuddlePreviewPayload): string {
    if (!preview.author) {
      return "";
    }

    if (!preview.authorUrl) {
      return preview.author;
    }

    return `[${preview.author}](${preview.authorUrl})`;
  }

  private toYamlString(value: string): string {
    return JSON.stringify(value.replace(/\s+/g, " ").trim());
  }

  private toYamlDate(value: string): string {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    const dateMatch = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    return dateMatch ? dateMatch[0] : JSON.stringify(value);
  }

  private updateUrlFromWebview() {
    if (!this.urlInputEl || !this.webviewEl?.getURL) {
      return;
    }

    const currentUrl = this.webviewEl.getURL();
    if (currentUrl) {
      this.urlInputEl.value = currentUrl;
    }
  }

  private async updateTitleFromWebview() {
    if (!this.webviewEl?.src || this.isPreviewMode) {
      return;
    }

    try {
      const title = await this.webviewEl.executeJavaScript<string>("document.title || location.hostname || location.href", true);
      this.setBrowserTitle(title || this.getDomain(this.webviewEl.getURL?.() ?? "") || DEFAULT_BROWSER_TITLE);
    } catch (error) {
      console.warn("Internal Defuddle Browser title update failed", error);
      this.setBrowserTitle(this.getDomain(this.webviewEl.getURL?.() ?? "") || DEFAULT_BROWSER_TITLE);
    }
  }

  private setBrowserTitle(rawTitle: string) {
    const title = this.normalizeTitle(rawTitle);
    this.currentDisplayTitle = title;

    // The title belongs in Obsidian's real tab header, not in the view header.
    // The view header is hidden for this browser so the toolbar/webview can sit
    // directly below the tab bar.
    const leafWithTabEls = this.leaf as WorkspaceLeaf & {
      tabHeaderEl?: HTMLElement;
      tabHeaderInnerTitleEl?: HTMLElement;
    };

    leafWithTabEls.tabHeaderInnerTitleEl?.setText(title);
    leafWithTabEls.tabHeaderEl
      ?.querySelector<HTMLElement>(".workspace-tab-header-inner-title")
      ?.setText(title);

    const leafContainer = this.containerEl.closest<HTMLElement>(".workspace-leaf");
    const activeTabTitle = leafContainer
      ?.closest<HTMLElement>(".workspace-tabs")
      ?.querySelector<HTMLElement>(".workspace-tab-header.is-active .workspace-tab-header-inner-title");
    activeTabTitle?.setText(title);
  }

  private normalizeTitle(rawTitle: string): string {
    const title = rawTitle.replace(/\s+/g, " ").trim();

    if (!title) {
      return DEFAULT_BROWSER_TITLE;
    }

    return title.length > 80 ? `${title.slice(0, 77)}…` : title;
  }

  private updateNavigationState() {
    const canGoBack = this.isPreviewMode || (this.webviewEl?.canGoBack?.() ?? false);
    const canGoForward = this.webviewEl?.canGoForward?.() ?? false;
    const hasPage = Boolean(this.webviewEl?.src);
    const currentUrl = this.getCurrentBrowserUrl();
    const canFetchYoutubeTranscript = Boolean(!this.isPreviewMode && currentUrl && this.getYoutubeVideoId(currentUrl));

    if (this.backButtonEl) {
      this.backButtonEl.disabled = !canGoBack;
    }

    if (this.forwardButtonEl) {
      this.forwardButtonEl.disabled = !canGoForward;
    }

    if (this.reloadButtonEl) {
      this.reloadButtonEl.disabled = !hasPage;
    }

    if (this.transcriptButtonEl) {
      this.transcriptButtonEl.disabled = !canFetchYoutubeTranscript;
      this.transcriptButtonEl.setText(canFetchYoutubeTranscript ? "YouTube Transcript" : "YouTube Transcript");
      this.transcriptButtonEl.setAttribute(
        "title",
        canFetchYoutubeTranscript
          ? "Fetch captions/transcript for this YouTube video"
          : "YouTube Transcript is available after loading a YouTube video"
      );
      this.transcriptButtonEl.toggleClass("is-youtube-ready", canFetchYoutubeTranscript);
    }
  }

  private getCurrentBrowserUrl(): string {
    return this.webviewEl?.getURL?.() || this.webviewEl?.src || this.urlInputEl?.value || "";
  }

  private setStatus(message: string) {
    if (this.statusEl) {
      this.statusEl.setText(message);
    }
  }
}
