#!/bin/sh
# b-2 (Fix-It): the handout and door sign from the planned job, then the
# volunteers' reminder from the Learner's own brief. Claude writes each file;
# the Learner approves the edits and sends the plan that would change a
# source back, so no source changes.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/feb/what-to-bring.md" fixit/feb/what-to-bring.md
cp "$SOLUTION/fixit/feb/door-sign.md" fixit/feb/door-sign.md
cp "$SOLUTION/fixit/feb/volunteer-reminder.md" fixit/feb/volunteer-reminder.md
