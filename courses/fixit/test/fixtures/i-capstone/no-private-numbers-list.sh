#!/bin/sh
# PreToolUse guard for Edit and Write: a public page may carry only the
# public numbers listed in public-contacts.txt, one a line. Any other phone
# number blocks the edit (exit 2), in any spacing, and so does a missing list
# or a tool input it can't read. A public page is anything under public/, a
# month's attendee-guide.md or a schedule.md.
list="$CLAUDE_PROJECT_DIR/public-contacts.txt"
input=$(cat) || { echo "no-private-numbers: could not read the tool input" >&2; exit 2; }

case "$input" in
  *'"file_path"'*) ;;
  *) echo "no-private-numbers: no file_path in the tool input" >&2; exit 2 ;;
esac

printf '%s' "$input" \
  | grep -Eq '"file_path" *: *"[^"]*(/public/[^"]*|/attendee-guide\.md|/schedule\.md)"' \
  || exit 0

[ -r "$list" ] || { echo "no-private-numbers: can't read public-contacts.txt, the list of public numbers" >&2; exit 2; }
public=" $(sed -E 's/^[^0-9]*([0-9][0-9 .-]*[0-9]).*$/\1/' "$list" | sed -E 's/[^0-9]//g' | tr '\n' ' ') "

found=""
for d in $(printf '%s' "$input" | grep -Eo '[0-9]{3}[ .-]?[0-9]{4}' | sed -E 's/[^0-9]//g' | sort -u); do
  case "$public" in
    *" $d "*) ;;
    *) found="$found ${d%????}-${d#???}" ;;
  esac
done
if [ -n "$found" ]; then
  echo "Blocked:$found is not a public number. A public page may list only the numbers in public-contacts.txt." >&2
  exit 2
fi
exit 0
