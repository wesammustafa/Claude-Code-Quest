#!/bin/sh
# i-7 (Fix-It): the bookings server added at project scope, pinned and
# read-only (the learner's `claude mcp add --scope project`); the shared
# settings allowing its two reading tools and denying cancel_booking; the
# March fact table's open item from the run with the connection down; and
# the attendee-guide skill's first step and KIT.md saying what the
# connection does and what happens when it's down, in the Lesson's order.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/.mcp.json" fixit/.mcp.json
cp "$SOLUTION/fixit/.claude/settings.json" fixit/.claude/settings.json
cp "$SOLUTION/fixit/march/facts.md" fixit/march/facts.md
cp "$SOLUTION/fixit/.claude/skills/attendee-guide/SKILL.md" fixit/.claude/skills/attendee-guide/SKILL.md
cp "$SOLUTION/fixit/KIT.md" fixit/KIT.md
