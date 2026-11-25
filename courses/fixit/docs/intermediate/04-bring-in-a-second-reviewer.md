# Bring in a second reviewer

<sub>**Intermediate** · Lesson 4 of 5 · about 25 minutes · Needs: [Decide what each part may touch](03-decide-what-each-part-may-touch.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can decide when a second reviewer earns its place, define a read-only reviewer that can't change anything, give it the context it needs, choose its model and effort for the job, and treat what it reports as leads you check, not verdicts you apply.

## The job

> **Maya:** The March guide was great. One thing: when I proofread February's, I found a "can't take" rule missing, and I only noticed because someone asked at the desk. Could someone other than the person who wrote it check these before they come to me?

You can see February's guide and fact table in `feb/`. Something on the can't-take list is missing, and nothing told you.

A reviewer that shares the writer's context tends to share the writer's blind spots. And a reviewer that's wrong and trusted is worse than no reviewer.

This lesson starts with the reference kit as it stands after Lesson 3: `fixit/CLAUDE.md`, the public-pages rule, the attendee-guide skill, and the shared settings with the private-folder rule, the sources protection and the number guard. `feb/` and `march/` each hold a guide and a `facts.md` the skill made. Your own version stays in Lesson 3.

## You need

- In Questerm: nothing. Claude's replies, and the reviewer's reports, are written in advance, so the model and effort you choose don't change them, and nothing leaves your browser. The agent file is real: its tools decide what the reviewer can do.
- On your own computer: Claude Code, and a folder of your own to try it in. An agent is a plain text file, so any editor opens it.

## The idea

A subagent is a helper with its own context: Claude hands it a job, it works on its own, and it reports back. It never sees the conversation that wrote the guide, only the job Claude passes it and the files it reads. That fresh context is what you're paying for.

So first, a question: February's guide is written. Before it goes to Maya, how should it be checked? Asking the same session to check its work tends to confirm what it wrote: it has the same sources in mind and the same assumptions. A reviewer on every document the group writes costs time and usage, and a thank-you note doesn't need one. What earns its place is a separate reviewer, with fresh context, for anything the public will rely on.

## Worked example

1. **Start Claude where the kit lives.** Work in `fixit/`, as you did in the last three lessons, and start Claude there:

   ```bash
   cd fixit
   claude
   ```

   Trust the folder: it's part of your practice copy.
2. **Define a reviewer that can only read.** Ask Claude for a subagent: `Create a project subagent called guide-reviewer that checks a finished attendee guide against its month's facts.md and the sources, and reports problems with file and line. It must only read: give it Read, Grep and Glob, nothing else. It never edits.`

   A subagent is a file in `.claude/agents/`: a description of what it does and when to use it, the tools it may use, then its instructions. Open `fixit/.claude/agents/guide-reviewer.md` in the files tab. `tools: Read, Grep, Glob` is all it gets. It can read and search files, and it can't edit them or run commands, so it can't fix anything it finds. Leave the `tools:` line out and it gets every tool the main session has, Edit included.
3. **Delegate, and read what comes back.** Hand it February's guide, naming the agent so Claude hands the job to it: `Have the guide-reviewer check feb/attendee-guide.md against feb/facts.md.`

   The reviewer works in its own context. Its reads show under its name: the guide, the fact table and the sources. It reports two findings:

   1. **Hours.** The guide says 10:30am to 1pm, and line 6 of `sources/flyer-2026-10.md` says 10am to 1pm.
   2. **Can't take.** The guide lists microwaves, gas appliances and swollen or cracked batteries. Line 15 of `sources/group-notes.md` also excludes items that need mains rewiring inside the casing.

   Don't act on either yet.
4. **Check each finding before you act on it.** Open the lines it cites.

   - **Finding 1.** The flyer is the oldest source, and `CLAUDE.md` says never to use one for times. The January notes say public from 10:30, at line 5 of `feb/meeting-notes-2027-01-28.md`, after the library's 10:00 booking. **The reviewer is wrong**: it weighed every source the same.
   - **Finding 2.** Line 15 of `sources/group-notes.md` says exactly that. **The reviewer is right**, and that's the rule Maya found missing.

   Ask the main session to add the missing rule and leave the hours alone: `Add the missing can't-take rule from line 15 of sources/group-notes.md to feb/attendee-guide.md and feb/facts.md. Leave the hours as they are.`

   Then fix the reviewer, so it doesn't repeat finding 1: `Add to the guide-reviewer's instructions: read CLAUDE.md for which source wins, and never report a guide fact as wrong because an old flyer disagrees with the venue's confirmation.`

   What you just did: used the reviewer's mistake to improve its instructions, and its correct catch to improve the guide. Neither finding was applied without opening the line it cited.

## Your turn

The evidence changes: March's guide, and you choose how the reviewer runs.

1. **Give the reviewer what it needs.** In your own words, have the guide-reviewer check `march/attendee-guide.md`. Tell it which fact table to use, and that it must not change anything. Its report runs with the instructions you fixed: one finding it's sure of, and one it isn't.
2. **Choose the reviewer's model and effort.** The reviewer matches facts in a guide against a table and a few short files. The main session does the harder part, reconciling sources that disagree. So what should the reviewer run on? The most capable model at maximum effort only gets slower and uses more of your plan: matching a line to a table doesn't get better with more thinking. Whatever the main session uses works, and it's the default, but it's more than this job needs. A smaller, faster model at normal effort fits: the job is narrow and checkable, and you check its findings anyway. Ask Claude to set it, for example to `haiku`.

   **Honest note:** in Questerm the replies are written in advance, so the reviewer's answers don't change when you change its model. On your own computer they would: a smaller model is faster and uses less of your plan. What you practise here is the choice.
3. **Decide on each finding, and record why.** For each of the reviewer's two March findings, open the source and decide. Then write one line per finding in `march/review-log.md`, in the files tab: the finding, **kept** or **changed**, and the source line that decided it. Finding 1 says no problem: do you agree from the sources, or only from the reviewer? For finding 2, what would an attendee lose if "free" were wrong?

   You may also change "Tea is free" to "Tea", to stay strictly within the sources. That's valid too: change the March guide as well, and say why in the log.
4. **Put the reviewer in the procedure.** Make the review part of the skill, so Sam gets it without remembering to ask: after the guide is written, the skill hands it to `guide-reviewer` and treats what it reports as leads.

## Check

The Lesson's check reads six things:

- `fixit/.claude/agents/guide-reviewer.md` is named guide-reviewer, says what it checks and when to use it, may only read (Read, Grep, Glob), and has a model
- the reviewer's instructions tell it which source wins: `CLAUDE.md`'s source order, so an old flyer never beats the venue's confirmation
- `fixit/march/review-log.md` answers the reviewer's March findings: a line on the places, and one on the tea
- `fixit/feb/attendee-guide.md` lists the rule the reviewer rightly found missing, items that need mains rewiring, and still gives the public hours from 10:30am
- each line of the log says kept or changed, and names the source file that decided it
- a step of the attendee-guide skill hands the guide to `guide-reviewer` after it's written, and treats what it reports as leads to check

The check reads your review log for the reviewer's two March findings, not a record of the reviewer's run: that it ran on the March guide is yours to say.

What only you can judge: whether each decision in the log is right. The check confirms you named a source. Put each line beside the source line it cites: does the source say what you claimed?

## On your own computer

1. `/agents` lists, creates and edits subagents. Project agents live in `.claude/agents/`, personal ones in `~/.claude/agents/`. Claude Code picks up an agent file you add or edit within a few seconds, with no restart.
2. Ask for it by name ("have guide-reviewer check ...") for a predictable run. Claude also hands a job to an agent on its own when the request matches the agent's description.
3. `model:` accepts aliases such as `haiku`, `sonnet` and `opus`, or `inherit` for the main conversation's model. `effort:` sets how long it thinks, from `low` to `max`, where the model supports it.
4. `/usage` shows what the session used; on Pro, Max, Ultra, Team and Enterprise plans it breaks usage down by subagent.

See [Create custom subagents](https://code.claude.com/docs/en/sub-agents), [Model configuration](https://code.claude.com/docs/en/model-config) and [Manage costs](https://code.claude.com/docs/en/costs).

## Technical detail

| Item | What it does | How to verify | Failure case |
|---|---|---|---|
| `.claude/agents/<name>.md` | a subagent with its own context, instructions, tools and model | `/agents` lists it | a vague description makes Claude's own choice to delegate unpredictable; name the agent for a reliable run ([Subagents](https://code.claude.com/docs/en/sub-agents)) |
| `tools: Read, Grep, Glob` | limits it to reading and searching | ask it to edit: it can't | leave `tools` out and it gets the main session's tools |
| `model: haiku` | a cheaper, faster model for a narrow job | the `/usage` breakdown | a subagent gives you a fresh pair of eyes, not a smarter answer ([Best practices](https://code.claude.com/docs/en/best-practices)) |
| Effort (`/effort`, or `effort:` in the agent file) | how long Claude thinks, from `low` to `max` per model | the effort indicator | `max` can overthink a simple job; "think hard" in a prompt is ordinary text ([Model configuration](https://code.claude.com/docs/en/model-config)) |
| Background subagents | most subagents Claude starts run in the background | `/tasks` | edits most subagents make aren't restored by `/rewind`; this reviewer can't edit ([Checkpointing](https://code.claude.com/docs/en/checkpointing)) |
| `/code-review` | Claude Code's own review of a code change | its report | it's for code; this lesson's reviewer is for documents ([Code review](https://code.claude.com/docs/en/code-review-local)) |

In Questerm, the agent file is read as Claude Code reads it: its name and description load it, and its `tools:` line decides which of the reviewer's reads and edits it may make. The reviewer's reports are written in advance, and it runs in the foreground here, so you read its report before you go on.

The Desktop app's Code tab and the VS Code extension use the same agent files. In claude.ai there are no subagents: the same move there is a new chat given only the finished document, the sources and your checklist, so it reviews without the drafting conversation.
