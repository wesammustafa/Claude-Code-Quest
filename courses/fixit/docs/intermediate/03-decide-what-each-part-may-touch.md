# Decide what each part may touch

<sub>**Intermediate** · Lesson 3 of 6 · about 30 minutes · Needs: [Turn a repeated job into a skill](02-turn-a-repeated-job-into-a-skill.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can choose allow, ask or deny for what Claude reads, edits and runs, put each rule where it belongs, shared or personal, say what the sandbox does and doesn't cover, and add a guard that holds when memory is missed, and prove it with one probe that must be blocked and one that must go through.

## The job

> **Priya:** Two things scare me about handing this to Sam's laptop. Last year's flyer went out with my mobile number on it, and I still get texts. And in February Claude "tidied" the library's email while shortening the guide. The sources are what we check against; they can't change. Can you make sure neither happens, even if someone forgets to say so?

You can see both risks in the folder: `sources/flyer-2026-10.md` has Priya's 555-0187, and `march/private/roster.csv` has ten more numbers.

`CLAUDE.md` already says never to put a private number on a public page. That makes the right thing likely. Priya needs it to be certain.

This lesson starts with the reference kit as it stands after Lesson 2: `fixit/CLAUDE.md`, the public-pages rule and the attendee-guide skill, with the March guide it made. Your own version stays in Lesson 2. There are no settings yet.

## You need

- In Questerm: nothing. Claude's replies are written in advance, so the model and effort a session shows don't change them, and nothing leaves your browser. The rules, the hooks and their exit codes are real: your settings and your guard's script decide what happens. The sandbox here is a simulated one.
- On your own computer: Claude Code, and a folder of your own to try it in. Settings are plain JSON files, so any editor opens them.

## The idea

Memory is guidance. It usually works, and nobody notices the one time it doesn't. Permission rules and hooks are enforced by Claude Code itself, not by the model, so they hold even when the instruction in memory is missed.

So first, a question: next month's folder will have a roster with ten phone numbers in `private/`, and Sam's own notes may have numbers in them too. What keeps those numbers off the public guide? The line in `CLAUDE.md` is guidance, and that's how Priya's number got on the flyer. A rule that stops Claude reading `private/` works for the roster, but does nothing for a number in Sam's notes or on the old flyer, which Claude may read. It takes both: a path rule protects the place you know about, and a guard on what gets written to a public page catches the number wherever it came from.

## Worked example

1. **Start Claude where the kit lives.** Work in `fixit/`, as you did in the last two lessons, and start Claude there:

   ```bash
   cd fixit
   claude
   ```

   Trust the folder: it's part of your practice copy.
2. **Keep Claude out of the private folders.** First, see the rules this session follows: type `/permissions`. It lists every allow, ask and deny rule, with the settings file it came from. The list is empty: no project rules. What Claude does is decided by the session's mode, auto here, and by asking you.

   There are three kinds of rule. **Allow**: do it without asking. **Ask**: always ask me first. **Deny**: never, in any mode. Claude Code checks deny first, then ask, then allow, so a deny always wins.

   They live in two places. `.claude/settings.json` is **shared**: it sits in `fixit/`, the folder you started Claude in, and anyone who opens that folder gets it, Sam included. `.claude/settings.local.json` is **yours alone**: Claude Code keeps it at the top of your practice copy, the folder above `project/`, and out of Git. Rules that protect the group go in the shared file.

   Ask Claude for a deny rule in the shared settings: `Add a deny rule to the shared .claude/settings.json so you can never read anything under a private/ folder, in any month.` Claude adds `Read(./**/private/**)` to `.claude/settings.json`. It matches a `private/` folder at any depth, so next month's is covered too. It's in the shared file, so Sam gets it.

   Now probe it. Ask something only the roster could answer: `How many volunteers are on the March roster, and who are the trainees?` The deny held, and Claude didn't try to get round it with a shell command. It found the answer in a file it may read: ten volunteers, two trainees, Tomás and Lin, from the meeting notes.

   Rules match an action as written. `Read(./**/private/**)` also stops `cat march/private/roster.csv`, but a script that opens the file itself wouldn't match. That's one reason commands go through ask, next.
3. **Ask before commands, and know what the sandbox covers.** Making a guide needs no shell commands. If Claude ever wants one here, you want to see it first: `Add Bash to the ask list in the shared settings.` Now any command, even a harmless one, shows you a prompt with the exact command line before it runs.

   The sandbox is a fence the operating system puts around the shell commands Claude runs: what they can write, and which sites they can reach. It covers shell commands only. Claude's own file reading and editing, hooks and outside connections run outside it.

   So, would turning the sandbox on have stopped Priya's number getting onto the guide? No: Claude writes the guide with its Edit tool, not a shell command, and the sandbox never sees it. The sandbox matters when commands run, especially when nobody is watching.

   If you turn it on, that's a choice about your machine, so it goes in `.claude/settings.local.json`, not the shared file. Native Windows has no sandbox; macOS, Linux and WSL 2 do.

## Your turn

Two protections, two different boundaries.

1. **The sources must never change.** In your own words, make Claude unable to change anything in `sources/` or any venue's booking or email, while it can still edit the guides and fact tables. Choose the mechanism. Both work here, because the path is the boundary:

   - a **deny rule** in the shared settings, such as `Edit(./sources/**)`: it covers Claude's Edit and Write tools, runs no script, and can't fail;
   - or a **hook**: a small script Claude Code runs before every edit, which refuses edits to those paths, set to block if the script itself can't run. That's called failing closed.

   Then probe it: ask Claude to correct the October flyer, changing 60 seats to 40 seats. Either mechanism blocks it. If the flyer needs correcting, that's a new flyer, not a change to the old one we check against.

   The check also tries edits you didn't make: a Write to the flyer, to next month's booking and to a venue's email, which must be blocked, and one to `march/facts.md`, which must go through. A rule in your local settings fails: Sam won't have it. So does a hook that runs for Edit only, since a Write makes a new file without an edit.
2. **Private numbers never reach a public page.** Here the content is the boundary: Priya's number is on the old flyer, which Claude may read. A path rule can't say: this number, in that file. Only a check of what's being written can.

   Ask Claude for a guard that blocks any edit putting Priya's number (555-0187) on a public page, lets the venue's public number through, and blocks if it can't check. Claude writes the script and tests it before it registers it. The test is a shell command, so your ask rule shows it to you first. You judge the script by probing, not by reading it.

   The check runs your guard on test edits: 555-0187 written into the March guide or edited into it, which must be blocked, and 555-0100 there or 555-0187 in a private note, which must go through.

   Then type `/hooks`, which lists the hooks this session runs, each with the file it came from. Yours should be on `Edit` and `Write`, in the shared settings, where Sam's sessions read it too. A guard that isn't registered never runs, and nothing tells you: the list is how you see it took effect.
3. **Probe it yourself.** Make Claude try to break the rule, and watch the guard stop it: ask for Priya's number on the March guide, for access questions. Then make sure the normal job still works: the same kind of line, with the library's public number. It goes through.

   One question for you, not graded: your guard blocks 555-0187. What does it do with 555-0175, a number from the roster? Ask Claude to try your guard on it. Keep the answer in mind for the capstone.

## Check

The Lesson's check reads five things:

- `fixit/.claude/settings.json` denies Claude reading any `private/` folder, in any month
- nothing can change `sources/`, a booking or a venue email, by a shared deny rule or a hook that fails closed, while guides and fact tables stay editable
- a hook in the shared settings blocks 555-0187 in a Write or Edit to a public page, lets 555-0100 and private notes through, and blocks when it can't read the input
- the shared settings ask before every command, and allow none broader than one
- `fixit/march/attendee-guide.md` has no 555-0187, and has the access line your guard let through

The check runs your hooks on test edits, the way Claude Code runs them, and judges what they do, not how they're written. It reads the March guide for 555-0187, not a record of the block you watched: that the guard blocked your probe is yours to say.

What only you can judge: read each rule and the guard beside what it stops. Too strict, and Sam can't work. Too loose, and Priya gets texts. Is there anything here Sam would have to switch off to do the job?

## On your own computer

Real Claude Code reads the same files. Edit them in any editor, or ask Claude to.

1. `/permissions` shows every rule and where it came from; you can add rules there too.
2. Settings files: `.claude/settings.json` (shared; read from the folder you start Claude in), `.claude/settings.local.json` (yours alone, for this one project), `~/.claude/settings.json` (yours, everywhere). A deny anywhere can't be overridden by an allow elsewhere.
3. When you choose "Yes, and don't ask again" for a command, Claude Code saves an allow rule to `.claude/settings.local.json`. In a Git repository it reads and writes that file at the repository root, so a session you start in a subfolder saves the rule for the whole repository; a file an older version left in the subfolder is still read as well. Read it from time to time.
4. Hooks are set in the same settings files, under `"hooks"`; `/hooks` shows them. A script must be executable on macOS and Linux (`chmod +x`). Claude Code normally picks up an edit to a settings file while it runs; if a change doesn't show, restart `claude`.
5. The sandbox runs on macOS, Linux and WSL 2, not on native Windows.
6. `/add-dir <path>`, or `claude --add-dir <path>` when you start, extends where Claude may read and edit files. It doesn't make that folder a second configuration root: its `CLAUDE.md`, `.claude/rules/` and hooks don't load, so the rules and guards in force are still the ones from the folder you started in. Its skills, commands and subagents do load. `permissions.additionalDirectories` in settings keeps a folder across sessions, and grants file access only. See [Additional directories grant file access, not configuration](https://code.claude.com/docs/en/permissions#additional-directories-grant-file-access-not-configuration).

See [Configure permissions](https://code.claude.com/docs/en/permissions), [Sandboxing](https://code.claude.com/docs/en/sandboxing) and the [Hooks guide](https://code.claude.com/docs/en/hooks-guide).

## Technical detail

| Item | What it does | How to verify | Failure case |
|---|---|---|---|
| `permissions.deny`, `ask`, `allow` | checked deny, then ask, then allow; a more specific rule doesn't change the order | `/permissions` lists them with their source | a deny in `settings.local.json` protects only you ([Permissions](https://code.claude.com/docs/en/permissions)) |
| `.claude/settings.local.json` | your own rules for this one project, over the shared file | `/permissions` names the file each rule came from | for a session started in a subfolder of a Git repository, Claude Code reads and writes it at the repository root, so a rule you expect beside the shared file isn't there; a file a version before 2.1.211 left in the starting folder is still read too ([Settings](https://code.claude.com/docs/en/settings)) |
| `Read(...)` and `Edit(...)` rules | `Edit` rules cover Claude's file-writing tools; `Read` rules also catch a shell read of that path as written | probe with a prompt that would cross it | a script that opens the file itself isn't matched; `@` mentions skip `PreToolUse` hooks, so protect reads with a `Read` deny, not a hook |
| Sandbox | limits the operating system puts on shell commands and their children | a write outside the allowed folders fails | it covers shell commands only: file tools, outside connections and hooks run outside it ([Sandboxing](https://code.claude.com/docs/en/sandboxing)) |
| `PreToolUse` command hook | runs before a tool call; exit 2 blocks it, with the message on stderr | run the script yourself with a JSON input | exit 0 doesn't approve, it only doesn't block; hooks run with your full permissions, outside the sandbox ([Hooks guide](https://code.claude.com/docs/en/hooks-guide)) |
| `"onFailure": "block"` | treats a hook that errors as a block: it fails closed | break the script on purpose and probe | without it, a broken guard silently lets edits through |
| Rules and hooks versus memory | rules and hooks are enforced by Claude Code; `CLAUDE.md` is guidance | compare a probe with and without the rule | a line you keep adding emphasis to in `CLAUDE.md` belongs in a hook ([Best practices](https://code.claude.com/docs/en/best-practices)) |

In Questerm, hooks run as real scripts in the practice shell, and their exit codes count. The sandbox is simulated: it refuses a shell write outside the project, and it doesn't model the network. Claude's replies are written in advance; what blocks them is your settings and your script. The practice session reads the local settings at the top of the copy, as Claude Code does; the Lesson's check also reads one left in `fixit/`, and says which file your rule is in.

The Desktop app's Code tab and the VS Code extension use the same settings files and hooks. Claude in claude.ai has no file permissions or hooks: what it can see is what you attach or connect, so the same decision there is what you put in a Project's files and which connectors you turn on.
