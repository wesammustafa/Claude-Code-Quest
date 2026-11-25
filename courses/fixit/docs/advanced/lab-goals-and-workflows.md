# Goals and saved workflows

<sub>**Advanced** · Optional lab · about 30 minutes · Needs: [Advanced index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Optional engineering lab.** This is the engineering side of Advanced lessons 1 and 4, Choose how to split the work, where you decide when a workflow beats subagents, and Recover from a partial failure, where you learn that a run's own report is not evidence. Here you set a goal and build a workflow yourself. No core lesson or capstone depends on it, so you can skip it. It asks you to read a short script and some Git output, and explains each part as you meet it.

## Goal

By the end of this lab you can keep a session working until a check you can run passes, and know what the goal's evaluator did and didn't verify. You can also save a workflow that has one agent look at each file, a second agent check each finding, and reports only what was confirmed.

## The job

> **Maya:** The library moved its events site. Every page of ours that links to `https://library.example/events/` now needs `https://library.example/whats-on/`. And separately: last month the checker skipped a broken link on a page and printed nothing. Ade thinks there are other places where it swallows an error. Can we find them all and be sure?

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. `samples/` holds this summer's pages, `npm run linkcheck -- samples` checks their relative links, and `npm test` runs the checker's tests. This lab starts from its own copy of the repository, so your files from earlier lessons don't carry over.

## You need

- In Questerm, nothing to install: the website repository, Git and Node.js are in the practice workspace.
- On your own computer: Claude Code on a paid plan, with workflows turned on, Git and Node.js. See [On your own computer](#on-your-own-computer).

## The idea

A goal keeps one session working toward a condition you state. After each turn, a separate model reads the conversation and judges whether the condition holds; if it doesn't, Claude starts another turn. That evaluator runs no command and reads no file. It sees only what Claude showed in the conversation, so a goal reported met is a claim, and you run its checks yourself before you commit.

A good goal has one end state you can measure, the check that proves it, a limit on what may change, and a turn clause that stops the run if it never gets there.

A workflow is a script Claude writes for a task too big for one conversation: it starts many agents and keeps their results in its own variables. Because the plan is code, you can read it before it runs. A quality pattern makes it trustworthy: one agent looks at each file, then a second agent checks each finding on its own, and only what the second agent confirms is reported. Once a run does what you wanted, you save its script as a command and run it again on another folder.

## Worked example

1. **Decide first, then start in the repository.** You set a goal, and Claude Code reports it met. What has been checked? Then start a session in the `project/` folder:

   ```bash
   claude
   ```

   Claude Code asks whether you trust this folder: it's your practice copy, so read the dialog and accept it. A goal works only in a folder you trust, as hooks do.
2. **Set a goal you can check.** Set the goal for Maya's change:

   ```text
   /goal git grep -n 'library.example/events/' -- samples lists nothing, npm test passes, only files under samples/ change, or stop after 20 turns
   ```

   It has one end state you can measure, the check that proves it, a limit on what may change, and a turn clause that bounds the run. After each turn, a separate model checks whether the condition holds, and if it doesn't, Claude starts another turn. A `◎ /goal active` line shows while it runs. While it works, check on the goal:

   ```text
   /goal
   ```

   It shows the condition, the turns evaluated and the evaluator's last reason, or the goal as achieved. When the evaluator judges the condition met, Claude Code clears the goal and records it as achieved.
3. **Check it yourself, then commit.** The goal is achieved. What comes before you commit? In the shell tab, run the checks yourself, read `git diff`, then commit the pages. The goal's own checks: `git grep -n 'library.example/events/' -- samples` lists nothing, and `npm test` passes. Commit only `samples/`: the goal said nothing else changes.

## Your turn

1. **Ask for the audit, and read the script before you approve it.** Leave this session and start one in Manual mode, so Claude Code asks before each workflow run. Set the size guideline, so Claude aims for few agents: it is advice, not a cap, and it applies from your next prompt. Ask for a workflow that audits each file in one small folder, such as `src/`, for errors that are caught and then dropped, with a second agent checking each finding. The audit only reads: it changes no file. Claude Code asks whether to run the script Claude wrote. Choose **View raw script** and read it before you decide:

   ```js
   // Audits src/ for errors that are caught and then dropped.
   export const meta = {
     name: 'audit-dropped-errors',
     description: 'Find the errors a folder catches and then drops, and report only the findings a second agent confirms',
   }

   const folder = 'src'

   const listing = await agent(`List every file under ${folder}/, each as a path from this folder.`, {
     schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
   })
   const found = await pipeline(listing.files, (file) =>
     agent(`List each place in ${file} where an error is caught and then dropped. One finding per line, as file:line: reason. Say NONE if there are none.`, { label: file }),
   )
   const findings = found.flatMap((answer) => (!answer || answer.trim() === 'NONE' ? [] : answer.split('\n').filter((line) => line.trim())))
   const verdicts = await pipeline(findings, (finding) =>
     agent(`Open the cited line and decide: does this code catch an error and drop it? Answer CONFIRMED or REFUTED, then one sentence.\n${finding}`, { label: 'check' }),
   )

   return findings.filter((_, i) => verdicts[i]?.startsWith('CONFIRMED')).join('\n') || 'No confirmed findings.'
   ```

   Run on a folder of 4 files whose file agents report 3 findings, how many agents does the script start, and which line decides what you see? Then choose **Yes, run it**, and read which findings the checking agents confirmed.
2. **Save it, and make the folder an argument.** Open the run's progress view: it shows each phase with its agent count, and each agent's prompt and answer. Save the finished run to the project's workflows folder: select the run and press `s`, keep the project location, then press `Enter`. The project location is the closest `.claude/workflows/` that already exists between your folder and the repository root, or the root itself if none does: here, the folder above `project/`. Load the reference Claude works from when it writes scripts, then ask Claude to change the saved script so it takes its folder from `args`, instead of naming one. Reload the workflows, so this session runs the changed script.
3. **Run it by name on a second folder.** Run your saved workflow by name on a folder the first run didn't audit, and read which findings it confirmed. Claude Code asks before the run again. In the shell tab, check that the run changed no file: `git status` shows no change from it.
4. **Commit the workflow.** Commit the saved workflow. The save put it in the `.claude/workflows/` folder above `project/`, at the repository root.

## Check

The lab's check reads four things:

- the pages in `samples/` link to `library.example/whats-on/` instead of `library.example/events/` at `HEAD`, changed by commits made in this lab that touch nothing outside `samples/`
- a committed workflow takes its folder from `args`, has an agent look at each file and a second agent check each finding on its own, returns only the confirmed findings, and asks no agent to change a file
- the tests pass
- nothing is left uncommitted

The check runs your committed workflow with stand-in agents on two folders of its own, so it sees each agent the script starts and what it returns.

What the check can't see: whether you set a goal in this lab's session and Claude Code reported it met, and whether you ran the grep and the tests yourself before you committed. No file records them. That part is yours to confirm.

What only you can judge: name one finding a checking agent refuted, and say why that was right.

## Try it elsewhere

- **Software:** a codebase-wide rename: write the goal's condition with a command that proves it, then run that command yourself.
- **Workplace:** a policy update across 40 documents: what is the measurable end state, and who checks each flagged document?
- **Student:** checking every citation in a thesis: what would the agent that finds problems and the agent that checks them each be asked?

## On your own computer

`/goal` needs a folder you trust and hooks turned on, and a session has one goal at a time. Workflows come with every paid plan; on Pro, turn them on in `/config`. A workflow starts many agents in the background and uses many tokens, so keep it small with the size guideline, read the raw script before you approve it, and use Manual mode for a script you haven't read:

```bash
claude --permission-mode manual
```

```text
/config workflowSizeGuideline=small
```

`/workflows` lists the runs, `s` saves one, and `/reload-skills` picks up a script you changed:

```text
/workflows
/workflow-authoring
/reload-skills
```

In Questerm, Claude's words and its agents' answers are written in advance, and model and effort settings don't change them. The workflow script is real: it runs, and the agents it starts and what it returns come from its code.

## Technical detail

| Item | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `/goal <condition>` | keeps Claude working; after each turn a separate model judges the condition from the conversation | `/goal` shows its status | reported met with no evidence in the conversation, since the evaluator runs nothing | [Goal](https://code.claude.com/docs/en/goal) |
| Workflow script | JavaScript with `agent()`, `pipeline()` and `parallel()`, and a literal `export const meta` | the saved command appears in `/` autocomplete | a `meta` with anything but literal values isn't registered as a command | [Dynamic workflows](https://code.claude.com/docs/en/workflows) |
| `args` | the input a saved workflow takes, such as a folder | run `/<name>` on two folders | a script that names its own folder audits it whatever you pass | [Dynamic workflows](https://code.claude.com/docs/en/workflows) |
| `/workflows` | watch, stop or save a run | the saved file under `.claude/workflows/` | dozens to hundreds of agents per run on a big folder | [Dynamic workflows](https://code.claude.com/docs/en/workflows) |

## Go further

- [Dynamic workflows](https://code.claude.com/docs/en/workflows): how Claude writes a workflow script, how to read it before it runs, and how to save it as a command.
