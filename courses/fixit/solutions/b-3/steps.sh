#!/bin/sh
# b-3 lab: Ade's patch applied and found to skip the booking link, fixed
# with a test that fails on his version and committed with it; then the
# missing folder fixed test first, with a test that names the folder, and
# committed.
set -eu
# Step 2 as the lab words it. git apply skips, and exits 0 for, any path
# outside the folder it runs in, so check the patch landed.
git apply practice/b-3/protocol-relative.patch
if [ ! -f test/external.test.js ] || git diff --quiet -- src/links.js; then
  echo "b-3: git apply practice/b-3/protocol-relative.patch changed nothing" >&2
  exit 1
fi
cp "$SOLUTION/test/external.test.js" test/external.test.js
cp "$SOLUTION/src/links.js" src/links.js
git add src/links.js test/external.test.js
git commit -q -m "Skip only protocol-relative links, so the booking link is checked again"
cp "$SOLUTION/test/links.test.js" test/links.test.js
cp "$SOLUTION/src/check-links.js" "$SOLUTION/src/cli.js" src/
git add src/check-links.js src/cli.js test/links.test.js
git commit -q -m "Stop with an error when linkcheck.json names a missing folder"
