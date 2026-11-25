#!/bin/sh
# The summer pages' refresh runner, prepared for you: you judge what it
# does, and you don't need to change it. Run it from any folder:
#   fixit/summer/run/refresh.sh                  every page in summer/public/
#   fixit/summer/run/refresh.sh "<task>"         only the task you name
#   fixit/summer/run/refresh.sh "<task>" <flags> with more flags for claude
# A flag that changes or skips the bounds is refused.
cd "$(dirname "$0")/../.." || exit 2

# 1. No bounds, no run, and no flag that changes or skips them.
if [ ! -f summer/run/bounds.json ]; then
  echo "Refusing to run without summer/run/bounds.json." >&2
  exit 2
fi
TASK="Refresh summer/public/ from the sources, following CLAUDE.md. Change only what a source contradicts. Report what you changed and what you could not change."
if [ $# -gt 0 ]; then
  case "$1" in
    -*) ;;
    *) [ -n "$1" ] && TASK=$1; shift ;;
  esac
fi
TURNS=25
BUDGET=1.00
prev=
for arg in "$@"; do
  case "$arg" in
    *bypass* | *dangerously* | --settings* | --permission-mode* | --allowedTools* | --allowed-tools*)
      echo "Refusing to run without summer/run/bounds.json: $arg would change or skip its rules." >&2
      exit 2
      ;;
  esac
  [ "$prev" = --max-turns ] && TURNS=$arg
  [ "$prev" = --max-budget-usd ] && BUDGET=$arg
  prev=$arg
done
before=$(mktemp -d)
cp summer/public/*.md "$before/"
mkdir -p summer/run/last-run

# 2. The run: one claude -p command, inside the bounds.
claude -p "$TASK" \
  --permission-mode dontAsk \
  --settings summer/run/bounds.json \
  --strict-mcp-config --mcp-config summer/run/bookings-only.json \
  --max-turns 25 \
  --max-budget-usd 1.00 \
  --output-format json \
  "$@" \
  > summer/run/last-run/result.json
status=$?
cp summer/run/bounds.json summer/run/last-run/bounds.json

# 3. The report: what the run did, and what it was stopped from doing.
{
  echo "exit status: $status"
  jq -r --arg here "$PWD/" --arg turns "$TURNS" --arg budget "$BUDGET" '
    "result subtype: \(.subtype)",
    "turns: \(.num_turns) (limit \($turns))",
    "estimated cost: $\(.total_cost_usd) (limit $\($budget))",
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
# 4. Every run's report, one after the other, in summer/run/runs.txt.
{ cat summer/run/last-run/report.txt; echo; } >> summer/run/runs.txt
rm -rf "$before"
exit "$status"
