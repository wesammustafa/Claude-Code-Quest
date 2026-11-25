#!/bin/sh
# a-3 lab: the goal's session points the library links in samples/ at
# /whats-on/ (Claude's edits, here the solution's pages), which are committed
# on their own; the audit workflow, saved from /workflows to the project's
# .claude/workflows/ and changed to take its folder from args, is committed
# after them.
set -eu
cp "$SOLUTION/samples/june.md" samples/june.md
cp "$SOLUTION/samples/july.md" samples/july.md
cp "$SOLUTION/samples/schedule.md" samples/schedule.md
git add samples
git commit -q -m "Point the library links at /whats-on/"
cp "$SOLUTION/.claude/workflows/audit-dropped-errors.js" .claude/workflows/audit-dropped-errors.js
git add .claude/workflows/audit-dropped-errors.js
git commit -q -m "Add a workflow that audits dropped errors"
