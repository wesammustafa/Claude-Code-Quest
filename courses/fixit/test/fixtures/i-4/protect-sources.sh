#!/bin/sh
# PreToolUse guard for Edit and Write: the sources we check against never
# change. Blocks (exit 2) an edit to anything under sources/ and to any
# venue's booking or email (booking-*, venue-email-*), in any month, and any
# tool input it can't read.
input=$(cat) || { echo "protect-sources: could not read the tool input" >&2; exit 2; }

case "$input" in
  *'"file_path"'*) ;;
  *) echo "protect-sources: no file_path in the tool input" >&2; exit 2 ;;
esac

if printf '%s' "$input" | grep -Eq '"file_path" *: *"([^"]*/)?(sources/[^"]*|[^"/]*booking-[^"/]*|[^"/]*venue-email-[^"/]*)"'; then
  echo "Blocked: sources/, bookings and venue emails are what we check against. They never change." >&2
  exit 2
fi
exit 0
