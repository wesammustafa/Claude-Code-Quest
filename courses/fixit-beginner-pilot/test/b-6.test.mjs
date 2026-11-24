// The pilot b-6 check against the guides and fact tables a Learner may leave:
// the model answer, a shorter valid guide, and the near miss the Lesson is
// built around (the biscuits row Claude gets wrong, accepted unread).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const b6 = await import(pathToFileURL(join(checks, 'lessons/b-6.mjs')).href);
const [sources, table, time, parking, access, booking, rules, privacy, biscuits] = b6.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/b-6/project']) {
  const walk = (d, rel = '') => {
    for (const e of readdirSync(join(COURSE, d, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(d, r);
      else START[r] = read(`${d}/${r}`);
    }
  };
  walk(dir);
}
const MODEL_GUIDE = read('solutions/b-6/fixit/feb/draft-attendee-guide.md');
const MODEL_TABLE = read('solutions/b-6/fixit/feb/fact-table.md');

function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const all = [sources, table, time, parking, access, booking, rules, privacy, biscuits];
const passes = (r, items = all) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('the model guide and table pass every item', () => {
  passes(copy({ [b6.DRAFT]: MODEL_GUIDE, [b6.TABLE]: MODEL_TABLE }));
});

test('a shorter guide that says less, and leaves parking out, passes too', () => {
  const short = [
    '# Fix-It Saturday, 13 February 2027',
    '',
    'Free repair session at Millbrook Library, Room B, 10:30am to 1pm.',
    '',
    'Room B is upstairs; for access, call the events desk on 555-0100.',
    '',
    'Places are limited: please book on the library events page.',
    '',
    "Bring the broken item and its charger. We can't take microwaves, gas appliances, or anything with a swollen battery.",
    '',
    'Tea is free. Questions? 555-0100.',
  ].join('\n');
  passes(copy({ [b6.DRAFT]: short, [b6.TABLE]: MODEL_TABLE }));
});

test('the near miss: every line fixed but biscuits, and the table that says it agrees', () => {
  const guide = MODEL_GUIDE.replace(/\*\*What it costs:\*\*.*\n/, '**What it costs:** free. Tea and biscuits provided.\n');
  const t = MODEL_TABLE.replace(/\| Tea and biscuits \|[^\n]*/, '| Tea and biscuits | agrees | flyer; meeting-notes-2027-01-28.md:12 "Tea yes" |');
  const r = copy({ [b6.DRAFT]: guide, [b6.TABLE]: t });
  says(table, r, /Read every line of `fixit\/feb\/meeting-notes-2027-01-28\.md`/);
  says(biscuits, r, /Tea and biscuits provided.*line 12/);
  passes(r, [sources, time, parking, access, booking, rules, privacy]);
});

test('the untouched draft fails each claim it makes, pointing at the line that settles it', () => {
  const r = copy({ [b6.TABLE]: MODEL_TABLE });
  says(time, r, /10am.*line 5 of `fixit\/feb\/meeting-notes/i);
  says(parking, r, /line 12 of `fixit\/feb\/venue-email-feb\.md`/i);
  says(access, r, /fully wheelchair accessible.*Line 11/);
  says(booking, r, /just turn up.*Line 7/);
  says(rules, r, /fix anything/);
  says(privacy, r, /555-0187.*Line 23/);
  says(biscuits, r, /biscuits/);
});

test('no fact table, a short one, and an unsourced row each fail', () => {
  says(table, copy({ [b6.DRAFT]: MODEL_GUIDE }), /There's no/);
  const short = MODEL_TABLE.split('\n').slice(0, 8).join('\n');
  says(table, copy({ [b6.TABLE]: short }), /claim rows?\. The draft makes at least eight/);
  says(table, copy({ [b6.TABLE]: MODEL_TABLE.replace('| One item per person until 12:00 | right | group-notes.md:7 |', '| One item per person until 12:00 | right | I think so |') }), /names no file/);
});

test('editing a source fails, even to delete the hidden note', () => {
  const email = START['fixit/feb/partner-email.md'].replace(/<!--[\s\S]*?-->\n/, '');
  says(sources, copy({ 'fixit/feb/partner-email.md': email }), /partner-email\.md` has changed/);
});

test('step-free, free parking, a private number and an unhedged biscuit each fail on their own', () => {
  const base = { [b6.TABLE]: MODEL_TABLE };
  says(access, copy({ ...base, [b6.DRAFT]: MODEL_GUIDE.replace('There\'s a lift next to the children\'s library, and stairs.', 'It is step-free.') }), /step-free/);
  passes(copy({ ...base, [b6.DRAFT]: MODEL_GUIDE.replace('There\'s a lift next to the children\'s library, and stairs.', "It isn't step-free; there's a lift.") }), [access]);
  says(parking, copy({ ...base, [b6.DRAFT]: MODEL_GUIDE.replace('Station Road car park is a five-minute walk.', 'Station Road car park is free and a five-minute walk.') }), /says parking is free/);
  says(privacy, copy({ ...base, [b6.DRAFT]: MODEL_GUIDE.replace('555-0100.', '555-0100, or text Priya on 555 0187.') }), /555 0187/);
  passes(copy({ ...base, [b6.DRAFT]: MODEL_GUIDE.replace('Tea is free,', 'Tea is free, biscuits if someone brings them,') }), [biscuits]);
});
