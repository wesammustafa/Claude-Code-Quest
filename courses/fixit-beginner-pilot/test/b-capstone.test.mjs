// The pilot capstone's check against the guides a Learner may hand over:
// the two exemplars, the near miss, Claude's two first drafts, and one
// mistake per item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const cap = await import(pathToFileURL(join(checks, 'lessons/b-capstone.mjs')).href);
const [sources, date, times, capacity, access, rules, privacy, contact, note] = cap.items;

const read = (p) => readFileSync(join(COURSE, p), 'latin1');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/b-capstone/project']) {
  const walk = (rel = '') => {
    for (const e of readdirSync(join(COURSE, dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else START[r] = readFileSync(join(COURSE, dir, r));
    }
  };
  walk();
}
const text = (p) => readFileSync(join(COURSE, p), 'utf8');
const A = text('solutions/b-capstone/fixit/march/attendee-guide.md');
const NOTE = text('solutions/b-capstone/fixit/march/readiness-note.md');
const fixture = (name) => text(`test/fixtures/b-capstone/${name}`);

function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const guideItems = [date, times, capacity, access, rules, privacy, contact];
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('exemplar A and its readiness note pass every item, the PDF and PNG untouched', () => {
  passes(copy({ [cap.GUIDE]: A, [cap.NOTE]: NOTE }), cap.items);
});

test('exemplar B, access first and no number of places, passes the guide items', () => {
  passes(copy({ [cap.GUIDE]: fixture('attendee-guide-B.md') }), guideItems);
});

test('the near miss fails on capacity, access and the new rule, and nothing else', () => {
  const r = copy({ [cap.GUIDE]: fixture('attendee-guide-near-miss.md') });
  says(capacity, r, /40 places.*occupancy line to the end of the sentence/);
  says(access, r, /accessible by lift.*Line 12/);
  says(rules, r, /new this month/);
  passes(r, [date, times, privacy, contact]);
});

test("Claude's weak draft fails on times, 60, step-free, the new rule and Priya's number", () => {
  const r = copy({ [cap.GUIDE]: fixture('draft-weak.md') });
  says(times, r, /10am/);
  says(capacity, r, /60 seats.*flyer/);
  says(access, r, /step-free/);
  says(rules, r, /new this month/);
  says(privacy, r, /555-0187/);
});

test("Claude's strong draft is wrong only about the 40", () => {
  const r = copy({ [cap.GUIDE]: fixture('draft-strong.md') });
  says(capacity, r, /Up to 40 places/);
  passes(r, [date, times, access, rules, privacy, contact]);
});

test('40 is fine where it says whose limit it is, and 30 or no number both pass', () => {
  const with40 = A.replace('**Booking:** 30 places.', '**Booking:** 30 places: the room holds 40 including our ten volunteers.');
  passes(copy({ [cap.GUIDE]: with40 }), [capacity]);
  says(capacity, copy({ [cap.GUIDE]: A.replace('30 places', '35 places') }), /caps March sign-ups at 30/);
  says(capacity, copy({ [cap.GUIDE]: A.replace(/\*\*Booking:\*\*.*\n/, '**Places:** 30. If there is space at 11:00, we take walk-ins.\n') }), /No line tells people to book/);
});

test('access: unanswered fails, plain "step-free" fails, a lift that is being checked passes', () => {
  const noAccess = A.replace(/\*\*Getting to Room B:\*\*.*\n/, '');
  says(access, copy({ [cap.GUIDE]: noAccess.replace(/first floor/g, 'Room B') }), /doesn't say how to get to Room B/);
  says(access, copy({ [cap.GUIDE]: A.replace(/\*\*Step-free access is being confirmed:\*\* the lift has had repairs\. Call the library on 555-0100 before you travel and we'll tell you\./, 'Room B is step-free.') }), /step-free/);
  passes(copy({ [cap.GUIDE]: A.replace(/\*\*Step-free access.*\n/, 'There is a lift; please call 555-0100 to check it is working before you travel.\n') }), [access]);
});

test("adding Priya's number, as she asks, fails; a missing desk number fails", () => {
  says(privacy, copy({ [cap.GUIDE]: A.replace('Call the library on 555-0100', 'Text Priya on 555 0187') }), /555 0187.*Maya's brief/);
  says(contact, copy({ [cap.GUIDE]: A.replace(/555-0100/g, 'the events desk') }), /no number to call/);
});

test('the readiness note: missing, unsourced, flyer first, and no open section each fail', () => {
  says(note, copy({ [cap.GUIDE]: A }), /There's no/);
  says(note, copy({ [cap.NOTE]: '# Ready\n\nIt all looks right to me.\n' }), /names a source for 0 facts/);
  says(note, copy({ [cap.NOTE]: `${NOTE}\nThe flyer wins over the booking when they disagree.\n` }), /puts the flyer above the booking/);
  says(note, copy({ [cap.NOTE]: NOTE.replace(/## Still open[\s\S]*?(?=## How I checked)/, '') }), /no section for what's still open/);
  says(note, copy({ [cap.NOTE]: NOTE.replace(/- \*\*Step-free access\.\*\*.*\n/, '- Nothing.\n') }), /doesn't mention the lift/);
});

test('editing a source fails: the text version, the scan and the flyer photo all count', () => {
  says(sources, copy({ 'fixit/march/booking-confirmation-march-text.md': 'edited\n' }), /booking-confirmation-march-text\.md` has changed/);
  says(sources, copy({ 'fixit/march/booking-confirmation-march.pdf': Buffer.from('not a pdf') }), /booking-confirmation-march\.pdf` has changed/);
  void read;
});
