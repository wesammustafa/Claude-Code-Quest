---
name: changelog
description: Adds a one-line entry for the uncommitted change to the link checker to CHANGELOG.md. Use when the user asks for a changelog entry.
model: TODO
effort: TODO
disable-model-invocation: true
---

Read the uncommitted change to the link checker with `git diff -- src test`. Add one list item (`- `) at the top of `## Unreleased` in CHANGELOG.md that says what changed for someone who runs the checker. Change no other file.

## Why these settings

TODO: one line on what makes this task routine.
