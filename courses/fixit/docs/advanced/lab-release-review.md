# Release engineering: Claude review on a pull request

<sub>**Advanced** · Optional lab · about 40 minutes · Needs: [Advanced index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, not yet re-run in a real session</sub>

**Optional engineering lab.** This is the engineering side of the Advanced capstone, Release day for the summer series, where you make a go or no-go call on the public pack. Here you make the same call on a pull request, from a review Claude runs on GitHub. No core lesson or capstone depends on it, so you can skip it. It asks you to read two short workflow files and run Git and GitHub commands in the terminal, and explains each part as you meet it.

## Goal

By the end of this lab you can run Claude Code in GitHub Actions with every limit in the workflow file, read a failed run's log and fix what it names, make one review skill work on every pull request, and tie a green run to the exact commit it judged, then decide the merge from its report.

## The job

> **Maya:** From now on every change to the website goes through a pull request. Ade wants Claude to review each one on GitHub, and Priya wants the link checker run before anything merges. But nobody should be able to make it spend money or push code. And when it's done, I need someone to say "merge" or "not yet", with a reason.

The Millbrook Fixers keep their public pages in a small website repository. This lab gives you a new copy of it, with its own GitHub repository as `origin`, so your other lessons' files don't carry over. The website lives in `project/`, one folder below the repository's root: its link checker, `npm run linkcheck -- <folder>`, runs on the pages in `samples/`. The team's review skill is ready in `practice/a-5/team-review/`, and two prepared changes are in `practice/a-5/`: Priya's draft of the July session's page, and a fix for the March page's booking link.

## You need

- In Questerm, nothing to install: the repository, Git, Node.js and the GitHub CLI are in the practice workspace, and its GitHub is simulated in your browser. No real GitHub is reached and no real key is kept.
- On your own computer: the [GitHub CLI](https://cli.github.com), `gh`, signed in with `gh auth login`, and a repository you are an admin of. See [On your own computer](#on-your-own-computer).

## The idea

`anthropics/claude-code-action` runs Claude Code in a GitHub Actions job. With a `prompt`, it runs as soon as the job starts, with no one at the keyboard, so every limit has to be in the workflow file: which events start it, which release of the action runs, how many turns Claude gets, which commands it may run, what the job's token may do, and how long the job may take.

A green run says the job ended. It doesn't say which commit it judged, or what Claude could see. GitHub records the commit each run checked out, its `headSha`, so you can tie a green run to the exact commit you're about to merge, and the run's log shows what Claude was allowed to run.

On a pull request, the action loads `.claude/`, skills included, from the base branch, not from the pull request, so a stranger's pull request can't bring its own instructions. A review skill has to be on `main` before it can review anything.

## Worked example

1. **Decide first, then ask for the manual workflow.** A pull request's Claude review is green and says No problems found. What do you check before you merge? Start a session in the `project/` folder. The website lives in `project/`, one folder below the repository's root. GitHub runs workflows only from the root's `.github/workflows/`, so that's where this lab's workflows go. Ask Claude to write `.github/workflows/linkcheck-report.yml` at the repository's root, from these criteria:

   - It starts only by hand: `on: workflow_dispatch`, and nothing else.
   - It checks out the repository, then sets up Node.js, then runs `anthropics/claude-code-action@v1.0.258`, pinned.
   - Its prompt runs `npm --prefix project run linkcheck -- samples` and explains each broken link it reports.
   - Its `claude_args` set `--max-turns` to 5 or fewer and allow only `Bash(npm --prefix project run linkcheck *)`.
   - It sets `display_report: true`, reads the credential from the `ANTHROPIC_API_KEY` secret, passes `github_token: ${{ github.token }}`, keeps `permissions` at `contents: read` and sets `timeout-minutes` to 10 or fewer.

   Read what Claude wrote, before you commit it:

   ```yaml
   name: Link check report
   on: workflow_dispatch
   permissions:
     contents: read
   jobs:
     report:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       steps:
         - uses: actions/checkout@v7
         - uses: actions/setup-node@v7
           with:
             node-version: lts/*
         - uses: anthropics/claude-code-action@v1.0.258
           with:
             anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
             github_token: ${{ github.token }}
             display_report: true
             prompt: Run `npm --prefix project run linkcheck -- samples` and explain each broken link it reports, in one sentence each. Change no file.
             claude_args: --max-turns 5 --allowedTools "Bash(npm --prefix project run linkcheck *)"
   ```

   Every limit is in the file: the turns, the one command Claude may run, the read-only token and the time. The action pin stays at `v1.0.258`: moving it to a newer release is a tested decision for the repository's maintainer.
2. **Commit it, push it, and run it without the secret.** In the shell tab, commit the workflow:

   ```bash
   git add ../.github/workflows/linkcheck-report.yml
   git commit -m "Report broken links on the sample pages, on demand"
   ```

   The `..` is the repository's root, one folder above `project/`. Push it to `main`: GitHub starts a workflow by hand only once its file is on the default branch.

   ```bash
   git push
   ```

   Start it and follow it to the end:

   ```bash
   gh workflow run linkcheck-report.yml
   gh run watch 1
   ```

   It fails: the repository has no secret yet, so the action has no credential. Read the failed step's log:

   ```bash
   gh run view 1 --log-failed
   ```

   The log names the credential the action looked for: `ANTHROPIC_API_KEY`.
3. **Save the credential and run it again.** The website's repository is shared by the team, and its secret will be too. Which credential should it hold? For a secret that a team's repository shares, the docs recommend a Console API key, kept in a repository secret. Save it as the repository's secret, then list the secrets:

   ```bash
   gh secret set ANTHROPIC_API_KEY
   gh secret list
   ```

   With no value on the command line, `gh secret set` asks you to paste it, so it never lands in your shell history. In Questerm there's no real key to paste: type any placeholder. Only the secret's name is kept. Start it again and follow it to the end:

   ```bash
   gh workflow run linkcheck-report.yml
   gh run watch 2
   ```

   The check asks GitHub for the runs itself, and looks for a green one on the commit that holds your workflow.
4. **Read Claude's report.** Open the run's page in the browser tab:

   ```bash
   gh run view 2 --web
   ```

   With `display_report: true`, Claude's report is on the run's summary page. Which page has the broken link, and why is it broken?

## Your turn

1. **Add the review workflow and the team's skill.** In the shell tab, start a branch for your change: `git switch -c july-page`. Every change to the website now goes through a pull request, this one included. Ask Claude to write `.github/workflows/claude-review.yml` at the repository's root, from these criteria:

   - It runs on `pull_request` only, with `concurrency` set to `cancel-in-progress: true`, so a new push cancels the older review.
   - It checks out the whole history, `fetch-depth: 0`, so Claude can compare the branch with `main`.
   - Its prompt starts with `/team-review`, and its `claude_args` allow `Bash(git diff *)` and `Bash(npm --prefix project run linkcheck *)`, with `--max-turns` of 8 or fewer.
   - It keeps the manual workflow's other limits: pinned action, secret, job token, `display_report: true`, read-only `permissions` and a timeout.

   Put the team's review skill where the action loads it, at the root's `.claude/skills/`: `mkdir -p ../.claude/skills/team-review`, then `cp practice/a-5/team-review/SKILL.md ../.claude/skills/team-review/SKILL.md`. The action runs Claude Code at the repository's root, so it loads skills from the root's `.claude/skills/`. Commit the workflow and the skill together: `git add ../.github/workflows/claude-review.yml ../.claude/skills/team-review/SKILL.md`, then `git commit -m "Review every pull request with the team review skill"`.
2. **Open a pull request before the skill is on main.** Pick one prepared change. Apply Priya's draft of the July page, then commit it: `git apply practice/a-5/add-july-page.patch`, `git add samples/july.md`, `git commit -m "Add the July session's page"`. Or apply the booking link's fix, then commit it: `git apply practice/a-5/fix-booking-link.patch`, `git commit -am "Fix the booking link on the March page"`. Push the branch and open the pull request: `git push -u origin july-page`, then `gh pr create --fill`. Opening it starts the review workflow on the pull request. Follow the review to the end, then read its failed log: `gh run watch 3`, `gh run view 3 --log-failed`. It fails: the action loads `.claude/` from the base branch, `main`, so a pull request can't bring its own skill, and `main` has none yet.
3. **Put the skill on main, then push the branch again.** Commit the skill alone to `main`, and push it:

   ```bash
   git switch main
   mkdir -p ../.claude/skills/team-review
   cp practice/a-5/team-review/SKILL.md ../.claude/skills/team-review/SKILL.md
   git add ../.claude/skills/team-review/SKILL.md
   git commit -m "Add the team review skill"
   git push
   ```

   As the repository's owner you can push to `main`; on a team, this would be a small pull request of its own. Bring `main` into your branch and push it, which runs the review again, then follow it: `git switch july-page`, `git merge --no-edit main`, `git push`, `gh run watch 4`.
4. **Read the review and decide.** Open the review's run page and read Claude's report. Merge, or not yet? If not yet, ask Claude to fix what the review names, on this branch, then commit and push it. Claude reads the branch first: where the review named nothing, it says so and changes nothing. If Claude pushed a fix, follow the new review to the end and read its report. After Claude's push: `gh run watch 5`, then `gh run view 5 --web`. If Claude found nothing to fix, no new review starts: the green review of your latest commit still stands, and the next step's Check reads it. Before you merge, press Check: it asks GitHub for the review of your branch's latest commit. Merge it on the pull request's page, then bring the merge into your copy.
5. **Tear it down.** Remove both workflows from `main`, commit and push. Delete the repository's secret. Deleting a secret leaves the key it held valid. On a real account, delete the key the secret held on the Claude Console's [API keys page](https://platform.claude.com/settings/keys). In Questerm no real key was ever kept, so there's nothing to delete here.

## Check

The lab's check reads seven things:

- the repository root's `.github/workflows/linkcheck-report.yml` is committed: it starts only by hand, checks out the repository and sets up Node.js before a pinned `anthropics/claude-code-action`, reads its credential from a secret, shows Claude's report, and keeps its limits in the file
- GitHub ran it by hand to success on the newest commit that changed it
- the root's `.github/workflows/claude-review.yml` is committed: it reviews each pull request with `/team-review`, can read the change, cancels an older review on a new push, and keeps the same limits
- `.claude/skills/team-review/SKILL.md` is on GitHub's `main`
- the pull request's latest commit has a green review that could read the change, and nothing the review named is left in it
- GitHub merged the pull request into `main` at the commit its review passed, and your copy's `main` has the merge
- the workflows are gone from `main`, the repository holds no `ANTHROPIC_API_KEY` secret, and no Claude key is in the history

Run the lab's check:

```bash
npm run check -- a-5
```

It asks GitHub for the runs and the secrets itself, so no saved record stands in for a run.

What the check can't see: which line of the review's report your merge decision rests on. That part is yours to say.

What only you can judge: who can open a pull request on this repository, and which text from them reaches Claude in the review? Anyone who can open a pull request writes its title, body and diff, and the review reads them, so a pull request can carry instructions aimed at Claude.

## Try it elsewhere

- **Software:** in your own repository, list what each automated check on your pull requests can read, run and write, and which commit each green check ran on.
- **Workplace:** an approval workflow where a form is approved by an automated check: what did the check see, and which version of the form?
- **Student:** a plagiarism checker's green report on a draft: was it the final draft?

## On your own computer

You need admin on a GitHub repository. Running `/install-github-app` at the Claude Code prompt sets up the Claude GitHub App and the secret, on github.com only. Otherwise add the workflow yourself and save the credential with `gh secret set ANTHROPIC_API_KEY`, a Console API key, or `gh secret set CLAUDE_CODE_OAUTH_TOKEN`, a subscription token from `claude setup-token`, which is tied to your own subscription. Workflows run only from the repository root's `.github/workflows/`. The action is built on the Agent SDK, and is distinct from Anthropic's managed Code Review. In Questerm, Claude's replies and reports are written in advance, and GitHub runs in your browser: the workflows you commit decide which run you get, and the check asks that GitHub for the runs, as it would ask the real one.

## Technical detail

| Item | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `anthropics/claude-code-action@v1.0.258` | runs Claude Code in the job | the run log's first lines | an unpinned `@v1` moves under you | [GitHub Actions](https://code.claude.com/docs/en/github-actions) |
| `prompt`, `claude_args` | the task and Claude Code's flags | the log prints the allowed tools and the turn cap | no `--max-turns`: nothing caps the run | [GitHub Actions](https://code.claude.com/docs/en/github-actions) |
| `display_report: true` | shows Claude's report on the run page | the report renders | off: only a summary | [Action README](https://github.com/anthropics/claude-code-action) |
| `permissions: contents: read` | the job token can't push | a write attempt fails | `write-all` lets a prompt-injected run push | [GitHub docs](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token) |
| `concurrency` with `cancel-in-progress` | one review per pull request at a time | the older run shows cancelled | reviews of stale commits cost money | [GitHub docs](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) |
| `gh run list --json headSha` | which commit a run judged | compare it with `git rev-parse HEAD` | a green run on an older push | [GitHub CLI](https://cli.github.com/manual/gh_run_list) |

## Go further

- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions): the action's inputs, its `claude_args` and how to set it up on your own repository.
