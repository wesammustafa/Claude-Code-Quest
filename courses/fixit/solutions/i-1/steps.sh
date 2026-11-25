#!/bin/sh
# i-1 (Fix-It): Claude makes the attendee-guide skill from the March steps,
# with its template; its description is rewritten to load for the attendee
# guide and not the rota; step 3 gains the rule that settles March's limit;
# the skill, run on March again, writes the guide with 30 places; and
# KIT.md says how to run it, in the Lesson's order.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
mkdir -p fixit/.claude/skills/attendee-guide
cp "$SOLUTION/fixit/.claude/skills/attendee-guide/template.md" fixit/.claude/skills/attendee-guide/template.md
cp "$SOLUTION/description-first/SKILL.md" fixit/.claude/skills/attendee-guide/SKILL.md
cp "$SOLUTION/fixit/.claude/skills/attendee-guide/SKILL.md" fixit/.claude/skills/attendee-guide/SKILL.md
cp "$SOLUTION/fixit/march/attendee-guide.md" fixit/march/attendee-guide.md
cp "$SOLUTION/fixit/KIT.md" fixit/KIT.md
