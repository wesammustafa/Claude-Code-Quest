#!/bin/sh
# The summer pages' refresh runner, prepared for you: you judge its flags,
# and you don't need to change it. Run it from any folder:
#   fixit/summer/run/refresh.sh june    a slice: one page
#   fixit/summer/run/refresh.sh         every page in summer/public/
cd "$(dirname "$0")/../.." || exit 2

# 1. No bounds, no run.
if [ ! -f summer/run/bounds.json ]; then
  echo "Refusing to run without summer/run/bounds.json." >&2
  exit 2
fi
case "$1" in
  "") PAGES="summer/public/" ;;
  june | august | schedule) PAGES="summer/public/$1.md" ;;
  *) echo "Usage: summer/run/refresh.sh [june | august | schedule]" >&2; exit 2 ;;
esac
before=$(mktemp -d)
cp summer/public/*.md "$before/"
mkdir -p summer/run/last-run

# 2. The run: one claude -p command, inside the bounds.
claude -p "Refresh $PAGES from the sources, following CLAUDE.md. Change only what a source contradicts. Report what you changed and what you could not change." \
  --permission-mode dontAsk \
  --settings summer/run/bounds.json \
  --strict-mcp-config --mcp-config summer/run/bookings-only.json \
  --max-turns 25 \
  --max-budget-usd 1.00 \
  --output-format json \
  > summer/run/last-run/result.json
status=$?
cp summer/run/bounds.json summer/run/last-run/bounds.json

# 3. The report: what the run did, and what it was stopped from doing.
{
  echo "exit status: $status"
  jq -r --arg here "$PWD/" '
    "result subtype: \(.subtype)",
    "turns: \(.num_turns) (limit 25)",
    "estimated cost: $\(.total_cost_usd) (limit $1.00)",
    "permission denials: \(.permission_denials | length)",
    (.permission_denials[] | "  \(.tool_name): \(.tool_input.command // .tool_input.file_path | ltrimstr($here))")
  ' summer/run/last-run/result.json
  echo "files changed:"
  changed=no
  for f in summer/public/*.md; do
    if ! diff -q "$before/$(basename "$f")" "$f" > /dev/null 2>&1; then
      echo "  $f"
      changed=yes
    fi
  done
  [ "$changed" = yes ] || echo "  none"
} | tee summer/run/last-run/report.txt
rm -rf "$before"
exit "$status"
