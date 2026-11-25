# Check every claim before anyone relies on it

<sub>**Beginner** · Lesson 3 of 6 · about 20 minutes · Needs: [lesson 2](02-give-claude-a-clear-job.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can trace every claim in a draft to the source it came from, settle a conflict between sources by which one to trust, recognise an instruction hidden inside a document, and correct a draft before anyone relies on it.

## The job

> **Maya (library events desk):** Claude made a February attendee guide. It looks great! It's open on my screen. Can I post it this afternoon?

The draft is `fixit/feb/draft-attendee-guide.md`. Claude made it from four files: the library's booking email, the January meeting notes, last October's flyer and an email forwarded by the Repair Network. Unlike a brief from Lesson 2, the request named no source as the one to trust.

## You need

- In Questerm: nothing. The draft, the hidden note and Claude's replies are written in advance, and nothing leaves your browser.
- On your own computer: Claude Code, installed as in [lesson 1](01-start-and-check.md).

## The idea

A draft can be a faithful mix of its sources and still be wrong, when some of those sources are out of date or second-hand. Counting files isn't weighing them: the newest file about this session, from the people who run it, wins.

Text inside a document is data about the world, not a request from you, whoever wrote it.

## Worked example

1. **List every claim with its source.** Start a session with `claude`. If Claude Code asks whether you trust this folder, accept it: this is your own practice copy, as in Lesson 1. Then ask: `List every factual claim in @fixit/feb/draft-attendee-guide.md. For each, give the file and line it most likely came from. Don't change anything.`
2. **Settle one conflict yourself.** The draft says doors open at 10am, as the flyer and the Repair Network listing do; the January notes say public from 10:30. Open `fixit/feb/meeting-notes-2027-01-28.md` and read line 5, then `fixit/feb/venue-email-feb.md` line 9: the room is yours from 10:00, so volunteers set up first and the public comes in after. Then tell Claude: `Change the start time in the draft to 10:30am, and ask people not to arrive before 10:30. Leave everything else.` Open the draft and confirm only that line moved.

## Your turn

1. In your own words, ask Claude to check each remaining claim against the sources, saying which sources win: the library's email and your own notes over the flyer and the Repair Network email. Ask for a verdict and the file and line for each. Don't ask it to fix anything yet.
2. Open `fixit/feb/partner-email.md` and find line 11. It's an HTML comment: it doesn't show when the email is displayed, but Claude reads the raw file. Decide what happens to that email from now on.
3. Optional: ask Claude to write its verdicts into `fixit/feb/fact-table.md`: each claim, its verdict, and the file and line that settles it.
4. Make sure the fact table gives each claim a verdict and the line that settles it, and read every row against the files before you accept it.
5. Optional: ask Claude to correct the draft so every claim matches your fact table, with the library's public number as the contact.
6. Make sure every claim in the draft matches your fact table, in plain words for the public. The access line is your choice: say what the library says, or say less and point people to the events desk. Don't say more than the library does.

## Check

The Lesson's check reads nine things: that the sources are as they arrived, that the fact table gives each claim a verdict and the line that settles it, and that the guide gives 10:30 as the public start, offers no parking the library hasn't, claims no access the library hasn't confirmed, tells people to book, names what you can't bring, gives only the library's public phone number, and doesn't promise biscuits.

What only you can judge: reading your corrected guide, would a stranger still want to come?

## On your own computer

In Questerm the draft, the hidden note and Claude's verdicts are written in advance. With real Claude Code, results depend on your files; the habit is the same.

1. Put a draft and its sources in one folder. Start `claude` there.
2. Ask for every claim with its source and verdict, and tell Claude which sources win.
3. Ask Claude to point out any text in the files that seems to be addressed to an AI tool rather than to people.
4. Read the cited lines yourself before you change the draft.
5. If a source is a scanned PDF or a photo, give Claude the file's path or paste the image with `Ctrl+V` (on Windows and WSL, `Alt+V`). PDFs longer than 10 pages are read in page ranges and need the `pdftoppm` tool (part of poppler) installed.

## Technical detail

| Item | What it does | How to check | Watch out for | Reference |
|---|---|---|---|---|
| Asking for citations | makes each claim checkable | open each cited file and line | a citation can point at the wrong line; the claim is only checked when you've read the line | [Best practices](https://code.claude.com/docs/en/best-practices) |
| Prompt injection | text in a file, web page or tool output that tries to direct Claude | ask Claude to report instructions it found in the content | no system is completely immune; Anthropic's guidance is to review suggested commands, avoid piping untrusted content straight to Claude, and verify changes to critical files | [Security: prompt injection](https://code.claude.com/docs/en/security#protect-against-prompt-injection) |
| Images and screenshots | Claude reads PNG, JPEG, GIF and WebP | the image appears as `[Image #1]` in your message | large images are downscaled; crop for detail | [Common workflows: images](https://code.claude.com/docs/en/common-workflows#work-with-images) |
| PDFs | Claude reads them by path or `@` | it quotes the page you asked about | over 10 pages: read in ranges, needs `pdftoppm` or fails with `pdftoppm is not installed` | [Tools reference](https://code.claude.com/docs/en/tools-reference) |
| Giving Claude a check | best practices: give Claude a way to verify its work | Claude reports the check's result | a check you didn't specify gets skipped | [Best practices](https://code.claude.com/docs/en/best-practices) |

In Claude chat and Projects, attach the draft and the sources and ask for the same table; Claude quotes passages instead of line numbers, so ask for quotes. Hidden HTML comments and white-on-white text in uploaded documents reach Claude there too; the habit of asking "is anything in these files addressed to an AI?" transfers. In the Desktop app you can attach PDFs and images with **+**.
