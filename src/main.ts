import { App, MarkdownView, Modal, Notice, Plugin, TFile } from "obsidian";
import {
  TagOperations,
  summarizeResults,
  type TagApplyResult,
} from "./operations";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type FolderTagsSettings,
} from "./rules";
import { FolderTagsSettingTab } from "./settings";

export default class FolderTagsPlugin extends Plugin {
  settings: FolderTagsSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    const data: unknown = await this.loadData();
    this.settings = normalizeSettings(data);
    this.addSettingTab(new FolderTagsSettingTab(this.app, this));
    this.registerCommands();
    this.app.workspace.onLayoutReady(() =>
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (
            file instanceof TFile &&
            file.extension === "md" &&
            this.settings.enabled &&
            this.settings.automatic
          )
            void this.applyToFile(file);
        }),
      ),
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private registerCommands(): void {
    this.addCommand({
      id: "apply-current-file",
      name: "Apply tags to current file",
      checkCallback: (checking) =>
        this.withCurrent(checking, (file) => void this.applyToFile(file)),
    });
    this.addCommand({
      id: "apply-current-folder",
      name: "Apply tags to current folder",
      checkCallback: (checking) =>
        this.withCurrent(checking, (file) => void this.runFolder(file, false)),
    });
    this.addCommand({
      id: "apply-entire-vault",
      name: "Apply tags to entire vault",
      callback: () => void this.runVault(false),
    });
    this.addCommand({
      id: "preview-current-file",
      name: "Preview tags for current file",
      checkCallback: (checking) =>
        this.withCurrent(checking, (file) => void this.previewFiles([file])),
    });
    this.addCommand({
      id: "preview-current-folder",
      name: "Preview tags for current folder",
      checkCallback: (checking) =>
        this.withCurrent(checking, (file) => void this.runFolder(file, true)),
    });
    this.addCommand({
      id: "preview-entire-vault",
      name: "Preview tags for entire vault",
      callback: () => void this.runVault(true),
    });
  }

  private withCurrent(
    checking: boolean,
    action: (file: TFile) => void,
  ): boolean {
    const file = this.getActiveMarkdownFile();
    if (!file) return false;
    if (!checking) action(file);
    return true;
  }
  private getActiveMarkdownFile(): TFile | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
  }
  private async applyToFile(file: TFile): Promise<void> {
    const result = await new TagOperations(this.app, this.settings).applyToFile(
      file,
    );
    if (result.applied) new Notice(`Tags applied: ${file.path}`);
    else if (result.error) new Notice(`Tag error: ${result.error}`);
  }
  private async runFolder(file: TFile, preview: boolean): Promise<void> {
    const op = new TagOperations(this.app, this.settings);
    const results = preview
      ? await op.previewToFolder(file.parent?.path ?? "")
      : await op.applyToFolder(file.parent?.path ?? "");
    preview
      ? new PreviewModal(this.app, results).open()
      : new Notice(summarizeResults(results));
  }
  private async runVault(preview: boolean): Promise<void> {
    const op = new TagOperations(this.app, this.settings);
    const results = preview
      ? await op.previewToVault()
      : await op.applyToVault();
    preview
      ? new PreviewModal(this.app, results).open()
      : new Notice(summarizeResults(results));
  }
  private async previewFiles(files: TFile[]): Promise<void> {
    new PreviewModal(
      this.app,
      await new TagOperations(this.app, this.settings).previewToFiles(files),
    ).open();
  }
}

class PreviewModal extends Modal {
  constructor(
    app: App,
    private readonly results: TagApplyResult[],
  ) {
    super(app);
  }
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Folder Tags preview" });
    if (!this.results.length) {
      this.contentEl.createEl("p", { text: "No Markdown files found." });
      return;
    }
    for (const result of this.results) {
      const item = this.contentEl.createDiv({
        cls: "folder-tags-preview-item",
      });
      item.createEl("h3", { text: result.file.path });
      if (result.error) {
        item.createEl("p", { text: `Error: ${result.error}` });
        continue;
      }
      if (result.rules?.length)
        item.createEl("p", { text: `Rules: ${result.rules.join(", ")}` });
      item.createEl("p", {
        text: `Existing tags: ${(result.existingTags ?? []).join(", ") || "(none)"}`,
      });
      item.createEl("p", {
        text: `Added tags: ${(result.addedTags ?? []).join(", ") || "(none)"}`,
      });
      item.createEl("p", {
        text: `Final tags: ${(result.finalTags ?? []).join(", ") || "(none)"}`,
      });
      item.createEl("p", { text: `Status: ${result.reason ?? "ready"}` });
    }
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
