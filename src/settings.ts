import {
  App,
  Modal,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem,
  TextComponent,
  ToggleComponent,
} from "obsidian";
import { matchPath, substitute } from "obsidian-path-matcher";
import type FolderTagsPlugin from "./main";
import type { TagRule } from "./rules";

export class FolderTagsSettingTab extends PluginSettingTab {
  private readonly openRuleIds = new Set<string>();

  constructor(
    app: App,
    private readonly plugin: FolderTagsPlugin,
  ) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Settings",
        items: [
          {
            name: "Folder Tags settings",
            desc: "Configure automatic tagging rules.",
            render: (setting) => {
              setting.settingEl.empty();
              setting.settingEl.addClass("folder-tags-settings-container");
              this.renderGeneral(setting.settingEl);
              this.renderRules(setting.settingEl);
            },
          },
        ],
      },
    ];
  }

  private refresh(): void {
    this.captureOpenRules();
    this.update();
  }

  private captureOpenRules(): void {
    for (const details of Array.from(
      this.containerEl.querySelectorAll<HTMLDetailsElement>(
        "details[data-rule-id]",
      ),
    )) {
      const id = details.dataset.ruleId;
      if (!id) continue;
      if (details.open) this.openRuleIds.add(id);
      else this.openRuleIds.delete(id);
    }
  }
  private renderGeneral(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Enable plugin").addToggle((t) =>
      t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
        this.plugin.settings.enabled = v;
        await this.plugin.saveSettings();
      }),
    );
    new Setting(containerEl)
      .setName("Apply automatically")
      .setDesc("Apply matching tags automatically.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.automatic).onChange(async (v) => {
          this.plugin.settings.automatic = v;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Automatic trigger")
      .setDesc("Choose when automatic processing starts.")
      .addDropdown((d) =>
        d
          .addOption("create", "When file is created")
          .addOption("rename", "When file is named")
          .setValue(this.plugin.settings.automaticTrigger)
          .onChange(async (value) => {
            this.plugin.settings.automaticTrigger =
              value === "rename" ? "rename" : "create";
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName("Automatic delay (ms)")
      .setDesc("Wait before applying automatic rules. 0 means immediately.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.automaticDelayMs))
          .onChange(async (value) => {
            const delay = Number(value);
            if (!Number.isFinite(delay)) return;
            this.plugin.settings.automaticDelayMs = Math.max(
              0,
              Math.round(delay),
            );
            await this.plugin.saveSettings();
          }),
      );
  }
  private renderRules(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Rules").setHeading();
    for (const [index, rule] of this.plugin.settings.rules.entries())
      this.renderRule(containerEl, rule, index);
    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText("Add rule")
        .setCta()
        .onClick(async () => {
          const rule: TagRule = {
            id: crypto.randomUUID(),
            name: `Rule ${this.plugin.settings.rules.length + 1}`,
            enabled: true,
            pattern: "^notes/",
            mode: "regex",
            tags: ["example"],
          };
          this.plugin.settings.rules.push(rule);
          this.openRuleIds.add(rule.id);
          await this.plugin.saveSettings();
          this.refresh();
        }),
    );
  }
  private renderRule(
    containerEl: HTMLElement,
    rule: TagRule,
    index: number,
  ): void {
    const details = containerEl.createEl("details", {
      cls: "folder-tags-rule",
    });
    details.dataset.ruleId = rule.id;
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
          this.openRuleIds.add(this.plugin.settings.rules[index + 1].id);
          await this.plugin.saveSettings();
          this.refresh();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Delete")
          .setDestructive()
          .onClick(async () => {
            this.plugin.settings.rules = this.plugin.settings.rules.filter(
              (x) => x.id !== rule.id,
            );
            this.openRuleIds.delete(rule.id);
            await this.plugin.saveSettings();
            this.refresh();
          }),
      );
    details.addEventListener("toggle", () =>
      icon.setText(details.open ? "▾" : "▸"),
    );
    details.open = this.openRuleIds.has(rule.id);
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
