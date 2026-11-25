# Capstone: hand the kit to Sam

<sub>**Intermediate** · Capstone, Lesson 6 of 6 · 40 to 60 minutes · Needs: [lesson 5](05-connect-an-outside-tool.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

Hand Sam a kit that, in a fresh session with no help from you, turns `april/` into a correct public guide with no private details, and a `KIT.md` that says honestly what it does and doesn't do.

## The brief

> **From:** Sam · **Date:** Mon 29 March 2027 · **Subject:** Using your kit for April
>
> I'm running April's Fix-It Saturday at Northside Community Centre on **Saturday 10 April**. Kofi at the centre has emailed me everything, and my own notes are in `april/` too.
>
> I'd like to make the attendee guide myself with your kit, the way you did for March, so I'm not waiting on you every month. I'll open a fresh Claude session in `fixit/`, ask for the April attendee guide, and send whatever comes out to Kofi for the centre's noticeboard on **Wednesday 7 April**.
>
> You won't be there when I run it, so if the kit needs anything to work for Northside, please sort it before then.

Kofi pins the guide on the noticeboard. Forty people decide from it whether to come, where to go in, and whether there's a toilet they can use.

You hand over the kit, `KIT.md`, and a short note to Sam in `april/handoff-note.md`.

## What you start with

| File | What it is |
|---|---|
| `fixit/april/BRIEF.md` | Sam's request |
| `fixit/april/venue-email-northside.md` | Kofi's email confirming the booking |
| `fixit/april/sam-notes.md` | Sam's notes for the session |
| `fixit/april/private/roster.csv` | the volunteers' phones and emails |
| `fixit/april/flyer-northside-2026.md` | last year's Northside flyer |
| the kit in `fixit/` | `CLAUDE.md`, the public-pages rule, the attendee-guide skill, the shared settings and the number guard, the guide-reviewer agent, the bookings connection and `KIT.md`, as they stand after lesson 5 |

The kit is the reference kit, not the one you built in the lessons: yours stays in those lessons. This capstone tests whether you can find and fix a kit's faults, not whether you kept your files.

## The decisions are yours

1. How to find out whether the kit works for Northside before Sam does.
2. What, if anything, is wrong with the kit, not just with April's guide.
3. For each fault, which part of the kit to change: memory, the skill, the settings, the guard, or the folder layout.
4. Whether Sam's own "anyone can ring me" number belongs on a public page.
5. What `KIT.md` should promise, and what it should admit.

Making April's guide yourself and sending it to Sam doesn't meet the brief: Sam gets a good guide this month and the same kit next month.

## The task

1. **Run the kit the way Sam will.** A fresh session in `fixit/`, Sam's words, no help.
2. **Say what's wrong, and where it comes from.** Compare the guide and its fact table with Kofi's email, line by line, and every number on the guide with where it came from.
3. **Fix the source order**, so a venue's written confirmation wins on venue facts whatever form it takes. Make the skill's step say the same.
4. **Fix the leak where it starts and where it lands.** No number but a venue's public one reaches a public page, whichever file it came from. Prove it with two probes: one the guard must block, one it must let through.
5. **Run it again as Sam**, in a fresh session, and compare the result with Kofi's email.
6. **Tell Sam the truth about the kit.** Update `KIT.md`: what it does, what it does not do, and when it was last tested. Then write Sam a short note.
7. **A case you haven't seen.** Run the kit on May's sources, and decide whether the kit, not the guide, needs another change.

## Check

The Lesson's check reads the kit and what it made: the source order in `CLAUDE.md` and the skill's step that applies it; the number guard, run on test edits as Claude Code runs it, so any guard that behaves right passes; the read rules in the shared settings; the April guide and its fact table; `KIT.md`; your note to Sam; and the guard on May's guide.

What only you can judge: whether the guide reads well for a noticeboard, whether `KIT.md`'s limits are the ones that matter to Sam, and whether the school's public number should be added for May.

**In Questerm**, Claude's replies are written in advance, worked out from what your kit's files say, and the bookings server is simulated. Questerm asks for each run in a fresh session, but the check reads your files, not a record of the sessions or of the skill running: a guide corrected by hand while the kit stays wrong still fails, because the kit is what the check reads.

## On your own computer

Sharing a kit for real:

1. Commit or share the whole `fixit/` folder: `CLAUDE.md`, `.claude/` (rules, skills, agents, `settings.json`, hooks), `.mcp.json` and `KIT.md`. Not `.claude/settings.local.json` or `CLAUDE.local.md`, which are yours alone.
2. On the other person's computer, hooks must be executable (`chmod +x` on macOS and Linux), the project's MCP server asks for approval on first use, and their own account and plan apply.
3. Test it the way they'll use it: a new session, their words, a folder you didn't prepare.
4. When the kit outgrows one folder, a plugin packages the same parts for installing anywhere.

See [Manage Claude's memory](https://code.claude.com/docs/en/memory), [Skills](https://code.claude.com/docs/en/skills), [Configure permissions](https://code.claude.com/docs/en/permissions) and the [Hooks guide](https://code.claude.com/docs/en/hooks-guide).

## Technical detail

| Item | Where in the kit | How it's verified here |
|---|---|---|
| Source order | `CLAUDE.md` | the check reads tier 1, and the fresh run's fact table |
| Procedure | `.claude/skills/attendee-guide/SKILL.md` | the check reads its step that applies the order |
| Read and edit limits | `.claude/settings.json` | the check reads the deny rules |
| Number guard | `.claude/hooks/no-private-numbers.sh`, with `"onFailure": "block"` | the check runs it on test edits |
| Reviewer | `.claude/agents/guide-reviewer.md` | shown, not checked here: lesson 4 checked it |
| Bookings server | `.mcp.json` | shown: Northside isn't on the library's system |

**Why the reviewer passed a bad guide.** It checked the guide against the fact table, and the table was built with the same faulty rule. A reviewer adds fresh eyes on the work; it doesn't fix a rule both of them follow. That's a reason to test a kit on a real new input, not only to review what it makes.

**CLAUDE.md is read when a session starts.** A session that was running while you changed it began with the old rules. That's one more reason the test is a fresh session.

**On other surfaces.** The kit works unchanged in the Desktop app's Code tab and in VS Code. In claude.ai, a Project with the rules as instructions and the sources as files gets Sam part of the way. There are no hooks there, so the number rule is guidance only, and a fresh-chat test matters even more.
