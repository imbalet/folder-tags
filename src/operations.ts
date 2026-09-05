import { App, getFrontMatterInfo, parseYaml, TFile } from "obsidian";
import { TagRuleEngine, type ResolvedTagRule } from "./path-matcher";
import { mergeTags, type FolderTagsSettings } from "./rules";
import { filterFilesInFolder } from "./path-utils";

export interface TagApplyResult {
  file: TFile;
  applied: boolean;
  skipped: boolean;
  reason?: string;
  existingTags?: string[];
  addedTags?: string[];
  finalTags?: string[];
  rules?: string[];
  error?: string;
}

function readExistingTags(content: string): unknown[] {
  const info = getFrontMatterInfo(content);
  if (!info.exists) return [];
  try {
    const parsed = parseYaml(info.frontmatter) as Record<
      string,
      unknown
    > | null;
    if (!parsed || typeof parsed !== "object") return [];
    const tags = parsed.tags;
    return Array.isArray(tags) ? tags : typeof tags === "string" ? [tags] : [];
  } catch {
    return [];
  }
}

export class TagOperations {
  constructor(
    private readonly app: App,
    private readonly settings: FolderTagsSettings,
  ) {}

  private matches(file: TFile): ResolvedTagRule[] {
    return new TagRuleEngine(this.settings.rules).match(file.path);
  }

  private calculate(file: TFile, existing: readonly unknown[]) {
    const engine = new TagRuleEngine(this.settings.rules);
    const matches = engine.match(file.path);
    const additions = matches.flatMap((match) =>
      engine.resolveTags(match.rule, match),
    );
    const finalTags = mergeTags(existing, additions);
    const existingTags = mergeTags(existing, []);
    const existingSet = new Set(existingTags);
    return {
      matches,
      existingTags,
      additions: mergeTags([], additions),
      addedTags: finalTags.filter((tag) => !existingSet.has(tag)),
      finalTags,
    };
  }

  async previewToFile(file: TFile): Promise<TagApplyResult> {
    if (file.extension !== "md")
      return { file, applied: false, skipped: true, reason: "not-markdown" };
    if (!this.settings.enabled)
      return { file, applied: false, skipped: true, reason: "disabled" };
    try {
      const content = await this.app.vault.read(file);
      const result = this.calculate(file, readExistingTags(content));
      if (!result.matches.length)
        return {
          file,
          applied: false,
          skipped: true,
          reason: "no-rule",
          existingTags: result.existingTags,
          finalTags: result.finalTags,
        };
      return {
        file,
        applied: false,
        skipped: result.addedTags.length === 0,
        reason: result.addedTags.length ? "ready" : "already-applied",
        existingTags: result.existingTags,
        addedTags: result.addedTags,
        finalTags: result.finalTags,
        rules: result.matches.map((x) => x.rule.name),
      };
    } catch (error) {
      return {
        file,
        applied: false,
        skipped: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async applyToFile(file: TFile): Promise<TagApplyResult> {
    const preview = await this.previewToFile(file);
    if (preview.skipped || preview.error || !preview.addedTags?.length)
      return preview;
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        const existing = Array.isArray(frontmatter.tags)
          ? frontmatter.tags
          : typeof frontmatter.tags === "string"
            ? [frontmatter.tags]
            : [];
        frontmatter.tags = mergeTags(existing, preview.addedTags ?? []);
      });
      return {
        ...preview,
        applied: true,
        skipped: false,
        reason: "applied",
        finalTags: [...(preview.finalTags ?? [])],
      };
    } catch (error) {
      return {
        ...preview,
        applied: false,
        skipped: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async applyToFiles(files: TFile[]): Promise<TagApplyResult[]> {
    const results: TagApplyResult[] = [];
    for (const file of files) results.push(await this.applyToFile(file));
    return results;
  }
  async previewToFiles(files: TFile[]): Promise<TagApplyResult[]> {
    return Promise.all(files.map((file) => this.previewToFile(file)));
  }
  async applyToFolder(path: string): Promise<TagApplyResult[]> {
    return this.applyToFiles(
      filterFilesInFolder(this.app.vault.getMarkdownFiles(), path),
    );
  }
  async previewToFolder(path: string): Promise<TagApplyResult[]> {
    return this.previewToFiles(
      filterFilesInFolder(this.app.vault.getMarkdownFiles(), path),
    );
  }
  async applyToVault(): Promise<TagApplyResult[]> {
    return this.applyToFiles(this.app.vault.getMarkdownFiles());
  }
  async previewToVault(): Promise<TagApplyResult[]> {
    return this.previewToFiles(this.app.vault.getMarkdownFiles());
  }
}

export function summarizeResults(results: TagApplyResult[]): string {
  return [
    `Applied: ${results.filter((x) => x.applied).length}`,
    `Skipped: ${results.filter((x) => x.skipped).length}`,
    `Errors: ${results.filter((x) => x.error).length}`,
  ].join(" • ");
}
