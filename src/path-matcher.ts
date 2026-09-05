import { RuleMatcher, substitute, type RuleMatch } from "obsidian-path-matcher";

import type { TagRule } from "./rules";

export interface ResolvedTagRule {
  rule: TagRule;
  match: RuleMatch<TagRule>;
}

export class TagRuleEngine {
  private readonly matcher: RuleMatcher<TagRule>;

  constructor(rules: readonly TagRule[]) {
    this.matcher = new RuleMatcher(
      rules
        .filter((rule) => rule.enabled)
        .map((rule) => ({
          pattern: rule.pattern,
          mode: rule.mode,
          value: rule,
        })),
    );
  }

  match(path: string): ResolvedTagRule[] {
    return this.matcher.matchAll(path).map((match) => ({
      rule: match.rule.value,
      match,
    }));
  }

  resolveTags(rule: TagRule, match: ResolvedTagRule): string[] {
    return rule.tags.map((tag) => substitute(tag, match.match.match));
  }
}
