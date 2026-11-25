---
name: attendee-guide
description: Builds the public attendee guide for one Fix-It Saturday session from that month's folder, with a fact table citing a source for every fact. Use when asked to make, draft, update or check an attendee guide or event page. Not for volunteer rotas, internal briefs or meeting notes.
argument-hint: "<month folder>"
---

# Attendee guide

Make the attendee guide for the session in `$ARGUMENTS/`.

1. Read every file in `$ARGUMENTS/` except `private/`, plus `sources/group-notes.md`.
2. Write a fact table in `$ARGUMENTS/facts.md`: each fact, its source file and line, and which source lost.
3. Apply the source order in CLAUDE.md.
4. Mark anything unconfirmed as *being confirmed* with the venue's public number.
5. Write `$ARGUMENTS/attendee-guide.md` from `template.md`.
6. Report the guide's path and the open items.
