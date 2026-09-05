# Folder Tags

Folder Tags automatically adds YAML frontmatter tags to Markdown notes based
on their vault-relative paths. It can run when a new note is created or be
invoked manually for an existing note, folder, or the entire vault.

## Settings and rules

The plugin has two global settings:

- `Enable plugin` turns all automatic and manual processing on or off;
- `Apply automatically` applies matching rules when a Markdown file is
  created.

Each rule contains a name, an enabled switch, a pattern, a matching mode, and
one or more comma-separated tags. Every enabled rule that matches the full
file path is applied, so one note can receive tags from several rules.

### Regex

Regex patterns use JavaScript regular expression syntax. Named and positional
capture groups can be used in tag values:

```text
Pattern: ^courses/(?<course>[^/]+)/(?<topic>[^/]+)/notes/
Mode: Regex
Tags: course-{course}, topic-{topic}, note-{1}
```

For `courses/linux/networking/notes/firewall.md`, this produces:

```text
course-linux, topic-networking, note-linux
```

`{0}` is the full match. `{1}`, `{2}`, and so on refer to positional capture
groups. `{course}` and `{topic}` refer to named groups.

### Glob

Glob patterns support:

- `*` — any characters except `/`;
- `**` — any characters, including `/`;
- `?` — exactly one character except `/`.

Examples:

```text
Pattern: projects/*/notes/*.md
Mode: Glob
Tags: project-note
```

This matches a note directly inside `projects/<project>/notes/`. A pattern
such as `projects/**/README.md` also matches through nested folders.

## Frontmatter behavior

Tags are merged into the existing YAML frontmatter without replacing manual
tags or creating duplicates. Values are trimmed, empty values are ignored,
and leading `#` is removed.

The resulting field is written as a YAML list:

```yaml
---
tags:
  - personal
  - course-linux
---
```

Running the same rule again is safe and does not add another copy of a tag.

## Commands and preview

The command palette provides commands to apply tags to the current file,
current folder, or entire vault. Matching can also be previewed for each of
these scopes without changing files.

Preview shows matching rules, existing tags, tags that would be added, and
the final deduplicated tag set. The `Test` button on a rule accepts a
vault-relative path and shows whether it matches, its captures, and resolved
tag values without modifying a note.
