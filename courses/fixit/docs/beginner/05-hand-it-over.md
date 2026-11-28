# Hand it over: show it is ready

<sub>**Beginner** · Lesson 5 of 6 · about 20 minutes · Needs: [lesson 4](04-steer-undo-and-start-fresh.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can write down what ready means, as criteria with evidence, have a fresh Claude session check the work against them, without the conversation that made it, and hand over something another person can verify.

## The job

> **Maya:** Thursday's fine. Before I post it, how do I know it's right? In November we posted the wrong time and the front desk took thirty calls. I'll print the door sign with it.

You can see what Maya will publish: `fixit/feb/attendee-guide.md`, the one-page guide from Lesson 4, and `fixit/feb/door-sign.md`, the Room B sign from Lesson 2. Jordan printed it again from last October's flyer, so it says 10am to 1pm, and nobody has checked it since. The sources are beside them: the library's two emails, the January meeting notes, and, in `fixit/sources/`, the group's standing notes and last October's flyer.

## You need

- In Questerm: nothing. Claude's replies are written in advance, and nothing leaves your browser. The fresh session's findings are written for this lesson. `/clear` behaves as in real Claude Code: the conversation empties, and your files stay as they are.
- On your own computer: Claude Code, installed as in [lesson 1](01-start-and-check.md).

## The idea

"It's right, I checked" can't be checked. A readiness note with a source for every fact can be checked, by Maya, by you next month, or by a fresh session in thirty seconds.

A new session, or this one after `/clear`, starts with no memory of this conversation. It knows only what's in the files. If the guide can be verified by something that knows only the files, it can be verified by Maya.

## Worked example

1. **Why a fresh session.** First decide: the guide is finished. Who should do the final check before Maya posts it? Not the same session that wrote it. That session remembers why it wrote each line, and it tends to agree with itself. It will check what it meant, not what's on the page. Not nobody, either. Every line of the guide was checked. Maya is printing two documents. A fresh session that sees only the files and your written criteria is right. It knows nothing you didn't write down, which is exactly the position Maya, or next month's you, will be in.

   Start Claude in the `project/` folder:

   ```bash
   claude
   ```

   A new session starts with no memory of any earlier conversation, and so does this one after `/clear`. It knows only what's in the files. It won't know which source you trusted, or that the parking changed on Friday, unless a file says so. Anything that's only in the conversation is about to be lost. (Writing such things down where every new session reads them is Intermediate Lesson 1.) If Claude Code asks whether you trust this folder, accept it: this is your own practice copy, as in Lesson 1.
2. **Write down what ready means.** Maya's questions from her request become the criteria. Send:

   `Make fixit/feb/readiness-note.md for Maya. For each thing an attendee needs to know (when, where, parking, booking, what to bring, what we can't take, access, who to contact), give the guide's answer and the file and line that supports it. Add a "Still open" section for anything not confirmed. Don't change the guide.`

   Open `fixit/feb/readiness-note.md` in the files tab and spot-check two rows against the files. They hold: Claude did this well. The note is the guide's evidence, in one place Maya can read.

## Your turn

1. **Run the fresh check yourself.** Start an empty conversation, so the check knows only what's written down: type `/clear`. Then, in your own words, ask the fresh session to check what Maya will publish against the readiness note's criteria and the sources, and to report problems rather than fix them. The choice that's yours: what to check. Maya publishes the guide and prints the door sign. Checking only the guide is quicker. Decide. Stuck? Ask yourself what the check should measure against, and what counts as evidence. Should the checker also be the fixer? You'll want to see the findings first.
2. **Fix it, or note it?** The door sign says 10am. Maya prints it tomorrow. What do you do? **Still open** is for what the evidence can't settle yet. This one is settled: the sign is wrong. Asking Claude whether 10am is close enough doesn't help. You already have the evidence. Asking again gets a second opinion, not a better one. Fix what's wrong, then write down the rule the fresh session had to guess, so the next check doesn't have to.
3. **Ask Claude to make it ready.** This step is optional. Ask Claude to correct the door sign's time, and to add a line to the readiness note saying which sources win when they disagree. Or skip the step and make the changes yourself in the files tab.
4. **Make it ready.** Make sure `fixit/feb/door-sign.md` gives the guide's time, that `fixit/feb/readiness-note.md` says which sources win when they disagree, and that its **Still open** part is honest: is anything in the guide true only for this one Saturday, or not yet confirmed? Stuck? Which source did every row of the readiness note use, and which never? Then read `fixit/feb/venue-email-feb-update.md` again: does it say Park Lane is free every Saturday, or that it's open on this one?

   Before you call it ready, read everything that changed in one place:

   ```text
   /diff
   ```

   `/diff` shows every edit in the folder, yours and Claude's together: the door sign's new time and the readiness note's new lines, each under its file name. The panel may already be open, since it opens on its own once Claude edits files: read it there, because typing `/diff` closes it. Nothing there is a surprise if you read each change as it happened; the point is to be sure, in one place, before Maya prints it.

5. **Save a version.** This step is optional, and not part of the check. When it's ready, ask Claude to save a version of the February files called "February guide ready". Claude records a snapshot of the folder you can always go back to, even after rewinds and new sessions. Under the hood this is a Git commit; you don't need to know Git to use it.

## Check

The Lesson's check reads four things:

- the door sign gives the guide's time, 10:30
- `fixit/feb/readiness-note.md` gives a source for each fact, and says which source wins
- the readiness note says what's still open
- the guide still gives 10:30, booking, the public number and Park Lane

It reads the files, not a record of your sessions: Questerm keeps no record of the fresh session for a check to read, so the step that asks for it judges your request instead.

What only you can judge: Maya, who wasn't in any of these conversations, could use the readiness note to answer a caller. If someone rings the desk asking "can I park at the library?", which row answers them? And **Still open** holds what's true only for this one Saturday, or says nothing is, because you looked.

## On your own computer

In Questerm the fresh session's findings are written in advance. With real Claude Code a fresh session works the same way: it starts with no conversation history.

1. Write the readiness note in the same folder as the work.
2. Start a fresh session: `/clear` in the current one, or `/exit` then `claude` again. Project memory files, if you have any, still load; that's Intermediate Lesson 1.
3. Ask it to check the work against the note and report, not fix.
4. To save a version: if the folder is a Git repository, ask Claude to commit with a message; if it isn't, ask Claude to set one up, or copy the folder somewhere safe. On Windows without Git installed, Claude Code can't make Git commits until you install Git for Windows.

## Technical detail

| Item | What it does | How to check | Watch out for | Reference |
|---|---|---|---|---|
| `/clear` | starts an empty conversation in the same session | the conversation is empty; the earlier one is in `/resume` | none | [Commands](https://code.claude.com/docs/en/commands) |
| A fresh session as reviewer | Anthropic's best practices suggest a fresh context for review, because the writer's context biases the check | the reviewer cites files, not "as we discussed" | a reviewer given your conclusions agrees with them: give it criteria and sources only | [Best practices](https://code.claude.com/docs/en/best-practices) |
| What a new session loads | project memory (`CLAUDE.md`), settings and skills' descriptions; not the previous conversation | `/context` or `/memory` | rules said only in chat are gone | [Memory](https://code.claude.com/docs/en/memory) |
| Saving a version (a Git commit) | records the folder's state with a message | `git log --oneline` lists it | committing on Windows needs Git for Windows; checkpoints are not version control | [Common workflows](https://code.claude.com/docs/en/common-workflows), [Checkpointing](https://code.claude.com/docs/en/checkpointing) |
| `/diff` | shows what changed in the folder, yours and Claude's edits together | the files you expected, and nothing else, are listed | it reads the working tree, so a change already committed isn't in it | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#review-changes-with-%2Fdiff) |
| Verification commands | for code changes: `/code-review` reviews the diff in a fresh subagent that never saw your conversation, `/security-review` looks for vulnerabilities in your branch, and `/verify` builds and runs the app to see the change work | see their pages | they review code, not documents, and `/security-review` needs an `origin` remote | [Commands](https://code.claude.com/docs/en/commands), [Review locally](https://code.claude.com/docs/en/code-review-local) |

In Claude chat, a new conversation is the fresh session: attach the work, the sources and the readiness note, and ask for a report. In a Claude Project, files you add to the Project's knowledge are available to every new chat in it, which is chat's version of written down where every new session reads it. The Desktop app's Code tab and the VS Code extension start new sessions from their session lists.
