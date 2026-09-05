import {
  App,
  Modal,
  PluginSettingTab,
  Setting,
  TextComponent,
  ToggleComponent,
} from "obsidian";
import { matchPath, substitute } from "obsidian-path-matcher";
import type FolderTagsPlugin from "./main";
import type { TagRule } from "./rules";

export class FolderTagsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: FolderTagsPlugin,
  ) {
    super(app, plugin);
  }
  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Folder Tags" });
    this.renderGeneral();
    this.renderRules();
  }
  private renderGeneral(): void {
    this.containerEl.createEl("h3", { text: "General" });
    new Setting(this.containerEl).setName("Enable plugin").addToggle((t) =>
      t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
        this.plugin.settings.enabled = v;
        await this.plugin.saveSettings();
      }),
    );
    new Setting(this.containerEl)
      .setName("Apply automatically")
      .setDesc("Apply matching tags when a new Markdown file is created.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.automatic).onChange(async (v) => {
          this.plugin.settings.automatic = v;
          await this.plugin.saveSettings();
        }),
      );
  }
  private renderRules(): void {
    this.containerEl.createEl("h3", { text: "Rules" });
    for (const [index, rule] of this.plugin.settings.rules.entries())
      this.renderRule(rule, index);
    new Setting(this.containerEl).addButton((b) =>
      b
        .setButtonText("Add rule")
        .setCta()
        .onClick(async () => {
          this.plugin.settings.rules.push({
            id: crypto.randomUUID(),
            name: `Rule ${this.plugin.settings.rules.length + 1}`,
            enabled: true,
            pattern: "^notes/",
            mode: "regex",
            tags: ["example"],
          });
          await this.plugin.saveSettings();
          this.display();
        }),
    );
  }
  private renderRule(rule: TagRule, index: number): void {
    const details = this.containerEl.createEl("details", {
      cls: "folder-tags-rule",
    });
    const summary = details.createEl("summary", {
      cls: "folder-tags-rule-header",
    });
    const left = summary.createDiv({ cls: "folder-tags-rule-header-left" });
    const icon = left.createSpan({
      cls: "folder-tags-rule-collapse",
      text: "▾",
    });
    new TextComponent(left)
      .setValue(rule.name)
      .setPlaceholder(`Rule ${index + 1}`)
      .onChange(async (v) => {
        rule.name = v.trim() || `Rule ${index + 1}`;
        await this.plugin.saveSettings();
      })
      .inputEl.addClass("folder-tags-rule-name");
    new ToggleComponent(summary).setValue(rule.enabled).onChange(async (v) => {
      rule.enabled = v;
      await this.plugin.saveSettings();
    });
    const body = details.createDiv({ cls: "folder-tags-rule-body" });
    new Setting(body).setName("Pattern").addText((t) =>
      t
        .setValue(rule.pattern)
        .setPlaceholder("^courses/(?<course>[^/]+)/")
        .onChange(async (v) => {
          rule.pattern = v;
          await this.plugin.saveSettings();
        }),
    );
    new Setting(body).setName("Mode").addDropdown((d) =>
      d
        .addOption("regex", "Regex")
        .addOption("glob", "Glob")
        .setValue(rule.mode)
        .onChange(async (v) => {
          rule.mode = v === "glob" ? "glob" : "regex";
          await this.plugin.saveSettings();
        }),
    );
    new Setting(body)
      .setName("Tags")
      .setDesc("Comma-separated tags; supports {name} and {1} captures.")
      .addText((t) =>
        t.setValue(rule.tags.join(", ")).onChange(async (v) => {
          rule.tags = v
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          await this.plugin.saveSettings();
        }),
      );
    new Setting(body)
      .addButton((b) =>
        b
          .setButtonText("Test")
          .onClick(() => new RuleTestModal(this.app, rule).open()),
      )
      .addButton((b) =>
        b.setButtonText("Duplicate").onClick(async () => {
          this.plugin.settings.rules.splice(index + 1, 0, {
            ...rule,
            id: crypto.randomUUID(),
            name: `${rule.name} copy`,
            tags: [...rule.tags],
          });
          await this.plugin.saveSettings();
          this.display();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Delete")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.rules = this.plugin.settings.rules.filter(
              (x) => x.id !== rule.id,
            );
            await this.plugin.saveSettings();
            this.display();
          }),
      );
    details.addEventListener("toggle", () =>
      icon.setText(details.open ? "▾" : "▸"),
    );
    details.open = false;
  }
}

class RuleTestModal extends Modal {
  constructor(
    app: App,
    private readonly rule: TagRule,
  ) {
    super(app);
  }
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: `Test rule: ${this.rule.name}` });
    new Setting(this.contentEl)
      .setName("Path")
      .setDesc("Enter a vault-relative path to test.")
      .addText((t) => {
        t.setPlaceholder("courses/linux/notes/network.md").onChange(() =>
          this.run(t.inputEl.value),
        );
      });
    this.run("");
  }
  private run(path: string): void {
    const el =
      this.contentEl.querySelector(".folder-tags-test-result") ??
      this.contentEl.createDiv({ cls: "folder-tags-test-result" });
    el.empty();
    if (!path.trim()) {
      el.createEl("p", { text: "Enter a path to test." });
      return;
    }
    try {
      const match = matchPath(path.trim(), this.rule.pattern, this.rule.mode);
      if (!match.matched) {
        el.createEl("h3", { text: "✗ Not matched" });
        return;
      }
      el.createEl("h3", { text: "✓ Matched" });
      new Setting(el as HTMLElement)
        .setName("Full match")
        .setDesc(match.fullMatch ?? "");
      for (const [i, value] of match.groups.entries())
        new Setting(el as HTMLElement)
          .setName(`{${i + 1}}`)
          .setDesc(value ?? "");
      for (const [name, value] of Object.entries(match.namedGroups))
        new Setting(el as HTMLElement)
          .setName(`{${name}}`)
          .setDesc(value ?? "");
      new Setting(el as HTMLElement)
        .setName("Tags")
        .setDesc(
          this.rule.tags.map((tag) => substitute(tag, match)).join(", "),
        );
    } catch (error) {
      el.createEl("h3", { text: "✗ Error" });
      el.createEl("p", {
        text: error instanceof Error ? error.message : String(error),
      });
    }
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
