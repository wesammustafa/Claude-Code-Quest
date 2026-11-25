# Intermediate: a kit a second organizer can use

<sub>**Intermediate** · about 3 hours · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

Sam, the Fixers' second organizer, runs sessions at another venue. In this level you build the organizer kit: project memory, an attendee-guide skill, access settings and a guard, a reviewer, and the decision whether a booking connection earns its place. Then Sam uses it in a fresh session for the April session at Northside Community Centre. It runs in Questerm's practice workspace. You need no Git or programming experience.

## You're ready for this level if you can

- [ ] Brief Claude with the sources ranked, the reader's questions and what a finished result looks like.
- [ ] Check each claim in a draft against the line it came from, and correct the draft.
- [ ] Leave a detail nobody has confirmed visibly open, with a number to call.

## Lessons

1. [Decide what Claude should remember](01-decide-what-to-remember.md)
2. [Turn a repeated job into a skill](02-turn-a-repeated-job-into-a-skill.md)
3. [Decide what each part may touch](03-decide-what-each-part-may-touch.md)
4. [Bring in a second reviewer](04-bring-in-a-second-reviewer.md)
5. [Connect an outside tool when it earns its place](05-connect-an-outside-tool.md)

## Capstone

[Hand the kit to Sam](capstone.md): a fresh session uses the kit on a different venue, and you fix the kit, not just its output.

## Optional labs

[Model and effort, one variable at a time](lab-model-and-effort.md): the experiment behind lesson 4, on the Fix-It group's website repository. Find out why an answer about the link checker's crash was weak before reaching for a bigger model, then give the routine changelog skill cheaper settings and the root-cause skill deeper ones, and commit one change with an entry that says what it does. No core lesson or capstone depends on it.

[Hooks that fail closed](lab-hooks-fail-closed.md): the deep end of lesson 3, on the website repository. Register a guard that blocks edits to `package-lock.json` and `secrets/` even when its own script is missing, find the hole a shell write leaves and close it with a deny rule, and have Claude write a Stop hook that sends it back while the tests fail. No core lesson or capstone depends on it.

[Evaluate, trial and share a plugin](lab-evaluate-and-share-a-plugin.md): the engineering side of lesson 5, on the website repository. Read what a plugin installs before you install it, trial the code intelligence plugin for this repository only and use it to find every caller of a function before changing it, then share only the plugin the team chose. No core lesson or capstone depends on it.
