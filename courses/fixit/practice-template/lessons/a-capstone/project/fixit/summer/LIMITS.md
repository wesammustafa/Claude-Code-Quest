# Summer pack refresh: what it does and what it can't

**Owner:** the coordinator. **Runs:** nightly at 02:00 until 11 June, then stops (the schedule entry is removed).

## What it does
- Reads `sources/`, `summer/` and the read-only bookings connection.
- Rewrites the session pages and the schedule in `summer/public/`, applying the kit's rules (source precedence, "being confirmed" for unconfirmed details, public contacts only).
- Keeps each run's JSON result and a plain report of the files it changed in `summer/run/last-run/`, and adds the report to `summer/run/runs.txt`.

## What it cannot do
- It cannot read `private/` or edit `sources/`. It cannot push, publish or send email: Maya publishes, Priya sends.
- It cannot tell a newer venue email from an older signed booking unless the email is in `summer/`. **A late change that arrives by phone or in someone's inbox is invisible to it.**
- It cannot know registration numbers. Overbooking after a room change is a person's check.
- It does not verify its own work. "success" means the run ended normally, not that the pages are right.

## Who decides
- The coordinator reads each morning's report. Any permission denial, any unchanged page that should have changed, or any access line that changed means: **don't publish until a person has checked.**
- Maya decides what goes live; Priya decides what goes in the email.

## How to stop it
- Remove the schedule entry, or rename `summer/run/bounds.json` (the runner refuses to start without it).
