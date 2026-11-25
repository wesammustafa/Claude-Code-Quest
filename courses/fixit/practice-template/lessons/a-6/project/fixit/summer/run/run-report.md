# Run report: release week, Fri 11 June 2027

Written by the coordinator after the 11 June rerun, for whoever runs the refresh next.

## What went wrong overnight
- Every nightly run from 29 May to 11 June ended in `success`, with one permission denial each morning: `Edit: summer/public/july.md`. Nobody knew what that line meant, so nobody acted on it.
- The cause: `bounds.json` allowed edits to three named pages. Sam added `july.md` by hand on 28 May, and nobody updated the bounds.
- On 11 June it mattered. The library's late email of 10 June said the lift was out of service. The run only saw that email because Priya saved it into `summer/` the evening before. It still couldn't edit `july.md`, so the page kept "step-free by lift", and `schedule.md` copied it.
- `june.md` moved to Room A but kept 32 places. Room A holds 30 including the team. No file said how many volunteers were coming, so the run couldn't know. Priya told us: six, which left 24.
- Registrations: 28 people had booked for June before the move to Room A. The run can't see registrations, which are in the library's events system. Maya and Priya contacted the last four people by hand.

## What I changed
- The bounds now have one rule for every page, `Edit(./summer/public/*.md)`. The run still can't read `private/`, edit `sources/`, push or fetch from the web, and it still needs the sandbox.
- I reran only what failed: `july.md`, the places on `june.md`, and `schedule.md`. The limits stayed at 25 turns and $1.00.

## Rerun result
- `success`, no permission denials, about $0.17 (an estimate, not a bill). It changed `july.md`, `june.md` and `schedule.md`. I opened each one and compared it with the late email.

## Who decides
- The coordinator reads the report of every run before anyone uses the pages.
- Maya decides what goes on the library site, and publishes it.
- Priya decides what goes in the reminder email, and sends it.
- The run publishes nothing and sends nothing.

## Since then
- The nightly schedule entry was removed after 11 June. The runner only runs when someone starts it.
