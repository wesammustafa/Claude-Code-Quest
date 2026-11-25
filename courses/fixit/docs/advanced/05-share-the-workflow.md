# Share the workflow with its limits

<sub>**Advanced** · Lesson 5 of 5 · about 25 minutes · Needs: [lesson 4](04-recover-from-a-partial-failure.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can write down what a workflow checks, what it can't, who decides and how to stop it, share it at the right scope, so the limits hold on a teammate's machine, and use a teammate's dry run to find the limit you didn't write down.

## The job

> **Sam (Mon 14 June, 09:15):** I'm running the August pages myself. Can I just use your overnight refresh? What do I need to know?

It's Monday 14 June 2027. You can see what Sam would get: the refresh runner and its bounds in `fixit/summer/run/`, the kit's `fixit/KIT.md`, and the release-week report, `fixit/summer/run/run-report.md`, that says what went wrong on 11 June.

On 11 June the run's report had said "denied: july.md" every morning for two weeks, and nobody knew what that meant. A workflow without its limits written down is trusted for things it never did.

This lesson starts with the reference organizer kit as it stands at the end of Intermediate, in `fixit/`, lesson 4's corrected bounds and runner, and the summer files as they stood that morning. A second terminal plays Sam's laptop. Your own files from lesson 4 stay in that lesson.

## You need

- In Questerm: nothing. The runs and their costs are simulated, Sam's lines are written in advance, and so are Claude's replies, so model and effort change nothing. "Saving a version teammates get" is a commit in Questerm's simulated Git. Nothing leaves your browser.
- On your own computer: Claude Code, on macOS, Linux or WSL 2 for the run's sandbox, `jq` for the runner's report, and Git for sharing.

## The idea

A workflow you share carries limits nobody wrote down: what it can't see, who checks its output, how to stop it. A short card, kept with the files, says them. Write it with Claude, then check every line against the evidence, because a draft can sound right and claim more than the run does.

Share at the right scope. What everyone needs, the card, the runner, its bounds and the kit's deny rules, goes in the shared version of the project. What's yours alone, your personal settings, stays out. A teammate's personal allow rule can't loosen a team deny rule: Claude Code checks deny first, then ask, then allow, and a deny wins at any level.

Then let someone else try it. A teammate's dry run finds the limit you didn't think of.

## Worked example

1. **Draft the limits card, then correct it.** First, decide: Sam will run the refresh for August without you. What does he need most? The runner and its bounds file only partly help: he gets a working run, and no idea what it can't see. That's how the July page went wrong. A call where you walk him through it helps once, but it's in nobody's files when Lin runs it in September. A short card beside the files: what it does and can't, who decides, how to stop it. The limits travel with the workflow, and the next person reads them before trusting it.

   Go into the kit folder and start Claude there. Claude Code asks whether you trust this folder: it's your practice copy of the kit, so read the dialog and accept it.

   ```bash
   cd fixit
   claude
   ```

   Then ask for a first draft: `Draft summer/LIMITS.md for the pack refresh, for a teammate who has never run it: what it does, what it cannot do, who decides what gets published, and how to stop it. Base it on summer/run/bounds.json, summer/run/refresh.sh, KIT.md and summer/run/run-report.md. Quote the lines you rely on.`

   Claude writes a card with four parts, each line quoting the file it comes from. Open `fixit/summer/LIMITS.md` in the files tab and read it against `fixit/summer/run/run-report.md`, the report from release week. One sentence claims more than the run can do: "Keeps the pages in sync with the venues' latest confirmations." The run only sees confirmations someone saved into `summer/`. On 10 June the late email reached it because Priya saved it there. A phone call never would.

   Ask Claude to correct it: `"Keeps the pages in sync with the venues' latest confirmations" overclaims: it only sees what's saved in summer/. Rewrite that line, and add to "cannot" the two things release week showed it can't know: changes that never get written into summer/, and registration numbers. Also add: "success" in its report doesn't mean the pages are right; read the denials.`

   Now the "does" line says the run works from what's saved in `summer/`, and "cannot" has three new lines: unsaved changes, registration numbers, and a `success` that hides a denial. Claude's draft was partly right: accurate on the bounds, wrong on the one claim that mattered.
2. **Decide what's shared and what's personal.** Before you share the card, decide who needs each file.

   | File | Who needs it | Scope |
   |---|---|---|
   | `summer/LIMITS.md`, `summer/run/refresh.sh`, `summer/run/bounds.json` | everyone who runs the refresh | shared: saved in the project, so teammates get it |
   | `fixit/.claude/settings.json`, the kit's deny rules | everyone | shared |
   | `fixit/.claude/settings.local.json` | one person | personal: never shared, and the kit's `fixit/.gitignore` keeps it out |

   Ask Claude to save a version teammates will get: `Save a version of summer/LIMITS.md, summer/run/refresh.sh and summer/run/bounds.json that teammates will get, with the message "Pack refresh: limits card". Don't include .claude/settings.local.json.`

   Claude commits the card. The runner and its bounds were already in the shared version, unchanged, and the personal settings file is ignored, so it isn't included. Saving a version teammates get is a Git commit here. You don't need Git for this lesson: Claude runs it, and Claude Code asks before it runs a command. On a real team you'd also push, and Sam would pull.
3. **Watch a team limit hold on Sam's laptop.** Sam wants to check the volunteer roster while he's at it. Open his personal settings, `fixit/.claude/settings.local.json`, in the files tab. It has one allow rule, `Read(./summer/private/**)`: Sam lets Claude read the private folder on his own machine. The second terminal plays Sam's laptop. To keep this practice to one folder, it opens the same kit, so this personal file stands for Sam's.

   In the second terminal, Sam's, go into the kit folder and start Claude there:

   ```bash
   cd fixit
   claude
   ```

   Then ask, as Sam: `how many volunteers are on summer/private/roster.md for August?`

   Claude can't read the roster: the project's shared settings deny reads of `private/`, and an allow rule can't override a deny at any level. A teammate's personal settings can add convenience, but they can't loosen the team's deny rules. Rules are checked deny first, then ask, then allow. That's what lets the card promise "it cannot read `private/`" on Sam's laptop too.

## Your turn

The evidence changes: Sam's dry run for August.

1. **Sam's dry run.** In Sam's terminal, leave Claude with `/exit`, then run the shared workflow for August as Sam would: `summer/run/refresh.sh "Refresh august.md from its sources. Change nothing else."` Read its report: which line says what the run changed?

   > **Sam:** Great, it says nothing to change. Oh: Kofi rang me this morning about the parking question from last week. The centre car park is shut on 14 August for resurfacing; people should use the leisure centre car park on Park Lane. Does the page need that?

   The run said nothing needed changing. What's actually true? Not that the page is right: the run checked the page against what's in `summer/`, and Kofi's call isn't in `summer/`. Not that the run is broken: no run can read a phone call. The fix is a habit, writing it down, and the card saying so.
2. **Close the gap, for August and for the card.** Get the parking change onto the August page through the workflow, and make sure the next person knows how a phone change gets in. You can write down Kofi's call now, as a dated note in `summer/`, or wait for his written word: Sam emails Kofi, and his reply arrives at 10:05. Either way, the change goes into `summer/` first, the refresh reruns, and the card says how a phone change gets in.

   Don't edit `august.md` yourself: the next refresh rewrites the page from `summer/`, so a change it can't find there goes. And don't give the run web access: the run reads everything in `summer/` already.

## Check

The Lesson's check reads four things: that `LIMITS.md` says what the run does, what it can't, who decides and how to stop it, names unsaved changes and registrations, and is in the shared version; that a dated note in `summer/` records Kofi's parking change for 14 August, and `august.md` has the Park Lane car park; that a refresh run that ended in `success` with no denials made the August change, and nothing changed `august.md` after it; and that the personal settings file isn't shared, and the team's deny rules are as they were.

The check reads the records the runner keeps of each run, in `summer/run/last-run/` and `summer/run/runs.txt`, to see that a run made the August change. In this practice workspace you could write those records by hand, so on a real machine trust the run's own record over a file anyone can edit.

What only you can judge: if Lin runs this in September and you're unreachable, does `fixit/summer/LIMITS.md` tell her when not to trust it?

## On your own computer

In Questerm the second terminal is a second simulated session in the same folder, Sam's lines are written in advance, and the shared version is a commit in Questerm's simulated Git. A real team must still establish that teammates actually pull the shared files and trust the folder.

1. Project settings (`.claude/settings.json`) and files in the repository are shared once committed. `.claude/settings.local.json` is personal and should be ignored by Git ([Settings](https://code.claude.com/docs/en/settings)).
2. A project's allow rules need workspace trust on each teammate's machine; deny and ask rules apply regardless ([Permissions](https://code.claude.com/docs/en/permissions)).
3. When a second repository or team needs the same setup, a plugin packages skills, agents, hooks and MCP servers. A plugin you install runs code with your user privileges, so treat it as code you review ([Plugins](https://code.claude.com/docs/en/plugins)).

## Technical detail

| Item | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `.claude/settings.json` (project) | shared rules, committed | teammates' `/permissions` lists them | an allow rule does nothing until the folder is trusted | [Settings](https://code.claude.com/docs/en/settings) |
| `.claude/settings.local.json` | personal overrides | ignored by Git | committing it shares your personal allows | [Settings](https://code.claude.com/docs/en/settings) |
| Precedence | deny, then ask, then allow; a deny at any level wins | Sam's local allow on `private/` has no effect | managed settings outrank all | [Permissions](https://code.claude.com/docs/en/permissions) |
| Limits card | a plain file next to the workflow | the runner's folder holds it | nothing enforces it: it's guidance for people | [Best practices](https://code.claude.com/docs/en/best-practices) |

## Go further

- [Permissions](https://code.claude.com/docs/en/permissions): how deny, ask and allow rules combine across settings files.
