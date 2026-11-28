# Choose how to split the work

<sub>**Advanced** · Lesson 1 of 6 · about 25 minutes · Needs: [Advanced index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can tell independent work from dependent work, pick the cheapest way to run it (one session, subagents, parallel sessions, a saved workflow, a scheduled run or an agent team), and decline parallelism that costs more than it saves.

## The job

> **Priya (lead volunteer):** The library's fire officer has a new rule from June: no lithium power tool batteries over 36 V. It has to go on all three summer pages and on the schedule before Maya publishes. Last time we updated pages one by one it took all evening and the schedule ended up out of step with July. Can you get Claude to do it properly this time?

It's Friday 28 May 2027. The four outputs are in `fixit/summer/public/`: `june.md`, `july.md`, `august.md` and `schedule.md`. The fire officer's email is `fixit/summer/fire-officer-email-2027-05-20.md`. The schedule is what goes into the reminder email: if it is built before the pages are right, 70 people get the wrong version.

This lesson starts with the reference organizer kit as it stands at the end of Intermediate, in `fixit/`: its `CLAUDE.md`, the attendee-guide skill, its settings and number guard, the read-only guide reviewer and `KIT.md`. The summer files are as they stood on 28 May. Your own Intermediate kit stays in the Intermediate lessons.

## You need

- In Questerm: nothing. Claude's replies, its subagents and what they cost are written in advance, and nothing leaves your browser.
- On your own computer: Claude Code, and a folder of your own with a few files that each need the same kind of change.

## The idea

Before you split work, map what each output reads. Work that reads only its own sources can run at the same time; work that reads another output waits for it. Parallel where independent, sequential where not.

Splitting always costs something. Subagents give you "parallelism or a fresh pair of eyes ... but not a smarter answer," and their cost is "mostly tokens" ([Best practices](https://code.claude.com/docs/en/best-practices#know-what-subagents-cost)). Pick the cheapest way that fits the job, and say no to the rest.

Helpers that only report back are subagents. Helpers that have to argue with each other are an agent team, and a team costs more: "Use subagents when you need quick, focused workers that report back. Use agent teams when teammates need to share findings, challenge each other, and coordinate on their own" ([Agent teams](https://code.claude.com/docs/en/agent-teams#compare-with-subagents)).

## Worked example

1. **Map what each output reads.** First, decide: three session pages each need the new rule, checked against their own booking, and the schedule page is built from the three pages. What can run at the same time? The pages don't depend on each other; the schedule depends on all three. Then go into the kit folder and start Claude there. Claude Code asks whether you trust this folder: it's your practice copy of the kit, so read the dialog and accept it.

   ```bash
   cd fixit
   claude
   ```

   The kit's own settings, guard and reviewer load from `fixit/`, so that is where Claude starts from now on. Press `Shift+Tab` until the status bar reads `⏸ plan mode on`, so nothing is edited while you look, and ask: `For the new lithium battery rule: list each file in summer/public/ that has to change, which source files it must be checked against, and which outputs depend on other outputs. Don't change anything yet.`
2. **Compare the ways to run it.** Six ways Claude Code can run work, compared for this job:

   | Way | What it costs here | For this job |
   |---|---|---|
   | One session, in order: Claude edits each page, then the schedule | It uses the least, about four turns | Reasonable: the baseline to beat |
   | Subagents, one per page, then the schedule in the main session. A subagent is a helper Claude starts, with a conversation of its own | It uses more, you wait less, and the main conversation stays short | Best fit: each page reads its own sources, and the schedule waits |
   | Parallel sessions, each in its own worktree, a separate copy of the folder | The most setup, and a merge afterwards | Refuse: it pays only when sessions would edit the same files at once, and nothing collides here |
   | A saved workflow, a script that runs many subagents in stages | You write it and read it first | Refuse: it pays for a job too big for one conversation, not for three pages |
   | A scheduled run, Claude on a timer with nobody watching | It costs something every time | Not for a one-off change |
   | An agent team, a lead session with teammates that message each other and share a task list | Each teammate is a whole Claude Code session, so it uses significantly more than one session | Refuse: each page's helper only reports back, and none needs to argue with another |

   A subagent's edits are mostly not undone by `/rewind`, so you check its files yourself.
3. **Run it: three subagents, then the schedule.** Plan mode stops Claude editing anything, and this step edits four files. Press `Shift+Tab` until the status bar reads `⏵⏵ auto mode on`, then send: `Use one subagent per session page (june, july, august). Each one adds the lithium battery rule to its page's "We can't take" line, checked against that page's own booking and the fire officer's email, and changes nothing else. When all three are done, update schedule.md from the three pages yourself.` The subagents work in the background, so your prompt stays free. Type `/tasks`: it names each subagent run and says whether it is still working. Here all three have returned. Then type `/usage`: it lists the subagents apart from the main conversation. In this practice workspace the figures are written in advance, and on your own computer the dollar figure is a local estimate, not your bill.
4. **Check the result, not the summary.** The summary says four files changed. Open each page in the files tab: each "We can't take" line now ends with the battery rule. Then, in the shell tab, one line finds every page that mentions it:

   ```bash
   grep -l "36 V" fixit/summer/public/*.md
   ```

   `grep -l` prints the name of each file that holds the words in quotes. Four files print. This time Claude was right, and you know it from the files.

## Your turn

The jobs change. You triage two, run the one where splitting pays, then choose between helpers that report back and a team that argues it out.

1. **Triage: a tiny change everywhere.** Maya wants the heading "We can't take" renamed to "Please leave at home" on all four pages. Choose how to run it. Small, mechanical and the same everywhere: one session is cheapest and easiest to check.
2. **Triage: two people, the same files, this afternoon.** Sam wants to rework `august.md` in his own Claude session while you rework `schedule.md` and `august.md`'s booking line in yours. Choose what you do. Parallel tools don't fix overlapping ownership: split by file, and let the dependent file wait.
3. **Run the job where splitting pays.** The library wants an easy-read version of each session page for its accessibility shelf: short sentences, one fact per line, the access line first. Each must be checked against that session's own sources, and saved beside the page as `june-easy.md`, `july-easy.md` and `august-easy.md`. The original pages must not change. In your own words, ask Claude to run this the way you'd defend. For example: `Make an easy-read version of each summer page, one subagent per session, each checking its own booking and the May notes, saved as <session>-easy.md next to the page. Access line first. Don't edit the original pages. Then tell me which source each access line came from.`
4. **Check what it made.** Open each easy-read page and read it against its session's sources before you accept it.
5. **Choose: report back, or argue it out.** Fill in `fixit/summer/a-2/how-to-run.md` in the files tab. For each of two jobs, write `subagents` or `agent team`, then "because" and your reason. Job 1 is the easy-read job you just ran. Job 2 is Priya's next one, a fallback for July: if the Room B lift stops working before 10 July, should the July session move to Room A, move to Northside or change its date? She wants three helpers, each making the case for one option, to challenge each other's case and agree one plan between them. Questerm doesn't run agent teams, so here you only choose.

## Check

The Lesson's check reads four things: that the three session pages and the schedule are as the Worked example left them, that `june-easy.md`, `july-easy.md` and `august-easy.md` each give their own session's date and place, that each puts the access line first, and that `how-to-run.md` runs the easy-read pages with subagents and July's fallback with an agent team, with a reason for each.

What the check can't see is which helper wrote or checked each page. In this practice workspace, your request is judged before Claude acts on it. On your own computer, the transcript shows a `●` line for each subagent.

What only you can judge: could someone who struggles with long sentences find the access line in five seconds?

## On your own computer

In this practice workspace the subagents are simulated: their replies, their file edits and their costs are written in advance. With real Claude Code:

1. Ask for subagents in plain words, such as "use one subagent per page", or define a named one in `.claude/agents/` and Claude can choose it from its description. Most subagents Claude starts run in the background.
2. After a run that used subagents, `/usage` shows their share of the session ([Costs](https://code.claude.com/docs/en/costs)). The breakdown by subagent is on the Pro, Max, Ultra, Team and Enterprise plans.
3. Parallel sessions are a different thing: in the terminal, `claude -w <name>` starts a session in its own worktree ([Worktrees](https://code.claude.com/docs/en/worktrees)). **Agent view** (`claude agents`), one screen for many background sessions, is a research preview ([Agent view](https://code.claude.com/docs/en/agent-view)). This job needed neither.
4. **Agent teams** "are experimental and disabled by default" ([Agent teams](https://code.claude.com/docs/en/agent-teams)). To try one, set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` to `1` in your shell, or under `env` in your settings file, then describe the team you want. Teammates start only in an interactive session, not in a `claude -p` run, and "agent teams use significantly more tokens than a single session."
5. A command Claude is running can go to the background too: press `Ctrl+B` while it runs, twice in tmux, and `/tasks` lists it beside the subagents ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#background-bash-commands)). Work in the background keeps spending while you are not typing.
6. The same job can run on another surface. `claude --cloud "<task>"` starts a cloud session, which runs on cloud infrastructure rather than your machine and keeps going after you close your laptop, and `/teleport` pulls a cloud session into this terminal ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)). `/desktop` continues the session you are in inside the Claude Code Desktop app, on macOS or x64 Windows ([Desktop](https://code.claude.com/docs/en/desktop)). Each of these needs a paid Claude plan.

## Technical detail

| Mechanism | What it does | How to verify | Failure case | Reference |
|---|---|---|---|---|
| A subagent you ask for | runs a task in its own context and returns a summary | a `●` line for each one; `/usage` lists them | most subagents' edits aren't restored by `/rewind`: check their files yourself | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| `/tasks` | shows the background work of the session you are in, subagents that have finished included | one row for each run, with whether it is still working | it covers this session only, and background work keeps spending while you are not typing | [Commands](https://code.claude.com/docs/en/commands) |
| `claude -w <name>` | a session in its own git worktree | `git worktree list` shows it | a fresh checkout lacks gitignored files and installed dependencies | [Worktrees](https://code.claude.com/docs/en/worktrees) |
| `/batch <instruction>` | for one big mechanical change, splits the work into 5 to 30 units and runs each in its own worktree, one subagent per unit | the plan it shows before it starts, then each unit's pull request or report | it needs a git repository (or a `WorktreeCreate` hook that makes the worktrees), and it is far more machinery than three pages need | [Commands](https://code.claude.com/docs/en/commands) |
| A dynamic workflow | a script that runs many subagents in stages | `/workflows` shows it running | token-heavy for a small job | [Workflows](https://code.claude.com/docs/en/workflows) |
| An agent team | a lead session and teammates, each its own Claude Code session, with a shared task list and messages between them | the agent panel below the lead's prompt lists them, though subagents show there too | experimental and off by default; `/resume` and `/rewind` don't bring back in-process teammates; a task's status can lag | [Agent teams](https://code.claude.com/docs/en/agent-teams) |
| `/usage` | the session's estimated spend, split by what used it | the subagents' rows | the dollar figure is a local estimate | [Costs](https://code.claude.com/docs/en/costs) |
