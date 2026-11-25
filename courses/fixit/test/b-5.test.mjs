// The b-5 check against what a session may leave: the manuscript's two valid
// ends and its near miss, the untouched start, the note Claude writes in the
// worked example, hand-written evidence, and other ways to word the ranking,
// the Still open part and the door sign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const b5 = await import(pathToFileURL(join(checks, 'lessons/b-5.mjs')).href);

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const lesson = (p) => read(`practice-template/lessons/b-5/project/${p}`);
const START = {
  'fixit/sources/group-notes.md': read('practice-template/project/fixit/sources/group-notes.md'),
  'fixit/sources/flyer-2026-10.md': read('practice-template/project/fixit/sources/flyer-2026-10.md'),
  ...Object.fromEntries(
    ['attendee-guide.md', 'door-sign.md', 'venue-email-feb.md', 'venue-email-feb-update.md', 'meeting-notes-2027-01-28.md', 'partner-email.md'].map((f) => [
      `fixit/feb/${f}`,
      lesson(`fixit/feb/${f}`),
    ]),
  ),
};
const SIGN_A = read('solutions/b-5/fixit/feb/door-sign.md');
const NOTE_A = read('solutions/b-5/fixit/feb/readiness-note.md');
const RANKING_A = /^\*\*Sources, in order of trust:\*\*.*\n\n/m;
const OPEN_A = /^\*\*Still open:\*\*.*$/m;
// The note Claude writes in the worked example: the rows, no ranking, and
// nothing open.
const NOTE_FIRST = NOTE_A.replace(RANKING_A, '').replace(OPEN_A, '**Still open:** nothing.');
const VALID_B = `# Ready for Maya

- When: Saturday 13 February, 10:30am to 1pm, meeting notes line 5
- Where: Room B, first floor, library's email item 1 and 4
- Parking: Park Lane leisure centre, Dee's email of 12 February
- Booking: 32 places on the events page, meeting notes line 7
- Bring: the item, its charger, spare parts, a note of the fault, meeting notes line 9
- Can't take: microwaves, gas, damaged batteries, rewiring, group-notes.md lines 12 to 15
- Contact: 555-0100, library's email item 7

When sources disagree, the library's emails win.

Still open: nothing, all confirmed by the library's emails.
`;
const [sign, sourced, open, guide] = b5.items;

// A practice copy whose first commit holds the lesson's starting files, with
// `files` written over it.
function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const done = (note, extra = {}) => copy({ [b5.SIGN]: SIGN_A, [b5.NOTE]: note, ...extra });
const withRanking = (line) => NOTE_A.replace(RANKING_A, `${line}\n\n`);
const withOpen = (part) => NOTE_A.replace(OPEN_A, part);

const passes = (item, r) => assert.equal(item.check(r), true);
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, 'expected a hint');
  assert.match(got, re);
};
const all = (r) => b5.items.forEach((item) => passes(item, r));

test("valid A, the exemplar's shape: a table, a ranking line and Park Lane still open, passes every item", () => {
  all(done(NOTE_A));
});

test('valid B, a bullet list, a one-sentence ranking and nothing open, passes every item', () => {
  all(done(VALID_B));
});

test('the near miss, a complete note but a fresh check that skipped the sign, fails the sign item', () => {
  const r = done(NOTE_A, { [b5.SIGN]: START[b5.SIGN] });
  says(sign, r, /`fixit\/feb\/door-sign\.md` says "10am to 1pm"\. Maya prints it with the guide, and the guide says 10:30/);
  for (const item of [sourced, open, guide]) passes(item, r);
});

