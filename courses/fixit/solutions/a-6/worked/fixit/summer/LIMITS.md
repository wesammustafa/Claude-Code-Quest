# Pack refresh: what it does and what it can't

For a teammate who has never run it. Each line quotes the file it relies on.

## What it does
- Reads `sources/`, `summer/` and the read-only bookings connection (`bounds.json`: `Read(./sources/**)`, `Read(./summer/**)`).
- Rewrites the pages in `summer/public/` (`bounds.json`: `Edit(./summer/public/*.md)`), from the confirmations and notes saved in `summer/`.
- Adds a report of every run to `summer/run/runs.txt` (`refresh.sh`, step 4).

## What it cannot do
- Read `private/` (`bounds.json` denies `Read(**/private/**)`).
- Edit `sources/` (`Edit(./sources/**)` is denied).
- Push, or fetch from the web (`Bash(git push *)` and `WebFetch` are denied).
- Publish the pages or send email (`run-report.md`: "The run publishes nothing and sends nothing").
- See a change that arrives by phone or in someone's inbox until someone saves it in `summer/`. The late email of 10 June reached it only because Priya saved it there (`run-report.md`).
- Know registration numbers: they're in the library's events system. Overbooking after a room change is a person's check (`run-report.md`: 28 booked for June's 24 places).
- Check its own work. `success` in its report doesn't mean the pages are right: a `success` with a permission denial means part of the job wasn't done, as on 11 June. Read the denials.

## Who decides
- The coordinator reads the report of every run before anyone uses the pages. Maya publishes the pages, and Priya sends the reminder email (`run-report.md`, "Who decides").

## How to stop it
- Nothing starts it on a timer now: the nightly schedule entry was removed after 11 June (`run-report.md`).
- To stop it starting at all, rename `summer/run/bounds.json`: the runner refuses to run without it (`refresh.sh`, line 11).
