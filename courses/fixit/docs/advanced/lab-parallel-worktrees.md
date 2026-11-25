# Parallel worktrees and real merges

<sub>**Advanced** · Optional lab · about 25 minutes · Needs: [Advanced index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Optional engineering lab.** This is the hands-on side of Advanced lesson 1, Choose how to split the work, which decides whether two jobs are independent enough to run at once. Here you run two such jobs in two Claude Code sessions at the same time and merge the result. No core lesson or capstone depends on it, so you can skip it. It asks you to use Git commands in the shell and read short lists of changed files, and explains each one as you meet it.

## Goal

By the end of this lab you can run two Claude Code sessions at once, each in its own Git worktree; brief each with only its job and what a fresh checkout lacks; review both changes before either session commits; and merge both branches into `main` and remove the worktrees.

## The job

> **Ade:** Two jobs for the website before Friday: the link checker should ignore links inside HTML comments on our pages, and the schedule page needs a test that the summer dates render. Different files. Can two sessions do them at once without stepping on each other?

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. The summer pages are in `pages/`, the link checker's code is in `src/` and its tests are in `test/`. `npm run linkcheck -- pages` checks the pages' links, and `npm test` runs the tests. Ade's backlog, with the files each job changes, is `practice/a-1/backlog.md`. This lab starts from its own copy of the repository, so your files from earlier lessons don't carry over.

## You need

- In Questerm, nothing to install: the website repository, Git and Node.js are in the practice workspace, with two terminals side by side.
- On your own computer: Claude Code, Git, Node.js and a repository with at least one commit. See [On your own computer](#on-your-own-computer).

## The idea

Two sessions in one folder edit the same files, and each can undo the other's work. A **worktree** gives each session a folder of its own: a second checkout of the same repository, on a branch of its own. A **branch** is a line of commits you can later bring into `main` with a **merge**. `claude --worktree <name>` makes the worktree at `.claude/worktrees/<name>`, on a new branch called `worktree-<name>`, and starts the session there.

A worktree keeps the sessions apart while they work, not when you merge. So pick jobs that change different files. And a fresh checkout has only what Git tracks: installed dependencies and ignored files don't come along, so tell each session to install first.

Each session's change is still yours to review. Ask each one to wait for you before it commits, look at both changes, and only then let them commit. Run only as many sessions as you can review this way.

In this practice workspace Claude's replies are written in advance. Git, Node.js and the tests really run, on the files in your practice copy, and each worktree is a real Git worktree.

## Worked example

1. **Decide first, then open the repository.** A worktree is a fresh checkout of the repository. Before you start, decide what it won't have that your folder has. Then start Claude Code at the repository's root, the folder above `project/`, and trust the folder when it asks. Git keeps the whole repository there, and that's where `claude --worktree` makes the worktrees:

   ```bash
   cd ..
   claude
   ```

2. **Keep worktrees out of Git.** Ask Claude to ignore the folder the worktrees will live in, and commit the rule:

   ```text
   Add .claude/worktrees/ to the .gitignore at the repository root and commit it.
   ```

   Without the rule, the worktrees show up as untracked files in your main checkout. In the shell tab, push the commit, since a new worktree starts from the remote's main branch:

   ```bash
   git push
   ```

   Then leave this session with `/exit`, so terminal 1 is free for the first worktree.

3. **Pick two jobs that won't collide.** Open Ade's backlog, `practice/a-1/backlog.md`, in the files tab. Decide which two of its three jobs can run in two sessions at once: two sessions can work at once only on jobs that change different files.

## Your turn

1. **Start the first session and brief it.** In terminal 1, start a session in a new worktree named `comments-fix`. In your own words, give it its one job, the comment fix; tell it to install the dependencies first, since this is a fresh checkout; and ask it to wait for you before it commits.
2. **Start the second session beside it.** While the first session works, start the schedule test's session in terminal 2, in a worktree named `schedule-test`, with `claude -w schedule-test`. Brief it the same way: only its job, the install, and the wait.
3. **Compare both changes before either commits.** In the shell tab, list what each session changed in its worktree, then decide whether either changed a file the other one changed:

   ```bash
   git -C ../.claude/worktrees/comments-fix status --short
   ```

   Your main checkout's `git status` shows neither session's edits: they happen in other folders. Then tell each session to commit, on its own branch.
4. **Merge both into main and run the tests.** In the shell tab, in your main checkout, merge both branches into `main`, then run `npm test` and press Check:

   ```bash
   git merge worktree-comments-fix
   git merge --no-edit worktree-schedule-test
   ```

   The first merge moves `main` forward; the second makes a merge commit, and `--no-edit` keeps Git's message for it. If both jobs had changed the same lines, Git would stop with a conflict here.
5. **Remove both worktrees.** Leave each session with `/exit`. Claude Code asks whether to keep or remove its worktree: choose to remove it. Removing a worktree deletes its folder and its branch, with any commit on it that `main` doesn't have, so remove one only once its branch is merged. If you kept one, run `git worktree remove <path>` from your main checkout.

## Check

The lab's check reads four things:

- a committed `.gitignore` at the repository root ignores `.claude/worktrees/`, and nothing else in `.claude/`
- `main` has both jobs, each made on a branch of its own that split from the other: the comment fix in `src/links.js` and a test that reads `pages/schedule.md`, neither changing the other's file
- on `main` the tests pass, a link inside an HTML comment is no longer reported, and the schedule test fails when a summer date is missing from the page
- neither worktree is still there once both branches are merged

What the check can't see: that each worktree was a Claude Code session's. The steps watch that while the sessions run, from the lock `claude --worktree` puts on its worktree. Once a worktree is removed, Git keeps no trace of its session, so the check reads what the sessions left in Git instead.

What only you can judge: how many sessions could you really review at once?

## Try it elsewhere

- **Software:** two bug fixes in different modules of your own project, two worktrees, one merge.
- **Workplace:** two people editing different sections of a proposal. What would make their edits collide, and how would you tell before you put them together?
- **Student:** splitting a group report. Which sections can be written at the same time, and which depend on another's results?

## On your own computer

The same moves work in any Git repository with at least one commit:

1. Add `.claude/worktrees/` to the repository's `.gitignore`, commit it, and push it.
2. Run `claude --worktree <name>`, or `claude -w <name>`, once for each job, each in a terminal of its own. If you haven't run `claude` in that repository before, run it there once and trust the folder first.
3. List gitignored files a fresh checkout needs, such as a local config file, in a `.worktreeinclude` file at the repository root, so Claude Code copies them into each new worktree. Dependencies still need installing.
4. Merge each branch from your main checkout. When you leave a session, Claude Code asks whether to keep or remove a worktree with changes or new commits; a clean one it removes by itself, unless you named the session.

The Desktop app can also run a session in its own worktree, and cloud sessions on the web run in parallel without local worktrees.

## Technical detail

| Command | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `claude --worktree <name>` | makes `.claude/worktrees/<name>` on the new branch `worktree-<name>`, from the remote's main branch, and starts the session there | `git worktree list` | an untrusted folder: no worktree is made | [Worktrees](https://code.claude.com/docs/en/worktrees) |
| `.worktreeinclude` | gitignored files to copy into each new worktree | the file is there in the worktree | dependencies still need installing | [Worktrees](https://code.claude.com/docs/en/worktrees) |
| `git -C <folder> status --short` | lists the changes in another worktree | each line names one changed file | your main checkout's own `git status` lists none of them | [git status](https://git-scm.com/docs/git-status) |
| `git merge <branch>` | brings a branch's commits into the branch you are on | `git log --oneline --graph` | both branches changed the same lines: a conflict to resolve | [git merge](https://git-scm.com/docs/git-merge) |
| Leaving a session | a worktree with changes or new commits asks keep or remove; a clean one is removed, unless the session is named | `git worktree list` | another session still open in it keeps the worktree | [Worktrees](https://code.claude.com/docs/en/worktrees) |

## Go further

- [Run parallel sessions with Git worktrees](https://code.claude.com/docs/en/worktrees): how `--worktree` makes a checkout and a branch for each session, and how they are cleaned up.
