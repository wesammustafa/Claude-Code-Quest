#!/bin/sh
# a-capstone (Fix-It): release day for the summer series. The learner holds
# the 14:00 email in the outbox, Claude lets the nightly bounds edit every
# page in summer/public/ with every deny kept, the learner reruns only what
# failed with the prepared runner, writes the go/no-go note, and Claude
# saves a read-only reviewer's report on the corrected pages and the outbox.
# The rerun is a real headless run of the runner as prepared: no run record
# is written by hand. Runs in <copy>/project; $SOLUTION holds this lesson's
# files.
cp "$SOLUTION/fixit/summer/outbox/reminder-2027-06-11-1400.md" fixit/summer/outbox/reminder-2027-06-11-1400.md
cp "$SOLUTION/fixit/summer/run/bounds.json" fixit/summer/run/bounds.json
fixit/summer/run/refresh.sh "Update july.md's access line and june.md's places line from summer/late-email-2027-06-10.md, with 24 places for June, then rebuild schedule.md from the three pages. Change nothing else."
cp "$SOLUTION/fixit/summer/go-no-go.md" fixit/summer/go-no-go.md
cp "$SOLUTION/fixit/summer/reviews/release-check.md" fixit/summer/reviews/release-check.md
