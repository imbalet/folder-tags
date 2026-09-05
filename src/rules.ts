import type { MatchMode } from "obsidian-path-matcher";

export type { MatchMode };

export interface TagRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string;
  mode: MatchMode;
  tags: string[];
}

export interface FolderTagsSettings {
  enabled: boolean;
  automatic: boolean;
  rules: TagRule[];
}

export const DEFAULT_SETTINGS: FolderTagsSettings = {
  enabled: true,
  automatic: true,
  rules: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];

  return values.filter((tag): tag is string => typeof tag === "string");
}

export function normalizeSettings(data: unknown): FolderTagsSettings {
  const source = isRecord(data) ? data : {};
  const rawRules = Array.isArray(source.rules) ? source.rules : [];

  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_SETTINGS.enabled,
    automatic:
      typeof source.automatic === "boolean"
        ? source.automatic
        : DEFAULT_SETTINGS.automatic,
    rules: rawRules.flatMap((value, index) => {
      if (!isRecord(value)) return [];

      const pattern = typeof value.pattern === "string" ? value.pattern : "";
      const tags = normalizeTags(value.tags);
      if (!pattern || tags.length === 0) return [];

      return [
        {
          id:
            typeof value.id === "string" && value.id
              ? value.id
              : `rule-${index + 1}`,
          name:
            typeof value.name === "string" && value.name.trim()
              ? value.name.trim()
              : `Rule ${index + 1}`,
          enabled: typeof value.enabled === "boolean" ? value.enabled : true,
          pattern,
          mode: value.mode === "glob" ? "glob" : "regex",
          tags,
        },
      ];
    }),
  };
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, "");
}

export function mergeTags(
  existing: readonly unknown[],
  additions: readonly string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of [...existing, ...additions]) {
    if (typeof value !== "string") continue;
    const tag = normalizeTag(value);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }

  return result;
}
