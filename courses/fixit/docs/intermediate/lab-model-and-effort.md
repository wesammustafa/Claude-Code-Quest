# Model and effort, one variable at a time

<sub>**Intermediate** · Optional lab · about 20 minutes · Needs: [Intermediate index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Optional engineering lab.** This is the experiment behind Intermediate lesson 4, Bring in a second reviewer, where you pick a reviewer's model and effort. No core lesson or capstone depends on it, so you can skip it. It asks you to read a skill file, a short code change and its diff, and explains each one as you meet it.

## Goal

By the end of this lab you can find out why a weak answer was weak before reaching for a bigger model, change one setting at a time, and give a routine skill cheaper settings and a hard one deeper ones.

## The job

> **Ade:** Every time we change the website or the link checker, someone has to write the changelog line, and we've been running it on the big model at high effort. Meanwhile the link checker crashed on a bad link last week and the "fix" didn't fix it. Can you set this up sensibly?

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. Its link checker runs on the pages before Maya posts them: `npm run linkcheck -- <folder>` checks a folder, the code is in `src/` and its tests are in `test/`. Two skills are ready in it: `five-whys`, which finds the root cause of a failure, and `changelog`, which writes one line in `CHANGELOG.md` for a change. Three volunteers asked for a change to the checker, and one goes into this release: their requests are in `practice/i-3/requests.md`. This lab starts from its own copy of the repository, so your files from earlier lessons don't carry over.

## You need

- In Questerm, nothing to install: the website repository, Git and Node.js are in the practice workspace.
- On your own computer: Claude Code, Git and Node.js. See [On your own computer](#on-your-own-computer).

## The idea

When an answer is weak, find out why before you change anything. An answer that never mentions the file that failed was missing context, not intelligence. A bigger model given the same missing evidence guesses with more confidence, and more thinking about the wrong input is still about the wrong input. Fix the input first. Change one setting only if the answer is still weak, and compare against the same goal.

The model sets the capability Claude starts with, and effort is how long it thinks. A skill's `model:` and `effort:` lines apply while that skill runs, then the session's settings come back. So a routine skill, such as a one-line changelog entry you will review, can run smaller and cheaper, and a hard one, such as finding a root cause, can think longer.

In Questerm, Claude's words are written in advance. Changing the model or effort here changes what `/status` shows and what the skill's file records, not the answer. This lab teaches the decision and where it is configured. On your own computer you'll compare real answers.

## Worked example

1. **Decide first, then see what you're running.** Claude says the crash is a parser bug, but the answer never mentions the file that crashed it. Decide what you change first. Then start a session in the `project/` folder:

   ```bash
   claude
   ```

   Type `/status`: it lists the model and the effort this session runs, Opus at medium. Then type `/effort status`: it prints the effort in force. Plain `/effort` opens a slider to change it, and `/model` opens the model picker. Don't change the default: this lab compares every setting against it.
2. **Diagnose before escalating.** `samples/bad-escape.md` links to `bad%.md`, and `npm run linkcheck -- samples` crashes on it. Give Claude the failing file and the command, and ask why, with no edits:

   ```text
   Read samples/bad-escape.md and the link checker's code. Why does npm run linkcheck -- samples crash? Cite the files you used and don't edit anything.
   ```

   With the file in front of it, Claude finds the cause on the same model and effort. Open a file it cites and read the line: a plausible answer alone is not evidence.

## Your turn

1. **Give the root-cause skill depth.** Add this line inside the frontmatter of `.claude/skills/five-whys/SKILL.md`, between its two `---` lines:

   ```yaml
   effort: high
   ```

   Finding a root cause means checking each step against evidence, where more thinking pays.
2. **Give the changelog skill less.** In `.claude/skills/changelog/SKILL.md`, replace `model: TODO` and `effort: TODO` so the skill costs less than the session's default, Opus at medium: a smaller model, or a lower effort. Then replace the `TODO` line under `## Why these settings` with one line of your own: what makes this task routine.
3. **Make one change and get its entry.** Pick one of the three requests in `practice/i-3/requests.md` for this release. Ask Claude to make that change, with a test. Read the diff with `/diff`: it lists every file this session changed, with the lines added and removed. Then run `/changelog`. Read the entry it writes against the diff: does it say what the change does for someone running the checker? If it doesn't, ask Claude to correct it, or correct it yourself in `CHANGELOG.md`. Before you commit, press Check: it reads the entry against the change.
4. **Commit change, entry and both skills together.** Ask Claude to commit the change, its test, the entry and both skills as one commit.

## Check

The lab's check reads five things:

- the committed changelog skill runs a smaller model or a lower effort than the session's default, Opus at medium, and says why
- the committed `five-whys` skill runs at `effort: high`
- the commit that adds your changelog entry holds exactly one of the three requested changes, so the entry sits beside the change it describes
- the entry says what that change does for someone running the checker, and claims no speed-up the diff doesn't make
- the tests pass

If the check names a skill, correct it, then ask Claude to commit it.

What the check can't see: whether a smaller model wrote a worse entry. In Questerm every setting gets the same words; on your own computer, compare them.

What only you can judge: would the entry make sense to Maya?

## Try it elsewhere

- **Workplace:** your team runs a weekly status summary on the most expensive model. Run it once on a smaller one and compare; keep the cheaper one if nothing important is lost.
- **Student:** a flashcard-making prompt and an essay-feedback prompt: which deserves more effort, and why?
- **Software:** a commit-message helper versus a bug investigation: set each one's skill frontmatter.

## On your own computer

Run `/changelog` on the same change twice: once with the skill at `model: haiku` and `effort: low`, once at `model: opus` and `effort: high`. Compare the two entries against the diff, and note how long each took. Keep the cheaper settings unless the entry got worse.

## Technical detail

| Item | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `/model`, typed in the session beside `/effort`, with aliases such as `default`, `best` (the same as `opus` since v2.1.321), `sonnet`, `opus`, `haiku` and `opusplan` | picks the session's model: with an alias it also saves your default for new sessions, and with no argument it opens the picker, where `s` on a row changes this session only | `/status`, or the picker's marked row | switching mid-session rebuilds the prompt cache, so the next turn costs more; on some providers an alias resolves to an older model | [Model configuration](https://code.claude.com/docs/en/model-config) |
| `/effort`, `low` to `max` | how long Claude thinks; typed with a level it sets one, with no argument it opens a slider | `/effort status` prints the level in force | `max` lasts only for the session and is "prone to overthinking" | [Model configuration](https://code.claude.com/docs/en/model-config) |
| `ultrathink` in a prompt | deeper effort for one turn | the word shows a rainbow highlight (VS Code and Desktop, v2.1.316 or later) | "think hard" is ordinary text, not a setting | [Best practices](https://code.claude.com/docs/en/best-practices#change-the-model-and-effort) |
| `model:` and `effort:` in a skill's frontmatter | the settings while that skill runs | the status line during the skill's turn | the session's settings return after it | [Skills](https://code.claude.com/docs/en/skills) |
| `/diff` | shows the session's uncommitted changes | the file list matches what you asked for | a file you didn't ask for: press `Esc` earlier, or ask Claude to put it back | [Commands](https://code.claude.com/docs/en/commands) |

## Go further

- [Model configuration](https://code.claude.com/docs/en/model-config): aliases, effort levels and where each setting applies.
