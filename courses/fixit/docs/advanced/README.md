# Advanced: a release others can trust within stated limits

<sub>**Advanced** · about 25 minutes · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Pilot.** This index lists only what is built so far of the redesigned Advanced level: two of its optional labs. It runs in Questerm's practice workspace.

## You're ready for this level if you can

- [ ] Check a claim against the line it came from.
- [ ] Read a short change to a file and say what it does.

## Optional labs

[Parallel worktrees and real merges](lab-parallel-worktrees.md): the hands-on side of lesson 1, Choose how to split the work, on the Fix-It group's website repository. Run two Claude Code sessions at once, each in its own Git worktree, review both changes before either commits, merge both into `main` and remove the worktrees. No core lesson or capstone depends on it.

[Script Claude Code with `claude -p`](lab-script-claude-code.md): the hands-on side of lesson 3, Bound an unattended run, on the same repository. Write a script that has Claude review each staged change with nobody at the keyboard, bound to reading, with its findings in a shape you define, and that fails loudly when the run does. Then check the review's findings before you act on them. No core lesson or capstone depends on it.
