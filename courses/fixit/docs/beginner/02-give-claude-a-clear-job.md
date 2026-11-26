# Give Claude a clear job

<sub>**Beginner** · Lesson 2 of 6 · about 20 minutes · Needs: [lesson 1](01-start-and-check.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can give Claude a job with its sources, which one wins, who it's for and what it must contain; answer the question Claude asks before it starts; choose who approves Claude's edits; and ask for a plan first, and send back a plan you shouldn't approve.

## The job

> **Priya (lead volunteer):** Last month someone carried a microwave up two flights of stairs. Can you get Claude to draft the "what to bring" half-page for February? The list is in the meeting notes. Keep it short; people read it on their phones.

The sources are `fixit/feb/meeting-notes-2027-01-28.md` and `fixit/sources/group-notes.md`. There is also last October's flyer, `fixit/sources/flyer-2026-10.md`, which says "We fix anything!"

## You need

- In Questerm: nothing. Claude's replies are written in advance, and nothing leaves your browser. The session starts in auto mode, and Claude's plans and questions are written for this lesson.
- On your own computer: Claude Code, installed as in [lesson 1](01-start-and-check.md).

## The idea

Claude makes what you ask for, from what it reads. Ask vaguely and it fills the gaps from whatever it finds, including last year's flyer.

Sources, audience, outcome and a test for done are the four things Claude can't guess. A good brief names the files to use and which one wins when they disagree, who the result is for, what it must contain, and how you'll know it's done.

## Worked example

1. **A vague request, and what it costs.** Start Claude in the `project/` folder:

   ```bash
   claude
   ```

   If Claude Code asks whether you trust this folder, accept it: this is your own practice copy, as in Lesson 1. Send the request exactly as a busy person would type it: `make a what to bring handout from the fixit folder`. Claude writes `fixit/feb/what-to-bring.md`. Open it in the files tab and read what Claude made. We fix anything! and the biscuits come from last October's flyer, and the safety list lost two items: damaged batteries and rewiring. Claude used every file it found and treated the flyer as just as good as the notes, because nothing told it otherwise. It did what was asked. The request is what changed.
2. **A clear brief, and a question back.** First decide: you're about to type a request for a what to bring handout. Which addition changes the result most? Asking for it to be really good and friendly doesn't help: adjectives don't tell Claude what to read or what done looks like. Asking Claude to be careful doesn't either: Claude can only check against something. Name what to check against. Now send a brief that names the sources and which one wins, what the result is, and how you'll know it's done: `Redo fixit/feb/what-to-bring.md as a half-page handout. Use only feb/meeting-notes-2027-01-28.md and sources/group-notes.md; the October flyer is out of date, so ignore it. It must list everything to bring, every item we don't accept, and the one-item-until-12:00 rule, in plain words. No phone numbers.` Claude stops and asks who the handout is for, because the notes give visitors and volunteers different things to bring. Choose **1. Visitors**. A good clarifying question is one where the options lead to different documents. When the choice wouldn't change anything, Claude should just go ahead. Open `fixit/feb/what-to-bring.md` again: everything in it now comes from the two files you named.
3. **Who approves each edit.** Look at the line under the input. It shows the permission mode: who approves what Claude does. Choose who approves Claude's work before the job starts, not halfway through it.

   | Mode | What happens | Use it when |
   |---|---|---|
   | **Auto**, `⏵⏵ auto mode on` | A safety checker approves each action, and Claude doesn't stop to ask you | Small jobs you'll read afterwards anyway |
   | **Manual**, `⏸ manual mode on` | Claude asks before it edits a file or runs a command | You want to see each change as it happens |
   | **Accept edits**, `⏵⏵ accept edits on` | File edits, and simple file commands such as `mkdir`, `cp` and `rm` inside your folder, go through without asking; other commands still ask | Many small edits you'll review together at the end |
   | **Plan**, `⏸ plan mode on` | Claude reads and proposes a plan, and changes no files until you approve it | A job with several parts, where a wrong approach would waste time |

   Press `Shift+Tab` and watch the line change. Stop when it reads `⏵⏵ accept edits on`: that is the mode for a run of small edits you'll read together at the end. Then press it again until the line reads `⏸ plan mode on`.
4. **A two-file job: ask for a plan first.** Two documents have to agree: the handout and a door sign for Room B. Plan when a job has several parts and a wrong approach would waste your time: you read the plan before any file changes. Send: `Make a door sign for Room B in fixit/feb/door-sign.md, big time and room only, and add the date and time to the bottom of the handout so they match. Use the meeting notes and the library's email for the time.` Read the plan: it names both files, the source for the time, and nothing else. Choose **Yes, manually approve edits**. Careful with keys here: at the approval prompt, `Shift+Tab` approves the plan. To back out, press `Esc` first. Claude now asks before each of the two edits. Read each one and choose **Yes**. When it's done, the door sign and the bottom of the handout both say 10:30am to 1pm.

## Your turn

The evidence changes: a message for volunteers, where different things are allowed.

1. **Brief Claude yourself.** In your own words, ask Claude for a short reminder to the eight February volunteers, saved as `fixit/feb/volunteer-reminder.md`. Name the sources and which wins, say who it's for, say what it must contain, and decide whether Priya's number goes in. Priya's mobile, 555-0187, is for volunteers only: it must never go on anything public. This message is for volunteers. Include it, so a late volunteer can reach her, or leave it out, in case the reminder gets forwarded. Either is fine; not deciding isn't, because then Claude decides for you. The session is still in manual mode from step 4, so Claude asks before it saves the file. Read what it will write, then choose **Yes**. Then open `fixit/feb/volunteer-reminder.md` and read it as a volunteer would: when to get in, and where to park.
2. **Review a plan you shouldn't approve.** Switch to plan mode, then ask Claude, in your own words, to update the door sign so its time matches the reminder. For example: `update feb/door-sign.md so the time matches the volunteer reminder`. Claude's plan checks the door sign against the reminder, then adds February's times and parking to `sources/group-notes.md`. Don't approve it: the standing notes are a source Priya keeps for every month. Writing one month's parking into them makes them wrong for March, and you didn't ask for it. Approving and undoing that part afterwards works if you remember. Turning it down now costs one line and changes nothing. Choose **No, keep planning** and type your reason in the box: what to drop, and why. A plan is cheapest to fix before it runs. Say what to drop and why, so the next plan doesn't bring it back. Claude answers with a one-step plan: no changes needed, because the door sign already matches.

   If you approved it, `sources/group-notes.md` now holds February's times, and the check says so. Ask Claude to put the file back as it was, or reset the step.

## Check

The Lesson's check reads four things:

- `fixit/feb/volunteer-reminder.md` tells volunteers when to get in and where to park
- the reminder gives no phone number but Priya's or the library's
- the sources are as they were when the lesson started
- `fixit/feb/door-sign.md` gives 10:30 as the start, not 10am

What only you can judge: would a volunteer who skims the first two lines of your reminder get to the right door at the right time?

## On your own computer

With real Claude Code, plans and questions depend on your files and your words, and a new session usually starts in auto mode.

1. Put two or three documents you want turned into something into a folder, go into it in the terminal, and start `claude`.
2. Write your brief with the four parts: the sources and which wins, who it's for, what it must contain, and how you'll know it's done. Type `@` and a file's path to include that file in your request.
3. For a job with several parts, press `Shift+Tab` until the line under the input says `⏸ plan mode on`, or type `/plan` followed by the task.
4. To make Claude ask you before it starts, end the brief with "Ask me anything you need to know before you start."
5. On native Windows, without WSL, Claude Code may run commands in PowerShell instead of Bash. Briefs and plan mode work the same.

## Technical detail

| Command or setting | What it does | How to check | Watch out for | Reference |
|---|---|---|---|---|
| `Shift+Tab` | moves to the next permission mode | the line under the input names the mode | at a plan approval prompt, `Shift+Tab` approves the plan: press `Esc` first | [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| Accept edits mode | file edits go through without asking, and so do simple file commands such as `mkdir`, `cp` and `rm` inside your folder; anything else still asks | the line reads `⏵⏵ accept edits on` | it holds until you change it, so read the edits together at the end | [Permission modes](https://code.claude.com/docs/en/permission-modes#auto-approve-file-edits-with-acceptedits-mode) |
| `/plan` and a task | enters plan mode and starts the task | the line reads `⏸ plan mode on` | in plan mode Claude can still read files and run commands that only look | [Plan mode](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode) |
| Plan approval | approve with auto mode, approve and confirm each edit, or keep planning; `Ctrl+G` opens the plan to edit it | after approval the mode changes: read the line | approving a plan doesn't review the result: read the files afterwards | [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| Auto mode | a safety checker approves each action; interactive sessions start in it from Claude Code 2.1.283 | the line reads `⏵⏵ auto mode on` | it's a judgment, not a rule, and can be wrong; deny rules still hold in every mode | [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| Questions from Claude | a numbered menu of choices | pick one, or type your own answer | in auto mode Claude keeps going without asking unless your brief invites questions | [Tools reference](https://code.claude.com/docs/en/tools-reference) |

In the VS Code extension and the Desktop app, the mode is a selector labelled with the mode's name, and it applies to that conversation only. In Claude chat outside Claude Code there are no permission modes, because Claude can't edit your files there, but the brief's four parts work the same.
