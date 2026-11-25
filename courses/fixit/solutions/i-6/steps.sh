#!/bin/sh
# i-6 (Fix-It): Claude writes the read-only guide-reviewer subagent; of its
# two February findings, only the right one, the rewiring rule, goes into
# the February guide and its fact table, and the reviewer is told which
# source wins; its model is set to haiku; the March review log answers its
# two March findings, each with the source that decided it; and the
# attendee-guide skill hands each guide to the reviewer, in the Lesson's
# order.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
mkdir -p fixit/.claude/agents
cp "$SOLUTION/stages/reviewer/guide-reviewer.md" fixit/.claude/agents/guide-reviewer.md
cp "$SOLUTION/fixit/feb/attendee-guide.md" fixit/feb/attendee-guide.md
cp "$SOLUTION/fixit/feb/facts.md" fixit/feb/facts.md
cp "$SOLUTION/stages/order/guide-reviewer.md" fixit/.claude/agents/guide-reviewer.md
cp "$SOLUTION/fixit/.claude/agents/guide-reviewer.md" fixit/.claude/agents/guide-reviewer.md
cp "$SOLUTION/fixit/march/review-log.md" fixit/march/review-log.md
cp "$SOLUTION/fixit/.claude/skills/attendee-guide/SKILL.md" fixit/.claude/skills/attendee-guide/SKILL.md
