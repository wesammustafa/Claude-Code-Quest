// The b-4 check against what a session may leave: the manuscript's two
// valid ends and its near miss, the drift a rewind undoes, a guide that was
// rewound and never asked again, and other ways to word the parking line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const b4 = await import(pathToFileURL(join(checks, 'lessons/b-4.mjs')).href);

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const lesson = (p) => read(`practice-template/lessons/b-4/project/${p}`);
const START = {
  'fixit/sources/group-notes.md': read('practice-template/project/fixit/sources/group-notes.md'),
  'fixit/sources/flyer-2026-10.md': read('practice-template/project/fixit/sources/flyer-2026-10.md'),
  'fixit/feb/attendee-guide.md': lesson('fixit/feb/attendee-guide.md'),
  'fixit/feb/venue-email-feb.md': lesson('fixit/feb/venue-email-feb.md'),
  'fixit/feb/meeting-notes-2027-01-28.md': lesson('fixit/feb/meeting-notes-2027-01-28.md'),
  'fixit/feb/partner-email.md': lesson('fixit/feb/partner-email.md'),
};
const EMAIL = START[b4.EMAIL];
const VALID_A = read('solutions/b-4/fixit/feb/attendee-guide.md');
const PARKING_A = /^\*\*Parking:\*\*.*$/m;
const withParking = (line) => VALID_A.replace(PARKING_A, `**Parking:** ${line}`);
const [email, list, parking, shorter] = b4.items;

// A practice copy whose first commit holds the lesson's starting files, with
// `files` written over it, as the session leaves them: the overnight update
// and the backup copy the drift made with a command among them.
function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, {
    'fixit/feb/venue-email-feb-update.md': '# update\n',
    'fixit/feb/attendee-guide.backup.md': START[b4.GUIDE],
    ...files,
  });
  return openRepo(dir);
}
const done = (guide, extra = {}) => copy({ [b4.GUIDE]: guide, ...extra });

const passes = (item, r) => assert.equal(item.check(r), true);
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, 'expected a hint');
  assert.match(got, re);
};
const all = (r) => b4.items.forEach((item) => passes(item, r));

test('valid A, rewound, asked again and the Park Lane line with free parking, passes every item', () => {
  all(done(VALID_A));
});

test('valid B, the Park Lane line without the walking time, passes every item', () => {
  all(done(withParking('Station Road car park is closed on 13 February. Park at the leisure centre on Park Lane instead.')));
});

test("the near miss, Claude's rebuilt email without Dee's sign-off, fails the email item", () => {
  const rebuilt = EMAIL.replace(/\nThanks,\nDee, Events Desk\n$/, '\n');
  assert.notEqual(rebuilt, EMAIL);
  says(email, done(VALID_A, { [b4.EMAIL]: rebuilt }), /isn't the email the library sent\. Its line "Thanks," isn't there any more\..*Restore code and conversation/);
});

