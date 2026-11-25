---
lesson: a-capstone
stamp: "Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session"
badge: Advanced
---

## intro
- minutes: "60 to 90 minutes"
- why: "At noon Maya publishes whatever is in the summer pages folder, and at 14:00 Priya's reminder goes to 70 people. The overnight run says success, and nobody else will check before then."
- can: "stop a workflow's output being used before you've checked it"
- can: "reconcile what a run and its reviewers tell you, by what each read and the newest evidence"
- can: "recover a partial run inside its bounds"
- can: "make the release call yourself, with the evidence for each page and the email"
- payoff: "make the release call yourself, with the evidence for each page and the email"

## steps

### T1 | The task step 1 of 7 | Stop the output being used
- tier: challenge
- skill: stop-run
- where: editor
- beat: ask
- ask: It's 07:00 on Friday 11 June. The overnight run says success, Maya publishes at 12:00 and Priya's email goes at 14:00. What's your first move?
- option: Tell Maya to hold until you've checked, then read what the run was refused
- option: Read the pages and fix what's wrong
- option: Rerun the overnight job now with today's sources
- beat: do
- when: T1.0=Read the pages and fix what's wrong
- verify: self
- goal: "Partly. You will, but Maya may start layout from what's there now. Stop the pages being used first, then read them."
- hint: "Who will use the pages before you've finished checking them?"
- beat: do
- when: T1.0=Rerun the overnight job now with today's sources
- verify: self
- goal: "Not yet. You don't know why last night's run fell short, and running the same thing again can fall short the same way."
- hint: "What would you need to know before a rerun could do better?"
- beat: do
- verify: self
- done-label: I told Maya to hold
- goal: "Tell Maya to hold the summer pages until you've checked them. Her plan for today is in `fixit/summer/BRIEF.md`."
- hint: "Who is about to use the pages, and what one line would stop her for now?"
- hint: "Maya needs to know what to wait for, and until when."
- hint: "The exact message: Please hold the summer pages. The overnight run hit a problem, and I'll tell you by 11:30 what's good."
- note: "Maya replies at 07:12: "OK, holding. Tell me by 11:30 what goes up.""

### T2 | The task step 2 of 7 | Diagnose the overnight run
- tier: challenge
- skill: watch-run
- where: editor
- beat: do
- verify: self
- done-label: I read the run's result
- goal: "Find out what the overnight run was refused. Its result and the runner's report are in `fixit/summer/run/`."
- hint: "Is there anything in the run's JSON besides `subtype`?"
- hint: "Open `fixit/summer/run/overnight-2027-06-11.json` in the files tab."
- hint: "Read its `permission_denials`: what was refused, and which file?"
- beat: do
- where: terminal
- verify: self
- goal: "Start Claude in the kit folder, `fixit/`."
- hint: "Which folder holds the kit's rules, so Claude starts with them?"
- hint: "In the terminal, go into `fixit/` first, then start Claude."
- hint: "Type `cd fixit`, then `claude`, and accept the folder trust dialog: it's your practice copy of the kit."
- beat: do
- where: claude
- verify: self
- goal: "Ask Claude which pages the refusal left wrong, and why the run was refused. Compare each page with the newest source for it, and change nothing yet."
- hint: "Did the run's report compare any page with the newest venue word?"
- hint: "Compare each page with `late-email-2027-06-10.md`, quoting lines."
- hint: "The exact request: The overnight run was denied an edit to summer/public/july.md. Compare each page in summer/public/ with summer/late-email-2027-06-10.md and say which are wrong, quoting the line, and why the edit was denied, from summer/run/bounds.json. Don't change anything."
- note: "June's places are a question for a person: Room A holds 30 including your team, and no file says how many volunteers come."

