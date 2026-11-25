# Intermediate: a kit a second organizer can use

<sub>**Intermediate** · about 20 minutes · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Pilot.** This index lists only what is built so far of the redesigned Intermediate level: its optional labs. It runs in Questerm's practice workspace.

## You're ready for this level if you can

- [ ] Start Claude Code in a folder and check what it tells you.
- [ ] Read a short change to a file and say what it does.

## Optional lab

[Model and effort, one variable at a time](lab-model-and-effort.md): the experiment behind lesson 4, on the Fix-It group's website repository. Find out why an answer about the link checker's crash was weak before reaching for a bigger model, then give the routine changelog skill cheaper settings and the root-cause skill deeper ones, and commit one change with an entry that says what it does. No core lesson or capstone depends on it.

[Hooks that fail closed](lab-hooks-fail-closed.md): the deep end of lesson 3, on the website repository. Register a guard that blocks edits to `package-lock.json` and `secrets/` even when its own script is missing, find the hole a shell write leaves and close it with a deny rule, and have Claude write a Stop hook that sends it back while the tests fail. No core lesson or capstone depends on it.

[Evaluate, trial and share a plugin](lab-evaluate-and-share-a-plugin.md): the engineering side of lesson 5, on the website repository. Read what a plugin installs before you install it, trial the code intelligence plugin for this repository only and use it to find every caller of a function before changing it, then share only the plugin the team chose. No core lesson or capstone depends on it.
