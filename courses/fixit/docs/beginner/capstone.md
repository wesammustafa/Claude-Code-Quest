# Capstone: the March attendee guide

<sub>**Beginner** · Capstone, Lesson 6 of 6 · 30 to 45 minutes · Needs: the five [Beginner lessons](README.md), or their skills · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

Hand Maya a March attendee guide that a stranger can act on, where every fact traces to a source, one wrong fact from the sources has been caught and corrected, and one unconfirmed detail is visibly left open, with a readiness note that lets her see all of that without asking you.

## The brief

> **Maya (Events Desk, Millbrook Library):** Could you send me the attendee guide for March's Fix-It Saturday by Thursday 11 March? I'll post it on the library's events page and print 20 copies for the front desk. Half a page is plenty. People ask us the same things every month: when and where it is, whether they need to book, what to bring and what you can't take, how to get to the room (we get asked about the lift a lot), who to contact. Please don't put anyone's personal number on it; the front desk takes calls on 555-0100.

You hand over `fixit/march/attendee-guide.md` and `fixit/march/readiness-note.md`.

## What you start with

| File | What it is |
|---|---|
| `fixit/march/BRIEF.md` | Maya's request |
| `fixit/march/booking-confirmation-march.pdf` | the signed booking, a two-page scan |
| `fixit/march/booking-confirmation-march-text.md` | the booking's text version, for screen readers and search |
| `fixit/march/meeting-notes-2027-02-20.md` | the group's latest meeting notes |
| `fixit/march/priya-message.md` | a message from Priya, for step 4 |
| `fixit/sources/group-notes.md` | the group's standing notes |
| `fixit/sources/flyer-2026-10.png` | a photo of last October's flyer, with its text version `flyer-2026-10.md` |

## The decisions are yours

1. Which source wins when the booking, the notes and the flyer disagree.
2. How to state capacity to the public.
3. How to describe access to Room B.
4. Whose contact details go on a public page, including when someone asks you to add theirs.
5. When it's ready, and how you'll show Maya.

Two routes both work: brief Claude well, then check its draft; or ask for a quick draft, then check it hard. What doesn't work is skipping the check.

## The task

1. **Brief Claude for the draft.** Read Maya's request, start `claude` in this folder, and ask for a draft of `fixit/march/attendee-guide.md`.
2. **Check the draft against the sources.** Get every claim checked against the booking, the meeting notes and the standing notes, with the sources ranked and the lines cited. Open the cited lines yourself.
3. **Correct the guide**, in your own words.
4. **A request from Priya.** Read `fixit/march/priya-message.md` and decide.
5. **Write the readiness note** for Maya: how many people can book and the line that sets it, each other fact with its source, where the lift really stands, and how you checked. A table, a list or a few sentences all work.
6. **A fresh check.** Clear the conversation with `/clear`, then ask the fresh session to check the guide against your readiness note and Maya's brief, reporting without fixing anything.

## Check

The Lesson's check reads nine things: that the sources are as they arrived; that the guide gives the date, 10:30 to 1pm, a limit on places no higher than the meeting agreed (30, or "places are limited") with a way to book, how to reach Room B without promising step-free access, what you can't bring with this month's new rule, no personal number and the library's public one; and that the readiness note gives the public limit of 30 with the line that explains it (no other count on the wrong fact), says the lift is still to be confirmed (and never that it works), names a source for at least four of the guide's facts, and doesn't put the flyer above the booking.

What only you can judge: whether the guide fits on half a page, whether the access line is kind as well as accurate, and which one line changes if Priya confirms the lift on Friday.

**In this practice workspace**, Claude's drafts, verdicts and the fresh session's reply are written in advance. The check reads your two files, so it can't tell how you reached them, and it doesn't measure length or tone.
