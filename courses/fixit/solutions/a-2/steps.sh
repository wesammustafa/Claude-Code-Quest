#!/bin/sh
# a-2 (Fix-It): the battery rule on the three session pages and then the
# schedule, then an easy-read version beside each session page, with the
# pages themselves left as they were. Claude makes every change; the
# learner asks and checks, then fills in how-to-run.md with the way each
# of two jobs runs, in the files tab. Runs in <copy>/project; $SOLUTION
# holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/summer/public/june.md" fixit/summer/public/june.md
cp "$SOLUTION/fixit/summer/public/july.md" fixit/summer/public/july.md
cp "$SOLUTION/fixit/summer/public/august.md" fixit/summer/public/august.md
cp "$SOLUTION/fixit/summer/public/schedule.md" fixit/summer/public/schedule.md
cp "$SOLUTION/fixit/summer/public/june-easy.md" fixit/summer/public/june-easy.md
cp "$SOLUTION/fixit/summer/public/july-easy.md" fixit/summer/public/july-easy.md
cp "$SOLUTION/fixit/summer/public/august-easy.md" fixit/summer/public/august-easy.md
cp "$SOLUTION/fixit/summer/a-2/how-to-run.md" fixit/summer/a-2/how-to-run.md
