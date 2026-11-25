// The a-8 check against the August folders a Learner may leave: the model
// page and decision note (valid A), a more cautious contact line with a note
// written as a table under headings (valid B), the manuscript's near miss
// and routes back, and the ones beyond it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a8 = await import(pathToFileURL(join(checks, 'lessons/a-8.mjs')).href);
const [page, toilet, note] = a8.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/a-8/project']) {
  const walk = (d, rel = '') => {
    for (const e of readdirSync(join(COURSE, d, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(d, r);
      else START[r] = read(`${d}/${r}`);
    }
  };
  walk(dir);
}
const PAGE = 'fixit/summer/a-8/august-sam-2027-06-09.md';
const NOTE = 'fixit/summer/a-8/august-decision.md';
const SAM = START[PAGE];
const A = { [PAGE]: read(`solutions/a-8/${PAGE}`), [NOTE]: read(`solutions/a-8/${NOTE}`) };
const B = { [PAGE]: read('test/fixtures/a-8/august-sam-B.md'), [NOTE]: read('test/fixtures/a-8/august-decision-B.md') };
const SOLVED = A[PAGE];

function copy(files = {}) {
  const dir = repo(START, { nested: true });
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const all = [page, toilet, note];
const passes = (r, items = all) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };
/** The solved page with one sentence of the Where line changed. */
const where = (from, to) => SOLVED.replace(from, to);

test("valid A: Sam's page without his mobile or the parking line, and the model note, passes every item", () => {
  passes(copy(A));
});

test('valid B: the Questions line held back to the Northside office, and a note as a table under headings, passes too', () => {
  passes(copy(B));
});

test("the untouched starting state fails: Sam's mobile is on the page, and there's no note", () => {
  const r = copy();
  says(page, r, /^The page still gives 555-0162, Sam's mobile\./);
  says(note, r, /^There's no `fixit\/summer\/a-8\/august-decision\.md` yet\./);
  passes(r, [toilet]);
});

test('the near miss: by count, the toilet line changed and the number removed, the parking line never noticed', () => {
  const byCount = SAM.replace('Text Sam on 555-0162, or call', 'Call').replace('accessible toilet available', 'the accessible toilet is being refurbished');
  const r = copy({ [PAGE]: byCount, [NOTE]: 'Two of three reviewers found problems, so I changed the toilet line and removed Sam\'s number.\n' });
  says(toilet, r, /^The page now says the toilet is being refurbished\. Kofi's email of 25 May says it's back in use\. Which source is newer\?$/);
  says(note, r, /doesn't say what you did with the accuracy review/);
  says(page, r, /^The page says "Free parking at the centre\." Which source says that\?$/);
});

test('the routes back: the toilet line acted on, or the parking line left in, each gets its own line', () => {
  says(toilet, copy({ ...A, [PAGE]: where('accessible toilet available', 'accessible toilet being refurbished') }), /^The page now says the toilet is being refurbished\./);
  says(page, copy({ ...A, [PAGE]: where('accessible toilet available.', 'accessible toilet available. Free parking at the centre.') }), /^The page says "Free parking at the centre\." Which source says that\?$/);
});

test("Reset step's state, Sam's page as he left it, passes the toilet item and fails the page item", () => {
  const r = copy({ [NOTE]: A[NOTE] });
  says(page, r, /555-0162/);
  passes(r, [toilet, note]);
});

test('a private number in another format, or anyone else\'s, fails', () => {
  says(page, copy({ ...A, [PAGE]: SOLVED.replace('555-0130.', '555-0130, or text Sam on 555 0162.') }), /555-0162, Sam's mobile/);
  says(page, copy({ ...A, [PAGE]: SOLVED.replace('555-0130.', '555-0130, or Sam on 5550162.') }), /555-0162/);
  says(page, copy({ ...A, [PAGE]: SOLVED.replace('555-0130.', '555-0130, or Priya on 555-0187.') }), /^The page gives 555-0187, which is not a public number\./);
});

test('the whole Questions line taken out leaves no number to call, and fails', () => {
  says(page, copy({ ...A, [PAGE]: SOLVED.replace(/^\*\*Questions\?\*\*.*\n?/m, '') }), /^The page gives no number to call now\./);
});

test('parking: free is a claim however it is hedged, a car park at the centre is one unless left open, and asking passes', () => {
  says(page, copy({ ...A, [PAGE]: where('toilet available.', 'toilet available. Free parking at the centre (to be confirmed).') }), /Free parking at the centre \(to be confirmed\)\./);
  says(page, copy({ ...A, [PAGE]: where('toilet available.', 'toilet available. Parking is free on Saturdays.') }), /Parking is free on Saturdays\./);
  says(page, copy({ ...A, [PAGE]: where('toilet available.', "toilet available. There's a car park at the centre.") }), /There's a car park at the centre\./);
  passes(copy({ ...A, [PAGE]: where('toilet available.', 'toilet available. Parking: ask the Northside office.') }), [page]);
  passes(copy({ ...A, [PAGE]: where('toilet available.', 'toilet available. Parking at the centre is being confirmed.') }), [page]);
  passes(copy({ ...A, [PAGE]: SOLVED.replace('Tea is free.', 'Tea is free, and so is the advice.') }), [page]);
});

test('the toilet line removed, or written as closed, fails; "back in use" passes', () => {
  says(toilet, copy({ ...A, [PAGE]: where('; accessible toilet available.', '.') }), /^The page no longer mentions the accessible toilet\./);
  says(toilet, copy({ ...A, [PAGE]: where('accessible toilet available', 'no accessible toilet on site') }), /^The page says "no accessible toilet on site\."/);
  says(toilet, copy({ ...A, [PAGE]: where('accessible toilet available', "the accessible toilet isn't open") }), /Which source is newer\?$/);
  passes(copy({ ...A, [PAGE]: where('accessible toilet available', 'the accessible toilet is back in use') }), [toilet]);
});

test('struck-through or hidden text is what the page no longer says', () => {
  passes(copy({ ...A, [PAGE]: where('toilet available.', 'toilet available. ~~Free parking at the centre.~~ <!-- Sam: 555-0162 -->') }), [page, toilet]);
});

test('a note that names two reviews, or acts on the accessibility finding, fails with its line', () => {
  const two = A[NOTE].replace(/^- Accuracy.*\n/m, '');
  says(note, copy({ ...A, [NOTE]: two }), /doesn't say what you did with the accuracy review\. Name each of the three/);
  const acted = A[NOTE].replace(/^- Accessibility.*$/m, '- Accessibility finding: acted on to be safe, the toilet line changed.');
  says(note, copy({ ...A, [NOTE]: acted }), /says "Accessibility finding: acted on to be safe, the toilet line changed"\. Did you act on the accessibility finding, or set it aside\?/);
  const notAside = A[NOTE].replace(/^- Accessibility.*$/m, '- Accessibility: not set aside, we changed the toilet line.');
  says(note, copy({ ...A, [NOTE]: notAside }), /Did you act on the accessibility finding, or set it aside\?/);
});

test('a note under headings reads each heading with the lines below it', () => {
  const sections = [
    '# August decision',
    '',
    '## Accessibility',
    '',
    "Set aside. It read the April notes; Kofi's email of 25 May says the toilet is back in use.",
    '',
    '## Accuracy',
    '',
    'Agreed, but it missed the parking line.',
    '',
    '## Privacy',
    '',
    "Acted on: Sam's mobile is off the page.",
    '',
    '## Still open',
    '',
    'Ask Kofi whether the car park is open and free on Saturdays.',
    '',
  ].join('\n');
  passes(copy({ ...A, [NOTE]: sections }), [note]);
  // A title that says "set aside" doesn't set every finding aside.
  const titled = A[NOTE].replace(/^# .*$/m, '# August: what we acted on and set aside').replace(/^- Accessibility.*$/m, '- Accessibility: acted on, toilet line changed.');
  says(note, copy({ ...A, [NOTE]: titled }), /Did you act on the accessibility finding/);
});

test("the June decision copied as the August one fails: it names the late email, not Kofi's", () => {
  says(note, copy({ ...A, [NOTE]: read('solutions/a-8/fixit/summer/reviews/june-decision.md') }), /doesn't name the newer evidence\. Which email settles the toilet line/);
});

test('a note with no question, or a question about something else, fails', () => {
  const none = A[NOTE].replace(/^- Open.*$/m, '- Parking line taken out for now.');
  says(note, copy({ ...A, [NOTE]: none }), /doesn't give the one question you're asking/);
  const other = A[NOTE].replace(/^- Open.*$/m, '- Open: should the hall have more chairs?');
  says(note, copy({ ...A, [NOTE]: other }), /doesn't give the one question/);
});

test('a note saved anywhere but beside the page is not there', () => {
  says(note, copy({ [PAGE]: SOLVED, 'fixit/summer/reviews/august-decision.md': A[NOTE] }), /^There's no `fixit\/summer\/a-8\/august-decision\.md` yet/);
});

test("a deleted page is named, with Reset step as the way back", () => {
  const r = copy(A);
  r.gitLocal('rm', '-qf', PAGE);
  says(page, r, /`fixit\/summer\/a-8\/august-sam-2027-06-09\.md` is missing\. Reset this step/);
  says(toilet, r, /is missing/);
});

test("the June page the Worked example corrects isn't what the check reads", () => {
  passes(copy({ ...A, 'fixit/summer/public/june.md': read('solutions/a-8/fixit/summer/public/june.md') }));
});
