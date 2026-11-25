# Turn a repeated job into a skill

<sub>**Intermediate** · Lesson 2 of 5 · about 25 minutes · Needs: [Decide what Claude should remember](01-decide-what-to-remember.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can package a procedure as a skill, run a skill by name, write its description so it loads for the right requests and not the wrong ones, test that both ways, and improve the skill when a second input shows a gap.

## The job

> **Sam (second organizer):** I watched you make the March guide. It's the same five moves every month: read the sources, check every fact, decide what wins, mark what isn't confirmed, write it up. Can Claude just know how to do that when I ask for "the April guide"? I don't want to paste your checklist every time.

You can see the March guide and its readiness note in `fixit/march/`. The steps you took are listed under "How I checked".

This lesson starts with the reference kit as it stands after Lesson 1: `fixit/CLAUDE.md` and the public-pages rule. Your own version stays in Lesson 1. The course's March guide is kept as `march/attendee-guide.reference.md`, so you can compare the skill's guide with it.

## You need

- In Questerm: nothing. Claude's replies are written in advance, so the model and effort a session shows don't change them, and nothing leaves your browser.
- On your own computer: Claude Code, and a folder of your own to try it in. A skill is a plain text file, so any editor opens it.

## The idea

A skill is the procedure Sam can't forget to paste. Claude sees its one-line description in every session, and reads its steps only when a request matches.

That makes the description the part that decides. A description that fits every request loads for the wrong ones: it starts writing a public page when Sam asked for a volunteer rota. That's worse than no skill at all.

So you write the description, then probe it both ways: a request it should load for, and one it shouldn't.

## Worked example

1. **Start Claude where the kit lives.** Work in `fixit/`, as you did in Lesson 1, and start Claude there:

   ```bash
   cd fixit
   claude
   ```

   Trust the folder: it's part of your practice copy.
2. **Turn the March steps into a skill.** First, a question: you make an attendee guide every month with the same five steps. Where should those steps live?

   In a skill. `CLAUDE.md` loads in every session, the rota and the minutes included, and a procedure you need once a month shouldn't cost attention every time. Pasting the steps into the prompt works, for you, but Sam doesn't have your checklist, and a pasted checklist drifts: one month a step gets dropped.

   Ask Claude to turn how you made the March guide into a skill. The steps you took are under How I checked, in `march/readiness-note.md`: `Make a project skill called attendee-guide from how I made the March guide: the How I checked list in march/readiness-note.md. It takes a month folder. Steps: read that folder and sources/group-notes.md, write a fact table with a source for every fact, apply the source order in CLAUDE.md, mark open items as being confirmed, write the guide from a template, and report the open items. Description: Helps with Fix-It Saturday documents.`

   A skill is a folder in `.claude/skills/` with a `SKILL.md`: a short description at the top, then the steps. Open `fixit/.claude/skills/attendee-guide/SKILL.md` in the files tab. The description, between the two lines of dashes at the top, is what Claude reads in every session to decide whether to use this skill. The steps below it load only when the skill runs. The description is the one you dictated. You'll come back to it.
3. **Run it by name on February.** Claude Code watches the skill folders that existed when this session started. `.claude/skills/` is new, so load it: type `/reload-skills`. From now on, a change to the skill shows at your next message. Then run it by name, with the month's folder after it: `/attendee-guide feb`. `$ARGUMENTS` in the steps becomes `feb`, so the skill reads that folder.

   Claude writes `feb/facts.md` and `feb/attendee-guide.md`. It was right on the hours and the hidden note, and rightly unsure about the limit: the library allows 40 people including volunteers, and the January notes cap sign-ups at 32, so it wrote "places are limited" and asked. That doubt is a gap in the skill, not in Claude: nothing says whose rule wins on our own arrangements. You'll fix it in Your turn.
4. **Watch the description fail.** A skill can also load without its name, when a request matches its description. Start a clean conversation with `/clear`, so nothing earlier steers which skill loads. Then ask for something that has nothing to do with attendee guides: `draft the volunteer rota for March`

   Claude's first action is Skill: attendee-guide. Press `Esc` straight away. Why it loaded: "Helps with Fix-It Saturday documents" describes the rota too. Had you not pressed `Esc`, Claude would have started a fact table for a public page.

## Your turn

1. **Write a description that chooses correctly.** In the files tab, rewrite the skill's `description:` in your own words, so it loads for requests about the public attendee guide and not for rotas, volunteer briefs or meeting notes. Say what it does and when to use it. Who reads the thing this skill makes? Name the output, then say what it is not for, in a sentence of its own.

   The check tries four requests on the saved file:

   | Request | Should it load? |
   |---|---|
   | make the attendee guide for february | yes |
   | can you check the March attendee guide | yes |
   | draft the volunteer rota for March | no |
   | summarise the 20 February meeting | no |

2. **Probe it both ways.** In a clean conversation, ask for February's attendee guide without naming the skill. When you see Skill: attendee-guide, press `Esc`: you only wanted to see it load. Clear it again, and ask for March's volunteer rota. Claude should start on the rota without the skill. It offers to write the rota: say no, or press `Esc`. If the rota request still loads it, press `Esc`, edit the description, clear the conversation and ask again.
3. **Fix the gap on a second input.** Run the skill on March, where you have a reference guide to compare with. Claude reports the same open item as February: the booking allows 40 people including volunteers, the notes cap sign-ups at 30, so it writes "places are limited". Where do you fix this? In the skill's step 3: it's part of how the guide is made, so it belongs in the procedure. Editing this month's guide fixes March only, and Sam gets "places are limited" again in April. `CLAUDE.md` would also work, but it loads for every task, and its source order is about the venue's facts.

   Change the skill so it settles this itself, every month: the venue's confirmation wins on the room's limits, but our notes win on our own arrangements, such as the sign-up cap and what to bring. Run it on March again, and compare its guide with the reference copy. The guide now says 30 places, the open item is gone, and the access line is still being confirmed.

   Watch the rule's reach. "Our notes always win" settles March, but it would also let our notes beat the venue on the room and the access, and the check says so.
4. **When a skill is overkill.** Maya asks for a one-off thank-you note to the library, for hosting a year of sessions. Do you make a `thank-you-note` skill? No: a skill pays when a procedure repeats and someone else must run it the same way. A one-off note is a prompt. Now tell the next organizer how to run the skill you did make: in `fixit/KIT.md`, under How to run it, add one line with the skill's name and the folder to give it.

## Check

The Lesson's check reads four things:

- `fixit/.claude/skills/attendee-guide/SKILL.md` has a name and a description that load it for requests about the attendee guide, and not for the volunteer rota or a meeting summary
- the skill's steps ask for a fact table with sources, apply the source order, publish open items as being confirmed, and let our notes decide only our own arrangements
- `fixit/march/attendee-guide.md` was saved after your last change to the skill, gives 30 places or says places are limited, never 40, 60 or just turn up, and says step-free access is being confirmed
- `fixit/KIT.md` says how to run the skill: `/attendee-guide` with the month's folder

The check reads the March guide and when it was saved, not which Skill call wrote it: that it came from the skill, run after your last change, is yours to say.

What only you can judge: put `SKILL.md` beside `march/readiness-note.md`. Is anything you did by hand in March missing from the steps?

## On your own computer

Real Claude Code reads skills from your project and your home folder.

1. Ask Claude to make one, or create the folder yourself: `.claude/skills/<name>/SKILL.md` in the project, shared with everyone who works there, or `~/.claude/skills/<name>/SKILL.md`, yours in every project.
2. Run it by name: `/<name>`, with any argument after it.
3. Probe the description in a clean conversation (`/clear`), and press `Esc` when you see the Skill call you were checking for.
4. If you edit a skill and Claude doesn't pick up the change, `/reload-skills` reads the skill folders again. A skills folder that didn't exist when the session started needs it too.

Custom commands in `.claude/commands/` still work, and now behave as skills. If a skill has side effects you only ever want on request, add `disable-model-invocation: true`, so it never loads on its own. See [Extend Claude with skills](https://code.claude.com/docs/en/skills).

Skills follow the Agent Skills open standard. Skills you made in claude.ai sync into Claude Code sessions signed in with the same claude.ai account.

## Technical detail

| Item | What it does | How to verify | Failure case |
|---|---|---|---|
| `SKILL.md` frontmatter `name`, `description` | the description is in context in every session; the body loads on use | `/skills` lists it | a vague description loads for unrelated requests; a too-narrow one never loads on its own ([Skills](https://code.claude.com/docs/en/skills)) |
| `$ARGUMENTS`, `argument-hint` | passes what follows `/<name>` into the body | run it with and without an argument | with no argument, the body should say what to do |
| Supporting files (`template.md`) | loaded only when the body points to them | ask Claude which files it read | a missing file fails silently |
| `disable-model-invocation: true` | only an explicit `/<name>` runs it | the probe no longer loads it | none |
| `/reload-skills` | reads the skill folders again | the edited description shows in `/skills` | none ([Commands](https://code.claude.com/docs/en/commands)) |

In Questerm, a description is matched by fixed rules, not by a model: a request loads the skill when the description names what the request is about, and "Not for" rules out the rest of its sentence. Real Claude Code decides with the model, so probe your own skills both ways.

The Desktop app's Code tab and the VS Code extension run the same project skills. In claude.ai, skills are added in settings and apply to your chats. The habit is the same everywhere: a procedure with a description that says when it applies, probed both ways.
