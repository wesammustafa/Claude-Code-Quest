#!/bin/sh
# PreToolUse guard for Edit and Write: a public page may give only the
# library's public number. Any other 555-01xx number blocks the edit (exit 2),
# in any spacing, and so does any tool input it can't read. A public page is
# anything under public/, a month's attendee-guide.md or a schedule.md.
input=$(cat) || { echo "no-private-numbers: could not read the tool input" >&2; exit 2; }

case "$input" in
  *'"file_path"'*) ;;
  *) echo "no-private-numbers: no file_path in the tool input" >&2; exit 2 ;;
esac

printf '%s' "$input" \
  | grep -Eq '"file_path" *: *"[^"]*(/public/[^"]*|/attendee-guide\.md|/schedule\.md)"' \
  || exit 0

found=$(printf '%s' "$input" | grep -Eo '555[ .-]?01[0-9]{2}' | sed -E 's/555[ .-]?/555-/' | grep -Ev '^555-0100$' | sort -u | tr '\n' ' ')
if [ -n "$found" ]; then
  echo "Blocked: $found is not a public number. A public page gives only the library's 555-0100." >&2
  exit 2
fi
exit 0
