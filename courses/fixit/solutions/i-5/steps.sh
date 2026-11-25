#!/bin/sh
# i-5 lab: the guard from practice/i-5/ goes into .claude/hooks/ and is
# registered for Edit and Write, failing closed; an Edit deny rule closes the
# shell write into secrets/; Claude writes the Stop gate, which is registered
# under Stop; both scripts and the settings are committed together.
set -eu
mkdir -p .claude/hooks
cp practice/i-5/protect-files.sh .claude/hooks/protect-files.sh
chmod +x .claude/hooks/protect-files.sh
cp "$SOLUTION/.claude/hooks/test-gate.sh" .claude/hooks/test-gate.sh
chmod +x .claude/hooks/test-gate.sh
cp "$SOLUTION/.claude/settings.json" .claude/settings.json
git add .claude/hooks/protect-files.sh .claude/hooks/test-gate.sh .claude/settings.json
git commit -q -m "Guard protected files, deny shell writes to secrets/, and gate stopping on the tests"
