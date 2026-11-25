---
name: changelog
description: Adds a one-line entry for the uncommitted change to the link checker to CHANGELOG.md. Use when the user asks for a changelog entry.
model: haiku
effort: low
disable-model-invocation: true
---

Read the uncommitted change to the link checker with `git diff -- src test`. Add one list item (`- `) at the top of `## Unreleased` in CHANGELOG.md that says what changed for someone who runs the checker. Change no other file.

## Why these settings

The input is an exact diff and I review the one line it writes, so a small model at low effort is enough.