### T3 | The task step 3 of 7 | Reconcile the reviews
- tier: challenge
- skill: reconcile
- where: claude
- beat: do
- verify: self
- goal: "At 08:10 three reviews arrived in `fixit/summer/reviews/`, and they disagree. Decide which findings you act on, by what each reviewer read and whether it saw the late email. Don't change any page yet."
- hint: "How will you tell an informed finding from a guess?"
- hint: "Each review has a Read line. Did every reviewer see the newest venue word?"
- hint: "The exact request: For each finding in summer/reviews/, say which files it read and relied on, whether summer/late-email-2027-06-10.md changes it, and quote the lines. Don't edit anything."
- note: "You can run fresh reviews in parallel instead, one subagent each. Then tell each reviewer about the late email, and have it list what it read."

### T4 | The task step 4 of 7 | Priya's 09:30 message
- tier: challenge
- skill: stop-run
- where: editor
- beat: do
- verify: self
- done-label: I read Priya's message
- goal: "It's 09:30. Priya writes: "FYI I scheduled the reminder for 14:00 this morning, with the schedule page pasted in, so I don't forget. It's in the outbox. Off to work, back at 15:00.""
- hint: "What goes out at 14:00 unless someone acts?"
- hint: "The email is `fixit/summer/outbox/reminder-2027-06-11-1400.md`: what does its body say about July?"
- hint: "Open it in the files tab and compare its table with the late email."
- beat: ask
- ask: Priya can't be reached until after the email goes. Before she leaves, what do you ask her?
- option: How many volunteers will be in Room A on Saturday?
- option: Nothing: the outbox is mine to deal with now
- option: Whether she can move the email to Monday
- beat: do
- when: T4.1=How many volunteers will be in Room A on Saturday?
- verify: self
- goal: "Priya, 09:32: "Six of us in Room A." Room A holds 30 people including your team, so June has 24 places."
- hint: "Room A's limit includes your team: how many does that leave?"
- beat: do
- when: T4.1=Nothing: the outbox is mine to deal with now
- verify: self
- goal: "The outbox is yours now, yes. June's places still need a number no file gives: Room A holds 30 including your team. Priya answers your text at 09:40: "Six of us in Room A.""
- hint: "Room A's limit includes your team: how many does that leave?"
- beat: do
- when: T4.1=Whether she can move the email to Monday
- verify: self
- goal: "Priya, 09:31: "Can't, I'm on site all day. Hold it in the outbox if you need to. Six of us in Room A, by the way.""
- hint: "Room A's limit includes your team: how many does that leave?"
- beat: do
- verify: check 5
- goal: "Make sure the 14:00 email can't go out with this morning's schedule. Hold or cancel it, or correct its body, in the files tab."
- hint: "What goes out at 14:00 unless you act?"
- hint: "The outbox file has a `status:` line."
- hint: "The exact change: set `status: held`, and add the line Held by the coordinator at 09:35: see summer/go-no-go.md."
- watching: fixit/summer/outbox/reminder-2027-06-11-1400.md
- back: T2 Reread the late email: what will 70 people read about July at 14:00?

### T5 | The task step 5 of 7 | Recover the run
- tier: challenge
- skill: limit-run
- where: claude
- beat: do
- verify: self
- goal: "Ask Claude to fix the cause of the refusal in `fixit/summer/run/bounds.json`, with as small a change as you can. Keep every deny rule."
- hint: "Why was `july.md` refused?"
- hint: "Change the bounds as little as possible, and keep every deny."
- hint: "The exact request: In summer/run/bounds.json, replace the three Edit lines with one that allows editing any .md page directly in summer/public/, and change nothing else in the file."
- beat: do
- where: shell
- verify: check 0 1 2 3 7
- goal: "Then rerun only what failed, inside the bounds, with the prepared runner `fixit/summer/run/refresh.sh` and a task that names the pages."
- hint: "Which pages did the overnight run leave wrong, and what does each one need? June's places need Priya's number, or no number at all."
- hint: "Name `july.md`, `june.md` and `schedule.md` in the task, and ask the run to change nothing else."
- hint: "The exact command, in the shell tab: fixit/summer/run/refresh.sh "Update july.md's access line and june.md's places line from summer/late-email-2027-06-10.md, with 24 places for June, then rebuild schedule.md from the three pages. Change nothing else.""
- note: "The runner keeps each run's result and report in `fixit/summer/run/last-run/`, and adds the report to `fixit/summer/run/runs.txt`. Open the pages it changed and read them yourself."
- watching: fixit/summer/run/last-run/result.json
- back: T2 Reread what the overnight run was refused, and which pages that left wrong.

