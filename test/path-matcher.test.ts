import assert from "node:assert/strict";
import test from "node:test";
import { TagRuleEngine } from "../src/path-matcher";

test("matches all enabled rules and substitutes captures", () => {
  const engine = new TagRuleEngine([
    {
      id: "1",
      name: "course",
      enabled: true,
      pattern: "^courses/(?<course>[^/]+)/",
      mode: "regex",
      tags: ["course-{course}"],
    },
    {
      id: "2",
      name: "notes",
      enabled: true,
      pattern: "courses/*/**",
      mode: "glob",
      tags: ["notes", "{1}"],
    },
    {
      id: "3",
      name: "off",
      enabled: false,
      pattern: "**",
      mode: "glob",
      tags: ["off"],
    },
  ]);
  const matches = engine.match("courses/linux/notes/a.md");
  assert.deepEqual(
    matches.map((m) => m.rule.name),
    ["course", "notes"],
  );
  assert.equal(
    engine.resolveTags(matches[0].rule, matches[0])[0],
    "course-linux",
  );
});
