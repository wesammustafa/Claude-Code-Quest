#!/usr/bin/env bash
# Asks Claude Code to review the staged change before a commit, with no one
# at the keyboard.
#   scripts/review-staged.sh [result.json]
# Saves the run's JSON to the path given, or to .practice/a-4-result.json,
# prints each finding as file:line and the problem, and exits non-zero when
# nothing is staged or the run fails.
set -euo pipefail
out="${1:-.practice/a-4-result.json}"
mkdir -p "$(dirname "$out")"
if git diff --cached --quiet; then
  echo "Nothing is staged: stage a change with git add, then run this again." >&2
  exit 1
fi

# The shape the findings come back in, for --json-schema.
schema='{"type":"object","properties":{"findings":{"type":"array","items":{"type":"object","properties":{"file":{"type":"string"},"line":{"type":"integer"},"problem":{"type":"string"}},"required":["file","line","problem"]}}},"required":["findings"]}'

# One claude -p call, with the staged diff on stdin. Write the prompt in
# place of the first placeholder, and the flags that bound the run in place
# of the second: the output format, the permission mode, the tools, the tools
# allowed without asking, no hooks, no MCP servers, a turn cap and the schema.
git diff --cached | claude -p "PROMPT GOES HERE" FLAGS_GO_HERE > "$out"

# Fail loudly on a failed or capped run, then print each finding.
jq -e '.is_error == false and .subtype == "success"' "$out" > /dev/null || {
  echo "The review run failed or stopped early: see $out" >&2
  exit 1
}
jq -r '.structured_output.findings | if length == 0 then "No problems found." else .[] | "\(.file):\(.line) \(.problem)" end' "$out"
