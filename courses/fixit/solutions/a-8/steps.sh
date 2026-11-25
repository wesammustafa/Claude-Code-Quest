#!/bin/sh
# a-8 (Fix-It): the June page's places corrected and the June decision
# written, as the Worked example has Claude do; then Sam's August page made
# right and the August decision written, which the learner does in the files
# tab or asks Claude to do. Runs in <copy>/project; $SOLUTION holds this
# lesson's files.
set -eu
cp "$SOLUTION/fixit/summer/public/june.md" fixit/summer/public/june.md
cp "$SOLUTION/fixit/summer/reviews/june-decision.md" fixit/summer/reviews/june-decision.md
cp "$SOLUTION/fixit/summer/a-8/august-sam-2027-06-09.md" fixit/summer/a-8/august-sam-2027-06-09.md
cp "$SOLUTION/fixit/summer/a-8/august-decision.md" fixit/summer/a-8/august-decision.md
