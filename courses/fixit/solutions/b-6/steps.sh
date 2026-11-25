#!/bin/sh
# b-6 (Fix-It pilot): the fact table, then the February guide corrected to match it.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/feb/fact-table.md" fixit/feb/fact-table.md
cp "$SOLUTION/fixit/feb/draft-attendee-guide.md" fixit/feb/draft-attendee-guide.md
