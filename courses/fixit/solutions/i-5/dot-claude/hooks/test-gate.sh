#!/bin/bash
# The Stop gate: when Claude finishes, it runs the tests. While they fail,
# exit 2 sends Claude back to work, with the reason on stderr. Once the gate
# has sent it back, stop_hook_active is true: exit 0 then, so it can't loop.
INPUT=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 1

if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi
if ! npm test 2>&1; then
  echo "Blocked: npm test fails. Fix the failing test before you finish." >&2
  exit 2
fi

exit 0
