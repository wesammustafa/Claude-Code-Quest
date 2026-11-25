#!/bin/sh
# a-1 lab (Fix-It): ignore Claude Code's worktrees at the copy's root, then
# make each of Ade's two jobs in a worktree of its own, commit each on its
# worktree's branch once both are reviewed, merge both into main, and remove
# the worktrees. The push after the first commit, which moves origin/main so
# new worktrees start from it, changes no file here, so it has no line.
# Runs in <copy>/project; $SOLUTION holds this lab's files.
set -eu
# `claude --worktree` makes .claude/worktrees/ at the git root, the copy's
# root above project/, so the rule goes in the .gitignore there.
top=$(git rev-parse --show-toplevel)
printf '.claude/worktrees/\n' >> "$top/.gitignore"
git add :/.gitignore
git commit -q -m "Ignore Claude Code worktrees"
wt="$top/.claude/worktrees"
# Each worktree is a checkout of the whole copy, so project/ is inside it.
git worktree add -q -b worktree-comments-fix "$wt/comments-fix"
cp "$SOLUTION/src/links.js" "$wt/comments-fix/project/src/links.js"
cp "$SOLUTION/test/links.test.js" "$wt/comments-fix/project/test/links.test.js"
git worktree add -q -b worktree-schedule-test "$wt/schedule-test"
cp "$SOLUTION/test/schedule.test.js" "$wt/schedule-test/project/test/schedule.test.js"
git -C "$wt/comments-fix" add project/src/links.js project/test/links.test.js
git -C "$wt/comments-fix" commit -q -m "Skip links inside HTML comments"
git -C "$wt/schedule-test" add project/test/schedule.test.js
git -C "$wt/schedule-test" commit -q -m "Test that the schedule page shows the three summer dates"
git merge worktree-comments-fix
git merge --no-edit worktree-schedule-test
git worktree remove "$wt/comments-fix"
git worktree remove "$wt/schedule-test"
