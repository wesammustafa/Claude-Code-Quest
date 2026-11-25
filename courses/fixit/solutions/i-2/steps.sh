#!/bin/sh
# i-2 (Fix-It): Claude's auto memory loses Room B's limit and the events
# desk's number, fixit/CLAUDE.md keeps only the rules that hold every month,
# a fresh session writes the March access note from memory, and Sam's
# checklist becomes a rule scoped to the public pages, in the Lesson's order.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
top=$(git rev-parse --show-toplevel)
memory="$HOME/.claude/projects/$(printf '%s' "$top" | tr -c 'A-Za-z0-9' '-')/memory/MEMORY.md"
if [ -f "$memory" ]; then
  grep -v -e 'Room B' -e '555-0100' "$memory" > "$memory.new" || true
  mv "$memory.new" "$memory"
fi
cp "$SOLUTION/fixit/CLAUDE.md" fixit/CLAUDE.md
cp "$SOLUTION/fixit/march/access-note.md" fixit/march/access-note.md
mkdir -p fixit/.claude/rules
cp "$SOLUTION/fixit/.claude/rules/public-pages.md" fixit/.claude/rules/public-pages.md
