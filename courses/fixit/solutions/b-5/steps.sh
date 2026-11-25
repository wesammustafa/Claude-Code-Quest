#!/bin/sh
# b-5 (Fix-It): the readiness note Claude wrote in the worked example, with
# the source ranking and the open Park Lane line Claude added on request,
# and the door sign given the guide's time. The fresh check before them
# reads and reports only, so it needs no line here.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/feb/door-sign.md" fixit/feb/door-sign.md
cp "$SOLUTION/fixit/feb/readiness-note.md" fixit/feb/readiness-note.md
