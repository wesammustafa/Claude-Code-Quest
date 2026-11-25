---
lesson: i-capstone
stamp: "Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session"
badge: Intermediate
---

## intro
- minutes: "40 to 60 minutes"
- why: "Sam runs April's Fix-It Saturday at Northside Community Centre and will make the attendee guide with your kit, in a fresh session, without you. Forty people will decide from that guide whether to come, where to go in, and whether there's a toilet they can use."
- can: "test a kit the way someone else will use it: a fresh session, their words"
- can: "trace a wrong result back to the part of the kit that caused it"
- can: "fix the kit, not just its output, and prove the fix with probes"
- can: "say honestly what the kit does and doesn't do"
- payoff: "say honestly what the kit does and doesn't do"

## steps

### T1 | The task step 1 of 7 | Run the kit the way Sam will
- tier: challenge
- skill: start
- where: terminal
- beat: do
- verify: self
- done-label: it's started
- goal: "Read Sam's request in `fixit/april/BRIEF.md`. Then start a session the way Sam will: a fresh one, in `fixit/`, where the kit lives."
- note: "The decisions are yours: how to find out whether the kit works for Northside before Sam does, what's wrong with it, which part of the kit to change, whether Sam's own number belongs on a public page, and what `KIT.md` should promise."
- note: "Claude Code asks whether you trust the folder, then whether to use the kit's bookings server. You built both, so say yes, as Sam will."
- hint: "Which session has no memory of you building the kit?"
- hint: "Change into the kit's folder, then start Claude there."
- bottom: "cd fixit"
- bottom: "claude"
- beat: do
- where: claude
- verify: self
- done-label: I read it
- goal: "Ask for the April attendee guide in Sam's words, and help with nothing else. Then read what Claude wrote and what it reports."
- note: "Claude's replies here are written in advance, worked out from what your kit says, and the bookings server is simulated. The guide and the fact table it writes are real files."
- hint: "Use Sam's words from the brief, not yours."
- bottom: "make the attendee guide for april"

### T2 | The task step 2 of 7 | Say what's wrong, and where it comes from
- tier: challenge
- skill: review-diff
- where: editor
- beat: do
- verify: self
- done-label: I compared them
- goal: "Read `april/attendee-guide.md`, `april/facts.md` and Claude's report. Then open Kofi's email, `april/venue-email-northside.md`, and compare it with the guide line by line. Look at every phone number on the guide too: where did each one come from?"
- hint: "What does the guide say about the times, the room and access, and what does Kofi's email say?"
- beat: ask
- ask: The times, the room and access all say *being confirmed*. Why?
- option: The source order trusts only signed bookings
- option: Kofi's email isn't a real confirmation
- option: Claude got it wrong, so ask it again
- beat: do
- when: T2.1=The source order trusts only signed bookings
- verify: self
- done-label: on to the fix
- goal: "So a venue's email can't win, however clear it is. The fault is in the kit: fix it there, and every month with an emailed confirmation works."
- hint: "Which tier of the source order would Kofi's email need to be?"
- beat: do
- when: T2.1=Kofi's email isn't a real confirmation
- verify: self
- goal: "Before you go on: read line 8 of Kofi's email. He says in writing that the email is the confirmation, and he runs the venue."
- hint: "Line 8 of `april/venue-email-northside.md`."
- beat: do
- when: T2.1=Claude got it wrong, so ask it again
- verify: self
- goal: "Before you go on: Claude followed the kit exactly, and asking again gets the same answer from the same rule. Find the line of the kit that puts the signed booking first."
- hint: "Tier 1 of the source order in `fixit/CLAUDE.md`."

### T3 | The task step 3 of 7 | Fix the source order
- tier: challenge
- skill: memory
- where: claude
- beat: do
- verify: self
- done-label: it's changed
- goal: "Change the kit so a venue's written confirmation wins on venue facts, whatever form it takes, while flyers and forwarded listings still never do. Change the skill's step 3 to match. Ask Claude in your own words."
- hint: "Which part of the kit says which source wins, and which step of the skill repeats it?"
- hint: "Describe the kind of source, not this month's venue: the next venue may confirm another way."
- bottom: "In CLAUDE.md, make tier 1 of the source order the venue's written confirmation: a signed booking, or an email from the venue's staff confirming the booking. Change step 3 of the attendee-guide skill to match."
- beat: do
- verify: check 0
- watching: fixit/.claude/skills/attendee-guide/SKILL.md
- goal: "The check reads tier 1 of the source order in `CLAUDE.md`, and the skill's step that applies it: a venue's written confirmation in any form, no one venue named, and flyers still last."
- note: "To word either file your own way, edit it in the files tab, then check again."

