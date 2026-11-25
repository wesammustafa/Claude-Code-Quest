#!/bin/sh
# b-capstone (Fix-It pilot): the March attendee guide, then the readiness note for Maya.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/march/attendee-guide.md" fixit/march/attendee-guide.md
cp "$SOLUTION/fixit/march/readiness-note.md" fixit/march/readiness-note.md
