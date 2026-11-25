# The organizer kit

For whoever makes the next attendee guide. Open a fresh Claude session in `fixit/` and ask for it.

## How to run it
1. Put the month's sources in a folder named for the month, for example `may/`: the venue's confirmation (a signed booking or the venue's email), your notes, anything else. Private lists go in `may/private/`.
2. In `fixit/`, start Claude and type `/attendee-guide may`: the skill's name, then the month's folder. Asking for "the attendee guide for may" loads it too.
3. Read `may/facts.md` and the open items Claude reports. Open the source line for anything that surprises you.
4. Send `may/attendee-guide.md` when every fact has a source and every open item says *being confirmed*.

## What it does
- **CLAUDE.md**: which source wins, with the venue's written confirmation first, whatever form it takes; how to publish an unconfirmed fact; which numbers are public.
- **.claude/rules/public-pages.md**: the checklist every public page follows, loaded only when Claude works on one.
- **bookings connection** (`.mcp.json`): reads Millbrook Library's booking records through a pinned, read-only server, so a room change shows up without anyone forwarding an email. When it's down, Claude makes the guide from the files alone, says so, and adds an open item to the fact table. Northside isn't on that system: its confirmation is Kofi's email.
- **no-private-numbers hook**: blocks any edit that puts a 555-01xx number other than 555-0100 or 555-0130 on a public page, wherever the number came from, and blocks if it can't check.

## What it does not do
- It does not catch private **email addresses** on a public page. The contacts rule asks Claude to leave them out; the hook doesn't check.
- It knows only two public numbers. A new venue's public number is blocked until someone adds it to the hook.
- It does not know a fact nobody wrote down. If the venue told you something on the phone, put it in your notes first.
- It does not decide whether to publish. Read the guide and the open items; you send it.

## Last tested
Saturday 10 April 2027 session, on 6 April: a fresh session made Sam's guide from `april/` with no help.
