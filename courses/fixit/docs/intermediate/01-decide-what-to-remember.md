# Decide what Claude should remember

<sub>**Intermediate** · Lesson 1 of 5 · about 25 minutes · Needs: [Intermediate index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can decide which instructions belong in project memory and which don't, keep project memory short and true, load a rule only where it matters, check what a session actually loaded, and prove that a fresh session follows memory without being told.

## The job

> **Sam (second organizer):** From May I'll make the Northside guides myself. When I tried with Claude last week it didn't know any of the things you'd worked out: that the booking beats the flyer, the lift business, that Priya's number never goes on anything. Can you get Claude to remember the important stuff, so I don't have to explain it every time?

You can see what Claude remembers today: nothing in `fixit/CLAUDE.md`, because there isn't one, and three lines in its own auto memory.

This lesson starts from the course's March guide, `fixit/march/attendee-guide.md`, as Maya posted it. Your own version stays with the Beginner capstone.

## You need

- In Questerm: nothing. Claude's replies are written in advance, so the model and effort a session shows don't change them, and nothing leaves your browser.
- On your own computer: Claude Code, and a folder of your own to try it in. Memory files are plain text, so any editor opens them.

## The idea

Memory is read by every session, including Sam's. A true rule there saves Sam explaining it. A stale fact there misleads Sam every month, silently.

Rules that hold every month go in memory. Facts that change come from the sources. Private details stay out entirely.

For each line, ask: does this hold every month, and can Claude not find it by looking?

## Worked example

1. **Start Claude where the project lives.** First, a question: three lines are candidates for the memory that every session in `fixit/` reads. "Room B holds 40 people, including volunteers." "When sources disagree, the venue's written confirmation beats our notes, and our notes beat old flyers." "Priya's number is 555-0187." Which belong there?

   Only the second. The first is true for Room B, but Sam runs sessions in Northside's Main Hall, and the library sometimes moves us to Room A. A session that remembers 40 will use it where it's wrong. The third is true and private: memory a session reads is memory it can repeat. Facts that change by month or venue belong in that month's sources, where Claude reads the current version. Memory is for what holds every month.

   From now on the project is `fixit/`, not the whole practice copy, because that's where the Fixers' material and memory live:

   ```bash
   cd fixit
   claude
   ```

   Claude Code shows the trust dialog for this folder. Trust it: it's part of your practice copy.
2. **See what Claude already remembers.** Type `/memory`. It lists the memory files this session loaded, and the ones it would read once they exist. There's no project memory yet, `./CLAUDE.md`, and no user memory either. Auto memory is on, with one file, `MEMORY.md`, that Claude saved in earlier sessions. Ask: `Show me your auto memory, one line at a time.`

   Auto memory is notes Claude decides to save, from corrections and things you told it. It loads in every session in this project. It's useful for your own preferences, and risky for facts that change, because nobody reviews it.

   The first line, about Room B, is the trap from the question you just answered. Keep the second, a preference. The third is true, but it belongs in the venue's sources, and it's wrong for Northside, whose number is 555-0130. Ask: `Delete the Room B line and the events desk line from your auto memory. Keep the line about short answers.`
3. **Let Claude draft the project memory, then cut it.** Type `/init`. It reads the folder and drafts a `CLAUDE.md`: a starting point to cut, not a file to keep as it is. Open `fixit/CLAUDE.md` in the files tab and read each line: does this hold every month, and can Claude not find it by looking?

   | Line | Keep? | Why |
   |---|---|---|
   | The tour of the folders | Cut | Claude can see the folders. Every line in memory costs attention in every session. |
   | Room B, 40 people | Cut | An event fact, wrong for Northside and for Room A. |
   | Public hours 10:30 to 13:00 | Cut | An event fact. Northside opens at 10:00. |
   | Priya on 555-0187 | Cut, and replace | Private. Replace it with a rule: never put a private number on a public page; public enquiries go to the venue's public number. |
   | Which source wins | Keep | It holds every month. |
   | Unconfirmed details | Keep | The March decision, now a rule. |
   | Plain English, 10:30am | Keep | House style. |

   Then tell Claude: `Save CLAUDE.md with only the source order, the rule for unconfirmed details, a rule that private numbers (Priya's, or anything from a private/ folder or roster) never go on public pages and public enquiries go to the venue's number, and the house style. No folder tour and no event facts.` Open `fixit/CLAUDE.md` again: about 20 lines, each one true every month.
4. **Prove a fresh session follows it.** Claude Code reads `CLAUDE.md` when a session starts, so test it in a new one. Type `/exit`, then `claude` again. Ask, without mentioning any rule: `write a two-line access note for the March guide in march/access-note.md`

   The prompt said nothing about unconfirmed details or which number to use. The session got both from memory. That's the proof Sam needs. In this practice workspace, Claude takes this request only in a session that started after you saved `CLAUDE.md`, and the Lesson's check reads the note itself.

## Your turn

Sam has four more notes they want Claude to just know.

1. **Load a rule only where it matters.** Sam's first note is a checklist for every public page: answer when and where, booking, what to bring, what we can't take, how to get in, and end with the venue's number. That matters only when Claude writes a public page. In `CLAUDE.md` it would load for the volunteer rota too. In your own words, ask Claude to put Sam's checklist in a rule file under `.claude/rules/` that loads only for public pages: the month's `attendee-guide.md`, and anything under `public/`.
2. **Sort the other three notes.** "Write times as 10:30am, not 10.30" is already in `CLAUDE.md`. Where should "I like answers as bullet points" go? A personal preference goes where only that person's sessions read it. `CLAUDE.local.md` stays out of the shared files. `CLAUDE.md` is shared: you'd get Sam's preference too, and so would every future organizer. The public-pages rule is about what public pages say, not how Claude talks to Sam. Sam's note that Northside's car park is free on Saturdays goes nowhere in memory: it's a Northside fact, true this month, and it belongs in that month's sources, where Claude will read it.
3. **Check what a session loads.** Show that the rule loads when Claude works on a public page, and not before. Start a fresh session and run `/memory`: it lists `CLAUDE.md`, but not your rule. Ask Claude to check `march/attendee-guide.md` against the public-page checklist: name the page, and the checklist to check it against. Run `/memory` again: the rule is now loaded, because Claude read a matching file. If the rule never appears, compare its `paths:` with the real file names in `fixit/`, fix the pattern in the files tab, and start a new session.

## Check

The Lesson's check reads five things:

- `fixit/CLAUDE.md` is short and gives the rules that hold every month: which source wins, how to publish an unconfirmed detail, and whose number goes on a public page
- `fixit/CLAUDE.md` holds no event facts: no dates, hours, room limits, personal numbers or folder tour
- Claude's auto memory gives no room limit
- a rule in `fixit/.claude/rules/` loads only for the files it covers, and every scoped rule matches a file in `fixit/`
- `fixit/march/access-note.md` says step-free access is being confirmed, and gives only the library's public number

What only you can judge: could Sam read `CLAUDE.md` in a minute and know why each line is there?

The check reads the access note, not when its session began: that the note came from a session that started after `CLAUDE.md` last changed is yours to say.

## On your own computer

The same steps work with real Claude Code. In your project folder, run `claude`, then `/init`, and read the draft before you keep it.

| File | Who reads it | Shared? |
|---|---|---|
| `./CLAUDE.md`, or `./.claude/CLAUDE.md` | every session in this project | yes: commit it or share the folder |
| `./CLAUDE.local.md` | your sessions in this project | no: keep it out of shared files |
| `~/.claude/CLAUDE.md` | all your sessions, everywhere | no |
| `./.claude/rules/*.md` with `paths:` | sessions that touch matching files | yes |
| Auto memory, `~/.claude/projects/<project>/memory/MEMORY.md` | your sessions in this project | no: Claude writes it |

`/memory` shows what loaded, opens each file in your editor, opens the auto memory folder, and turns auto memory on or off. If your project already has an `AGENTS.md` for other tools, Claude Code reads it when there's no `CLAUDE.md`; once you add one, put a line in it that imports the other: `@AGENTS.md`. See [How Claude remembers your project](https://code.claude.com/docs/en/memory).

## Technical detail

| Item | What it does | How to verify | Failure case |
|---|---|---|---|
| `CLAUDE.md` | loads at session start as context, not enforced configuration | `/memory` lists it | a long file dilutes attention; the docs advise staying under 200 lines ([Best practices](https://code.claude.com/docs/en/best-practices)) |
| `.claude/rules/` with `paths:` | loads only when Claude reads, writes or edits a matching file; each pattern is read from the folder that holds the rule's `.claude/` | `/memory` before and after reading a match | a pattern that matches nothing never loads; `/compact` summarizes path rules away until they match again ([Memory: path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)) |
| Auto memory | Claude saves notes it thinks you'll want; the first 200 lines or 25 KB of `MEMORY.md` load at session start | `/memory` shows it and its switch | a stale fact stays until someone deletes it ([Memory: auto memory](https://code.claude.com/docs/en/memory#auto-memory)) |
| `InstructionsLoaded` hook | logs each memory file as it loads, with the reason | the log line appears when Claude reads a match | optional depth: the hooks lab takes it further ([Hooks](https://code.claude.com/docs/en/hooks)) |

Memory is guidance, not a guarantee. A rule in `CLAUDE.md` makes the right behaviour likely; it doesn't make the wrong one impossible. A later lesson adds the guard that makes "never put a private number on a public page" hold even when guidance is missed.

In claude.ai, a Project's instructions play the role of `CLAUDE.md` for every chat in that Project. The habit transfers: rules yes, monthly facts no, private details never.
