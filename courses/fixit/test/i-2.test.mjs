// i-2's check against what a Learner may leave: the untouched start, the
// two valid memories, the manuscript's near misses, Claude's /init draft
// kept as it is, the rule scoped to a folder that doesn't exist, and the
// access note a session without the rule writes. Claude's auto memory sits
// in a home folder of the test's own, named after each copy's git root.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i2 = await import(pathToFileURL(join(checks, 'lessons/i-2.mjs')).href);
const [rules, facts, auto, scoped, note] = i2.items;

process.env.HOME = mkdtempSync(join(tmpdir(), 'i-2-home-'));
const PROJECTS = join(process.env.HOME, '.claude', 'projects');

const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/i-2/project']) {
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
const SEEDED = text('practice-template/lessons/i-2/auto-memory/MEMORY.md');
const KEPT = SEEDED.split('\n').filter((l) => !/Room B|555-0100/.test(l)).join('\n');
const A = text('solutions/i-2/fixit/CLAUDE.example.md');
const RULE = text('solutions/i-2/fixit/dot-claude/rules/public-pages.md');
const NOTE = text('solutions/i-2/fixit/march/access-note.md');
const fixture = (name) => text(`test/fixtures/i-2/${name}`);
const DONE = { [i2.MEMORY]: A, [`${i2.RULES}/public-pages.md`]: RULE, [i2.NOTE]: NOTE };

