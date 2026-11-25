#!/bin/sh
# The easy-read refresh runner, prepared for you: you judge what it
# does, and you don't need to change it. Run it from any folder:
#   fixit/summer/run/easy-refresh.sh             all three easy-read pages
#   fixit/summer/run/easy-refresh.sh "<task>"    only the task you name
#   fixit/summer/run/easy-refresh.sh "<task>" <flags> with more flags for claude
# A flag that changes or skips the bounds is refused.
cd "$(dirname "$0")/../.." || exit 2

# 1. No bounds, no run, and no flag that changes or skips them.
if [ ! -f summer/run/easy-bounds.json ]; then
  echo "Refusing to run without summer/run/easy-bounds.json." >&2
  exit 2
fi
TASK="Refresh the three *-easy.md pages in summer/public/ from their sources, following CLAUDE.md. Change only what a source contradicts. Report what you changed and what you could not change."
if [ $# -gt 0 ]; then
  case "$1" in
    -*) ;;
    *) [ -n "$1" ] && TASK=$1; shift ;;
  esac
fi
TURNS=15
BUDGET=0.30
prev=
for arg in "$@"; do
  case "$arg" in
    *bypass* | *dangerously* | --settings* | --permission-mode* | --allowedTools* | --allowed-tools*)
      echo "Refusing to run without summer/run/easy-bounds.json: $arg would change or skip its rules." >&2
      exit 2
      ;;
  esac
  [ "$prev" = --max-turns ] && TURNS=$arg
  [ "$prev" = --max-budget-usd ] && BUDGET=$arg
  prev=$arg
done
before=$(mktemp -d)
cp summer/public/*.md "$before/"
mkdir -p summer/run/easy-last-run

# 2. The run: one claude -p command, inside the bounds.
claude -p "$TASK" \
  --permission-mode dontAsk \
  --settings summer/run/easy-bounds.json \
  --strict-mcp-config --mcp-config summer/run/bookings-only.json \
  --max-turns 15 \
  --max-budget-usd 0.30 \
  --output-format json \
  "$@" \
  > summer/run/easy-last-run/result.json
status=$?
cp summer/run/easy-bounds.json summer/run/easy-last-run/bounds.json

# 3. The report: what the run did, and what it was stopped from doing.
{
  echo "exit status: $status"
  jq -r --arg here "$PWD/" --arg turns "$TURNS" --arg budget "$BUDGET" '
    "result subtype: \(.subtype)",
    "turns: \(.num_turns) (limit \($turns))",
    "estimated cost: $\(.total_cost_usd) (limit $\($budget))",
    "permission denials: \(.permission_denials | length)",
    (.permission_denials[] | "  \(.tool_name): \(.tool_input.command // .tool_input.file_path | ltrimstr($here))")
  ' summer/run/easy-last-run/result.json
  echo "files changed:"
  changed=no
  for f in summer/public/*.md; do
    if ! diff -q "$before/$(basename "$f")" "$f" > /dev/null 2>&1; then
      echo "  $f"
      changed=yes
    fi
  done
  [ "$changed" = yes ] || echo "  none"
} | tee summer/run/easy-last-run/report.txt
# 4. Every run's report, one after the other, in summer/run/easy-runs.txt.
{ cat summer/run/easy-last-run/report.txt; echo; } >> summer/run/easy-runs.txt
rm -rf "$before"
exit "$status"
