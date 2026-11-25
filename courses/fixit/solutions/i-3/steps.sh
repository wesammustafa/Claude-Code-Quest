#!/bin/sh
# i-3 lab: five-whys gets its own high effort and the changelog skill haiku at
# low effort; Sun-hee's change, a malformed percent escape reported as a
# broken link, is made with its test, /changelog writes its entry, and the
# change, its entry and both skills are committed together.
set -eu
cp "$SOLUTION/.claude/skills/five-whys/SKILL.md" .claude/skills/five-whys/SKILL.md
cp "$SOLUTION/.claude/skills/changelog/SKILL.md" .claude/skills/changelog/SKILL.md
cp "$SOLUTION/src/check-links.js" src/check-links.js
cp "$SOLUTION/test/links.test.js" test/links.test.js
cp "$SOLUTION/CHANGELOG.md" CHANGELOG.md
git add .claude/skills/five-whys/SKILL.md .claude/skills/changelog/SKILL.md src/check-links.js test/links.test.js CHANGELOG.md
git commit -q -m "Report a malformed percent escape as a broken link, with its changelog entry and each skill's settings"
