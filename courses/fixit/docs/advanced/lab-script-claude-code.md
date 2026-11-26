# Script Claude Code with `claude -p`

<sub>**Advanced** · Optional lab · about 25 minutes · Needs: [Advanced index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Optional engineering lab.** This is the hands-on side of Advanced lesson 3, Bound an unattended run, which decides whether a run should go unattended and sets its bounds. Here you write the script around those bounds, for a review that runs before each commit. No core lesson or capstone depends on it, so you can skip it. It asks you to edit a short shell script, read JSON and use Git commands in the shell, and explains each one as you meet it.

## Goal

By the end of this lab you can run Claude Code from a script with nobody at the keyboard; bound what the run may do, with its permission mode, its tools and a turn cap; get its answer in a shape you define, with a JSON Schema; make a failed or capped run fail loudly; and check a review's findings before you act on them.

## The job

> **Ade:** Before anyone commits to the website repo, I want Claude to review the staged change and list problems with file and line. No edits, no surprises, and if the review fails I want the commit hook to know.

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. The summer pages are in `pages/`, the link checker's code is in `src/` and its tests are in `test/`. `npm run linkcheck -- pages` checks the pages' links, and `npm test` runs the tests. `scripts/review-staged.sh` is a review script with its plumbing done and its Claude Code call left for you to write. Sam's first change for Ade, skipping links in editors' notes, is in `practice/a-4/comment-links.patch`. This lab starts from its own copy of the repository, so your files from earlier lessons don't carry over.

## You need

- In Questerm, nothing to install: the website repository, Git, Node.js and `jq` are in the practice workspace.
- On your own computer: Claude Code, Git, Node.js, `jq` and bash, on macOS, Linux or WSL 2. See [On your own computer](#on-your-own-computer).

## The idea

`claude -p "<prompt>"` runs Claude once, with no conversation, prints its answer and exits, so a script can run it. Nobody is there to answer a permission prompt, so a script passes a **permission mode** every time: `dontAsk` denies whatever would ask, and lists each refusal in the run's `permission_denials`.

A run that ends normally says `"subtype": "success"`, even when a refusal kept it from part of the job. So a script reads the exit code, `is_error` and the denials before it trusts the result. A run that stops at its **turn cap**, set with `--max-turns`, ends with `error_max_turns` and no result at all.

A script bounds the run with flags: `--tools` sets the tools it has at all, `--allowedTools` the ones it may use without asking, `--settings '{"disableAllHooks": true}'` keeps the project's hooks out, and `--strict-mcp-config` starts no MCP server you didn't pass. `--output-format json` gives one JSON object, and `--json-schema` asks for the answer in your shape, under `structured_output`.

A reviewer can be wrong too. Check each finding against the code before you act on it.

In this practice workspace Claude's replies are written in advance, and model and effort don't change them. Git, Node.js, `jq` and the tests really run, on the files in your practice copy, and each `claude -p` run goes through the real permission rules of its flags.

## Worked example

1. **Decide first: is a successful run done?** A run that nobody watched ends with JSON that says `"subtype": "success"` and lists one call in `permission_denials`. Decide whether the job is done before you run one yourself.
2. **Run with nobody to approve.** In the terminal, ask Claude to run the tests, with nobody there to approve the command, and save the JSON:

   ```bash
   claude -p "Run the tests and say how many pass" --output-format json --permission-mode dontAsk > .practice/a-4-denied.json
   jq -c '.permission_denials[] | {tool_name, command: .tool_input.command}' .practice/a-4-denied.json
   jq '{subtype, is_error, result}' .practice/a-4-denied.json
   ```

   The test command is denied and listed, and the run still says `success`: it ended normally, but the job didn't get done. `.practice/` is a folder Git ignores, for files like this one.
3. **Allow one command, then cap the turns.** Allow the one command the job needs, with a turn cap, and run it again:

   ```bash
   claude -p "Run the tests and say how many pass" --output-format json --permission-mode dontAsk --allowedTools "Bash(npm test)" --max-turns 3 > .practice/a-4-allowed.json
   ```

   Nothing is denied this time, and the result counts the tests. Then predict what a cap of one turn does to the same job, and run it with `--max-turns 1`, saved to `.practice/a-4-capped.json`. It stops at the cap with no result, exits with 1 and says `"is_error": true`.

## Your turn

1. **Fill in the review script.** Open `scripts/review-staged.sh` in the files tab. It already stops when nothing is staged, saves the JSON, fails on a failed run and prints each finding. Write your prompt and the flags in place of its two placeholders. The prompt asks Claude to review the staged diff it gets on stdin, the input the script pipes in with `|`; report each problem with its file and line; and change nothing. The flags ask for JSON, run in `dontAsk` mode, keep and allow only `Read`, `Grep` and `Glob`, turn hooks and MCP servers off, cap the turns at 10 or fewer, and pass the script's schema with `--json-schema "$schema"`.
2. **Commit it, and let the check try it.** Make the script executable and commit it:

   ```bash
   chmod +x scripts/review-staged.sh
   git add scripts/review-staged.sh
   git commit -m 'Review the staged change with Claude before each commit'
   ```

   Then press Check: it runs your committed script with a stand-in for `claude`, which costs nothing, five ways.
3. **Review Sam's change before it's committed.** Apply Sam's change and stage it, then run your script on it once:

   ```bash
   git apply practice/a-4/comment-links.patch
   git add src/links.js test/links.test.js
   scripts/review-staged.sh
   ```

4. **Check each finding before you act.** Open the file at the line each finding names, and read what the change adds. Then decide which finding to act on.
5. **Ask Claude to finish the change.** Start Claude with `claude`, and in your own words ask it to make the change skip comments over several lines too, with a test for that case. You commit it yourself, once you've read it.
6. **Commit the change with its test.** Read Claude's change, then commit it with Sam's change in the shell tab, and press Check.

## Check

The lab's check reads five things:

- `scripts/review-staged.sh` is committed and executable
- its `claude -p` call asks for JSON in `dontAsk` mode, keeps and allows only `Read`, `Grep` and `Glob`, runs no hook or MCP server, caps turns at 10 or fewer, and asks for findings with `--json-schema`
- it pipes the staged diff in, saves the JSON where its argument says, prints the findings, exits non-zero when the run fails, and doesn't call Claude when nothing is staged
- `.practice/a-4-result.json` holds a real run of it that succeeded within your cap, with findings
- the comment change is committed with a fix for comments over several lines, a test for one, and no second test for a comment on one line

The check runs your committed script with a stand-in for `claude`, so it spends nothing. For the saved run, it looks for that run's session where Claude Code keeps every session it runs, under `~/.claude/projects/`, so JSON written by hand doesn't count. For the fix, it runs the link checker and your tests, and your tests again against Sam's change as it was staged.

What only you can judge: would you run this review on every commit, or only before a release? `jq .total_cost_usd .practice/a-4-result.json` shows what one run cost, as an estimate.

## Try it elsewhere

- **Software:** a nightly script that sums up yesterday's failing CI runs. Which flags bound it, and what makes it exit non-zero?
- **Workplace:** a weekly report that a scheduler generates. What would you check before you trust its output?
- **Student:** marking practice answers in a batch with a script. What shape should each verdict have?

## On your own computer

The script works in any Git repository, with bash and `jq`:

1. Copy `scripts/review-staged.sh` into the repository, make it executable and commit it.
2. Stage a change and run it. To run it before every commit, call it from a Git pre-commit hook: a non-zero exit stops the commit.
3. In CI with an API key, `--bare` is recommended for `-p` runs: it skips hooks, skills, plugins, MCP servers, `CLAUDE.md` and the claude.ai login, so the run needs `ANTHROPIC_API_KEY`. Signed in with a login, use `--settings '{"disableAllHooks": true}'` and `--strict-mcp-config` instead.

`-p` shows no trust dialog, but a repository's hooks in its settings and its `.mcp.json` servers can still run, so run scripts only in folders you trust. There is no turn limit by default. `--max-budget-usd` caps spend as an estimate, and a run can pass it a little. Claude Code keeps each run's session under `~/.claude/projects/` unless you pass `--no-session-persistence`.

A saved run is a session you can go back to. `claude -r <session id>` (`--resume`) opens it in the terminal, and `claude -p --resume "<session id>" "<follow-up>"` asks it one more thing without starting the review over ([Headless](https://code.claude.com/docs/en/headless#continue-conversations)). The JSON gives you the id in its `session_id` field.

## Technical detail

| Flag | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `--append-system-prompt "<text>"` | adds standing instructions to the end of the default system prompt, so the `-p` prompt can hold the task alone | the run follows them without the prompt repeating them | `--system-prompt` is the other one: it replaces the default prompt instead of adding to it | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| `--output-format json` | prints one JSON result | `jq .subtype` | text output can't be checked by a script | [Headless](https://code.claude.com/docs/en/headless) |
| `--json-schema '<schema>'` | the answer in your shape, under `structured_output` | `jq .structured_output` | no schema: the answer is only text in `result` | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| `--permission-mode dontAsk` | never prompts; a call that would ask is denied | `permission_denials` lists each one | left out, the run starts in manual mode and denies every call that needs approval | [Headless](https://code.claude.com/docs/en/headless) |
| `--tools` and `--allowedTools` | the tools the run has, and the ones it may use without asking | a tool `--tools` leaves out is never called | `--allowedTools` alone doesn't take the other tools away | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| `--max-turns N` | stops the run after N turns | `subtype: error_max_turns`, no `result` | no limit by default | [Headless](https://code.claude.com/docs/en/headless) |
| `--strict-mcp-config`, `disableAllHooks` | no project MCP servers or hooks in the run | the run starts none | `--bare` does both, but also skips the login | [Headless](https://code.claude.com/docs/en/headless) |

## Go further

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless): `-p`, its output formats and the flags that bound a run.
- [CLI reference](https://code.claude.com/docs/en/cli-reference): every flag `claude` takes.
