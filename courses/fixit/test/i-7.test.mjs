// i-7's check against what a Learner may leave: the untouched start, valid
// A (the solution: the two reading tools allowed, cancel denied), valid B
// (no allow rules, cancel denied), the manuscript's near misses (every
// bookings tool allowed, and the package at @latest), and the mistakes
// around them: the server added at local scope or from the wrong folder,
// without --read-only, cancel left to ask, denied in the local settings
// only, or every tool denied; a skill that falls back on the flyer, says
// nothing on the connection being down or looks the booking up after the
// fact table; a fact table that claims a re-check that never happened; and
// a guide that took the flyer's hours. The start is laid as Questerm lays
// it: the prepared files' inert names (dot-claude/, CLAUDE.example.md)
// restored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i7 = await import(pathToFileURL(join(checks, 'lessons/i-7.mjs')).href);
const [server, limits, procedure, downRun] = i7.items;

const LIVE = { 'dot-claude': '.claude', 'dot-mcp.json': '.mcp.json', 'CLAUDE.example.md': 'CLAUDE.md' };
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/i-7/project']) {
  const walk = (rel = '', as = '') => {
    for (const e of readdirSync(join(COURSE, dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const a = as ? `${as}/${LIVE[e.name] ?? e.name}` : (LIVE[e.name] ?? e.name);
      if (e.isDirectory()) walk(r, a);
      else START[a] = readFileSync(join(COURSE, dir, r));
    }
  };
  walk();
}
const text = (p) => readFileSync(join(COURSE, p), 'utf8');
const MCP = text('solutions/i-7/fixit/dot-mcp.json');
const SETTINGS = text('solutions/i-7/fixit/dot-claude/settings.json');
const SKILL = text('solutions/i-7/fixit/dot-claude/skills/attendee-guide/SKILL.md');
const FACTS = text('solutions/i-7/fixit/march/facts.md');
const KIT = text('solutions/i-7/fixit/KIT.md');
const DONE = { [i7.MCP]: MCP, [i7.SHARED]: SETTINGS, [i7.SKILL]: SKILL, [i7.FACTS]: FACTS, 'fixit/KIT.md': KIT };
const START_FACTS = START[i7.FACTS].toString('utf8');
const START_GUIDE = START[i7.GUIDE].toString('utf8');

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
/** The solution's .mcp.json with the bookings server's args replaced. */
const mcpWith = (args) => json({ mcpServers: { bookings: { type: 'stdio', command: 'npx', args, env: {} } } });
/** The solution's settings with each permissions list changed by `change`. */
const settingsWith = (change) => {
  const s = JSON.parse(SETTINGS);
  change(s.permissions);
  return json(s);
};
/** The skill with step 1 replaced. */
const step1 = (line) => SKILL.replace(/^1\. .*$/m, `1. ${line}`);
const OPEN_ITEM = /^Open item: .*\n/m;

/** A practice copy from the start, with `files` written; a null value removes that file. */
function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  const kept = Object.fromEntries(Object.entries(files).filter(([, v]) => v !== null));
  write(dir, kept);
  for (const [path, v] of Object.entries(files)) if (v === null) rmSync(join(dir, path), { force: true });
  return openRepo(dir);
}
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('the untouched start fails every item', () => {
  const r = copy();
  says(server, r, /^There's no `fixit\/\.mcp\.json` yet\. A server added without `--scope project` is yours alone/);
  says(limits, r, /^The shared settings don't deny `mcp__bookings__cancel_booking`/);
  says(procedure, r, /^None of the skill's steps names the `bookings` connection/);
  says(downRun, r, /^`fixit\/march\/facts\.md` has no open item saying the live booking wasn't re-checked/);
  // The start is the kit as i-6 left it: the reviewer, its step in the skill, and no server yet.
  assert.ok(START['fixit/.claude/agents/guide-reviewer.md']);
  assert.match(START[i7.SKILL].toString('utf8'), /^6\. Hand the guide to the `guide-reviewer` agent/m);
  assert.equal(START[i7.MCP], undefined);
});

test('valid A, the solution, passes every item', () => {
  passes(copy(DONE), i7.items);
});

test('valid B, no allow rules so Claude asks each time, with cancel denied, passes every item', () => {
  passes(copy({ ...DONE, [i7.SHARED]: settingsWith((p) => { delete p.allow; }) }), i7.items);
});

test("the manuscript's near misses: every bookings tool allowed, and the package at @latest", () => {
  for (const rule of ['mcp__bookings__*', 'mcp__bookings']) {
    const r = copy({ ...DONE, [i7.SHARED]: settingsWith((p) => { p.allow = [rule]; }) });
    says(limits, r, new RegExp(`^\`${rule.replace(/\*/g, '\\*')}\` in \`allow\` lets every tool the server offers run without asking, now or later, including one that cancels bookings\\.`));
  }
  says(server, copy({ ...DONE, [i7.MCP]: mcpWith(['-y', 'fixers-bookings-mcp@latest', '--read-only']) }), /^The package isn't pinned: `fixers-bookings-mcp@latest`\. Everyone would run whatever version was published last\./);
  says(server, copy({ ...DONE, [i7.MCP]: mcpWith(['-y', 'fixers-bookings-mcp', '--read-only']) }), /^The package isn't pinned: `fixers-bookings-mcp`\./);
  says(server, copy({ ...DONE, [i7.MCP]: mcpWith(['-y', 'fixers-bookings-mcp@^1.4.2', '--read-only']) }), /isn't pinned/);
  // Another exact version is a pin too: the choice of version is the Learner's to review.
  passes(copy({ ...DONE, [i7.MCP]: mcpWith(['-y', 'fixers-bookings-mcp@1.4.3', '--read-only']) }), [server]);
});

test('the server must be the project\'s, in fixit/, read-only and the library\'s package', () => {
  says(server, copy({ ...DONE, [i7.MCP]: null, '.mcp.json': MCP }), /^`\.mcp\.json` is in the practice copy's top folder, not in `fixit\/`/);
  says(server, copy({ ...DONE, [i7.MCP]: mcpWith(['-y', 'fixers-bookings-mcp@1.4.2']) }), /^The server runs without `--read-only`, so it offers `cancel_booking` too/);
  says(server, copy({ ...DONE, [i7.MCP]: mcpWith(['-y', 'bookings-helper@1.0.0', '--read-only']) }), /doesn't run `fixers-bookings-mcp`/);
  says(server, copy({ ...DONE, [i7.MCP]: MCP.replace('"bookings"', '"library"') }), /has no `bookings` server/);
  says(server, copy({ ...DONE, [i7.MCP]: '{ "mcpServers": {' }), /isn't valid JSON/);
});

test('cancel must be denied in the shared settings, and the reading tools stay usable', () => {
  says(limits, copy({ ...DONE, [i7.SHARED]: settingsWith((p) => { p.deny = p.deny.filter((r) => !r.startsWith('mcp__')); p.ask = [...p.ask, 'mcp__bookings__cancel_booking']; }) }), /^`mcp__bookings__cancel_booking` is set to ask, not deny: one wrong yes cancels a booking/);
  says(limits, copy({ ...DONE, [i7.SHARED]: settingsWith((p) => { p.allow = [...p.allow, 'mcp__bookings__cancel_booking']; }) }), /is in `allow`, so Claude could cancel a booking without asking/);
  says(limits, copy({ ...DONE, [i7.SHARED]: settingsWith((p) => { p.deny = [...p.deny.filter((r) => !r.startsWith('mcp__')), 'mcp__bookings']; }) }), /^`mcp__bookings` in `deny` blocks every bookings tool, so the guide can't look the booking up either/);
  const local = copy({ ...DONE, [i7.SHARED]: settingsWith((p) => { p.deny = p.deny.filter((r) => !r.startsWith('mcp__')); }), [i7.LOCAL]: json({ permissions: { deny: ['mcp__bookings__cancel_booking'] } }) });
  says(limits, local, /^The cancel rule is in your local settings, `settings\.local\.json`, which is yours alone/);
  // The kit's earlier rules stay: a rewrite that dropped the private-folder rule fails.
  says(limits, copy({ ...DONE, [i7.SHARED]: json({ permissions: { deny: ['mcp__bookings__cancel_booking'] } }) }), /no longer keep Claude out of the `private\/` folders/);
});

test('the skill looks the booking up before the fact table, carries on from the files when it is down, and never falls back on the flyer', () => {
  says(procedure, copy({ ...DONE, [i7.SKILL]: step1('Read every file in `$ARGUMENTS/`. Look up the booking with the `bookings` connection. If it is not available, use the flyer.') }), /^Step 1 falls back on the flyer: .*The flyer is the least reliable source for room and access/);
  says(procedure, copy({ ...DONE, [i7.SKILL]: step1('Read every file in `$ARGUMENTS/`. If not, use the flyer for the room; look the booking up with `get_booking`.') }), /falls back on the flyer/);
  says(procedure, copy({ ...DONE, [i7.SKILL]: step1('Read every file in `$ARGUMENTS/`, and look up the session\'s booking with the `bookings` connection.') }), /^Step 1 looks the booking up, but doesn't say what to do when the connection is down/);
  says(procedure, copy({ ...DONE, [i7.SKILL]: step1('Look up the booking with `bookings`. If it is down, say so.') }), /^Step 1 says what happens when the connection is down, but not where the facts come from then/);
  says(procedure, copy({ ...DONE, [i7.SKILL]: step1('Look up the booking with `bookings`. If it is down, carry on from the files.') }), /^Step 1 carries on from the files when the connection is down, but doesn't say so/);
  const late = SKILL.replace(/^1\. .*$/m, '1. Read every file in `$ARGUMENTS/` except `private/`, plus `sources/group-notes.md`.').replace(/^4\. /m, '4. Look up the booking with `bookings`. If it isn\'t available, say so and continue from the files.\n4b. ');
  says(procedure, copy({ ...DONE, [i7.SKILL]: late }), /^Step 4 looks the booking up after step 2 builds the fact table/);
  // Its own words, with the flyer refused, pass.
  passes(copy({ ...DONE, [i7.SKILL]: step1('Read the sources. Check the live booking with the bookings server; when the server fails, tell the user, keep going from the files and never fill anything in from the flyer.') }), [procedure]);
  says(procedure, copy({ ...DONE, [i7.SKILL]: null }), /^There's no `fixit\/\.claude\/skills\/attendee-guide\/SKILL\.md`/);
});

test('the down run leaves an open item that says what was not re-checked, and the guide keeps the booking\'s values', () => {
  says(downRun, copy({ ...DONE, [i7.FACTS]: FACTS.replace(OPEN_ITEM, 'Open item: re-checked with the bookings connection on 11 March, no change.\n') }), /^`fixit\/march\/facts\.md` says "Open item: re-checked with the bookings connection on 11 March, no change", but the connection was down/);
  says(downRun, copy({ ...DONE, [i7.FACTS]: START_FACTS }), /has no open item saying the live booking wasn't re-checked/);
  // In the Open column of a row works as well as a line after the table.
  const inRow = START_FACTS.replace('| Priya to confirm the lift |', "| Priya to confirm the lift; the library's record couldn't be re-checked, the bookings connection was down |");
  passes(copy({ ...DONE, [i7.FACTS]: inRow }), [downRun]);
  passes(copy({ ...DONE, [i7.FACTS]: `${START_FACTS}\n- Not checked against the live booking today: the connection was unavailable.\n` }), [downRun]);
  // The flyer's hours or its "just turn up" in the guide fail, open item or not.
  says(downRun, copy({ ...DONE, [i7.GUIDE]: START_GUIDE.replace('10:30am to 1pm', '10am to 1pm') }), /^The March guide now says "\*\*When:\*\* Saturday 13 March 2027, 10am to 1pm.*That's the flyer's/);
  says(downRun, copy({ ...DONE, [i7.GUIDE]: START_GUIDE.replace('If there is space at 11:00, we take walk-ins.', 'Or just turn up.') }), /That's the flyer's/);
});

test('a hand-written call record is no evidence: the check reads none', () => {
  const r = copy({ '.practice/i-7-mcp.txt': 'get_booking MBL-2027-0313-B\n', 'fixit/.practice/i-7-calls.json': '{"calls":["get_booking"]}\n' });
  for (const item of i7.items) assert.notEqual(item.check(r), true, item.text);
});
