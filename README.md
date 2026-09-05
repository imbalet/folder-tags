# Folder Tags

Automatically add tags to Markdown notes based on vault-relative paths.

Rules support regular expressions and globs. Regex named captures and positional captures can be used in tags, for example `course-{course}` or `topic-{1}`.

Existing YAML `tags` are preserved and merged without duplicates. Commands apply tags to the current file, folder, or entire vault. Preview commands and each rule's Test button do not modify files.