### T6 | The task step 6 of 7 | Decide the release
- tier: challenge
- skill: reconcile
- where: editor
- beat: do
- verify: check 6
- goal: "Write `fixit/summer/go-no-go.md` for Maya and Priya, in the files tab. Give a call for each page and for the email, the evidence for each, what you asked and haven't heard back, and what would change your decision."
- note: "June has 28 registrations. Decide what happens to the ones Room A can't take, and who tells them."
- hint: "For each page: what is live now if you hold it?"
- hint: "Who decides what happens to the extra June bookings, and when do they need to know?"
- hint: "A table or a list both work: one row per page and one for the email, each with go, hold or no-go and the line that settles it. Then what you asked and haven't heard back, and what would change your calls."
- watching: fixit/summer/go-no-go.md
- back: T3 Reread which findings you acted on, and the lines that settled them.

### T7 | The task step 7 of 7 | Verify before you hand over
- tier: challenge
- skill: delegate
- where: claude
- beat: do
- verify: self
- goal: "Before 11:30, have one independent check run over the corrected pages and the outbox: a read-only reviewer that lists what it read."
- hint: "Who checks the pages that nobody else will check before noon?"
- hint: "Ask for a read-only subagent: at least a privacy review of every page in `summer/public/` and the outbox, listing the files it read."
- hint: "The exact request: Have a read-only subagent review every page in summer/public/ and the outbox file for private contact details, list the files it read, and save its report in summer/reviews/release-check.md. Don't change anything else."
- beat: do
- where: editor
- verify: check 8
- goal: "Read the reviewer's report in `fixit/summer/reviews/release-check.md`: what it read, and what it found."
- hint: "Does its Read line cover every page that goes up at noon?"
- hint: "If it found a lead, is it one you've already dealt with?"
- watching: fixit/summer/reviews/release-check.md
- back: T5 Reread which pages the rerun changed: those are the pages the reviewer has to read.

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- goal: "Run the Lesson's check"
- note: "The check reads the runner's own record of each run, in `summer/run/last-run/` and `summer/run/runs.txt`, and the reviewer's report Claude saved. In this practice workspace you could write those files by hand, so on a real machine trust the run's own record over a file anyone can edit."
- beat: self
- self: "Self-check (not tested): you told Maya to hold before noon, before she started layout."
- beat: self
- self: "Self-check (not tested): the reviewer ran after your last rerun, on the pages as they go up."
- beat: self
- self: "Self-check (not tested): Priya is back at 15:00. Your note tells her what to send, to whom, and why."
- beat: self
- self: "Self-check (not tested): you can say in one line whether shipping July corrected or holding it back is better for July's readers, and why."

## ladder

### `june.md` gives Room A and says the session moved, with no more places than Room A can take
- narrow "is missing": Is `june.md` still in `fixit/summer/public/`?
- narrow "still gives Room B": Which source is newer, the 19 May booking or the 10 June email?
- narrow "doesn't say Room A": Where does the late email put the June session?
- narrow "more than Room A can take": How many of your team will be in Room A?
- narrow "doesn't say the session has moved": What does someone who booked for Room B need to see?
- back: T2 Reread what the late email says about June.

### `july.md` says Room B isn't step-free on 10 July, or holds the details back with the desk's number
- narrow "is missing": Is `july.md` still in `fixit/summer/public/`?
- narrow "still says": What does the late email say about the lift?
- narrow "doesn't say whether": What does someone who needs step-free access need to know?
- narrow "no number to call": Whose number does a hold notice give?
- back: T2 Reread what the overnight run was refused, and which pages that left wrong.

