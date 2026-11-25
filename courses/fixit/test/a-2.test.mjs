// The a-2 check against the summer folders a Learner may leave: the model
// easy-read set (valid A, three helpers each writing one page), another
// valid set in other words (valid B, written in one session and checked by
// three helpers), the manuscript's near misses, and the ones beyond it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a2 = await import(pathToFileURL(join(checks, 'lessons/a-2.mjs')).href);
const [easy, access, kept] = a2.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/a-2/project']) {
  const walk = (d, rel = '') => {
    for (const e of readdirSync(join(COURSE, d, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(d, r);
      else START[r] = read(`${d}/${r}`);
    }
  };
  walk(dir);
}
const PUBLIC = 'fixit/summer/public';
const IDS = ['june', 'july', 'august'];
const solution = (name) => read(`solutions/a-2/${PUBLIC}/${name}`);
/** The pages and the schedule as the Worked example leaves them. */
const WORKED = Object.fromEntries(['june', 'july', 'august', 'schedule'].map((p) => [`${PUBLIC}/${p}.md`, solution(`${p}.md`)]));
const EASY_A = Object.fromEntries(IDS.map((id) => [`${PUBLIC}/${id}-easy.md`, solution(`${id}-easy.md`)]));
const EASY_B = Object.fromEntries(IDS.map((id) => [`${PUBLIC}/${id}-easy.md`, read(`test/fixtures/a-2/${id}-easy-B.md`)]));

function copy(files = {}) {
  const dir = repo(START, { nested: true });
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const all = [easy, access, kept];
const passes = (r, items = all) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('valid A: the model easy-read set beside the pages the Worked example left passes every item', () => {
  passes(copy({ ...WORKED, ...EASY_A }));
});

test('valid B: an easy-read set in other words, paragraphs and a "Getting in" line first, passes too', () => {
  passes(copy({ ...WORKED, ...EASY_B }));
});

test('the easy-read job passes on pages the Worked example never changed, and with the rule written another way', () => {
  passes(copy(EASY_A));
  const other = {
    [`${PUBLIC}/june.md`]: START[`${PUBLIC}/june.md`].replace('e-scooter batteries.', 'e-scooter batteries, and lithium power tool batteries over 36V.'),
    [`${PUBLIC}/schedule.md`]: START[`${PUBLIC}/schedule.md`].replace('\nBook on', '\nNew from June: no lithium power tool batteries rated over 36 V.\n\nBook on'),
  };
  passes(copy({ ...other, ...EASY_A }));
});

test('the untouched starting state fails: no easy-read page yet', () => {
  const r = copy();
  says(easy, r, /There's no `fixit\/summer\/public\/june-easy\.md` yet/);
  says(access, r, /There's no/);
  passes(r, [kept]);
});

test('the near miss of Step 7: "rewrite each page in easy-read" changes the originals, and the check names june.md', () => {
  const inPlace = Object.fromEntries(IDS.map((id) => [`${PUBLIC}/${id}.md`, solution(`${id}-easy.md`)]));
  const r = copy({ ...WORKED, ...inPlace });
  says(kept, r, /^`june\.md` changed\. The easy-read job leaves the original pages as they were\./);
  says(easy, r, /There's no `fixit\/summer\/public\/june-easy\.md` yet/);
});

test('the near miss of the Acceptance: the schedule rebuilt from the easy-read pages in the same run', () => {
  const schedule = { [`${PUBLIC}/schedule.md`]: '# Fix-It Saturdays this summer\n\n- Saturday 12 June: Room B is upstairs. There is a lift.\n- Saturday 10 July: Room B is upstairs. There is a lift.\n- Saturday 14 August: Northside. No steps.\n' };
  const r = copy({ ...WORKED, ...EASY_A, ...schedule });
  says(kept, r, /^`schedule\.md` changed\. The schedule is built from the session pages/);
  passes(r, [easy, access]);
});

test('one small edit to an original while making the easy-read set fails too', () => {
  const june = WORKED[`${PUBLIC}/june.md`].replace('Tea is free;', 'Tea and biscuits are free;');
  says(kept, copy({ ...WORKED, ...EASY_A, [`${PUBLIC}/june.md`]: june }), /^`june\.md` changed/);
});

test("a page copied from another session's fails: its date, or another session's date", () => {
  const july = solution('june-easy.md');
  says(easy, copy({ ...WORKED, ...EASY_A, [`${PUBLIC}/july-easy.md`]: july }), /`july-easy\.md` doesn't give its date, Saturday 10 July/);
  const both = solution('july-easy.md').replace('- The place is', '- Last time was 12 June.\n- The place is');
  says(easy, copy({ ...WORKED, ...EASY_A, [`${PUBLIC}/july-easy.md`]: both }), /`july-easy\.md` gives 12 June, the june session's date/);
  const august = solution('august-easy.md').replace(/Northside Community Centre, /g, '').replace(/at Northside/, '').replace(/Northside office/g, 'centre office').replace('Northside Community Centre office', 'centre office');
  says(easy, copy({ ...WORKED, ...EASY_A, [`${PUBLIC}/august-easy.md`]: august }), /`august-easy\.md` doesn't say where: Northside Community Centre/);
});

test('easy-read pages saved somewhere else are not beside their pages', () => {
  const elsewhere = Object.fromEntries(IDS.map((id) => [`fixit/summer/${id}-easy.md`, solution(`${id}-easy.md`)]));
  says(easy, copy({ ...WORKED, ...elsewhere }), /There's no `fixit\/summer\/public\/june-easy\.md` yet\. Each easy-read version is saved beside its page/);
});

test('an easy-read page that opens with the date, not the access line, fails with the line it opens with', () => {
  const dateFirst = solution('july-easy.md').replace('- Room B is upstairs. There is a lift.\n- The lift is next to the children\'s library.\n', '').replace('- Come from 10:30am.', '- Room B is upstairs. There is a lift.\n- Come from 10:30am.');
  says(access, copy({ ...WORKED, ...EASY_A, [`${PUBLIC}/july-easy.md`]: dateFirst }), /The first line of `july-easy\.md` is "The day is Saturday 10 July 2027"/);
});

test('a missing original is named, and a deleted schedule too', () => {
  const r = copy({ ...WORKED, ...EASY_A });
  r.gitLocal('rm', '-qf', `${PUBLIC}/august.md`, `${PUBLIC}/schedule.md`);
  says(kept, r, /`fixit\/summer\/public\/august\.md` is missing/);
});

test('withoutRule takes out the battery rule only, list item or line of its own', () => {
  const page = '**We can\'t take:** microwaves; gas appliances; lithium power tool batteries over 36 V.';
  assert.equal(a2.withoutRule(page), "**We can't take:** microwaves; gas appliances");
  assert.equal(a2.withoutRule('| a | b |\n\nNew from June: we can\'t accept lithium power tool batteries over 36 V.\n\nBook.'), '| a | b |\n\nBook');
  assert.equal(a2.withoutRule('Tea is free.'), 'Tea is free');
});

test("a copy of the page saved as its easy-read version fails: its first line is the date, not the access line", () => {
  const copied = Object.fromEntries(IDS.map((id) => [`${PUBLIC}/${id}-easy.md`, WORKED[`${PUBLIC}/${id}.md`]]));
  const r = copy({ ...WORKED, ...copied });
  says(access, r, /The first line of `june-easy\.md` is "\*\*When:\*\* Saturday 12 June 2027, 10:30am to 1pm"/);
  passes(r, [easy, kept]);
});
