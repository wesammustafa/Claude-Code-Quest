# Hooks that fail closed

<sub>**Intermediate** · Optional lab · about 25 minutes · Needs: [Intermediate index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, not yet re-run in a real session</sub>

**Optional engineering lab.** This is the deep end of Intermediate lesson 3, Decide what each part may touch, where you decide that a rule needs a guard and pick a deny rule or a hook. Here you build and test the hooks themselves. No core lesson or capstone depends on it, so you can skip it. It asks you to read two short shell scripts and run them in the terminal, and explains each part as you meet it.

## Goal

By the end of this lab you can decide which rules need a hook rather than an instruction, make a guard that blocks even when its own script is missing, test it from inside a session, and stop Claude from ending a turn while the tests fail.

## The job

> **Ade:** Twice now a session "tidied" `package-lock.json` and once it opened `secrets/`. And Claude keeps stopping with the tests red and saying it's done. I don't want a note in CLAUDE.md about this. I want it impossible.

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. Its link checker runs on the pages before Maya posts them, `npm test` runs the checker's tests, and `secrets/api.txt` holds a placeholder for the booking calendar's token. `CLAUDE.md` already says "Never edit `secrets/` or `package-lock.json`", and `.claude/settings.json` holds the team's permission rules. A guard script is ready in `practice/i-5/protect-files.sh`. This lab starts from its own copy of the repository, so your files from earlier lessons don't carry over.

## You need

- In Questerm, nothing to install: the website repository, Git, Node.js and `jq` are in the practice workspace.
- On your own computer: Claude Code, Git, Node.js, and `jq`, which both hook scripts use to read the JSON Claude Code sends. See [On your own computer](#on-your-own-computer).

## The idea

A line in `CLAUDE.md` makes the right thing likely. A hook makes it certain: a script Claude Code runs at a fixed moment, whatever Claude decides. A `PreToolUse` hook runs before a tool call, and exit code 2 blocks that call. A `Stop` hook runs when Claude finishes its answer, and exit code 2 sends Claude back to work.

A hook can fail too: a missing script, a crash or a timeout. With `"onFailure": "block"`, a guard that can't run blocks the call instead of letting it through. That is failing closed. Without it, a broken guard silently lets edits through.

A hook only sees the tools its matcher names. A guard on `Edit|Write` never sees a shell command, so Claude could still change a protected file with `echo >>`. An `Edit` deny rule covers Claude's file tools and the files a shell command writes to, and it runs no script that could break.

Hooks run with your own access, outside any sandbox. A hook script is code you run: read it like code before you register it.

## Worked example

1. **Decide first, then start in the repository.** Your guard script is deleted by accident. With `"onFailure": "block"` set, what happens to Claude's next edit of `package-lock.json`? Then decide which line in `CLAUDE.md` needs a hook that runs before Claude acts. Then start a session in the `project/` folder:

   ```bash
   claude
   ```

   Claude Code asks whether you trust this folder: it's your practice copy, so read the dialog and accept it. Trusting a folder lets its settings take effect, hooks included.
2. **Put the guard in place, read it, register it.** In the shell tab, copy the guard from `practice/i-5/` into `.claude/hooks/` and make it executable:

   ```bash
   mkdir -p .claude/hooks
   cp practice/i-5/protect-files.sh .claude/hooks/protect-files.sh
   chmod +x .claude/hooks/protect-files.sh
   ```

   Claude Code runs a hook script directly, so it must be executable. Read the guard before you register it: every Edit and Write call sends its JSON to this script first.

   ```bash
   #!/bin/bash
   # Blocks Edit and Write on .env files (but not .env.example), on anything in a
   # secrets/ folder, and, as the hooks guide's script did, on package-lock.json
   # and .git/. Exit 2 blocks the call; stderr goes to Claude. When jq fails or
   # is missing, it exits 1, so "onFailure": "block" blocks the call.
   INPUT=$(cat)
   FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty') || {
     echo "protect-files.sh: can't read the file path: jq failed or is missing" >&2
     exit 1
   }
   FILE_PATH="${FILE_PATH//\\//}"
   NAME=$(basename "$FILE_PATH")

   case "$NAME" in
     .env.example) ;;
     .env | .env.*)
       echo "Blocked: $FILE_PATH is an environment file" >&2
       exit 2
       ;;
   esac

   case "/$FILE_PATH" in
     */secrets/*)
       echo "Blocked: $FILE_PATH is in a secrets folder" >&2
       exit 2
       ;;
     */package-lock.json | */.git/*)
       echo "Blocked: $FILE_PATH is protected" >&2
       exit 2
       ;;
   esac

   exit 0
   ```

   Exit 2 blocks the call, and what the script prints to stderr goes to Claude. Ask Claude to add this block to the shared `.claude/settings.json`:

   ```json
   "hooks": {
     "PreToolUse": [
       { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-files.sh", "args": [], "onFailure": "block" } ] }
     ]
   }
   ```

   `"onFailure": "block"` makes the guard fail closed: if the script can't run, the edit is blocked instead of let through. It goes in the shared file, so everyone who opens the repository gets it.

## Your turn

1. **Watch it block, from a new session.** Leave this session and start a new one, so you know it has loaded the hook: type `/exit` to leave Claude, then `claude` to start it again. In your own words, ask Claude to change the version in `package-lock.json` with its Edit tool, not a shell command. Name the tool: an `Edit|Write` hook never sees a shell command. In the shell tab, run `git status --short`: `package-lock.json` isn't listed, so the guard stopped the edit.
2. **Break the guard on purpose.** In the shell tab, rename the guard, so the hook can't start:

   ```bash
   mv .claude/hooks/protect-files.sh .claude/hooks/protect-files.off
   ```

   Send the same request again. The error says the hook failed, and the edit is blocked because of `"onFailure": "block"`. Then put the guard back under its name:

   ```bash
   mv .claude/hooks/protect-files.off .claude/hooks/protect-files.sh
   ```

3. **Find the hole a shell write leaves.** Ask Claude to add a line to `secrets/api.txt` with a shell command, not its Edit tool. Your guard watches only Edit and Write, so it never sees a shell command, and the file changes. Decide what closes the hole. Put the file back as it was:

   ```bash
   git checkout -- secrets/api.txt
   ```

   Ask Claude to add `Edit(./secrets/**)` to the deny rules in the shared `.claude/settings.json`. Then send the shell request again: this time the deny rule refuses it, and `git status --short` doesn't list `secrets/api.txt`. Rules are read before each action, so this one needs no new session.
4. **Have Claude write the Stop gate.** Ask Claude to write a Stop hook, `.claude/hooks/test-gate.sh`, that sends Claude back to work while the tests fail, and can't send it back forever. Don't register it yet: you'll test it by hand first. Read what Claude wrote, before you run it:

   ```bash
   #!/bin/bash
   # The Stop gate: when Claude finishes, it runs the tests. While they fail,
   # exit 2 sends Claude back to work, with the reason on stderr. Once the gate
   # has sent it back, stop_hook_active is true: exit 0 then, so it can't loop.
   INPUT=$(cat)
   cd "$CLAUDE_PROJECT_DIR" || exit 1

   if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
     exit 0
   fi
   if ! npm test 2>&1; then
     echo "Blocked: npm test fails. Fix the failing test before you finish." >&2
     exit 2
   fi

   exit 0
   ```

   Once the gate has sent Claude back, the next Stop event's JSON has `stop_hook_active` set to `true`: the gate exits 0 then, so a failure Claude can't fix doesn't keep it working.
5. **Test the gate by hand, then register it.** In the shell tab, run the gate with the JSON a Stop event sends. The tests pass, so it prints `exit 0`:

   ```bash
   echo '{"stop_hook_active":false}' | CLAUDE_PROJECT_DIR=$PWD .claude/hooks/test-gate.sh; echo "exit $?"
   ```

   Break one test on purpose, then run the gate again: `exit 2`, after the tests' output and your reason.

   ```bash
   sed -i 's/, false);/, true);/' test/links.test.js
   ```

   Send the JSON a retry sends, with the test still broken: `exit 0`, so a failure Claude can't fix doesn't keep it working. Then put the test back.

   ```bash
   echo '{"stop_hook_active":true}' | CLAUDE_PROJECT_DIR=$PWD .claude/hooks/test-gate.sh; echo "exit $?"
   git checkout -- test/links.test.js
   ```

   Ask Claude to register the gate under `Stop` in the shared `.claude/settings.json`:

   ```json
   "Stop": [
     { "hooks": [ { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/test-gate.sh", "args": [] } ] }
   ]
   ```

   Then press Check: it runs your gate the three ways you just did, on a copy of the repository.
6. **Watch Claude get sent back.** Break the same test again, in the shell tab. Start a new session, so it loads the gate. Ask a question that needs no edit, such as `Which file holds the link parser?` When Claude finishes its answer, the gate runs the tests and sends it back to work. You only asked a question, so Claude reports the failing test and leaves the fix to you. Put the test back:

   ```bash
   git checkout -- test/links.test.js
   ```

7. **Commit the guard, the gate and the settings.** Ask Claude to commit both scripts and `.claude/settings.json` together. Keep the scripts executable: `git ls-files -s .claude/hooks` shows `100755` for each.

## Check

The lab's check reads eight things:

- both hook scripts and `.claude/settings.json` are committed, the scripts executable, with no change to them left uncommitted
- `.claude/settings.json` runs protect-files.sh as a `PreToolUse` hook for Edit and Write, with `"onFailure": "block"`
- the test gate runs the repository's tests and exits 2 with a reason while they fail, and 0 once they pass or after one retry
- `.claude/settings.json` runs test-gate.sh as a `Stop` hook
- protect-files.sh exits 2 for an Edit or a Write of `package-lock.json`, `secrets/api.txt` and `.env`, and 0 for `src/links.js` and `.env.example`
- `permissions.deny` in `.claude/settings.json` holds an Edit rule covering `secrets/`
- `package-lock.json` and `secrets/api.txt` are as the lab started them
- the tests pass

The check runs your gate in a copy of the repository with its real `npm test`, and breaks a test there of its own. If the check names a file with changes that aren't committed, ask Claude to commit it.

What the check can't see: whether the guard blocked an edit and the gate sent Claude back in your session. It sees only that the protected files are unchanged. That part is yours to confirm.

What only you can judge: is the guard's list the right one for this repository? What else here should never be edited by a session?

## Try it elsewhere

- **Workplace:** which of your team's "always" rules, such as never emailing a customer list or always attaching the invoice number, would you enforce with a tool rather than a reminder?
- **Software:** add a guard that blocks edits to `migrations/`, and prove it with a Write, not just an Edit.
- **Student:** a shared lab notebook: which pages should no script ever change?

## On your own computer

Copy the two scripts into `.claude/hooks/`, run `chmod +x` on them, add the settings block, start `claude` and ask for a forbidden edit. `/hooks` lists what is registered. Claude Code usually picks up a settings change on its own; a new session makes sure. Test each script directly with JSON on stdin before you rely on it:

```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"package-lock.json"}}' | .claude/hooks/protect-files.sh; echo $?
```

It should print `2`. On macOS, `sed -i` needs an empty suffix first: `sed -i '' 's/, false);/, true);/' test/links.test.js`. In Questerm, Claude's words are written in advance, but the hooks are yours: your scripts run, and their exit codes decide what is blocked.

## Technical detail

| Item | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `PreToolUse` hook, exit 2 | blocks that tool call and shows stderr to Claude | `/hooks` lists it; a forbidden edit is refused | exit 0 does not approve; it just doesn't block | [Hooks guide](https://code.claude.com/docs/en/hooks-guide) |
| `"onFailure": "block"` | a hook that can't run blocks instead of passing | rename the script; the edit is still blocked | without it a missing script fails open | [Hooks guide](https://code.claude.com/docs/en/hooks-guide) |
| `Stop` hook, exit 2 | sends Claude back to work | Claude continues after its answer | overridden after eight blocks in a row; guard it with `stop_hook_active` | [Hooks guide](https://code.claude.com/docs/en/hooks-guide) |
| Deny rule `Edit(./secrets/**)` | blocks Claude's file tools and the files a shell command writes to | an Edit and an `echo >>` are both refused | a hook matcher on `Edit\|Write` alone misses shell writes | [Permissions](https://code.claude.com/docs/en/permissions) |
| Hooks and the sandbox | hooks run outside the sandbox with your full access | n/a | a hook script is code you run; review it like code | [Hooks guide](https://code.claude.com/docs/en/hooks-guide) |

## Go further

- [Hooks guide](https://code.claude.com/docs/en/hooks-guide): when hooks run, how exit codes block, and how to test them.
