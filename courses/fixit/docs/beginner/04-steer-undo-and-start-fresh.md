# Steer, undo and start fresh

<sub>**Beginner** · Lesson 4 of 6 · about 20 minutes · Needs: [lesson 1](01-start-and-check.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can stop Claude when it heads the wrong way, rewind to before a bad turn and get your files back, choose between compacting a conversation, clearing it and resuming it, and know what to check again when you pick work back up.

## The job

> **Maya:** Lovely guide. One problem: our print template has a big header, so it has to fit on one printed page. Can you shorten it?

The guide is `fixit/feb/attendee-guide.md`, the corrected February guide, in eleven sections. Its sources are beside it: the library's booking email `fixit/feb/venue-email-feb.md` and the January meeting notes.

## You need

- In Questerm: nothing. Claude's replies are written in advance, and nothing leaves your browser. The turn Claude takes on its own, the overnight email and Claude's replies are written for this lesson. The rewind, its choices and its limit behave as in real Claude Code.
- On your own computer: Claude Code, installed as in [lesson 1](01-start-and-check.md).

## The idea

The fastest way to break a correct guide is a quick edit nobody rereads. Getting back to the last good version should take seconds, not memory.

Press `Esc` the moment Claude heads somewhere you didn't ask it to go. It stops at once and keeps what it has already done. Claude Code keeps a checkpoint before each of your messages. Rewind puts back the files Claude edited, and the conversation, exactly. Edits are checkpointed; files that only a command touched aren't.

Claude remembers yesterday's conversation, not today's folder: it knows which files changed only if it looks.

## Worked example

1. **A reasonable request, and a turn you didn't ask for.** Start Claude in the `project/` folder:

   ```bash
   claude
   ```

   If Claude Code asks whether you trust this folder, accept it: this is your own practice copy, as in Lesson 1. Send Maya's request: `shorten fixit/feb/attendee-guide.md so it fits on one printed page`. Watch the activity lines. When Claude starts on `fixit/feb/venue-email-feb.md`, press `Esc`. The library's email is a source, not part of the job. If you didn't press `Esc` in time, Claude finishes the turn. Nothing is lost: the next step works the same. Open `fixit/feb/attendee-guide.md`, then `fixit/feb/venue-email-feb.md`, in the files tab. The guide's What we can't take list is gone, cut for length. The email lost items 5 to 7, the parking line among them, and Dee's sign-off. There's also a new file, `attendee-guide.backup.md`, which Claude made with a command.
2. **Predict, then rewind.** First decide: Claude shortened the guide, and on the way it cut lines from the library's email, one of your sources. What's the fastest safe way back? Asking Claude to put the email back doesn't work well: Claude would rebuild it from memory, and the original is what it just changed: you'd have nothing to check it against. Fixing it yourself from memory is worse: your memory of the email is less reliable than Claude's, and you'd still have nothing to check it against. Claude Code keeps a checkpoint before each of your messages. Rewind puts back the files Claude edited, and the conversation, exactly.

   Then predict: you're about to rewind to before your request. Which files will come back as they were? Rewind restores what Claude changed with its edit tool. The backup copy was made by a command Claude ran, and checkpoints don't track that. The email was edited before you pressed `Esc`, and that edit was checkpointed like any other. Edits are checkpointed; files that only a command touched aren't. You'll see this in a moment.

   With the input empty, press `Esc` twice, or type `/rewind`. Choose your request that starts `shorten fixit/feb/attendee-guide.md`, then choose **Restore code and conversation**. Rewinding is faster than repairing: the files come back exactly as they were, with nothing rebuilt from memory.

   | Choice | What it does |
   |---|---|
   | **Restore code and conversation** | puts both back |
   | **Restore conversation** | keeps the files as they are now and forgets the conversation after that point |
   | **Restore code** | puts the files back and keeps the conversation |
   | **Summarize from here**, **Summarize up to here** | shrink the conversation instead of undoing it |

   Open the files tab: the guide has its eleven sections again, and the email its seven items. `attendee-guide.backup.md` is still there, as you predicted: a command made it, so rewind didn't remove it. Your old request is back in the input, ready to edit.
3. **Ask again, with the boundary.** Your old request is in the input. Add what the first one assumed, then send it: `shorten fixit/feb/attendee-guide.md so it fits on one printed page. Keep every item in the What we can't take list. Only edit that one file.` The second request says what the first one assumed: what must stay, and which file may change. Open `fixit/feb/attendee-guide.md`: shorter, with the whole What we can't take list. You can ask Claude to delete `fixit/feb/attendee-guide.backup.md`, or leave it: the check ignores it.

## Your turn

The evidence changes: time passes, the conversation grows, and a source changes overnight.

1. **Compact or clear?** The conversation is long now, and your next job is the volunteer rota, which has nothing to do with this guide. What do you do? Compacting is for carrying on the same job with less history. The rota needs none of this conversation, and a summary of it would sit in the way. Keeping going in it is worse: old history about the guide crowds out what the rota needs, and it costs more on every message. Unrelated job, clean start: `/clear` starts an empty conversation, and the guide is saved in its file, where it belongs. The old conversation can still be found with `/resume`.

   Compacting is right in the middle of one long job, for example halfway through checking twenty claims: a focus such as `/compact keep the fact table and the source ranking` keeps the summary on what you name.

   The rota can wait until Monday, so don't clear yet. End today's session instead, with `/exit`. Had you cleared, `claude -c` tomorrow would open the new, empty conversation, and you'd find the guide's conversation with `/resume` instead.
2. **The next morning.** It's Friday morning. Start Claude so it carries on yesterday's conversation, not a new one:

   ```bash
   claude -c
   ```

   `-c` is short for continue: the most recent conversation in this folder. The conversation is back, Claude's message about the Station Road car park included. And the folder has changed overnight: there's a new file, `fixit/feb/venue-email-feb-update.md`.
3. **Ask what changed, in your own words.** Ask Claude whether anything in `fixit/feb/` has changed since yesterday that makes the guide wrong, citing the file and line. Claude remembers yesterday's conversation, not today's folder: it knows which files changed only if it looks. For example: `Before we go on: has anything in fixit/feb changed since yesterday that affects the attendee guide? Check the files again, don't rely on what you remember, and cite file and line.` Then open `fixit/feb/venue-email-feb-update.md` and read line 6: Claude's answer comes from there. This time Claude is right, because it looked.
4. **Fix the parking line.** Ask Claude to update the parking line in `fixit/feb/attendee-guide.md`, or skip the step and fix the line yourself in the files tab. You decide how much to say: the update also says Park Lane is free on Saturdays and eight minutes' walk. Stuck? Ask yourself which car park, and why not Station Road.

## Check

The Lesson's check reads four things:

- `fixit/feb/venue-email-feb.md` is the email the library sent
- the guide still says what we can't take, and fits on one printed page
- the guide sends people to park on Park Lane, not Station Road
- the guide is shorter than the one you started with

It reads the files, not a record of your rewind: Questerm doesn't record rewinds for a check to read, so whether you rewound shows only in the files.

What only you can judge: the short guide still has everything an attendee needs. Which section would you miss most if it were cut?

## On your own computer

In Questerm, the turn Claude takes on its own, the overnight email and Claude's replies are written in advance. The rewind, its choices and its limit behave as in real Claude Code.

1. `Esc` stops Claude mid-turn. `Esc` twice on an empty input, or `/rewind` (also `/undo`), opens the rewind list.
2. Checkpoints are made before each of your messages. Claude Code keeps the 100 most recent, and they persist when you resume a session.
3. `/compact` takes an optional focus: `/compact keep the fact table`. `/clear` starts an empty conversation; the old one stays available through `/resume`.
4. `claude -c` resumes the most recent session in the current folder; `claude -r` shows a list to choose from.
5. **Checkpoints are not backups.** They don't track files changed only by commands, most edits made by subagents, edits made outside Claude Code, or anything sent to another system. Keep real backups, or version control, for anything that matters.

## Technical detail

| Command | What it does | How to check | Watch out for | Reference |
|---|---|---|---|---|
| `Esc` | stops the current answer or tool call; work so far is kept | the activity stops and the input is free | changes already made stay made: rewind to undo them | [Interactive mode](https://code.claude.com/docs/en/interactive-mode) |
| `/rewind` (`Esc` `Esc`) | restore code and conversation, the conversation only, the code only, or summarize from or up to a point | open the files; on a conversation restore the old request returns to the input | a file only a command changed isn't tracked; most subagent edits aren't restored; edits made outside Claude Code aren't tracked | [Checkpointing](https://code.claude.com/docs/en/checkpointing) |
| `/compact [focus]` | replaces the history with a summary, keeping what you name | `/context` shows less used | rules stated only in chat can be summarized away; project memory and up to five recent files survive | [Context window](https://code.claude.com/docs/en/context-window#what-survives-compaction) |
| `/clear` | starts an empty conversation | the conversation is empty | none: the old one can be resumed with `/resume` | [Commands](https://code.claude.com/docs/en/commands) |
| `claude -c`, `claude -r`, `/resume` | resumes the latest, or a chosen, session | the earlier messages are back | background commands aren't restored; launch flags must be passed again | [Sessions](https://code.claude.com/docs/en/sessions) |

In the VS Code extension and the Desktop app, sessions are kept in a history list or sidebar, and rewind works in local sessions. In Claude chat there's no checkpoint of your files, because Claude doesn't edit them there. The habits carry over: start a new chat for an unrelated job, and after two failed corrections, start fresh with a better request, as Anthropic's best practices recommend in Claude Code too.
