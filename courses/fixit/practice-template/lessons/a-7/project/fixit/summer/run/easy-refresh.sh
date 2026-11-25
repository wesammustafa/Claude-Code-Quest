#!/bin/sh
# The easy-read refresh runner, prepared for you: you judge its flags,
# and you don't need to change it. Run it from any folder:
#   fixit/summer/run/easy-refresh.sh june    a slice: one easy-read page
#   fixit/summer/run/easy-refresh.sh         all three easy-read pages
cd "$(dirname "$0")/../.." || exit 2

# 1. No bounds, no run.
if [ ! -f summer/run/easy-bounds.json ]; then
  echo "Refusing to run without summer/run/easy-bounds.json." >&2
  exit 2
fi
case "$1" in
  "") PAGES="the three *-easy.md pages in summer/public/" ;;
  june | july | august) PAGES="summer/public/$1-easy.md" ;;
  *) echo "Usage: summer/run/easy-refresh.sh [june | july | august]" >&2; exit 2 ;;
esac
before=$(mktemp -d)
cp summer/public/*.md "$before/"
mkdir -p summer/run/easy-last-run

# 2. The run: one claude -p command, inside the bounds.
claude -p "Refresh $PAGES from the sources, following CLAUDE.md. Change only what a source contradicts. Report what you changed and what you could not change." \
  --permission-mode dontAsk \
  --settings summer/run/easy-bounds.json \
  --strict-mcp-config --mcp-config summer/run/bookings-only.json \
  --max-turns 15 \
  --max-budget-usd 0.30 \
  --output-format json \
  > summer/run/easy-last-run/result.json
status=$?
cp summer/run/easy-bounds.json summer/run/easy-last-run/bounds.json

# 3. The report: what the run did, and what it was stopped from doing.
{
  echo "exit status: $status"
  jq -r --arg here "$PWD/" '
    "result subtype: \(.subtype)",
    "turns: \(.num_turns) (limit 15)",
    "estimated cost: $\(.total_cost_usd) (limit $0.30)",
    "permission denials: \(.permission_denials | length)",
    (.permission_denials[] | "  \(.tool_name): \(.tool_input.command // .tool_input.file_path | ltrimstr($here))")
  ' summer/run/easy-last-run/result.json
  echo "files changed:"
  for f in summer/public/*.md; do
    diff -q "$before/$(basename "$f")" "$f" > /dev/null 2>&1 || echo "  $f"
  done
} | tee summer/run/easy-last-run/report.txt
rm -rf "$before"
exit "$status"
