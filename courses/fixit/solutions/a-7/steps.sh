#!/bin/sh
# a-7 (Fix-It): Claude writes the nightly run's bounds, the Learner runs the
# prepared runner on one page, Claude writes the easy-read run's bounds, and
# the Learner runs the easy-read runner on one page. Each run is a real
# headless run of the runner as prepared: no result file is written by hand.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/fixit/summer/run/bounds.json" fixit/summer/run/bounds.json
fixit/summer/run/refresh.sh june
cp "$SOLUTION/fixit/summer/run/easy-bounds.json" fixit/summer/run/easy-bounds.json
fixit/summer/run/easy-refresh.sh june
