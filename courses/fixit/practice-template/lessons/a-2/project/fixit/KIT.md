# The organizer kit

For whoever makes the next attendee guide. Open a fresh Claude session in `fixit/` and ask for it.

## How to run it
1. Put the month's sources in a folder named for the month, for example `may/`: the venue's confirmation (signed booking or the venue's email), your notes, anything else. Private lists go in `may/private/`.
2. In `fixit/`, start Claude and ask: "make the attendee guide for may" (or type `/attendee-guide may`).
3. Read `may/facts.md` and the open items Claude reports. Open the source line for anything that surprises you.
4. Send `may/attendee-guide.md` when every fact has a source and every open item says *being confirmed*.

## What it does
- **CLAUDE.md**: which source wins, how to publish an unconfirmed fact, which numbers are public.
- **attendee-guide skill**: reads the sources, writes a fact table with a source per fact, writes the guide, asks the reviewer.
- **guide-reviewer**: a read-only second look against the fact table and sources, on a smaller model.
- **settings.json**: Claude can't read `private/` or rosters, can't edit sources or the venue's confirmations, can't cancel a booking, and asks before running commands.
- **no-private-numbers hook**: blocks any edit that puts a 555-01xx number other than 555-0100 or 555-0130 on a public page, and blocks if it can't check.
- **bookings connection**: reads Millbrook Library's booking records, so a room change shows up without anyone forwarding an email. Northside isn't on that system: its confirmation is Kofi's email.

## What it does not do
- It does not catch private **email addresses** on a public page. The reviewer looks for them; the hook doesn't.
- It does not know a fact nobody wrote down. If the venue told you something on the phone, put it in your notes first.
- It does not decide whether to publish. Read the guide and the open items; you send it.
- The hook knows only 555-01xx numbers. A real group would list its public numbers in one file and block every other phone-number pattern.
- If the bookings connection is down, the guide is made from the files alone, and Claude says so.

## Last tested
Saturday 10 April 2027 session: a fresh session made Sam's guide from `april/` with no help. See `exemplars/intermediate/`.