### T4 | The task step 4 of 7 | Fix the leak where it starts and where it lands
- tier: challenge
- skill: probe-guard
- where: claude
- beat: do
- verify: self
- done-label: it's changed
- goal: "Make sure no number but a venue's public one can reach a public page, whichever file it came from, and that the guard still blocks if it can't run. Ask Claude in your own words."
- hint: "Which part of the kit is guidance, and which part can't be skipped?"
- hint: "Where did 555-0162 come from, and why didn't the read rule stop it?"
- hint: "What does the guard know about?"
- bottom: "Change the no-private-numbers hook so it blocks every 555-01xx number on a public page except the venues' public numbers, 555-0100 and 555-0130, in any spacing. And in CLAUDE.md, make the contacts rule: only the venue's public number goes on a public page; every other phone number and email address is private, wherever you find it."
- beat: do
- verify: self
- done-label: I tried it
- goal: "Prove it with a probe that must be blocked: ask Claude to add Sam's number to the April guide."
- hint: "Ask for the very edit the guard should stop, as anyone would."
- bottom: "Add a line to the April attendee guide: On the day, ring Sam on 555-0162."
- beat: do
- verify: self
- done-label: it went through
- goal: "And one that must go through: ask Claude to add a line with the centre's public number."
- hint: "The same kind of edit, with the centre's 555-0130."
- bottom: "Add a line to the April attendee guide: On the day, ring the centre office on 555-0130."
- beat: do
- verify: check 1 2
- watching: fixit/.claude/hooks/no-private-numbers.sh
- goal: "The check runs your guard on test edits: Sam's, a volunteer's and a caretaker's numbers blocked on a public page, the venues' public numbers let through, private notes left alone, and a block when it can't read the edit. And the kit still keeps Claude out of `private/` folders."
- note: "To change the guard yourself, edit it in the files tab, then check again."

### T5 | The task step 5 of 7 | Run it again as Sam, fresh
- tier: challenge
- skill: run-skill
- where: claude
- beat: do
- verify: self
- done-label: it's started
- goal: "Start a fresh session, as Sam will."
- note: "`CLAUDE.md` is read when a session starts. A session that was running while you changed the kit started with the old rules."
- hint: "Leave this session, then start Claude again in `fixit/`."
- bottom: "/exit"
- bottom: "claude"
- beat: do
- verify: self
- done-label: I compared them
- goal: "Ask for the April guide in Sam's words again, with no help. Then compare the result with Kofi's email, line by line."
- hint: "The same words as the first time."
- bottom: "make the attendee guide for april"
- beat: do
- verify: check 3 4 fresh
- evidence: fixit/april/attendee-guide.md
- watching: fixit/april/attendee-guide.md
- goal: "The check reads the April guide and its fact table, made again since this step opened: Kofi's facts stated as facts, Sam's 40 places and the e-bike rule, the centre's number alone, and Kofi's email cited for the hours, the room and access."

### T6 | The task step 6 of 7 | Tell Sam the truth about the kit
- tier: challenge
- skill: memory
- where: editor
- beat: do
- verify: check 5
- watching: fixit/KIT.md
- goal: "Update `KIT.md` in the files tab: what the kit does, what it does not do, at least two honest limits, and when it was last tested on a real input."
- hint: "What would Sam need to know before trusting it with May?"
- hint: "A part headed What it does not do, with a line for each limit, and a Last tested part that names the April run."
- beat: do
- verify: check 6
- watching: fixit/april/handoff-note.md
- goal: "Write a short note to Sam in `april/handoff-note.md`: what you changed in the kit and why, and what to look at before sending the guide to Kofi."
- note: "A few lines is enough. Name the parts of the kit you changed: Sam will open them if something looks wrong."
- hint: "Which files did you change, and what would Sam's guide have said if you hadn't?"

