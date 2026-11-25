#!/bin/sh
# i-4 (Fix-It): Claude denies reads of every private/ folder in the shared
# settings, then asks before every command; denies edits to sources/, the
# bookings and the venue emails (valid A); writes the no-private-numbers
# guard, which blocks exactly 555-0187 on a public page, and registers it on
# Edit|Write, failing closed; and adds the access line with the library's
# number, which the guard lets through, in the Lesson's order.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
mkdir -p fixit/.claude
cp "$SOLUTION/stages/private/settings.json" fixit/.claude/settings.json
cp "$SOLUTION/stages/ask/settings.json" fixit/.claude/settings.json
cp "$SOLUTION/stages/sources/settings.json" fixit/.claude/settings.json
mkdir -p fixit/.claude/hooks
cp "$SOLUTION/fixit/.claude/hooks/no-private-numbers.sh" fixit/.claude/hooks/no-private-numbers.sh
chmod +x fixit/.claude/hooks/no-private-numbers.sh
cp "$SOLUTION/fixit/.claude/settings.json" fixit/.claude/settings.json
cp "$SOLUTION/fixit/march/attendee-guide.md" fixit/march/attendee-guide.md
