# Advanced: a release others can trust within stated limits

<sub>**Advanced** · about 2 hours 30 minutes · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

It's the summer series for the Millbrook Fixers: three session pages and a schedule, which Maya publishes on Friday and Priya pastes into the reminder email to 70 people. You choose how the work runs, set its bounds, judge what comes back, and decide what ships. Each lesson starts with the reference organizer kit as it stands at the end of Intermediate, with the summer files as they stood on that lesson's day.

## You're ready for this level if you can

- [ ] Check a claim against the line it came from.
- [ ] Say which source wins when two disagree.
- [ ] Read a short settings file and say what it allows.

## Lessons

1. [Choose how to split the work](01-split-the-work.md)
2. [Reconcile conflicting findings](02-reconcile-findings.md)
3. [Bound an unattended run](03-bound-an-unattended-run.md)
4. [Recover from a partial failure](04-recover-from-a-partial-failure.md)
5. [Share the workflow with its limits](05-share-the-workflow.md)

## Capstone

Release day for the summer series: a late change, reviewers who disagree, a partial run, and a go/no-go decision with its evidence.

## Optional labs

[Parallel worktrees and real merges](lab-parallel-worktrees.md): the hands-on side of lesson 1, Choose how to split the work, on the Fix-It group's website repository. Run two Claude Code sessions at once, each in its own Git worktree, review both changes before either commits, merge both into `main` and remove the worktrees. No core lesson or capstone depends on it.

[Script Claude Code with `claude -p`](lab-script-claude-code.md): the hands-on side of lesson 3, Bound an unattended run, on the same repository. Write a script that has Claude review each staged change with nobody at the keyboard, bound to reading, with its findings in a shape you define, and that fails loudly when the run does. Then check the review's findings before you act on them. No core lesson or capstone depends on it.