// A practice copy with `files` over the start, and its auto memory holding
// `memory` (null: none), in the folder Claude Code names after `as`, the
// copy's root by default.
function copy(files = {}, { memory = KEPT, as } = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  const r = openRepo(dir);
  if (memory !== null) {
    const path = join(PROJECTS, as ?? i2.projectName(r.top), 'memory', 'MEMORY.md');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, memory);
  }
  return r;
}
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('the untouched start fails every item, Room B in the auto memory included', () => {
  const r = copy({}, { memory: SEEDED });
  says(rules, r, /There's no `fixit\/CLAUDE\.md` yet/);
  says(facts, r, /There's no `fixit\/CLAUDE\.md` yet/);
  says(auto, r, /still says "Room B at Millbrook Library holds 40 people, including volunteers and staff"/);
  says(scoped, r, /There's no rule in `fixit\/\.claude\/rules\/` yet/);
  says(note, r, /There's no `fixit\/march\/access-note\.md` yet/);
});

test('valid A, the solution, passes every item', () => {
  passes(copy(DONE), i2.items);
});

test('valid B, nine lines of prose with a line that facts change monthly, passes the memory items', () => {
  const B = fixture('claude-md-B.md');
  assert.equal(B.trim().split('\n').length, 9);
  passes(copy({ ...DONE, [i2.MEMORY]: B }), i2.items);
});

test('the near miss, valid A plus Northside\'s limit, fails on that line alone', () => {
  const near = `${A}\n- Northside Main Hall: 50 people, free parking.\n`;
  const line = near.trimEnd().split('\n').length;
  const r = copy({ ...DONE, [i2.MEMORY]: near });
  says(facts, r, new RegExp(`\`fixit/CLAUDE\\.md\` line ${line} holds a room limit: "Northside Main Hall: 50 people, free parking"\\. Facts like this come from the month's sources\\.`));
  passes(r, [rules, auto, scoped, note]);
});

test("Claude's /init draft kept as it is fails on items 1 and 2: the private number rule, Room B's limit, Priya's number and the folder tour", () => {
  const draft = fixture('init-draft.md');
  says(rules, copy({ [i2.MEMORY]: draft }), /no rule that keeps private numbers off public pages/);
  says(facts, copy({ [i2.MEMORY]: draft }), /line 10 holds a room limit: "Sessions are in Room B at Millbrook Library, first floor, 40 people max"/);
  const noLimit = draft.replace(/^- Sessions.*\n/m, '');
  says(facts, copy({ [i2.MEMORY]: noLimit }), /line 10 holds a session's hours: "Public hours are 10:30 to 13:00"/);
  const noHours = noLimit.replace(/^- Public hours.*\n/m, '');
  says(facts, copy({ [i2.MEMORY]: noHours }), /line 10 gives 555-0187: "Questions go to Priya on 555-0187"/);
  const tourOnly = noHours.replace(/^- Questions.*\n/m, '');
  says(facts, copy({ [i2.MEMORY]: tourOnly }), /line 2 starts a tour of the folders, 4 lines long.*Claude can see the folders: cut the tour/);
  // Its rules section was right: with a contacts rule in place of the facts, it passes.
  const fixed = tourOnly.replace(/This folder has .*\n/, '').replace('## Key facts\n', '## Contacts\n- Never put a private number on a public page; public enquiries go to the venue\'s public number.\n');
  passes(copy({ [i2.MEMORY]: fixed }), [rules, facts]);
});

test('each rule CLAUDE.md must hold fails by name when it is missing or upside down', () => {
  const noOrder = A.replace(/## Which source wins[\s\S]*?\n\n/, '');
  says(rules, copy({ [i2.MEMORY]: noOrder }), /doesn't say which source wins/);
  const upside = A.replace('1. The venue\'s signed booking.', '1. Old flyers, for the dates.').replace(/^4\. Old flyers.*$/m, '4. The venue\'s signed booking.');
  says(rules, copy({ [i2.MEMORY]: upside }), /line 7 puts old flyers above the venue's written confirmation: "Old flyers, for the dates"/);
  const notesFirst = 'When sources disagree, our notes beat the signed booking, and the booking beats old flyers.\n';
  says(rules, copy({ [i2.MEMORY]: notesFirst }), /line 1 puts our notes above the venue's written confirmation/);
  const noOpen = A.replace(/## Facts we can't confirm\n.*\n\n/, '');
  says(rules, copy({ [i2.MEMORY]: noOpen }), /doesn't say how to publish a detail nobody has confirmed/);
  const noContact = A.replace(/publish it as \*\*being confirmed\*\* and give the venue's public number/, 'publish it as **being confirmed**');
  says(rules, copy({ [i2.MEMORY]: noContact }), /says how to mark an unconfirmed detail, but not who to call/);
  const noPrivacy = A.replace(/## Contacts\n.*\n\n/, '');
  says(rules, copy({ [i2.MEMORY]: noPrivacy }), /no rule that keeps private numbers off public pages/);
  const asking = A.replace(/^Never put Priya's number.*$/m, "Put Priya's number on public pages so people can reach her.");
  says(rules, copy({ [i2.MEMORY]: asking }), /no rule that keeps private numbers off public pages/);
  const long = `${A}${'\n- Plain English.'.repeat(45)}\n`;
  says(rules, copy({ [i2.MEMORY]: long }), /has 6\d lines.*keep it under 60/);
});

test('a rule that names the private number, a date or the hours is an event fact; a date written as the house style is not', () => {
  const named = A.replace("Never put Priya's number,", "Never put Priya's number (555-0187),");
  says(facts, copy({ [i2.MEMORY]: named }), /gives 555-0187/);
  const dated = `${A}- The next session is on Saturday 10 April 2027.\n`;
  says(facts, copy({ [i2.MEMORY]: dated }), /holds a date: "The next session is on Saturday 10 April 2027"/);
  const style = A.replace('Times as 10:30am.', 'Times as 10:30am. Dates as Saturday 10 April 2027.');
  passes(copy({ [i2.MEMORY]: style }), [rules, facts]);
  const venueNumbers = `${A}- The library's public number is 555-0100, Northside's is 555-0130.\n`;
  passes(copy({ [i2.MEMORY]: venueNumbers }), [facts]);
});

test('the auto memory passes once Room B\'s limit is gone, or the file with it, and is found when the copy has moved', () => {
  passes(copy(DONE, { memory: KEPT }), [auto]);
  passes(copy(DONE, { memory: null }), [auto]);
  passes(copy(DONE, { memory: '' }), [auto]);
  says(auto, copy(DONE, { memory: '- Northside Main Hall holds 50 people.\n' }), /still says "Northside Main Hall holds 50 people"/);
  // The build's real-tools run moves the copy: the folder keeps the old root's name,
  // so a folder named after the end of this root's path is this copy's.
  const dir = repo(START);
  commit(dir, 'start');
  const moved = openRepo(dir);
  const path = join(PROJECTS, `-${i2.projectName(basename(moved.top))}`, 'memory', 'MEMORY.md');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, SEEDED);
  says(auto, moved, /still says "Room B/);
  // Another project's auto memory is never this copy's.
  passes(copy(DONE, { memory: SEEDED, as: '-somewhere-else' }), [auto]);
});

test("a rule scoped to a folder that doesn't exist fails with the manuscript's words, and the fix passes", () => {
  const dead = RULE.replace('  - "*/attendee-guide.md"\n  - "public/**"\n', '  - "guides/**"\n');
  says(scoped, copy({ ...DONE, [`${i2.RULES}/public-pages.md`]: dead }), /^`\.claude\/rules\/public-pages\.md` is scoped to `guides\/\*\*`, which matches no file in `fixit\/`\. It will never load\.$/);
  const onlyPublic = RULE.replace('  - "*/attendee-guide.md"\n', '');
  says(scoped, copy({ ...DONE, [`${i2.RULES}/public-pages.md`]: onlyPublic }), /scoped to `public\/\*\*`, which matches no file/);
  const unscoped = RULE.replace(/^---[\s\S]*?---\n/, '');
  says(scoped, copy({ ...DONE, [`${i2.RULES}/public-pages.md`]: unscoped }), /No rule in `fixit\/\.claude\/rules\/` has `paths:`/);
  const brace = RULE.replace('  - "*/attendee-guide.md"\n  - "public/**"\n', '  - "{march,feb}/attendee-guide.md"\n');
  passes(copy({ ...DONE, [`${i2.RULES}/public-pages.md`]: brace }), [scoped]);
  const flow = RULE.replace(/paths:\n.*\n.*\n/, 'paths: "march/*.md, public/**"\n');
  passes(copy({ ...DONE, [`${i2.RULES}/public-pages.md`]: flow }), [scoped]);
  // Its own folder is no match: a rule scoped to .claude/ matches nothing it covers.
  const self = RULE.replace('  - "*/attendee-guide.md"\n  - "public/**"\n', '  - ".claude/**"\n');
  says(scoped, copy({ ...DONE, [`${i2.RULES}/public-pages.md`]: self }), /scoped to `\.claude\/\*\*`, which matches no file/);
  // A second rule that loads everywhere is no failure; a dead second one is.
  passes(copy({ ...DONE, [`${i2.RULES}/style.md`]: '# Style\n- Short lines.\n' }), [scoped]);
  says(scoped, copy({ ...DONE, [`${i2.RULES}/rota.md`]: '---\npaths: ["rota/**"]\n---\n# Rota\n' }), /`\.claude\/rules\/rota\.md` is scoped to `rota\/\*\*`/);
});

test('the access note a session without the rule writes fails; a private number or no number fails', () => {
  says(note, copy({ ...DONE, [i2.NOTE]: fixture('access-note-no-rule.md') }), /says "Room B is on the first floor, accessible by lift \(next to the children's library\) or stairs" as if it were settled/);
  says(note, copy({ ...DONE, [i2.NOTE]: NOTE.replace('555-0100', '555-0187') }), /gives 555-0187/);
  says(note, copy({ ...DONE, [i2.NOTE]: NOTE.replace(': call the library on 555-0100 before you travel', '') }), /gives no number to call/);
  says(note, copy({ ...DONE, [i2.NOTE]: 'Room B is on the first floor.\nCall the library on 555-0100 before you travel.\n' }), /doesn't say step-free access is being confirmed/);
  const mixed = 'The lift is being confirmed. Room B is fully accessible. Call 555-0100.\n';
  says(note, copy({ ...DONE, [i2.NOTE]: mixed }), /says "Room B is fully accessible" as if it were settled/);
  passes(copy({ ...DONE, [i2.NOTE]: 'Room B is upstairs, with a lift and stairs. Whether it is step-free is not yet confirmed, so please call 555-0100 first.\n' }), [note]);
});

test.after(() => rmSync(process.env.HOME ?? '', { recursive: true, force: true }));
