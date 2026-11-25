// The pilot b-1 check against the notes a Learner may leave: each case
// Priya's request turns on, and the wording a Learner may use instead of the
// model answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const b1 = await import(pathToFileURL(join(checks, 'lessons/b-1.mjs')).href);

const ORIGINAL = readFileSync(join(COURSE, 'practice-template/lessons/b-1/project/fixit/feb/jordan-welcome-note.md'), 'utf8');
const [, parking, leads, kept] = b1.items;

// A practice copy whose first commit holds Jordan's note, with `note` as the
// working-tree version (the original when absent).
function copy(note) {
  const dir = repo({ [b1.NOTE]: ORIGINAL });
  commit(dir, 'start');
  if (note !== undefined) write(dir, { [b1.NOTE]: note });
  return openRepo(dir);
}

const swap = (from, to) => ORIGINAL.replace(from, to);
const PARK = '- Park in the library car park behind the building, it\'s free.';
const LEADS = '- Bring your own tools if you have them; the library lends us extension leads.';
const FIXED_PARK = "- Don't use the library car park: it's closed on Saturdays for the farmers' market. Park at Station Road car park, five minutes' walk.";
const FIXED_LEADS = '- Bring your own tools if you have them; the library lends us extension leads (Priya to confirm).';
const model = swap(PARK, FIXED_PARK).replace(LEADS, FIXED_LEADS);

const passes = (item, r) => assert.equal(item.check(r), true);
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, 'expected a hint');
  assert.match(got, re);
};

test('the model answer passes every item it reads', () => {
  const r = copy(model);
  passes(parking, r);
  passes(leads, r);
  passes(kept, r);
});

test('two other wordings pass: a different order and different words', () => {
  const a = swap(PARK, "- Park at Station Road car park, five minutes' walk. The library car park is closed on Saturdays for the farmers' market.")
    .replace(LEADS, '- Bring your own tools if you have them. Extension leads: Jordan says the library lends them, TBC with Priya.');
  const b = swap(PARK, "- Don't park at the library on Saturdays, the car park is shut for the market. Station Rd is closest.")
    .replace(LEADS, '- Bring your own tools if you have them; does the library still lend us extension leads? (check)');
  for (const note of [a, b]) {
    const r = copy(note);
    passes(parking, r);
    passes(leads, r);
    passes(kept, r);
  }
});

test('a note edited by Claude in the same words as the model passes the same way', () => {
  passes(parking, copy(model.replace(/\n/g, '\r\n')));
});

test('an untouched note fails parking with a pointer to the email line, and leads as settled', () => {
  const r = copy();
  says(parking, r, /hasn't changed yet.*line 12 of `fixit\/feb\/venue-email-feb\.md`/);
  says(leads, r, /still reads as settled/);
  passes(kept, r);
});

test('a deleted true claim fails, naming the line and the source that supports it', () => {
  const r = copy(model.replace('- Doors open to the public at 10:30.\n', ''));
  passes(parking, r);
  says(kept, r, /Doors open to the public at 10:30.*line 5 of `fixit\/feb\/meeting-notes-2027-01-28\.md`/);
});

test('filler bullets in place of the true claims do not pass', () => {
  const filler = [
    '# Welcome, new volunteers!',
    '',
    FIXED_PARK,
    FIXED_LEADS,
    '- Have a great first session!',
    '- Ask anyone if you have questions.',
    '- Wear comfortable shoes.',
    '- Smile!',
  ].join('\n');
  const r = copy(filler);
  passes(parking, r);
  passes(leads, r);
  says(kept, r, /lost a line its sources support/);
});

test('an unsupported "free" on Station Road fails, pointing at what the email says', () => {
  const r = copy(swap(PARK, "- Park at Station Road car park, it's free."));
  says(parking, r, /says parking is free.*says nothing about what it costs/);
});

test('"feel free" is not a price', () => {
  passes(parking, copy(swap(PARK, '- Feel free to park at Station Road car park; the library car park is closed on Saturdays.')));
});

test('a confident claim about the leads fails, either way round', () => {
  says(leads, copy(model.replace(FIXED_LEADS, '- The library will definitely lend us extension leads, so leave yours at home.')), /still reads as settled/);
  says(leads, copy(model.replace(FIXED_LEADS, "- The library doesn't lend extension leads, bring your own.")), /Neither .* says that either/);
});

test('a deleted leads line fails: missing from the sources is not the same as wrong', () => {
  says(leads, copy(model.replace(FIXED_LEADS + '\n', '')), /no longer mentions extension leads/);
});

test('a deleted parking line, or one that only says where not to go, fails', () => {
  says(parking, copy(model.replace(FIXED_PARK + '\n', '')), /No line in the note tells a volunteer where to park/);
  says(parking, copy(model.replace(FIXED_PARK, "- Don't use the library car park on Saturdays.")), /not where to go instead/);
});

test('still sending people to the library car park fails, even beside Station Road', () => {
  says(parking, copy(swap(PARK, '- Park in the library car park, or at Station Road if it is full.')), /still sends volunteers to the library's car park/);
});

test('struck-through text is what the note no longer says', () => {
  passes(parking, copy(swap(PARK, "- ~~Park in the library car park behind the building, it's free.~~ Park at Station Road car park; the library's car park is closed on Saturdays.")));
});

test('a missing note fails with the way back', () => {
  const dir = repo({ 'fixit/feb/other.md': 'x' });
  commit(dir, 'start');
  says(parking, openRepo(dir), /is missing\. Reset this step/);
});

test('a leads line marked as settled ("confirmed", "checked") fails: nobody has confirmed it', () => {
  for (const mark of ['(confirmed)', '(Priya confirmed)', '(checked with the library)', '- confirmed by Priya'])
    says(leads, copy(model.replace(FIXED_LEADS, `- Bring your own tools if you have them; the library lends us extension leads ${mark}.`)), /still reads as settled/);
  for (const mark of ['(not confirmed yet)', '(to be checked)', '(unconfirmed)', '(Priya is checking)'])
    passes(leads, copy(model.replace(FIXED_LEADS, `- Bring your own tools if you have them; the library lends us extension leads ${mark}.`)));
});
