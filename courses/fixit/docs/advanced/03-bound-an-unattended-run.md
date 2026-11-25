# Bound an unattended run

<sub>**Advanced** · Lesson 3 of 6 · about 30 minutes · Needs: [lesson 2](02-reconcile-findings.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can decide whether a run should be unattended at all, bound what a run may read and edit, how long it may run and what it may spend, and make it refuse to start without its fence, and estimate a run's cost on a slice, and read its result for what it did and what it was stopped from doing.

## The job

> **Priya (Friday 28 May):** Until the summer pages are out, sources keep changing: the fire officer, Kofi, the library. Can Claude just refresh the pages every night, so nobody has to remember?

It's Friday 28 May 2027. A nightly run would touch the pages in `fixit/summer/public/` and read the sources in `fixit/summer/` and `fixit/sources/`. A runner for it is ready in `fixit/summer/run/`.

At 02:00 nobody is there to press No. Whatever a run is allowed to do, it will do, and its summary will still say success.

This lesson starts with the reference organizer kit as it stands at the end of Intermediate, in `fixit/`, lesson 1's easy-read pages, and the summer files as they stood that morning, before Sam adds the July page in the afternoon. Your own files from lessons 1 and 2 stay in those lessons.

## You need

- In Questerm: nothing. The runs, their results and their costs are simulated, and Claude's replies are written in advance, so model and effort change nothing. Nothing leaves your browser.
- On your own computer: Claude Code, on macOS, Linux or WSL 2 for the sandbox, and `jq` for the runner's report.

## The idea

Before a run goes unattended, answer five questions: what done looks like, how it checks itself, what it may touch, what stops it, and who reads the result. A vague answer to any of them is your reason not to schedule it.

Then bound it. Rules name exactly what it may edit, deny rules keep it out of what it must never touch, the sandbox fences any command and the run refuses to start without it, and a turn limit and a spend limit stop it. A refused call doesn't stop the run: it's listed in the result, and the run can still say success. So read what it was denied, not just how it ended.

## Worked example

1. **Answer the five questions.** First, decide: Priya wants Claude to refresh the summer pages every night, so nobody has to remember. What's your first move? Setting it up tonight in a mode that never stops to ask is the risk, not the goal: a run that can't be blocked can also edit `sources/`, read `private/`, or publish. Refusing outright throws away a run that might be safe and useful. Answer five questions first, and schedule it only if every answer is concrete.

   Go into the kit folder and start Claude there. Claude Code asks whether you trust this folder: it's your practice copy of the kit, so read the dialog and accept it.

   ```bash
   cd fixit
   claude
   ```

   Press `Shift+Tab` until the status bar reads `⏸ plan mode on`, so Claude creates nothing while you plan. Then ask: `Priya wants a nightly run that refreshes summer/public/ from the sources. Draft answers to these for that run, and say where any answer is weak: what does done look like, can it check its own work, what is it allowed to touch, what stops it, where does the result go and who signs off? Don't create anything.`

   Claude finds one weak answer: a nightly run can't know about a change that never reached the folder, such as a phone call. That's a real limit, not one you can fix: a person refreshing the pages each week would have the same blind spot. A nightly run is reasonable if someone reads its report each morning. You decide: nightly, with a morning check. Priya agrees: "The coordinator reads the report at 8, and Maya publishes."
2. **Read the bounds Claude proposes.** Press `Shift+Tab` until the status bar reads `⏵⏵ auto mode on`, then ask: `Write summer/run/bounds.json for the nightly run, from your answers: it may read sources/ and summer/, edit only june.md, august.md and schedule.md in summer/public/, never read a private folder or edit sources/, no git push and no web, and it must refuse to start without the sandbox.`

   Open `fixit/summer/run/bounds.json` in the files tab and read it line by line:

   - `Read(./sources/**)` and `Read(./summer/**)`: it may read these folders.
   - The three `Edit(...)` lines: it may change exactly these three pages, and nothing else.
   - `Read(**/private/**)` in deny: it can never read a private folder, whatever else allows it. A deny rule always wins.
   - `Edit(./sources/**)` in deny: it can never change the sources it checks against.
   - `Bash(git push *)` and `WebFetch` in deny: it can't publish anything or fetch from the web.
   - `sandbox`, with `enabled` and `failIfUnavailable`: any command runs inside a fence, the sandbox, and if the fence can't start, the run doesn't start.
   - `allowUnsandboxedCommands: false`: a command can't ask to step outside the fence. There's nobody to ask anyway.
   - `autoAllowBashIfSandboxed: false`: a command inside the fence still needs a rule that allows it. This run has none, so it runs no commands.

   Sam adds `july.md` this afternoon. The rules name files, not the folder, so the run is refused when it tries to edit `july.md`, and its result lists the refusal. The run itself can still report success. Narrow rules fail safe: a page they don't name is refused, not edited. That only helps if someone reads the refusals, and a new page needs a new line.
3. **Read the runner's flags.** Open `fixit/summer/run/refresh.sh` in the files tab. It was prepared for you, and it comes down to one `claude -p` command: you don't need to write shell, only to know what each flag bounds.

   | Flag | What it bounds |
   |---|---|
   | `-p` | Claude runs once, with no conversation, and nobody there to answer it. |
   | `--permission-mode dontAsk` | anything the bounds don't allow is denied, never asked, and listed in the result as a permission denial |
   | `--settings summer/run/bounds.json` | the allow, deny and sandbox rules you just read |
   | `--strict-mcp-config --mcp-config summer/run/bookings-only.json` | only the read-only bookings connection loads, not every server the kit lists |
   | `--max-turns 25` | how many steps it may take: at the limit it stops, and the result says why |
   | `--max-budget-usd 1.00` | what it may spend, as an estimate: at the limit it stops with an error, and its last step can take it a little over |
   | `--output-format json` | one JSON result instead of chat text: the runner prints how the run ended, its turns, its cost and its denials |

   Effort isn't a bound: it changes how long Claude thinks, not how far it can go. The limits are `--max-turns` and `--max-budget-usd`.
4. **Run a slice and read what it was stopped from doing.** Estimate before you schedule: run the refresh on one page, in the shell tab.

   ```bash
   fixit/summer/run/refresh.sh june
   ```

   The report shows `result subtype: success`, the turns and the cost against their limits, and one permission denial: a `git commit`. A `git commit` saves the change into the folder's history. Here a person does that, after reading the change. Is the slice good? A denial doesn't mean the run failed. Read which call was denied: a commit. Your bounds forbid commits on purpose, so a person commits after reading. And success means only that the run ended normally. So the slice is good once you've read the change. A denial is information. Here it's the one you expected.

   Open `fixit/summer/public/june.md`. The run changed one line. The group's standing notes say "mains rewiring inside the casing", and the page said "rewiring inside the casing". The battery rule was already right, and nothing else changed. One page cost about $0.12, so three pages about $0.36: inside the $1.00 limit, with room.

## Your turn

The job changes: a weekly refresh of lesson 1's easy-read pages, `june-easy.md`, `july-easy.md` and `august-easy.md`, which must never touch the original pages. Its runner, `fixit/summer/run/easy-refresh.sh`, is ready, and it refuses to run without its bounds.

1. **Ask Claude for bounds for the easy-read refresh.** In your own words, ask Claude to write `summer/run/easy-bounds.json` for the weekly easy-read refresh: what it may read, which files it may edit, what it must never touch, and that it must not start without the sandbox. For example: `Write summer/run/easy-bounds.json for a weekly run that refreshes only the three *-easy.md pages from the sources. It can read sources/ and summer/, edit only the easy-read pages, never read private/ or edit sources/ or the original pages, no push or web, and it must refuse to start if the sandbox can't.`
2. **Weekly by a person, or weekly unattended?** The easy-read pages change only when the main pages change, about once a fortnight. A scheduled weekly run works, but it runs, and costs, every week whether or not anything changed. Asking Claude in a normal session each time loses the fixed bounds and the JSON record. Run it by hand, right after the main pages change, with the same runner and bounds: the trigger is "the main pages changed", which a person knows and a timer doesn't.
3. **Run a slice and review what it changed.** Run the easy-read slice on June in the shell tab, `fixit/summer/run/easy-refresh.sh june`, and read its report. Then decide which change you accept: keep what the task asked for, undo what it didn't, and make sure the next run can't repeat it.

   Which file was the run asked to change? Open `fixit/summer/public/june.md`: did anyone ask for a change there?

## Check

The Lesson's check reads four things: that `easy-bounds.json` lets the run edit only the easy-read pages, keeps it out of private folders and off the sources, and makes it refuse to start without the sandbox; that the runner starts `claude -p` in `dontAsk` mode with `easy-bounds.json`, a turn limit, a spend limit and JSON output, and never skips permissions; that a slice ran with the bounds as they are now, and cost less than the runner's spend limit; and that `summer/public/june.md` is as it was before Your turn's slice.

The check runs the runner with a stand-in for `claude`, so it reads the flags without starting a run. It reads the slice from the result file the runner saved. In this practice workspace you could write that file by hand, so on a real machine trust the run's own record over a file anyone can edit.

What only you can judge: would you be comfortable if the easy-read run went off fifty times by mistake, at up to $0.30 each?

## On your own computer

In Questerm the headless run, its JSON and its cost are simulated, and the sandbox is a simulated fence: headless runs here apply only the rules this course teaches. A real run must still establish that the OS sandbox starts on your platform, and that your rules match the calls Claude actually makes.

1. `claude -p` and all its flags belong to the command line and the Agent SDK ([Headless](https://code.claude.com/docs/en/headless)).
2. The OS sandbox runs on macOS, Linux and WSL 2, not on native Windows. Without `failIfUnavailable`, a run whose sandbox can't start runs without one ([Sandboxing](https://code.claude.com/docs/en/sandboxing)).
3. Since 2.1.325, sandboxed commands follow the normal permission flow unless `autoAllowBashIfSandboxed` is set; in `dontAsk` mode that means denied unless allowed ([Permission modes](https://code.claude.com/docs/en/permission-modes)).
4. The sandbox fences commands only: Claude's file tools, MCP servers and hooks run outside it. Your `Edit(...)` rules are what fence file edits ([Permissions](https://code.claude.com/docs/en/permissions)).
5. To run on a schedule without your laptop, cloud scheduled tasks (`/schedule`) are a research preview and need a claude.ai login; Desktop scheduled tasks run locally. A cron job that calls your runner is the plain option.

## Technical detail

| Mechanism | Exact form | How to verify | Failure case | Reference |
|---|---|---|---|---|
| A run with nobody there | `claude -p "<task>"` | it exits when done | calls that need approval are denied unless allowed | [Headless](https://code.claude.com/docs/en/headless) |
| Permission mode | `--permission-mode dontAsk` | denials appear in `permission_denials` | `auto` is the other unattended mode: a classifier judges each action, and it can be wrong | [Permission modes](https://code.claude.com/docs/en/permission-modes) |
| Rule order | deny, then ask, then allow; a deny at any level can't be overridden | a denied call is listed | rules match calls as written: a `Read(./x)` deny catches `cat x` but not a script that opens it | [Permissions](https://code.claude.com/docs/en/permissions) |
| Settings for one run | `--settings <file>` | the run applies its rules | the project's own settings still load unless left out | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| MCP for one run | `--strict-mcp-config --mcp-config <file>` | only the servers listed load | without `--strict-mcp-config`, the project's `.mcp.json` servers load too | [Headless](https://code.claude.com/docs/en/headless) |
| Limits | `--max-turns N`, `--max-budget-usd X` | the result's `subtype` is `success`, or names the limit it hit | no turn limit by default, and spend can pass the cap: it's an estimate | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| Output | `--output-format json` | one JSON object with `result`, `is_error`, `num_turns`, `session_id`, `total_cost_usd` and `permission_denials` | recheck the field names at your version | [Headless](https://code.claude.com/docs/en/headless) |
| Bare mode | `--bare` | it skips hooks, skills, plugins, MCP, `CLAUDE.md` and the claude.ai login | don't use it here: the run needs `CLAUDE.md`'s rule on which source wins | [Headless](https://code.claude.com/docs/en/headless) |
| Sandbox | `sandbox.enabled`, `failIfUnavailable`, `allowUnsandboxedCommands: false` | `/sandbox` in a session | it fences commands only, and native Windows has none | [Sandboxing](https://code.claude.com/docs/en/sandboxing) |

## Go further

- [Best practices](https://code.claude.com/docs/en/best-practices#start-runs-on-a-schedule-or-an-event): the questions to answer before a run goes unattended.