test('the untouched starting state fails: the sign says 10am and there is no readiness note', () => {
  const r = copy();
  says(sign, r, /says "10am to 1pm"/);
  says(sourced, r, /There's no `fixit\/feb\/readiness-note\.md` yet/);
  says(open, r, /There's no `fixit\/feb\/readiness-note\.md` yet/);
  passes(guide, r);
});

test("the worked example's note, before Step 5, says nothing about which source wins", () => {
  const r = done(NOTE_FIRST);
  says(sourced, r, /doesn't say which source wins when two disagree\. The fresh session had to guess/);
  passes(open, r);
});

test('hand-written evidence fails: a note that says it was checked, with no source per fact', () => {
  says(sourced, done('# Readiness note\n\nA fresh session checked everything: all correct. Sources: venue-email-feb.md, meeting-notes-2027-01-28.md.\n\nStill open: nothing.\n'), /gives 0 facts with a source/);
  const ticked = NOTE_A.replace(/`venue-email-feb\.md:14`; `group-notes\.md:22`/, 'checked');
  says(sourced, done(ticked), /This line of the readiness note names no source: "Contact 555-0100 checked"/);
  says(sourced, done(NOTE_A.replace(/^\| (?:Bring|Can't take|Access) .*\n/gm, '')), /gives 5 facts with a source\. Maya's callers ask about at least 6 things/);
});

test('a fact that rests on the flyer or the newsletter alone fails; one that also names a source of this month passes', () => {
  says(sourced, done(NOTE_A.replace('`venue-email-feb.md:8`; `meeting-notes-2027-01-28.md:5`', '`flyer-2026-10.md:6`')), /rests on the flyer or the newsletter alone: "When Sat 13 Feb, 10:30am to 1pm `?flyer/);
  says(sourced, done(NOTE_A.replace('`venue-email-feb-update.md:6`', 'partner-email.md, the Repair Network listing')), /rests on the flyer or the newsletter alone: "Parking/);
  passes(sourced, done(NOTE_A.replace('`venue-email-feb.md:8`; `meeting-notes-2027-01-28.md:5`', '`meeting-notes-2027-01-28.md:5` (the flyer\'s 10am is out of date)')));
});

test('a ranking that puts the flyer first is quoted back', () => {
  for (const line of [
    'Sources, in order of trust: the flyer first, then the meeting notes, then the library\'s email.',
    'When sources disagree, trust the flyer over the library\'s email.',
    'Flyer > library email > meeting notes',
    'The library\'s email comes after the flyer when they disagree.',
    'When sources disagree, the flyer wins.',
  ])
    says(sourced, done(withRanking(line)), /ranks the flyer above the library's email: ".+"\. The guide's times come from the email and the meeting notes/);
});

test('rankings that keep the flyer out, or below the email and the notes, pass', () => {
  for (const line of [
    '**Sources, in order of trust:** the library\'s emails, then our meeting notes, then our standing notes. Old flyers and newsletters are never a source for times, places, parking or access.',
    'When the flyer and the library\'s email disagree, the email wins.',
    'The library\'s email beats the flyer, and the meeting notes beat the standing notes.',
    'Library email > meeting notes > standing notes > flyer',
    'The flyer loses to the library\'s email and the meeting notes.',
    'Which source wins: the library\'s emails, then the meeting notes. Never last October\'s flyer.',
    '## Which source wins\n\nThe library\'s emails, then the meeting notes, then the standing notes.',
  ])
    passes(sourced, done(withRanking(line)));
});

test("lines that aren't a ranking don't count as one", () => {
  // The Still open line names Dee's email, a ranking in a comment is never read, and a
  // How I checked line mentions sources without ranking them.
  says(sourced, done(NOTE_FIRST.replace('**Still open:** nothing.', '**Still open:** Park Lane is confirmed for 13 February only (Dee\'s email). Check before March.')), /doesn't say which source wins/);
  says(sourced, done(NOTE_FIRST.replace('**Still open:**', '<!-- When sources disagree, the library\'s emails win. -->\n\n**Still open:**')), /doesn't say which source wins/);
  says(sourced, done(NOTE_FIRST.replace('**Still open:**', '## How I checked\n\n- Opened each cited line in the library\'s email and the notes.\n\n**Still open:**')), /doesn't say which source wins/);
});

test('the Still open part: present and saying something, or saying nothing is open, passes; missing or empty fails', () => {
  passes(open, done(withOpen('## Still open\n\n- **Parking.** Park Lane is confirmed for 13 February only.')));
  passes(open, done(withOpen('**Still open:**\n\n- Park Lane parking, for this Saturday only')));
  passes(open, done(withOpen('Open questions: none, every row is confirmed.')));
  says(open, done(NOTE_A.replace(OPEN_A, '')), /has no \*\*Still open\*\* part/);
  says(open, done(withOpen('## Still open\n\n## How I checked\n\n- Opened each line.')), /\*\*Still open\*\* part is empty\. Is anything in the guide true only for this one Saturday/);
  says(open, done(withOpen('**Still open:**')), /is empty/);
});

test('door signs: 10.30 and half past ten pass; 10:00, no time or no sign fails', () => {
  passes(sign, done(NOTE_A, { [b5.SIGN]: SIGN_A.replace('10:30am', '10.30am') }));
  passes(sign, done(NOTE_A, { [b5.SIGN]: SIGN_A.replace('10:30am to 1pm', 'half past ten to one') }));
  says(sign, done(NOTE_A, { [b5.SIGN]: SIGN_A.replace('10:30am', '10:00') }), /says "10:00 to 1pm"/);
  says(sign, done(NOTE_A, { [b5.SIGN]: SIGN_A.replace('## 10:30am to 1pm\n\n', '') }), /doesn't say when the public comes in/);
  const dir = repo(START);
  commit(dir, 'start');
  rmSync(join(dir, b5.SIGN));
  rmSync(join(dir, b5.GUIDE));
  const r = openRepo(dir);
  says(sign, r, /There's no `fixit\/feb\/door-sign\.md`/);
  says(guide, r, /There's no `fixit\/feb\/attendee-guide\.md`/);
});

test("a guide that lost lesson 3's or lesson 4's facts fails, with that lesson's hint", () => {
  const g = START[b5.GUIDE];
  says(guide, done(NOTE_A, { [b5.GUIDE]: g.replace('10:30am to 1pm', '10am to 1pm') }), /The guide still says ".*10am to 1pm.*"\. Line 5 of `fixit\/feb\/meeting-notes-2027-01-28\.md`/);
  says(guide, done(NOTE_A, { [b5.GUIDE]: g.replace('555-0100', '555-0187') }), /The guide gives 555-0187/);
  says(guide, done(NOTE_A, { [b5.GUIDE]: g.replace(/\*\*Book first:\*\*.*\n\n/, '') }), /No line tells people to book/);
  says(guide, done(NOTE_A, { [b5.GUIDE]: g.replace(/Park at the leisure centre on Park Lane[^.]*\./, 'Station Road car park is a five-minute walk.') }), /still sends people to Station Road/);
});