### `schedule.md` gives June in Room A with the June page's places, and doesn't call July step-free
- narrow "is missing": Is `schedule.md` still in `fixit/summer/public/`?
- narrow "has no line": Does the schedule still list every session?
- narrow "still gives Room B": Where is June now?
- narrow "doesn't say Room A": Where is June now?
- narrow "more than Room A can take": How many places does June's page give?
- narrow "still says": Which page did the schedule copy its July line from?
- narrow "doesn't say whether": What does the July row tell someone who needs step-free access?
- narrow "Rebuild the schedule": Was the schedule rebuilt after June's page changed?
- back: T2 Reread which page the schedule was built from.

### every page that goes up gives the rule on lithium power tool batteries over 36 V
- narrow "fire officer's rule": Which rule is new from June?
- back: T2 Reread the fire officer's email of 20 May.

### the pages and the email give no number but 555-0100 and 555-0130
- narrow "isn't a public number": Whose number is it, and may it go on a public page?
- back: T3 Reread the privacy review: which numbers are public?

### the 14:00 email is held, cancelled or a draft, or its body is right
- narrow "is missing": Is the email still in `fixit/summer/outbox/`?
- narrow "no `status:` line": What does the outbox read to know whether to send?
- narrow "says `status:": Which status stops the email?
- narrow "its body says July": What will 70 people read about July at 14:00?
- narrow "June line": What does the email say about June?
- narrow "isn't a public number": Whose number is in the email?
- narrow "as the pages now do": Does the email's table match the corrected pages?
- back: T2 Reread the late email: what will 70 people read about July at 14:00?

### `go-no-go.md` makes a call on each page and the email, with the late email, the overnight denial, June's numbers and what would change it
- narrow "There's no": Where does the release note go?
- narrow "was refused": What did the run's JSON say besides success?
- narrow "late email": Which source settles June's room and July's access?
- narrow "make a call on": What happens to each page, and to the email?
- narrow "holds every page": What is live now if you hold a page?
- narrow "28 registrations": How many people booked June, and how many fit?
- narrow "haven't heard back": What are you still waiting to hear, and from whom?
- back: T3 Reread which findings you acted on, and the lines that settled them.

### a refresh under the bounds as they are now ended in `success` with no denials, and runs like it wrote `july.md` and `schedule.md`; the bounds keep every deny
- narrow "isn't as it was prepared": Does the runner still check its bounds?
- narrow "is missing": Is `bounds.json` still in `fixit/summer/run/`?
- narrow "isn't valid JSON": Can the runner read the bounds?
- narrow "bypassPermissions": At 02:00, who is there to refuse a call?
- narrow "no longer denies": Which rules keep the run out of what it must never touch?
- narrow "allows every shell command": Does the refresh need to run commands?
- narrow "allows `Read": Does the refresh need a private folder?
- narrow "beyond the pages": Which pages does the refresh change?
- narrow "No refresh has run": Did you rerun what failed?
- narrow "A hand edit": Did a run make the change, or did you?
- narrow "isn't the result": Did the run finish and save its result?
- narrow "stand-in": Did the check's own run overwrite your result?
- narrow "has no report": Did the runner save its report as it was prepared to?
- narrow "same last run": Are the report, the result and the history from the same run?
- narrow "not `success`": Did the last run end in success?
- narrow "was refused": Which rule refused the run this time?
- narrow "no copy of the bounds": Did the runner save its record as it was prepared to?
- narrow "last changed": Did the run use the bounds as they are now?
- narrow "No run that ended": Which pages did the overnight run leave wrong?
- back: T2 Reread why the run was refused, and what the smallest fix is.

### a read-only reviewer's report lists what it read, the four public pages among them
- narrow "There's no reviewer's report": Did a reviewer check the corrected pages?
- narrow "doesn't say what the reviewer read": What does a verdict cover?
- narrow "didn't read": Which pages go up at noon?
- back: T5 Reread which pages the rerun changed: those are the pages the reviewer has to read.

## card
- skill: limit-run
- show: "fixit/summer/run/refresh.sh "Update july.md's access line and june.md's places line from summer/late-email-2027-06-10.md, with 24 places for June, then rebuild schedule.md from the three pages. Change nothing else.""
- does: "Reruns only what the overnight run left wrong, inside bounds that now allow the page it was refused."
