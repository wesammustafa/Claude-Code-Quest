# Recover from a partial failure

<sub>**Advanced** · Lesson 4 of 6 · about 25 minutes · Needs: [lesson 3](03-bound-an-unattended-run.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can recognise a run that reports success but didn't finish, stop its output being used, and find the cause in the run's own evidence, and rerun only what failed, inside the same bounds, and check the result yourself.

## The job

> **The runner's morning report (Friday 11 June, 02:03):** `exit status: 0`, `result subtype: success`, `permission denials: 1`.
>
> **Maya (07:30):** Saw the overnight run went fine. I'll start laying out the pages for noon.

It's Friday 11 June 2027, 07:00. The nightly refresh from lesson 3 ran at 02:00. Its report is `fixit/summer/run/runner-report-2027-06-11.txt`, its result is the JSON file beside it, and the four pages it refreshed are in `fixit/summer/public/`. The library's late email of 10 June, `fixit/summer/late-email-2027-06-10.md`, says the lift is out of service.

Maya is about to publish pages a run said it updated. One of them still tells wheelchair users the lift works.

This lesson starts with the reference organizer kit as it stands at the end of Intermediate, in `fixit/`, lesson 1's easy-read pages, lesson 3's bounds and runners, and the summer files as they stood that morning. Your own files from lesson 3 stay in that lesson.

## You need

- In Questerm: nothing. The runs, their results and their costs are simulated, and Claude's replies are written in advance, so model and effort change nothing. Nothing leaves your browser.
- On your own computer: Claude Code, on macOS, Linux or WSL 2 for the sandbox, and `jq` for the runner's report.

## The idea

A run's `success` means it ended normally, inside its limits. It doesn't mean every change it needed was allowed. A refused call doesn't stop a run in `dontAsk` mode: it's listed in the result's permission denials, and the run's own summary can still say the job is done. A run that hits a limit does stop, with an error, and whatever it changed before then stays changed.

So recover in order: stop the output being used, read what the run was refused and how it ended, compare its output with the newest source, fix the cause, rerun only the part that failed with the same guard, and check the files yourself.

## Worked example

1. **Stop the output being used.** First, decide: the report says `success` with one permission denial, and Maya is starting layout for noon. What do you do first? Nothing is wrong: `success` says nothing about whether every change it needed was allowed. Rerunning the whole refresh with wider permissions is wrong too: you don't know yet what was denied or why, and widening the bounds removes the guard that just told you something was wrong. Tell Maya to wait, then find out what was denied and which pages it affects.

   Send Maya one line: "Hold the summer pages, the overnight run hit a problem. I'll tell you by 10:00 which are good." A run's output is only dangerous once someone relies on it. Stopping its use is the cheapest move you have, and the easiest to undo. Maya replies at 07:32: "OK, holding."
2. **Read what was denied.** Open `fixit/summer/run/overnight-2027-06-11.json` in the files tab. The nightly job keeps each night's result under its date.

   - `"subtype": "success"` and `"is_error": false`: the run ended normally, inside its limits.
   - `"result"`: the run's own summary. It says the pack was updated for the late venue change, and it doesn't mention July.
   - `"permission_denials"`: one call refused, an `Edit` of `summer/public/july.md`, with the line it wanted to write.

   Two things disagree. The summary says the pack was updated for the late change, and the denial says the run was refused the July page.
3. **Find what that did to the pages.** Go into the kit folder and start Claude there. Claude Code asks whether you trust this folder: it's your practice copy of the kit, so read the dialog and accept it.

   ```bash
   cd fixit
   claude
   ```

   Then ask: `The overnight run was denied an edit to summer/public/july.md. Compare each page in summer/public/ with summer/late-email-2027-06-10.md and tell me which pages are now wrong, quoting the line. Also tell me why the edit was denied, from summer/run/bounds.json. Don't change anything.`

   Claude finds two pages wrong: `july.md`, which the run was refused, and `schedule.md`, which it rebuilt from `july.md`. `june.md` is partly right: its room and access match the email, but Room A holds 30 including the team, so 32 places can't be right. `august.md` isn't affected. The edit was denied because the bounds name three pages, and Sam added `july.md` by hand after they were written. Claude is right because you asked it to compare the pages with the newest source, not to sum up the run.

   Open `fixit/summer/public/july.md` and `fixit/summer/public/schedule.md` in the files tab, and find both lines yourself. Don't trust a summary that didn't check. The run's `result` text was written by the run it describes, and nothing in the run tested the pages against the email.

   June's places are a question for a person: Room A holds 30 including the team, and no file says how many volunteers come. Priya answers at 07:50: "Six of us for Room A." That leaves 24 places.
4. **Fix the cause, then rerun only what failed.** Fix the cause first: ask Claude to let the nightly run edit every page in `summer/public/`, with every deny rule kept: `In summer/run/bounds.json, replace the three Edit lines with one that allows editing any .md page directly in summer/public/, and change nothing else in the file.`

   Claude writes `"Edit(./summer/public/*.md)"` in place of the three page lines, with the deny list and the sandbox unchanged. A folder rule fits this run: it refreshes every main page, and `july.md` was refused only because nobody added a line for it. The deny rules still keep it out of `private/` and off the sources.

   Then rerun only what failed, in the shell tab, with a task that names it:

   ```bash
   fixit/summer/run/refresh.sh "Update july.md's access line from summer/late-email-2027-06-10.md, set june.md to 24 places, then rebuild schedule.md from the three pages. Change nothing else."
   ```

   The report shows `result subtype: success`, `permission denials: 0`, and three files changed: `june.md`, `july.md` and `schedule.md`.
5. **Check the result with your own eyes.** Open the three changed pages in `fixit/summer/public/` and read each change.

   - `july.md`: "Not step-free on 10 July", with the events desk's number, 555-0100, for anyone who needs step-free access.
   - `june.md`: Room A, step-free, 24 places.
   - `schedule.md`: its June and July rows match the two pages.

   Then you tell Maya: "June, August and the schedule are good now. July is corrected and says it isn't step-free."

## Your turn

The failure changes: a loud one this time. The main pages changed, so the easy-read pages are due a refresh, started by hand with the same runner, as you decided in lesson 3. Its usual limit is $0.30 for all three: `june-easy.md`, `july-easy.md` and `august-easy.md`.

1. **Read a different failure.** It's 08:30. Run the easy-read refresh in the shell tab, `fixit/summer/run/easy-refresh.sh`, and read its report. What does it tell you? Which line names what stopped the run, and which files changed?
2. **Decide the recovery.** `july-easy.md` still says "Room B is upstairs. There is a lift." Rerunning in `bypassPermissions` mode with no budget removes every rule, including the ones that keep the run out of `private/` and off the original pages, and the run wasn't blocked by permissions: it ran out of money. Raising the budget and rerunning all three easy-read pages with the same bounds works, but it redoes `june-easy.md`, which is already right, and it costs more than it needs to. Rerun only the two pages it left, with the same bounds and a budget that fits them.
3. **Run the recovery and check it.** Get `july-easy.md` and `august-easy.md` refreshed by a run, without touching anything else. Open both pages, then fill in `fixit/summer/a-9/recovery.md` in the files tab: what stopped the run, what you reran, and how you checked it.

   The runner passes any extra flag on to Claude, except one that changes or skips its bounds, which it refuses.

## Check

The Lesson's check reads four things: that `july-easy.md` says Room B isn't step-free on 10 July, and no longer says there is a lift; that the last easy-read run ended in `success` with no denials, under the bounds as they are now, and runs like it changed `july-easy.md` and `august-easy.md`; that the original pages, `easy-bounds.json` and the easy-read runner are as Your turn found them; and that `recovery.md` says what stopped the run, which two pages you reran, and how you checked them.

The check reads the records the runner keeps of each run, in `summer/run/easy-last-run/` and `summer/run/easy-runs.txt`. In this practice workspace you could write those records by hand, so on a real machine trust the run's own record over a file anyone can edit.

What only you can judge: if this happens to Sam in August, would your note be enough for him to recover the same way?

## On your own computer

In Questerm both runs are simulated: their JSON, their reports and their costs are written in advance, and the permission decisions come from Questerm's gate applying your bounds. A real run must still establish that the denials your runner reports are the ones Claude Code recorded.

1. In a real `claude -p --output-format json` run, read `permission_denials` every time, not only `subtype`. A refused call in `dontAsk` mode doesn't fail the run ([Headless](https://code.claude.com/docs/en/headless)).
2. A run that hits `--max-budget-usd` stops with `subtype: error_max_budget_usd` and a non-zero exit, and its `total_cost_usd` can pass the cap by the cost of its last step ([CLI reference](https://code.claude.com/docs/en/cli-reference)).
3. `/rewind` restores Claude's own edits in an interactive session. It doesn't undo a `-p` run's edits ([Checkpointing](https://code.claude.com/docs/en/checkpointing)). Recover a headless run's files from your version history, or from the copy you kept.

## Technical detail

| Signal | Where | What it means | What it doesn't mean | Reference |
|---|---|---|---|---|
| `subtype: success`, exit 0 | the result JSON, the shell's exit status | the run ended normally, inside its limits | that every change it needed happened | [Headless](https://code.claude.com/docs/en/headless) |
| `permission_denials` | the result JSON | calls your rules refused, each with its tool and input | an error: in `dontAsk` the run goes on | [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| `subtype: error_max_budget_usd` or `error_max_turns`, a non-zero exit | the result JSON, the shell's exit status | the run hit a limit and stopped | that nothing changed: earlier edits stay | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| `result` text | the result JSON | the model's own summary | a check: it was written by the run it describes | [Best practices](https://code.claude.com/docs/en/best-practices#give-claude-a-check-to-run) |
| `/goal` | an interactive session | a model judges each turn whether a condition holds, from the conversation | a test of your files | [Goal](https://code.claude.com/docs/en/goal) |

Recovering, in order: stop the output being used; read the denials and the error subtype; compare the output with the newest source; fix the cause (the bounds, the budget or the task); rerun the smallest failed part with the same guard; check the files yourself.

## Go further

- [Headless](https://code.claude.com/docs/en/headless): what a `-p` run's JSON result holds, its permission denials included.
