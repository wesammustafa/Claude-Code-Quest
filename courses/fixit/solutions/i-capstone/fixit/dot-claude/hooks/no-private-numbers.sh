#!/bin/sh
# PreToolUse guard for Edit and Write: a public page may carry only the
# venues' public numbers. Any other 555-01xx number blocks the edit (exit 2),
# and so does any failure to read the tool input. Formats it catches:
# 555-0187, 555 0187, 555.0187, 5550187.
input=$(cat) || { echo "no-private-numbers: could not read the tool input" >&2; exit 2; }

case "$input" in
  *'"file_path"'*) ;;
  *) echo "no-private-numbers: no file_path in the tool input" >&2; exit 2 ;;
esac

# Only public pages are guarded: anything under public/, a month's
# attendee-guide.md, or a schedule.md.
printf '%s' "$input" \
  | grep -Eq '"file_path" *: *"[^"]*(/public/[^"]*|/attendee-guide\.md|/schedule\.md)"' \
  || exit 0

found=$(printf '%s' "$input" \
  | grep -Eo '555[ .-]?01[0-9]{2}' \
  | sed -E 's/555[ .-]?/555-/' \
  | grep -Ev '^555-01(00|30)$' \
  | sort -u | tr '\n' ' ')

if [ -n "$found" ]; then
  echo "Blocked: $found is not a public number. A public page may list only 555-0100 (Millbrook Library) or 555-0130 (Northside Community Centre)." >&2
  exit 2
fi
exit 0
