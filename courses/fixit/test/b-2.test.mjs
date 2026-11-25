// The b-2 check against what a Learner's briefs may leave: the manuscript's
// two valid reminders and its near miss, other wordings, the plan that
// changes a source, and the door sign the planned job makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const b2 = await import(pathToFileURL(join(checks, 'lessons/b-2.mjs')).href);

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {
  'fixit/sources/group-notes.md': read('practice-template/project/fixit/sources/group-notes.md'),
  'fixit/sources/flyer-2026-10.md': read('practice-template/project/fixit/sources/flyer-2026-10.md'),
  'fixit/feb/venue-email-feb.md': read('practice-template/lessons/b-2/project/fixit/feb/venue-email-feb.md'),
  'fixit/feb/meeting-notes-2027-01-28.md': read('practice-template/lessons/b-2/project/fixit/feb/meeting-notes-2027-01-28.md'),
};
const VALID_A = read('solutions/b-2/fixit/feb/volunteer-reminder.md');
const SIGN = read('solutions/b-2/fixit/feb/door-sign.md');
const [reminder, numbers, sources, sign] = b2.items;

// A practice copy whose first commit holds the lesson's sources, with `files`
// written over it, as the Learner's session leaves them.
function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const done = (text, extra = {}) => copy({ [b2.REMINDER]: text, [b2.SIGN]: SIGN, ...extra });

const passes = (item, r) => assert.equal(item.check(r), true);
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, 'expected a hint');
  assert.match(got, re);
};
const all = (r) => b2.items.forEach((item) => passes(item, r));

test('valid A, the reminder with Priya\'s number for volunteers, passes every item', () => {
  all(done(VALID_A));
});

test('valid B, no numbers and the group chat instead, passes every item', () => {
  all(done(VALID_A.replace(/Running late\?.*/, "Running late? Post in the volunteers' group chat.")));
});

test('other wordings pass: a list, other words, the library number', () => {
  const list = [
    '# Volunteers: Saturday 13 Feb',
    '',
    '- Get in from 9:30, when the library opens. Room B is ours from 10:00.',
    '- Public from 10:30.',
    "- Don't park at the library, its car park is shut for the market. Use Station Rd.",
    '- Ade brings the soldering kit.',
    '- Questions: the events desk, 555-0100.',
  ].join('\n');
  const prose = 'Hi all! Arrive at 10am to set up in Room B; doors open to the public at 10:30. The library car park is closed on Saturdays, so park at Station Road car park. Bring your tools.\n';
  for (const text of [list, prose]) all(done(text));
});

test('the near miss, doors at 10am and parking behind the library, fails on the time first', () => {
  const nearMiss = '# Reminder\n\nDoors 10am, park behind the library. Ade has the soldering kit.\n';
  says(reminder, done(nearMiss), /10am as the public start: "Doors 10am".*Line 5 of `fixit\/feb\/meeting-notes-2027-01-28\.md`/);
});

test("Jordan's old parking line, with the right times, fails on the car park", () => {
  const text = VALID_A.replace(/The library car park is closed.*\n/, "Park in the library car park behind the building, it's free.\n");
  says(reminder, done(text), /sends volunteers to the library's car park/);
});

test('a reminder with no arrival time, or no parking, fails with the email line that says it', () => {
  says(reminder, done(VALID_A.replace(/The library opens at 9:30 and the room is ours from 10:00; /, '')), /doesn't say when volunteers can get in.*Lines 9 and 10/);
  says(reminder, done(VALID_A.replace(/The library car park is closed.*\n/, '')), /doesn't say where to park.*Line 12/);
});

test('saying the library car park is closed is enough, with no other car park named', () => {
  passes(reminder, done(VALID_A.replace(/, so park at Station Road car park, five minutes' walk/, '')));
});

test('a reminder that only says 10:00, the room time, still gives volunteers a time', () => {
  passes(reminder, done(VALID_A.replace('The library opens at 9:30 and the room', 'The room')));
});

test('the public at 10am fails, however it is put', () => {
  for (const line of ['The public comes in at 10am.', 'Visitors from 10:00.', 'Doors open at 10am to everyone.'])
    says(reminder, done(VALID_A.replace('the public comes in from 10:30.', line)), /10am as the public start/);
});

test('another volunteer\'s number, or a real-looking one, fails; the two allowed ones pass', () => {
  says(numbers, done(VALID_A.replace('555-0187', '555-0162')), /gives 555-0162.*Priya's 555-0187/);
  says(numbers, done(`${VALID_A}\nTomás: 555 0173\n`), /gives 555 0173/);
  passes(numbers, done(`${VALID_A}\nPublic questions: 555-0100.\n`));
});

test('times and dates are not phone numbers', () => {
  passes(numbers, done(`${VALID_A}\nSaturday 13 February 2027, 10:00 to 13:30.\n`));
});

test('the untouched starting state fails: no reminder and no door sign yet', () => {
  const r = copy();
  says(reminder, r, /There's no `fixit\/feb\/volunteer-reminder\.md` yet/);
  says(numbers, r, /There's no/);
  passes(sources, r);
  says(sign, r, /There's no `fixit\/feb\/door-sign\.md` yet/);
});

test('the approved plan that writes February into the group notes fails the sources item', () => {
  const notes = START['fixit/sources/group-notes.md'].replace(
    '- Free. There is a donations jar for parts.\n',
    '- Free. There is a donations jar for parts.\n- February: volunteers in from 9:30, park at Station Road.\n',
  );
  says(sources, done(VALID_A, { 'fixit/sources/group-notes.md': notes }), /`fixit\/sources\/group-notes\.md` has changed\. Sources stay as they are/);
});

test('an edited library email, or a deleted flyer, fails the sources item too', () => {
  says(sources, done(VALID_A, { 'fixit/feb/venue-email-feb.md': START['fixit/feb/venue-email-feb.md'].replace('9:30', '9:00') }), /venue-email-feb\.md` has changed/);
  const dir = repo({ ...START });
  commit(dir, 'start');
  write(dir, { [b2.REMINDER]: VALID_A, [b2.SIGN]: SIGN });
  rmSync(join(dir, 'fixit/sources/flyer-2026-10.md'));
  says(sources, openRepo(dir), /flyer-2026-10\.md` is missing/);
});

test('a source with only its line ends changed is still the same source', () => {
  passes(sources, done(VALID_A, { 'fixit/sources/group-notes.md': START['fixit/sources/group-notes.md'].replace(/\n/g, '\r\n') }));
});

test("the door sign with the flyer's 10am fails; one with no time fails; 10:30 passes", () => {
  says(sign, done(VALID_A, { [b2.SIGN]: '# FIX-IT SATURDAY\n\n## Room B\n\n## 10am to 1pm\n' }), /door sign says "10am to 1pm"/);
  says(sign, done(VALID_A, { [b2.SIGN]: '# FIX-IT SATURDAY\n\n## Room B\n' }), /doesn't give the start time/);
  passes(sign, done(VALID_A, { [b2.SIGN]: 'FIX-IT SATURDAY. Room B. Half past ten to 1pm.\n' }));
});