test('the drift, a guide without the list and an email without items 5 to 7, fails both', () => {
  const guide = START[b4.GUIDE].replace(/\*\*What we can't take:\*\*.*\n\n/, '');
  const trimmed = EMAIL.replace(/5\. \*\*Our car park[\s\S]*$/, '');
  const r = done(guide, { [b4.EMAIL]: trimmed });
  says(email, r, /Its line "\*\*Our car park is closed on Saturdays\*\* for the farmers' market/);
  says(list, r, /no longer says what we can't take: it doesn't turn away microwaves, gas appliances or batteries that are swollen or cracked/);
});

test('the untouched starting state fails: the parking line is the old one, and the guide is as long as ever', () => {
  const r = copy();
  passes(email, r);
  passes(list, r);
  says(parking, r, /still sends people to Station Road car park: "\*\*Parking:\*\* the library car park is closed on Saturdays for the farmers' market"|still sends people to Station Road car park: "Station Road car park is a five-minute walk"/);
  says(shorter, r, /The guide is 190 words, about as long as the 190 you started with/);
});

test('rewound and never asked again: the start guide with only the parking line fixed fails the length', () => {
  const guide = START[b4.GUIDE].replace(PARKING_A, '**Parking:** Station Road car park is closed on 13 February. Park on Park Lane.');
  const r = done(guide);
  passes(parking, r);
  says(shorter, r, /The guide is 18\d words, about as long as the 190/);
});

test('parking lines that pass: Station Road turned down, Park Lane or the leisure centre named', () => {
  for (const line of [
    "Station Road car park is closed tomorrow, so park on Park Lane.",
    "Don't park at Station Road: use the leisure centre car park, free on Saturdays.",
    'Park at the leisure centre on Park Lane, not Station Road.',
    'Use the leisure center car park on Park Lane (Station Road is shut for resurfacing).',
    'Park on Park Lane since Station Road is closed.',
    'Park Lane leisure centre, eight minutes away.',
  ])
    passes(parking, done(withParking(line)));
});

test('parking lines that fail: Station Road offered, or nowhere named', () => {
  says(parking, done(withParking('Park at Station Road car park or on Park Lane.')), /still sends people to Station Road/);
  says(parking, done(withParking("Station Road car park is a five-minute walk. Park Lane is open too.")), /still sends people to Station Road/);
  says(parking, done(withParking('the library car park is closed on Saturdays.')), /doesn't say where to park on 13 February.*Line 6 of `fixit\/feb\/venue-email-feb-update\.md`/);
  says(parking, done(withParking('the leisure centre car park on Park Lane is closed.')), /doesn't say where to park/);
});

test("a Park Lane line in an HTML comment, which no reader sees, doesn't count", () => {
  const guide = VALID_A.replace(PARKING_A, '**Parking:** the library car park is closed on Saturdays.\n\n<!-- Park at the leisure centre on Park Lane. -->');
  says(parking, done(guide), /doesn't say where to park/);
});

test("what we can't take: other wordings pass; a list that takes them in, or drops one, fails", () => {
  const can = (line) => VALID_A.replace(/^\*\*What we can't take:\*\*.*$/m, line);
  passes(list, done(can('No microwaves, no gas appliances, no swollen or cracked batteries, and no mains rewiring.')));
  passes(list, done(can("**What we can't take:**\n\n- microwaves\n- gas appliances\n- damaged batteries")));
  passes(list, done(can("## What we can't take\n\nMicrowaves, gas appliances, or anything with a swollen battery.")));
  says(list, done(can('**Bring:**\n\n- microwaves\n- gas appliances\n- batteries')), /doesn't turn away microwaves, gas appliances or batteries/);
  says(list, done(can('**Bring:** microwaves, gas heaters and batteries are all welcome.')), /doesn't turn away microwaves, gas appliances or batteries/);
  says(list, done(can("**What we can't take:** microwaves or gas appliances.")), /doesn't turn away batteries that are swollen or cracked\./);
});

test('a guide over one printed page fails, however short each line', () => {
  const long = `${VALID_A}\n${Array.from({ length: 12 }, (_, i) => `Line ${String(i + 1)}.`).join('\n')}\n`;
  says(list, done(long), /has 21 lines of text, and one printed page in the library's template holds 18/);
});

test('an email with only its line ends changed is the same email; one with a line added is not', () => {
  passes(email, done(VALID_A, { [b4.EMAIL]: EMAIL.replace(/\n/g, '\r\n') }));
  says(email, done(VALID_A, { [b4.EMAIL]: `${EMAIL}\nPS: parking is free on site.\n` }), /has lines the library never sent/);
});

test('a missing email or guide says so', () => {
  const dir = repo({ ...START });
  commit(dir, 'start');
  rmSync(join(dir, b4.EMAIL));
  rmSync(join(dir, b4.GUIDE));
  const r = openRepo(dir);
  says(email, r, /`fixit\/feb\/venue-email-feb\.md` is missing/);
  for (const item of [list, parking, shorter]) says(item, r, /There's no `fixit\/feb\/attendee-guide\.md`/);
});
