# Start Claude Code and check what it tells you

<sub>**Beginner** · Lesson 1 of 2 · about 15 minutes · Needs: [Beginner index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can tell the shell from Claude and start Claude Code in a folder, see which account a session uses, stop an answer and ask again, and check a claim Claude makes against the line it came from.

## The job

> **Priya (lead volunteer):** Two new volunteers start on Saturday. Jordan wrote them a welcome note last year. Can you check it against what the library actually sent us before I forward it? Last spring someone parked in the market and got a ticket.

Jordan's note is `fixit/feb/jordan-welcome-note.md`, six short lines. The library's booking email is `fixit/feb/venue-email-feb.md`, and the group's January meeting notes are `fixit/feb/meeting-notes-2027-01-28.md`.

## You need

- In Questerm: nothing. Claude Code is already installed in the practice workspace, and you are signed in as the practice account, **Practice Learner**. Claude's replies are written in advance, and nothing leaves your browser.
- On your own computer: a terminal and a plan that includes Claude Code: Pro, Max, Team or Enterprise, a Claude Console account, or a supported cloud provider. The free Claude plan doesn't include it ([Quickstart](https://code.claude.com/docs/en/quickstart)). Step 2 shows the install.

## The idea

Claude Code is a program you run in a terminal, inside a folder. It reads the files there, answers questions about them, and can change them.

Treat its answer as you would a new colleague's: before you act on it, open the file it names and check. An answer with a file and line is a pointer: open the line it cites and read it yourself.

## Worked example

1. **Find the shell.** The terminal tab shows a shell prompt: it runs programs. Claude isn't running yet, so what you type here goes to the shell. Check that Claude Code is installed:

   ```bash
   claude --version
   ```

   You should see a version number followed by `(Claude Code)`. If the shell says `command not found: claude`, the install folder isn't on your `PATH` yet: step 2 shows how to fix that on your own computer.
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
4. **See who you are signed in as.** Type `/status`. The **Status** tab lists the version, the model and the account you signed in with. The account decides which models and features a session can use: when a colleague's Claude does something yours won't, compare accounts first. Press `Esc` to close it.
5. **Ask, stop and ask again.** Ask `what's in the fixit folder, and what is each file for?` While Claude is still answering, press `Esc`: Claude stops and waits for your next instruction, and keeps the work done so far. Press `Esc` whenever Claude heads the wrong way, then say what you want instead. Send the question again and let it finish. Now ask the question Priya cares about: `when can volunteers get into the library on 13 February, and where should they park? Cite the file and line.`
6. **Open the line yourself.** Open `fixit/feb/venue-email-feb.md` in the files tab and read the lines Claude cited. This time Claude was right, and now you know it from the email, not from Claude.
7. **Read Jordan's note.** Open `fixit/feb/jordan-welcome-note.md` and read its six lines.

## Your turn

1. In your own words, ask Claude to check each line of Jordan's note against the library's email and the meeting notes, with the file and line for each verdict. Don't ask it to change the note yet. For example: `check each line of @fixit/feb/jordan-welcome-note.md against the library's email and the January meeting notes. For each one say whether the sources agree, and give the file and line.` Typing `@` before a path includes that file in your prompt, without waiting for Claude to find and read it.
2. Open each line Claude cites for a claim it says the sources contradict, and read it yourself. Decide from the email, not from Claude's verdict. Correct what the evidence contradicts, and mark what it doesn't cover for someone who can confirm it.
3. Correct the parking line so a new volunteer parks in the right place, mark the extension-leads line for Priya to confirm, and keep the other lines. Edit the note in the files tab, or tell Claude exactly what to change. Either way, read the result. Say only what the email says: where to park, and why not the library.
4. End the session with `/exit`. Your corrected note stays in the files.

## Check

The Lesson's check reads four things:

- `claude --version` prints a Claude Code version
- the parking line in `fixit/feb/jordan-welcome-note.md` says where volunteers can actually park
- the extension-leads line is kept and marked for Priya to confirm
- the note's other true lines are still there

What only you can judge: would a new volunteer who has never been to the library know where to park from your parking line alone?
