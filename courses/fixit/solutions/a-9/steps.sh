#!/bin/sh
# a-9 (Fix-It): Claude lets the nightly bounds edit every page in
# summer/public/, the learner reruns only what failed with the prepared
# runner, then starts the easy-read refresh, which stops at its spend limit
# after one page, reruns only the two pages it left with a limit that fits
# them, and writes the recovery note. Each run is a real headless run of the
# runner as prepared: no result file is written by hand. There is no set -e:
# the easy-read refresh's first run exits 1, as the lesson has it. Runs in
# <copy>/project; $SOLUTION holds this lesson's files.
cp "$SOLUTION/fixit/summer/run/bounds.json" fixit/summer/run/bounds.json
fixit/summer/run/refresh.sh "Update july.md's access line from summer/late-email-2027-06-10.md, set june.md to 24 places, then rebuild schedule.md from the three pages. Change nothing else."
fixit/summer/run/easy-refresh.sh
fixit/summer/run/easy-refresh.sh "Refresh july-easy.md and august-easy.md from their sources. Change nothing else." --max-budget-usd 0.40
cp "$SOLUTION/fixit/summer/a-9/recovery.md" fixit/summer/a-9/recovery.md