### T7 | The task step 7 of 7 | A case you haven't seen
- tier: challenge
- skill: run-skill
- where: claude
- beat: do
- verify: self
- done-label: it's started
- goal: "A month on, Sam's May sources are in `may/`: St Anne's school, where the only confirmation is a text from the caretaker. Nobody has run the kit on them yet. Start a fresh session."
- hint: "Leave this session, then start Claude again in `fixit/`."
- bottom: "/exit"
- bottom: "claude"
- beat: do
- verify: self
- done-label: I read it
- goal: "Ask for the May guide in Sam's words, and read what the kit did with each surprise: the caretaker's text, his own mobile in it, and a public number nobody has used before."
- hint: "Sam's words from the brief, with May's folder."
- bottom: "make the attendee guide for may"
- beat: do
- verify: check 7
- watching: fixit/.claude/hooks/no-private-numbers.sh
- goal: "The check runs your guard on May's guide: the caretaker's 555-0168 must be blocked there too."
- note: "Whether the kit needs another change for May is yours to decide. If your guard blocked the school's public 555-0140, it worked as written: a new venue's public number is one more line of data in the guard or its list."
- hint: "Does your guard watch every month's guide, or only April's?"

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- goal: "Run the Lesson's check"
- beat: self
- self: "Self-check (not tested): each run of the kit was a fresh session, started after your last change to it, and the attendee-guide skill made the guide. Questerm made you start fresh for each run, but the check reads your files, not a record of the sessions."
- beat: self
- self: "Self-check (not tested): Sam's notes say anyone can ring him on the day. His mobile doesn't belong on the noticeboard: public enquiries go to the venue, and your kit now says so and stops it."
- beat: self
- self: "Self-check (not tested): the kit started with three faults. Tier 1 trusted only a signed booking, the contacts rule named only Priya's number, private folders and rosters, and the guard blocked only 555-0187. Your kit handles each now, and KIT.md says what it still doesn't do."

## ladder

### tier 1 of the source order in `fixit/CLAUDE.md`, and the skill's step that applies it, name the venue's written confirmation in any form, not one venue's, with flyers and listings still last
- narrow "There's no": Is `CLAUDE.md` still in `fixit/`?
- narrow "has no tier 1": Which source should win on venue facts?
- narrow "Tier 1 names one venue": Will every venue confirm the way Northside does?
- narrow "lets a flyer": Which sources should never decide times or access?
- narrow "trusts only a signed booking": How did Kofi confirm the booking?
- narrow "but not whose": Who sends a venue's confirmation?
- narrow "no longer names old flyers": Where do old flyers and listings sit in the order?
- narrow "of the skill": Does the skill's step say the same as tier 1?
- hint: "Tier 1 names the kind of source, the venue's written confirmation, and the skill's step says the same."
- bottom: "In CLAUDE.md, make tier 1 of the source order the venue's written confirmation: a signed booking, or an email from the venue's staff confirming the booking. Change step 3 of the attendee-guide skill to match."
- back: T2 Compare the guide with Kofi's email, line by line.

### the number guard blocks Sam's, a volunteer's, a caretaker's and Priya's numbers on a public page, lets the venues' public numbers and private notes through, blocks when it can't read the edit, and is registered on Edit and Write, failing closed, in the shared settings
- narrow "no such file": Is the guard's script still in `.claude/hooks/`?
- narrow "isn't executable": Can Claude Code run the script?
- narrow "isn't valid JSON": Does the settings file still open and close its braces where it should?
- narrow "local settings": Will Sam's sessions have the guard?
- narrow "Edit only": Does the guard run for a whole new file too?
- narrow "hides Sam's notes": What else is in Sam's notes, that the guide needs?
- narrow "Guidance worked this time": Which part of the kit runs whether Claude remembers the rule or not?
- narrow "knows only Priya's number": What does the guard know about?
- narrow "but lets": Which numbers may a public page carry?
- narrow "edited into the guide": Does the guard read an edit's new text?
- narrow "onFailure": What happens if the script can't run?
- narrow "can't read the input": What happens when the guard can't read the edit?
- narrow "also blocks": Which numbers must still go through?
- narrow "a private note": Which pages does the guard watch?
- hint: "Every number but the venues' public ones, on any public page, in any spacing, and a block when it can't check."
- bottom: "Change the no-private-numbers hook so it blocks every 555-01xx number on a public page except the venues' public numbers, 555-0100 and 555-0130, in any spacing."
- back: T2 Find where each number on the guide came from.

