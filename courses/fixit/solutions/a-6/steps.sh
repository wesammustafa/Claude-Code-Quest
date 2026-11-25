#!/bin/sh
# a-6 (Fix-It): Claude drafts the limits card and corrects its overclaim,
# then commits it beside the runner and its bounds, while the personal
# settings file stays ignored. Sam's session is refused the roster by the
# team's deny rule despite his own allow rule, and Sam's dry run for August
# changes nothing. Then Kofi's call is saved as a dated note in summer/,
# the refresh reruns for August with it, and the card says how a phone
# change gets in. Each run is a real headless run of the runner as
# prepared: no run record is written by hand. Runs in <copy>/project;
# $SOLUTION holds this lesson's files.
set -e
cp "$SOLUTION/worked/fixit/summer/LIMITS.md" fixit/summer/LIMITS.md
git add fixit/summer/LIMITS.md fixit/summer/run/refresh.sh fixit/summer/run/bounds.json
git commit -q -m "Pack refresh: limits card"
fixit/summer/run/refresh.sh "Refresh august.md from its sources. Change nothing else."
cp "$SOLUTION/fixit/summer/august-kofi-call-2027-06-14.md" fixit/summer/august-kofi-call-2027-06-14.md
fixit/summer/run/refresh.sh "Refresh august.md from its sources. Change nothing else."
cp "$SOLUTION/fixit/summer/LIMITS.md" fixit/summer/LIMITS.md
