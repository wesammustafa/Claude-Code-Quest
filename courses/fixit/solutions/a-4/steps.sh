#!/bin/sh
# a-4 lab (Fix-It): fill in the review script's prompt and flags, commit it
# executable, apply and stage Sam's comment change, review it with the
# script's one `claude -p` run, then finish the change for comments over
# several lines, with a test, and commit it. The worked example's three runs
# save JSON that no check item reads, so they have no line here.
# Runs in <copy>/project; $SOLUTION holds this lab's files, and `claude` is
# Claude Code.
set -eu
cp "$SOLUTION/scripts/review-staged.sh" scripts/review-staged.sh
chmod +x scripts/review-staged.sh
git add scripts/review-staged.sh
git commit -q -m "Review the staged change with Claude before each commit"
git apply practice/a-4/comment-links.patch
git add src/links.js test/links.test.js
scripts/review-staged.sh
cp "$SOLUTION/src/links.js" src/links.js
cp "$SOLUTION/test/links.test.js" test/links.test.js
git add src/links.js test/links.test.js
git commit -q -m "Skip links in editors' notes, on one line or several"
