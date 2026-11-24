---
lesson: b-capstone
stamp: "Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session"
badge: Beginner
---

## intro
- minutes: "30 to 45 minutes"
- why: "Maya at the library needs the March attendee guide by Thursday. She'll post it and print 20 copies, so whatever it says, people will act on."
- can: "brief Claude with the sources ranked and the reader's questions"
- can: "catch a wrong fact that a good brief didn't prevent"
- can: "leave an unconfirmed detail visibly open"
- can: "hand over a result with the evidence that it's ready"
- payoff: "hand over a result with the evidence that it's ready"
- read: "[Best practices](https://code.claude.com/docs/en/best-practices): a fresh session to review work, without the context that wrote it."

## steps

### T1 | The task step 1 of 6 | Brief Claude for the draft
- tier: challenge
- skill: ask
- where: terminal
- beat: do
- verify: self
- goal: "Read Maya's request in `fixit/march/BRIEF.md`, then start Claude in this folder"
- note: "The decisions are yours: which source wins when they disagree, how to state capacity, how to describe access, whose number goes on a public page, and when the guide is ready."
- note: "The booking is a signed scan, `fixit/march/booking-confirmation-march.pdf`. Claude reads it; you can open it in the files tab, and its text version sits beside it."
- beat: do
- where: claude
- verify: self
- goal: "Ask Claude for a draft of `fixit/march/attendee-guide.md` for Maya"
- hint: "When the booking, the meeting notes and the flyer disagree, which one should Claude believe?"

### T2 | The task step 2 of 6 | Check the draft against the sources
- tier: challenge
- skill: ask
- where: claude
- beat: do
- verify: self
- goal: "Get every claim in the draft checked against the booking, the meeting notes and the standing notes, with the sources ranked and the lines cited. Don't ask for changes yet."
- hint: "Then open the cited lines yourself, the booking's included: read each one to the end of the sentence."

### T3 | The task step 3 of 6 | Correct the guide
- tier: challenge
- skill: ask
- where: editor
- beat: ask
- ask: How will the guide state capacity?
- option: 30 places, the meeting's cap
- option: Places are limited, please book, with no number
- option: 40 places, as the signed booking says
- beat: do
- when: T3.0=40 places, as the signed booking says
- verify: self
- goal: "Before you write 40: read the booking's occupancy line to the end of the sentence, then line 11 of the meeting notes."
- beat: do
- verify: check 0 1 2 3 4 5 7
- goal: "Make `fixit/march/attendee-guide.md` right: every fact from the source that wins, in your own words"
- hint: "Go through Maya's five questions one at a time, and find the line that answers each."
- watching: fixit/march/attendee-guide.md
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### T4 | The task step 4 of 6 | A request from Priya
- tier: challenge
- skill: ask
- where: editor
- beat: do
- verify: self
- goal: "Priya messaged the volunteers' group last night: read `fixit/march/priya-message.md`."
- beat: ask
- ask: Do you add Priya's number to the access line?
- option: No, keep 555-0100, and tell Priya the desk will pass access questions to her
- option: Yes, it's her number and she offered
- option: Only in the online version
- beat: do
- when: T4.1=Yes, it's her number and she offered
- verify: self
- goal: "Before you add it: reread the last line of Maya's brief, and line 23 of the standing notes. Twenty printed copies can't be taken back."
- beat: do
- when: T4.1=Only in the online version
- verify: self
- goal: "Before you add it: online pages get printed, screenshotted and copied into listings, which is how her number reached the flyer."
- beat: do
- verify: check 6
- goal: "Make sure the guide gives no personal number"
- watching: fixit/march/attendee-guide.md

### T5 | The task step 5 of 6 | Write the readiness note
- tier: challenge
- skill: ask
- where: editor
- beat: do
- verify: check 8
- goal: "Write `fixit/march/readiness-note.md` for Maya: each fact with its source, which sources win, what's still open, and how you checked"
- hint: "Could Maya check every fact without asking you?"
- watching: fixit/march/readiness-note.md
- back: T4 Reread the meeting notes for what isn't settled yet.

### T6 | The task step 6 of 6 | A fresh check
- tier: challenge
- skill: ask
- where: claude
- beat: do
- verify: self
- goal: "Clear the conversation, so the next request starts with nothing from the drafting"
- hint: "`/clear`"
- beat: do
- verify: self
- goal: "Ask the fresh session to check the guide against your readiness note and Maya's brief, and to report without fixing anything"
- note: "In this practice workspace the fresh session's reply is written in advance, so it can only confirm what the Lesson's check reads. With real Claude Code, a fresh session reads your files with no memory of drafting them, and can find what you missed."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: check all
- goal: "Run the Lesson's check"
- beat: self
- self: "Self-check (not tested): the guide fits on half a page, as Maya asked."
- beat: self
- self: "Self-check (not tested): the access line is kind as well as accurate, for a reader who may have been turned away before."
- beat: self
- self: "Self-check (not tested): if Priya confirms the lift on Friday, I know which one line changes."

## ladder

### the sources are as they arrived
- narrow "is missing": Is every source file still in the folder?
- narrow "has changed": Which source did an edit change?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### the guide gives the date, Saturday 13 March
- narrow "which day": Which line of the booking gives the date?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### the guide gives 10:30 to 1pm
- narrow "The guide says": When does the booking let the public in?
- narrow "when the public": When does the booking let the public in?
- narrow "when the session ends": When does the session end?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### the guide offers no more places than the meeting agreed, and asks people to book
- narrow "flyer": Which source is about March?
- narrow "to the end of the sentence": Who counts toward the booking's 40?
- narrow "caps March sign-ups": What did the meeting decide about sign-ups?
- narrow "books on the library": How does the public book?
- narrow "No line tells": How does the public book?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### the guide answers how to reach Room B, without promising step-free access
- narrow "doesn't say how": What does Maya say people ask about most?
- narrow "The guide says": Who has to confirm the lift, and have they?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### the guide names what you can't bring, this month's new rule included
- narrow "The guide says": What does the group not accept?
- narrow "can't take": Which items do the standing notes list?
- narrow "new this month": What changed in March?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### no personal number is on the guide
- narrow "gives": Whose number is it, and where may it appear?
- back: T3 Reread Maya's brief to the last line.

### the guide gives the library's public number
- narrow "no number": Which number does the front desk answer?
- back: T2 Reread the cited lines, the booking's occupancy line to the end of the sentence.

### `fixit/march/readiness-note.md` shows where each fact comes from and what is still open
- narrow "There's no": Where should the readiness note be saved?
- narrow "names a source for": Which file does each fact come from?
- narrow "flyer above": Which source is signed, and about March?
- narrow "no section": What isn't settled yet?
- narrow "doesn't mention the lift": What is still to be confirmed?
- back: T4 Reread the meeting notes for what isn't settled yet.

## card
- skill: ask
- show: "/clear"
- does: "Start a new conversation, with nothing from the last one in context"
