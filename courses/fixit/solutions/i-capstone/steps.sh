#!/bin/sh
# i-capstone (Fix-It): the kit run as Sam would run it, whose faulty guide
# the Scenario writes; then tier 1 of the source order and the skill's step 3
# naming the venue's written confirmation, whatever form it takes; the guard
# widened to every 555-01xx number but the venues' public ones, and the
# contacts rule made general (valid A); a fresh run's April guide and fact
# table; KIT.md's limits and last test; and the note to Sam, in the Lesson's
# order. Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/stages/tier1/CLAUDE.md" fixit/CLAUDE.md
cp "$SOLUTION/fixit/.claude/skills/attendee-guide/SKILL.md" fixit/.claude/skills/attendee-guide/SKILL.md
cp "$SOLUTION/fixit/.claude/hooks/no-private-numbers.sh" fixit/.claude/hooks/no-private-numbers.sh
chmod +x fixit/.claude/hooks/no-private-numbers.sh
cp "$SOLUTION/fixit/CLAUDE.md" fixit/CLAUDE.md
cp "$SOLUTION/fixit/april/facts.md" fixit/april/facts.md
cp "$SOLUTION/fixit/april/attendee-guide.md" fixit/april/attendee-guide.md
cp "$SOLUTION/fixit/KIT.md" fixit/KIT.md
cp "$SOLUTION/fixit/april/handoff-note.md" fixit/april/handoff-note.md
