# Capstone: release day for the summer series

<sub>**Advanced** · Capstone, Lesson 6 of 6 · 60 to 90 minutes · Needs: [lesson 5](05-share-the-workflow.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, not yet re-run in a real session</sub>

## Goal

Ship the summer pages Maya publishes at noon, and decide what happens to Priya's 14:00 email, with a go/no-go note that names the evidence for each call: what the overnight run was refused, what the reviewers read, what you changed and reran, and what would change your mind.

## The brief

> **Maya (Mon 7 June):** Plan for Friday 11 June: **12:00** I publish whatever is in `summer/public/`: `june.md`, `july.md`, `august.md`, `schedule.md`. **14:00** Priya sends the reminder email to everyone registered; she pastes the schedule page into it. Registrations this morning: **70 people. June 28, July 22, August 20.** If anything isn't ready, tell me by 11:30 what to hold. I'd rather post two good pages than four with a mistake in them.

It's 07:00 on Friday. You are the coordinator. Nobody else will check the pages before noon.

You hand over the four public pages as they should go live, `fixit/summer/go-no-go.md` for Maya and Priya, and the state of the 14:00 email.

## What you start with

This lesson starts from its own prepared copy of the kit, in `fixit/`, as it stood at 07:00 on 11 June. Nothing from your earlier lessons is in it: the capstone checks that you can do the work, not that you kept your files.

| File | What it is | Trust it for |
|---|---|---|
| `fixit/summer/BRIEF.md` | Maya's plan and the registration numbers | times, who does what, registrations |
| `fixit/summer/booking-june-roomB.md`, `booking-july-roomB.md` | the signed bookings, 19 May | what they cover, until something newer |
| `fixit/summer/northside-august-email.md` | Kofi's confirmation, 25 May | August |
| `fixit/summer/meeting-notes-2027-05-27.md` | volunteers, caps, the battery rule | the group's plan as of 27 May |
| `fixit/summer/fire-officer-email-2027-05-20.md` | the lithium battery rule | the rule |
| `fixit/summer/late-email-2027-06-10.md` | Dee, Thursday 10 June, 16:40 | the newest venue word on June and July |
| `fixit/summer/run/overnight-2027-06-11.json`, `runner-report-2027-06-11.txt` | what the 02:00 run reported | what it did and was refused, not whether the pages are right |
| `fixit/summer/run/bounds.json`, `refresh.sh` | the run's rules and its runner | what it may touch |
| `fixit/summer/public/` | the four pages as the run left them | nothing, yet |
| `fixit/summer/reviews/` | three reviews from 08:10 | leads, each with its own Read line |
| `fixit/summer/outbox/reminder-2027-06-11-1400.md` | Priya's scheduled email, with this morning's schedule pasted in | what goes out at 14:00 unless someone acts |
| `fixit/CLAUDE.md`, `fixit/KIT.md`, `fixit/summer/LIMITS.md` | the kit's rules and the workflow's limits | how sources rank, and what the run can't know |

The outbox is simulated: no email is ever sent. A file whose status is `scheduled` is what would go out.

## The decisions are yours

1. Whether anything is used before you've checked it, and how you stop it.
2. Which findings, the run's, each reviewer's and Claude's, you act on, and why.
3. How to recover the run: what you change, what you rerun, and how you bound it.
4. What a number should be when the files can't settle it, and whom you ask.
5. For each page and for the email: go, hold, or go corrected.

More than one release call can be right. Shipping all four pages with July corrected to say it isn't step-free works, and so does replacing the July page with a hold notice that gives the events desk's number. Holding everything isn't neutral: the live site keeps May's pages, which send June's 28 people to Room B and tell July's readers the lift works. Shipping the pages as the run left them, because it said `success`, sends July's error to 70 people at 14:00.

## The task

There's no worked example. Each step starts as a challenge, and its hints go from a question, to a pointer, to the exact move.

1. **Stop the output being used.** First, decide: the run says `success`, Maya publishes at 12:00 and Priya's email goes at 14:00. What's your first move? Then tell Maya to hold the pages until you've checked them.
2. **Diagnose the overnight run.** Find out what the run was refused, which pages that left wrong, and why. Start Claude in `fixit/`, and compare each page with the newest source for it before you change anything.
3. **Reconcile the reviews.** The three 08:10 reviews disagree. Decide which findings you act on, by what each reviewer read and whether it saw the late email, not by how many reviewers agree. You can run fresh reviews in parallel instead, if you tell each one about the late email and have it list what it read.
4. **Priya's 09:30 message.** Priya has scheduled the reminder with this morning's schedule pasted in, and can't be reached until after it sends. Decide what to ask her before she goes, then make sure the 14:00 email can't go out wrong: hold or cancel it, or correct its body.
5. **Recover the run.** Ask Claude to fix the cause of the refusal in `bounds.json`, changing it as little as you can and keeping every deny rule. Then rerun only what failed, in the shell tab, with the prepared runner and a task that names the pages. June's places need a number the files can't give you: how many of the team will be in Room A?
6. **Decide the release.** Write `fixit/summer/go-no-go.md` for Maya and Priya: a call for each page and for the email, the evidence for each, what you asked and haven't heard back, and what would change your decision. Decide what happens to June's 28 registrations now that Room A takes fewer people.
7. **Verify before you hand over.** Before 11:30, have one independent check run over the corrected pages and the outbox: a read-only reviewer that lists what it read. Read its report.

The card for this lesson keeps the rerun:

```bash
fixit/summer/run/refresh.sh "Update july.md's access line and june.md's places line from summer/late-email-2027-06-10.md, with 24 places for June, then rebuild schedule.md from the three pages. Change nothing else."
```

## Check

The Lesson's check reads nine things: that `june.md` gives Room A, says the session moved and offers no more places than Room A can take; that `july.md` says Room B isn't step-free on 10 July, or holds the details back with the desk's number; that `schedule.md` agrees with both; that every page that goes up gives the battery rule; that the pages and the email give no number but 555-0100 and 555-0130; that the 14:00 email is held, cancelled or a draft, or its body is right; that `go-no-go.md` makes a call on each page and the email, cites the late email and the overnight denial, says what happens to June's extra bookings and what would change your calls; that a refresh under the bounds as they are now ended in `success` with no denials and wrote `july.md` and `schedule.md`, with every deny rule kept; and that a read-only reviewer's report lists what it read, the four public pages among them.

The check reads the runner's own record of each run, in `summer/run/last-run/` and `summer/run/runs.txt`, and the reviewer's report Claude saves in `summer/reviews/release-check.md`. Questerm doesn't yet keep a record of its own runs and subagents that a check can read, so in this practice workspace you could write those files by hand. On a real machine, trust the run's own record over a file anyone can edit.

What only you can judge: that you told Maya to hold before noon; that the reviewer ran after your last rerun; whether Priya, back at 15:00, knows what to send, to whom and why; and whether shipping July corrected or holding it is better for July's readers.

## On your own computer

In Questerm everything above is simulated: the overnight run, its JSON and its cost, the reviewers' reports, the outbox and the people. Claude's replies are written in advance, so model and effort change nothing. Questerm checks your bounds through its permission gate. A real release must still establish that your runner reports real denials, that your reviewer subagents read what they say they read, and that nobody's scheduled email goes out without you.

1. Run the refresh with a real `claude -p` and the flags from lesson 3, and read `permission_denials` in its JSON every morning ([Headless](https://code.claude.com/docs/en/headless)).
2. Run reviewers as read-only subagents (`tools: Read, Grep, Glob`), have each list its files, and give them the newest evidence by name ([Subagents](https://code.claude.com/docs/en/sub-agents)).
3. Keep the release decision in a file people read, not in a chat, and name what would change it.

## Technical detail

| Evidence | Where | Read it for | Don't read it as | Reference |
|---|---|---|---|---|
| `subtype`, exit status | the run's JSON, the shell's exit status | whether the run ended normally or hit a limit | "the pages are right" | [Headless](https://code.claude.com/docs/en/headless) |
| `permission_denials` | the run's JSON | what the run was refused | an error: in `dontAsk` the run goes on | [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| `total_cost_usd` | the run's JSON | an estimate of spend | your bill | [Costs](https://code.claude.com/docs/en/costs) |
| A reviewer's Read line | its report | the scope of its verdict | completeness | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| `CLAUDE.md`'s source order | the kit | how sources rank | enforcement | [Memory](https://code.claude.com/docs/en/memory) |
| The bounds file | `--settings` | what the run may touch; a deny wins at every level | a guarantee about files the sandbox doesn't cover: Claude's file tools, MCP and hooks run outside it | [Permissions](https://code.claude.com/docs/en/permissions), [Sandboxing](https://code.claude.com/docs/en/sandboxing) |

The release call is the same on any surface. In GitHub, the same evidence lives in the Actions run, with its commit and its log, and in the pull request.
