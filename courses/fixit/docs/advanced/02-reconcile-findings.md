# Reconcile conflicting findings

<sub>**Advanced** · Lesson 2 of 5 · about 25 minutes · Needs: [lesson 1](01-split-the-work.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can weigh disagreeing reviews by what each one read and how recent its evidence is, settle what the files can settle and ask the one question that settles what they can't, and write the decision down with its evidence.

## The job

> **Maya (Friday 11 June, 08:15):** I've got three review notes on the June page and they don't agree. One says change the room back to B, one says June isn't step-free, one says it's fine. I publish at noon. Which do I believe?

It's release morning, Friday 11 June 2027. The three reports are in `fixit/summer/reviews/`: `accuracy.md`, `accessibility.md` and `privacy.md`. The page they reviewed is `fixit/summer/public/june.md`. The library's late email, `fixit/summer/late-email-2027-06-10.md`, came in at 16:40 yesterday.

A reviewer that read the wrong file sounds as confident as one that read the right one. Picking by majority or by tone puts a wrong room on the library's website.

This lesson starts with the reference organizer kit as it stands at the end of Intermediate, in `fixit/`, and the summer files as they stood on release morning. Your own files from lesson 1 stay in lesson 1.

## You need

- In Questerm: nothing. The reviewers' reports are written in advance, and so are Claude's replies. Nothing leaves your browser.
- On your own computer: Claude Code, and two or more reviews of one file that disagree.

## The idea

A finding is only as good as its sources. Scope and date decide most disagreements. For each finding, check what the reviewer read, whether newer evidence exists, and open the line it relied on.

What the files can't settle is a question for a person, not a judgment for Claude. Ask the one person who knows, and keep the claim off the page until they answer.

## Worked example

1. **List what each reviewer read.** First, decide: two reviewers flag the June page, one says it's clear. How do you decide which findings to act on? Counting flags treats every reviewer as equally informed. A reviewer that read last March's notes can flag a June page for the wrong reason. Asking Claude for a fourth review is no better. A fourth opinion is another vote. If it reads the same files as the others, it inherits their blind spots.

   Open the three reports in the files tab, in `fixit/summer/reviews/`. Each report starts with a **Read:** line.

   - Accuracy read `june.md`, the June booking signed on 19 May and the May meeting notes. It didn't read the late email of 10 June.
   - Accessibility read the three session pages and last March's notes, `march/meeting-notes-2027-02-20.md`. It didn't read the June booking, the May notes or the late email.
   - Privacy read all four public pages. It needs no sources: it checks for personal numbers.

   The late email arrived at 16:40 yesterday, after the reviews were set up. Two reviewers never saw it.
2. **Ask Claude to reconcile, with the newest evidence.** Go into the kit folder and start Claude there. Claude Code asks whether you trust this folder: it's your practice copy of the kit, so read the dialog and accept it.

   ```bash
   cd fixit
   claude
   ```

   Give Claude the newest evidence by name, so it can't miss it the way two reviewers did. Ask: `Three reviews of summer/public/june.md disagree. For each finding in summer/reviews/, say which files it relied on, whether summer/late-email-2027-06-10.md changes it, and what the June page should say. Quote the lines. Don't edit anything.`

   Claude answers with a table. It sets aside the accuracy finding: the late email, a newer written confirmation from the venue, overrides the older booking on what it covers, which is the first rule in the kit's `CLAUDE.md`. It says 32 places is wrong now, sets the accessibility finding aside for June, and agrees with privacy. The page should say Room A, step-free, and fewer than 32 places.
3. **Catch what Claude left open.** Claude stopped at "fewer than 32". Open `fixit/summer/meeting-notes-2027-05-27.md`: June had 8 volunteers for Room B. The May notes give each session's volunteers and its cap, one line a session. Room A holds 30 including your team. With 8 volunteers that leaves 22; with 6 it leaves 24.

   The files can't tell you how many volunteers will come to a smaller room. That is a question for Priya, not a judgment for Claude. Priya answers at 08:35: "Six of us for Room A, I've told the others." That gives 24 places.

   Claude was partly right. It caught the stale room, the stale access finding and the stale cap, and it correctly stopped short of inventing a number. The step it couldn't take needed a person.
4. **Record the decision.** Ask Claude to correct the page and write the decision down where Maya will see it: `Change the Booking line of summer/public/june.md to 24 places. Then write summer/reviews/june-decision.md for Maya: what we acted on, what we set aside and why, with the evidence for each, and what stays open for release day.`

   Then open `fixit/summer/reviews/june-decision.md` and read it against the evidence. Its last line says 28 people registered for June and there are 24 places. That is what you hand forward. You didn't settle it, and you said so.

## Your turn

The evidence changes. On Wednesday 9 June Sam edited the August page by hand, outside Claude, and three reviewers have reported on his version. His page is `fixit/summer/a-8/august-sam-2027-06-09.md`, and their reports are in `fixit/summer/a-8/reviews/`.

1. **Reconcile the August reviews.** In your own words, ask Claude to reconcile the three August reviews: what each read, whether newer evidence changes it, and what the page should say. Ask for quoted lines, and don't let it edit yet. For example: `Reconcile the three reviews in summer/a-8/reviews/ of summer/a-8/august-sam-2027-06-09.md. For each finding say what files it relied on, whether anything newer contradicts it, and quote the deciding line. Don't edit anything yet.`
2. **Decide what the files can't settle.** Nobody's evidence covers "Free parking at the centre." Decide what you do before Maya publishes. No reviewer objected because none of them had a source for it. Silence isn't confirmation. Claude can only read what's in the folder, and the bookings connection, which doesn't cover parking. It would be guessing. Holding the whole page is safe, but the rest of it is confirmed, and people booking for August need it today. One question to the person who knows, and no unconfirmed claim on the page meanwhile. Add it back when Kofi answers.
3. **Ask Claude to correct the page and write the note.** You can skip this and do the next step by hand in the files tab. Tell Claude which findings to act on and which to set aside: what to change on Sam's August page, and what to write in `fixit/summer/a-8/august-decision.md`, with the one question for Kofi.
4. **Correct the page and record the decision.** Make Sam's August page right, and make sure `fixit/summer/a-8/august-decision.md` says which findings you acted on, which you set aside and why, and the one question you're asking.

   Which finding relied on a source older than Kofi's email? What did no reviewer have evidence for? The exact changes: remove "Text Sam on 555-0162, or" and "Free parking at the centre." Keep "accessible toilet available."

## Check

The Lesson's check reads three things: that `august-sam-2027-06-09.md` gives only the public numbers and claims no parking, that it still says the accessible toilet is available, as Kofi's email of 25 May does, and that `august-decision.md` says which findings you acted on, which you set aside and why, and the one question you're asking.

What the check can't see is whether you opened the lines the findings relied on. In this practice workspace, your requests are judged before Claude acts on them.

What only you can judge: if you were off sick at noon, could Maya publish from your note alone?

## On your own computer

In this practice workspace the three reviewers were written in advance: their reports are fixtures, and Claude's reconciliation is a scripted reply. With real Claude Code:

1. Run the reviewers as read-only subagents, with `tools: Read, Grep, Glob` in `.claude/agents/<name>.md`, and ask each one to list the files it read. Without that line, you can't weigh scope.
2. Give the reconciling session the newest evidence by name, as in `@summer/late-email-2027-06-10.md`. A fresh reviewer isn't biased by having watched the work, but it isn't automatically informed either ([Best practices](https://code.claude.com/docs/en/best-practices#know-what-subagents-cost)).
3. For code, `/code-review` is a bundled independent reviewer, and its findings are leads to check the same way ([Commands](https://code.claude.com/docs/en/commands)). Name what it should review: the docs disagree on what it reviews when given no target.

## Technical detail

| Mechanism | What it does | How to verify | Failure case | Reference |
|---|---|---|---|---|
| A read-only subagent | a separate context, with tools limited to reading | its frontmatter `tools:` line; it can't edit | a reviewer that read the wrong scope still reports confidently | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| "List the files you read" in the reviewer's prompt | makes its scope something you can inspect | the report's **Read:** line | a reviewer can still miss a file it was never pointed at | [Best practices](https://code.claude.com/docs/en/best-practices#give-claude-a-check-to-run) |
| A precedence rule in `CLAUDE.md` | guidance on which source wins | the reconciling session cites it | guidance, not enforcement: a subagent reads `CLAUDE.md` too, but may still not have the newer file | [Memory](https://code.claude.com/docs/en/memory) |
| Hooks | deterministic checks on Claude's own tool calls | the hook blocks Claude's edit | a person's hand edit never passes through a hook | [Hooks guide](https://code.claude.com/docs/en/hooks-guide) |

## Go further

- [Best practices](https://code.claude.com/docs/en/best-practices#know-what-subagents-cost): what a fresh reviewer gives you, and what it doesn't.
