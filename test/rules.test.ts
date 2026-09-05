import assert from "node:assert/strict";
import test from "node:test";
import { mergeTags, normalizeSettings } from "../src/rules";

test("normalizes settings and rules", () => {
  const settings = normalizeSettings({
    enabled: false,
    rules: [{ pattern: "x", tags: ["a"] }, { pattern: "", tags: ["b"] }, null],
  });
  assert.equal(settings.enabled, false);
  assert.equal(settings.rules.length, 1);
  assert.equal(settings.rules[0].name, "Rule 1");
});

test("merges tags, removes hashes, empties, and duplicates", () => {
  assert.deepEqual(
    mergeTags(["#one", "two", 4], ["two", " #three ", "###one", ""]),
    ["one", "two", "three"],
  );
});
