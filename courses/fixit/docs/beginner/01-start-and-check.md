# Start Claude Code and check what it tells you

<sub>**Beginner** · Lesson 1 of 6 · about 15 minutes · Needs: [Beginner index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can tell the shell from Claude and start Claude Code in a folder, see which account a session uses, stop an answer and ask again, and check a claim Claude makes against the line it came from.

## The job

> **Priya (lead volunteer):** Two new volunteers start on Saturday. Jordan wrote them a welcome note last year. Can you check it against what the library actually sent us before I forward it? Last spring someone parked in the market and got a ticket.

Jordan's note is `fixit/feb/jordan-welcome-note.md`, six short lines. The library's booking email is `fixit/feb/venue-email-feb.md`, and the group's January meeting notes are `fixit/feb/meeting-notes-2027-01-28.md`.

## You need

- In Questerm: nothing. Claude Code is already installed in the practice workspace, and you are signed in as the practice account, **Practice Learner**. Claude's replies are written in advance, and nothing leaves your browser.
- On your own computer: a terminal and a plan that includes Claude Code: Pro, Max, Ultra, Team or Enterprise, a Claude Console account, or a supported cloud provider. The free Claude plan doesn't include it ([Quickstart](https://code.claude.com/docs/en/quickstart)). Step 2 shows the install.

## The idea

Claude Code is a program you run in a terminal, inside a folder. It reads the files there, answers questions about them, and can change them.

Treat its answer as you would a new colleague's: before you act on it, open the file it names and check. An answer with a file and line is a pointer: open the line it cites and read it yourself.

## Worked example

1. **Find the shell.** The terminal tab shows a shell prompt: it runs programs. Claude isn't running yet, so what you type here goes to the shell. Check that Claude Code is installed:

   ```bash
   claude --version
   ```

   You should see a version number followed by `(Claude Code)`. Questerm's practice workspace simulates Claude Code 2.1.309, so it prints that number; this lesson was checked against the documentation for 2.1.325, and on your own computer you'll see the version you installed. If the shell says `command not found: claude`, the install folder isn't on your `PATH` yet, the list of folders where the shell looks for programs: step 2 shows how to fix that on your own computer.
2. **Install it on your own computer** (optional in Questerm). On your own computer you install Claude Code once, then run it in any folder:

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

   **Windows:** `irm https://claude.ai/install.ps1 | iex`

   When it finishes, open a new terminal window and run `claude --version` again. If the shell says `command not found: claude`, first try a new terminal window: an open window keeps its old `PATH`. If that still fails, follow [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install#command-not-found-claude-after-installation).
3. **Start Claude and trust the folder:**

   ```bash
   claude
   ```

   Claude Code asks whether you trust this folder. This is your own practice copy, so read the dialog and accept it. Trust a folder only when you know where its files came from: a folder can carry its own settings, and trusting it lets them take effect. For a stranger's project, read its `.claude/` folder first. From now on, what you type goes to Claude, not to the shell.

   When you want one shell command without leaving Claude, start the line with `!`. This one, `ls`, lists what is in a folder:

   ```bash
   !ls fixit/feb
   ```

   The line goes to the shell, not to Claude, and its output is added to the conversation. Without the `!`, the same words would go to Claude as a message.
4. **Find a command, and see who you are signed in as.** Commands start with `/`. When you don't know a command's name, type `/help`: it lists the commands you can type, with what each one does. You can also type `/` in the input on its own and read the list above it, then type the first letters of a name to filter it, as in `/st` for `/status`. `Tab` takes the top match.

   Now type `/status`. The **Status** tab lists the version, the model and the account you signed in with. The account decides which models and features a session can use: when a colleague's Claude does something yours won't, compare accounts first. Press `Esc` to close it.
5. **Ask, stop and ask again.** Ask `what's in the fixit folder, and what is each file for?` While Claude is still answering, press `Esc`: Claude stops and waits for your next instruction, and keeps the work done so far. Press `Esc` whenever Claude heads the wrong way, then say what you want instead. Send the question again and let it finish. Now ask the question Priya cares about: `when can volunteers get into the library on 13 February, and where should they park? Cite the file and line.`
6. **Open the line yourself.** Open `fixit/feb/venue-email-feb.md` in the files tab and read the lines Claude cited. This time Claude was right, and now you know it from the email, not from Claude.
7. **Read Jordan's note.** Open `fixit/feb/jordan-welcome-note.md` and read its six lines.

## Your turn

1. In your own words, ask Claude to check each line of Jordan's note against the library's email and the meeting notes, with the file and line for each verdict. Don't ask it to change the note yet. For example: `check each line of @fixit/feb/jordan-welcome-note.md against the library's email and the January meeting notes. For each one say whether the sources agree, and give the file and line.` Typing `@` before a path includes that file in your prompt, without waiting for Claude to find and read it.
2. Open each line Claude cites for a claim it says the sources contradict, and read it yourself. Decide from the email, not from Claude's verdict. Correct what the evidence contradicts, and mark what it doesn't cover for someone who can confirm it.
3. Optional: tell Claude exactly what to change: the parking line, from the library's email, and a mark on the extension-leads line for Priya to confirm. Name the line and what it should say, and what to leave as it is. Skip this step if you'd rather edit the note yourself in the files tab.
4. Make sure the note sends volunteers to the right car park, marks the extension-leads line for Priya to confirm, and keeps the other lines. Edit the note in the files tab, or read what Claude changed. Either way, read the result. Say only what the email says: where to park, and why not the library.
5. End the session with `/exit`. Your corrected note stays in the files.

## Check

The Lesson's check reads four things:

- `claude --version` prints a Claude Code version
- the parking line in `fixit/feb/jordan-welcome-note.md` says where volunteers can actually park
- the extension-leads line is kept and marked for Priya to confirm
- the note's other true lines are still there

What only you can judge: would a new volunteer who has never been to the library know where to park from your parking line alone?

## On your own computer

Everything above ran in Questerm's practice workspace, with Claude's replies written in advance and the practice account. To do it for real you need Claude Code on your computer and a plan that includes it, as **You need** says.

1. **Open a terminal.** macOS: Terminal (in Applications, Utilities). Windows: PowerShell. Linux: your terminal app. New to terminals? Anthropic's [terminal guide for new users](https://code.claude.com/docs/en/terminal-guide) walks through it.
2. **Install**, as in step 2. To move to the latest version later, run `claude update`; a native install also updates itself in the background. In the Windows Command Prompt, where the prompt doesn't start with `PS`, type `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd` instead. The installer shows no progress bar while it downloads. If you'd rather not use a terminal at all, the Claude **Desktop app** (macOS, Windows) has Claude Code in its **Code** tab.
3. **Make a practice folder** with two or three documents you want to check against each other, and move into it: `cd` followed by the folder's path. Don't start Claude in your home folder; trust there isn't remembered.
4. **Start Claude:** `claude`. The first time, it opens your browser to sign in. Then the trust dialog appears; trust a folder you made.
5. Ask a question about your documents with "cite the file and line", and open what it cites.

## Technical detail

| Command | What it does | How to check | Watch out for | Reference |
|---|---|---|---|---|
| `claude --version` | prints the installed version | the output ends in `(Claude Code)` | `command not found`: the install folder isn't on your PATH, as in step 2 | [Setup](https://code.claude.com/docs/en/setup) |
| `claude doctor` | read-only install and settings diagnostics, without starting a session | it prints its report and exits | run it when something else fails | [Setup](https://code.claude.com/docs/en/setup) |
| `claude --help` | lists the flags your version takes | it prints the list and exits | it doesn't list every flag, so a missing one may still work | [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| `claude update` | installs the latest version | it prints the version it moved to | a Homebrew install doesn't auto-update, so run this yourself | [Setup](https://code.claude.com/docs/en/setup#update-claude-code) |
| `claude` | starts a session in the current folder | the header shows the version, model and folder | the trust dialog every time in your home folder: start from a project folder | [Quickstart](https://code.claude.com/docs/en/quickstart) |
| The trust dialog | lists the rules and folders the project would grant before they apply; deny and ask rules apply regardless | it doesn't come back in the same project | `claude -p` never shows it, but a project's hooks and MCP servers can still run there | [Security](https://code.claude.com/docs/en/security), [Permissions](https://code.claude.com/docs/en/permissions) |
| `/help` | lists the commands you can type, each with what it does | `/status` is one of the lines | the list depends on your plan and platform, and a few commands are hidden from it by design | [Commands](https://code.claude.com/docs/en/commands) |
| `/` and the first letters | filters the command list as you type; `Tab` takes the top match | the list narrows as you add letters | a path such as `/tmp/notes.md` keeps no list open | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#commands) |
| `!` and a command | shell mode: runs the line and adds it and its output to the conversation | the output prints under your line | the line runs outside the sandbox, so read it before you send it | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#shell-mode-with-prefix) |
| `/status` | the version, model, account and connectivity | the account row matches who you meant to sign in as | the wrong account: `/login` to switch | [Commands](https://code.claude.com/docs/en/commands) |
| `/config` | opens Settings; `/config key=value` sets one key, as in `/config theme=dark` | the panel shows the setting you changed | a setting that needs confirming can't be set this way | [Commands](https://code.claude.com/docs/en/commands) |
| Typing while Claude works | queues the message instead of interrupting the turn | the queued line shows above the input | `Ctrl+Enter` sends what you queued now, and `Up` takes it back | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#queue-messages-while-claude-works) |
| `\` then `Enter` | adds a line to your message without sending it | the cursor moves down inside the input | `Shift+Enter` does the same in iTerm2, WezTerm, Ghostty, Kitty, Warp and Windows Terminal 1.25 or later, and `Ctrl+J` in any terminal | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#multiline-input) |
| Prompt suggestions | a grey example prompt in the input; `Tab` or `Right arrow` places it, then `Enter` sends it | typing dismisses it | each suggestion is a short background request that counts towards your usage | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#prompt-suggestions) |
| A usage limit mid-task | Claude Code waits in the open session and carries on by itself once the limit resets | the lines at the bottom say when it resets and when it will continue | `Esc` at an empty prompt, or `Ctrl+C`, cancels the wait | [Interactive mode](https://code.claude.com/docs/en/interactive-mode#wait-for-a-usage-limit-to-reset) |
| `@` and a path | includes that file in your message | the file appears as attached | over the read limit, it isn't included whole | [Common workflows](https://code.claude.com/docs/en/common-workflows) |
| `Esc` | stops the current answer or tool call; the work so far is kept | Claude waits for your next message | none | [Interactive mode](https://code.claude.com/docs/en/interactive-mode) |
| `/exit` | ends the session; `claude -c` resumes the latest one in this folder | you're back at the shell prompt | none | [Sessions](https://code.claude.com/docs/en/sessions) |

In this practice terminal `/help` and the `/` list hold the commands the course has taught so far, prompt suggestions are not shown, and a message you type while Claude works is listed above the input but not answered. On your own computer all three work as the table says.

The habit, ask for the source and open it, is the same everywhere. In the Desktop app's Code tab and the VS Code extension, citations are clickable and there's no shell prompt to confuse with the conversation. In Claude on the web or in the Claude apps without Claude Code, you attach the documents yourself and Claude can't open files you didn't give it, so ask it to quote the passage rather than give a line number.
