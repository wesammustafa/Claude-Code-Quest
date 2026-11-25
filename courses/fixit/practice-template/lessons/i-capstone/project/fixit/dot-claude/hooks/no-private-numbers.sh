#!/bin/sh
# PreToolUse guard for Edit and Write: Priya's private number, 555-0187, never
# goes on a public page. A public page is anything under public/, a month's
# attendee-guide.md or a schedule.md. The edit is blocked (exit 2) when the
# number is in it, in any spacing, and when the tool input can't be read.
input=$(cat) || { echo "no-private-numbers: could not read the tool input" >&2; exit 2; }

case "$input" in
  *'"file_path"'*) ;;
  *) echo "no-private-numbers: no file_path in the tool input" >&2; exit 2 ;;
esac

printf '%s' "$input" \
  | grep -Eq '"file_path" *: *"[^"]*(/public/[^"]*|/attendee-guide\.md|/schedule\.md)"' \
  || exit 0

if printf '%s' "$input" | grep -Eq '555[ .-]?0187'; then
  echo "Blocked: 555-0187 is not a public number. A public page gives the venue's public number, such as 555-0100." >&2
  exit 2
fi
exit 0