### `fixit/.claude/settings.json` still keeps Claude out of every `private/` folder
- narrow "There's no": Is the shared settings file still in `fixit/.claude/`?
- narrow "isn't valid JSON": Does the settings file still open and close its braces where it should?
- narrow "one month's": Will next month's private folder be covered?
- narrow "no longer keep": Which earlier rule did the fix take out?
- hint: "Keep the kit's rule for every month's `private/` folder in the shared settings' deny list."
- bottom: "Put Read(./**/private/**) back in the deny list of the shared settings."
- back: T2 Find where each number on the guide came from.

### `fixit/april/attendee-guide.md` gives Kofi's facts as facts, Sam's 40 places and the e-bike rule, and no number but a venue's public one
- narrow "There's no": Did you run the kit in `fixit/`?
- narrow "still says": Does the kit trust Kofi's email now, and did a fresh session make the guide?
- narrow "The April guide gives": Which numbers may a public page carry?
- narrow "the date": Which line of Kofi's email gives the date?
- narrow "old flyer's time": Which source wins on times?
- narrow "public hours": When can the public come in?
- narrow "Main Hall": Which room did Kofi book?
- narrow "how to get in": What does Kofi's email say about the entrance?
- narrow "toilet": What does Kofi's email say about the toilets?
- narrow "can't read": What can't Claude read, and what's in it?
- narrow "hall's limit": Whose cap is the guide's limit?
- narrow "how many can book": How many people can book?
- narrow "e-bike": What do Sam's notes ask the guide to remind people about?
- narrow "can't have made it": Who made this guide, the kit or you?
- hint: "Let the fixed kit make the guide: a fresh session, Sam's words."
- bottom: "make the attendee guide for april"
- back: T2 Compare the guide with Kofi's email, line by line.

### `fixit/april/facts.md` cites Kofi's email for the hours, the room and access
- narrow "There's no": Did the run write the fact table beside the guide?
- narrow "being confirmed": Did a fresh session make the fact table after your fix?
- narrow "doesn't cite": Which source wins on venue facts?
- hint: "Let the fixed kit make the fact table: a fresh session, Sam's words."
- bottom: "make the attendee guide for april"
- back: T2 Compare the guide with Kofi's email, line by line.

### `fixit/KIT.md` says what the kit does not do, at least two things, and when it was last tested, on April
- narrow "There's no": Is `KIT.md` still in `fixit/`?
- narrow "doesn't say what the kit does not do": What can't the kit do yet?
- narrow "lists": What else can't the kit do?
- narrow "last tested on a real input": When did you last run it on a real input?
- narrow "doesn't name April": Which session did you test it on?
- hint: "A part headed What it does not do, with two or more lines, and a Last tested part that names the April run."
- back: T5 Run the kit again as Sam, and compare.

### `fixit/april/handoff-note.md` tells Sam which part of the kit you changed
- narrow "There's no": Did you save the note as `april/handoff-note.md`?
- narrow "which part": Which files of the kit did you change?
- hint: "Name each part you changed: the source order in CLAUDE.md, the skill, the guard."
- back: T5 Run the kit again as Sam, and compare.

### the number guard blocks the caretaker's 555-0168 on `may/attendee-guide.md` too
- narrow "No guard": Does the guard block every number but the venues' public ones?
- narrow "not on `may/": Which months' guides does the guard watch?
- hint: "The guard watches every month's `attendee-guide.md`, not only April's."
- back: T4 Probe the guard: Sam's number must be blocked.

## card
- skill: probe-guard
- show: "Add a line to the April attendee guide: On the day, ring Sam on 555-0162."
- does: "A probe: the edit your guard must block, asked for as anyone would. Pair it with one it must let through."
