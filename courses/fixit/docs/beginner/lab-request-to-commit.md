# From request to commit in code

<sub>**Beginner** · Optional lab · about 45 minutes · Needs: [Beginner index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

**Optional engineering lab.** This is the code version of [Check every claim before anyone relies on it](03-check-every-claim.md): the same question, does this do what it says?, asked of a change to the Fix-It group's website code. No core lesson or capstone depends on it, so you can skip it. It asks you to read code, test output and a diff, and explains each one as you meet it.

## Goal

By the end of this lab you can check that a code change does only what it says, by running it on a case you choose; ask Claude for a test that fails on the bad version; read a diff for files it should not touch; and commit a fix with its test.

## The job

> **Maya (library events desk):** Our events page links to the library's booking form and to a map on a CDN. Ade sent a patch so the link checker stops complaining about the CDN link. Can you check it does only that before it goes in? Last time a "small fix" hid a broken booking link for a week.

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. Its link checker runs on the pages before Maya posts them: `npm run linkcheck -- <folder>` checks a folder, the code is in `src/` and its tests are in `test/`. Ade's patch is `practice/b-3/protocol-relative.patch`. Its description says it skips links such as `//cdn.example.com/app.js`, and every other link is checked as before.

## You need

- In Questerm, nothing to install: the website repository, Git and Node.js are in the practice workspace.
- On your own computer: Claude Code, Git and Node.js. See [On your own computer](#on-your-own-computer).

## The idea

A test only checks what its author thought of. Ade's test passes with his patch, which tells you only that the case he tried works. It says nothing about links he didn't try. When a change makes a promise, such as "every other link is checked as before", test that promise with one link of your own.

Then ask Claude for a test that fails on the bad version, so no later change can bring the flaw back. Read the diff before you commit: every file in it should be one your request named.

In this practice workspace Claude's replies are written in advance. Git, Node.js and the link checker really run, on the files in your practice copy.

## Worked example

1. **Decide first, then open the repository.** Ade's patch comes with a test, and the tests pass with the patch applied. Before you run anything, decide what that tells you. Then start a session in the `project/` folder:

   ```bash
   claude
   ```

   Claude waits while you run the checker yourself, in the shell tab.
2. **Run the checker before the patch.** `samples/march-links.md` is a copy of the March events page:

   ```markdown
   # Fix-It Saturday, 13 March
   - [Book a place](/events/fixit-booking.md)
   - [Map](//cdn.example.com/map.png)
   - [Setting up the room](setup.md)
   ```

   `samples/setup.md` exists, so the third link resolves. Run the link checker on the samples folder:

   ```bash
   npm run linkcheck -- samples
   ```

   It reports two broken links: `/events/fixit-booking.md`, the booking page that isn't in this folder, which is exactly what you want to hear about, and `//cdn.example.com/map.png`, the one Ade wants silenced.
3. **Apply the patch and run it again.** Apply Ade's patch, so its change is in your working tree:

   ```bash
   git apply practice/b-3/protocol-relative.patch
   ```

   Then run the checker again and read what it prints, line by line. A change is right when it does what its description says on a case you chose, not when its own test passes.

## Your turn

**Part 1: Ade's patch.**

1. **Ask Claude why, then for the fix.** In your own words, tell Claude which link the patch wrongly skips, ask it to fix `src/links.js` so only `//` links are skipped, and ask for a test that fails with Ade's version and passes with the fix. If Claude starts on a file your request didn't name, press `Esc` and tell it to keep to your request.
2. **Read the diff before committing.** Type `/diff` and read every changed file, the tests included. Every file in it should be one your request named. Before you commit, press Check: it runs the checker on the booking link and looks for files your request didn't name. If it names `src/cli.js`, ask Claude to put it back as it was. If the booking link is still skipped, ask Claude again for the fix.
3. **Commit fix and test together.** Ask Claude to commit the fix and its test as one commit. Asking Claude is enough; you don't need Git commands.

**Part 2: the silent missing folder.**

> **Sun-hee:** I set up `linkcheck.json` with `"files": ["docs"]`, but there's no `docs` folder. The checker said everything was fine. It should fail.

Her report is `practice/b-3/missing-folder.md`.

4. **Plan it test first, and review the plan.** Switch to plan mode: press `Shift+Tab` until the status bar shows `⏸ plan mode on`. Ask for a plan that writes a test first, runs it to see it fail, then fixes the bug. Read the plan before you approve it: does its test check that the error names the missing folder, or only that there is an error? Approve only once it does. If it falls short, use the plan menu to tell Claude what to change.
5. **Watch red, then green, then review.** Approve the plan with **Yes, and use auto mode**. Watch the new test fail before the fix (red), then pass after it (green). Review the diff, then press Check. If the test still doesn't check that the error names the missing folder, ask Claude to make it, and make sure `npm test` still passes.
6. **Commit.** Ask Claude to commit the fix and its test together.

## Check

The lab's check reads ten things:

- links with a title, in double or single quotes, are still checked
- links such as `//cdn.example.com/app.js` are skipped, and every other link, the booking link included, is checked as before
- your tests fail with Ade's `isExternal` put back
- the commit that adds Ade's test, `test/external.test.js`, also holds your change to `isExternal` in `src/links.js`
- the fix for Ade's patch changes no file outside `src/links.js` and `test/`, before and after it is committed
- a folder in `linkcheck.json` that doesn't exist stops the checker with code 2 and an error that names it, whether it is the first folder listed or a later one
- your tests fail with the checker's code from the start put back
- your tests fail with a fix whose error leaves out the folder's name
- the tests pass
- nothing is left uncommitted

What the check can't see: whether you watched the new test fail before the fix. It checks instead that the test fails on the code from before the fix.

What only you can judge: would someone reading the history know the booking link is checked again?

## Try it elsewhere

- **Software:** a colleague's pull request says it "only renames a variable". Run the tests, then ask Claude to list every behaviour change in the diff, and check one yourself.
- **Workplace:** a spreadsheet formula change "only fixes rounding". Try it on a row you know the answer for.
- **Student:** a lab partner's script "only changes the plot colour". Rerun it on last week's data and compare the numbers.

## On your own computer

The same moves work in any repository of your own that has tests:

1. Apply a change you were sent with `git apply <patch>`, then run the tests and the program on a case you choose.
2. Start `claude`, and ask for the fix with a test that fails on the bad version. Plan mode is `Shift+Tab` until the status bar shows plan mode.
3. Read the diff with `/diff` or `git diff`, then ask Claude to commit, or run `git add` and `git commit` yourself.

## Technical detail

| Command | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `git apply <patch>` | applies a patch to the working tree, with no commit | `git status` lists the changed files | "patch does not apply": the tree already differs; `git checkout -- .` and try again | [git apply](https://git-scm.com/docs/git-apply) |
| `npm test` | runs `node --test` over `test/` | the last lines read `fail 0` | a test that passes on the bad version proves nothing: put the bad version back and rerun | [Node.js test runner](https://nodejs.org/api/test.html) |
| `/diff` | shows the session's uncommitted changes | the file list matches what you asked for | a file you didn't ask for: press `Esc` earlier, or ask Claude to put it back | [Commands](https://code.claude.com/docs/en/commands) |
| Plan mode | Claude reads and plans; edits wait for your approval | the status bar shows `⏸ plan mode on` | approving a plan is not reviewing the diff | [Permission modes](https://code.claude.com/docs/en/permission-modes) |

## Go further

- [Give Claude a way to verify its work](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work): why a test beats a summary.
