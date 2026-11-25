// i-4's check against what a Learner may leave: the untouched start, valid
// A (the solution: deny rules and a guard on Priya's number), valid B (a
// hook for the sources and a guard on every number but the library's), the
// manuscript's near misses, and the mistakes around them: a rule in the
// wrong file or month, a hook that runs for Edit only or doesn't fail
// closed, a guard that blocks too much or reads too little, a broad allow
// rule, and a guide with Priya's number on it. The start is laid as
// Questerm lays it: the prepared files' inert names (dot-claude/,
// CLAUDE.example.md) restored. Hooks run with bash, as Claude Code runs them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i4 = await import(pathToFileURL(join(checks, 'lessons/i-4.mjs')).href);
const [privateFolders, sources, guard, ask, guide] = i4.items;

const LIVE = { 'dot-claude': '.claude', 'CLAUDE.example.md': 'CLAUDE.md' };
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/i-4/project']) {
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
const SETTINGS = JSON.parse(text('solutions/i-4/fixit/dot-claude/settings.json'));
const GUARD = text('solutions/i-4/fixit/dot-claude/hooks/no-private-numbers.sh');
const GUARD_EVERY = text('test/fixtures/i-4/no-private-numbers-every.sh');
const PROTECT = text('test/fixtures/i-4/protect-sources.sh');
const GUIDE = text('solutions/i-4/fixit/march/attendee-guide.md');
const SHARED = i4.SHARED;
const LOCAL = i4.LOCAL;
const GUARD_PATH = 'fixit/.claude/hooks/no-private-numbers.sh';
const PROTECT_PATH = 'fixit/.claude/hooks/protect-sources.sh';

const hook = (name, matcher = 'Edit|Write', extra = { onFailure: 'block' }) => ({
  matcher,
  hooks: [{ type: 'command', command: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${name}`, ...extra }],
});
const SOURCE_DENY = ['Edit(./sources/**)', 'Edit(./**/booking-*)', 'Edit(./**/venue-email-*)'];
/** The solution's settings with `deny`, `ask`, `allow` and PreToolUse hooks replaced where given. */
function settings({ deny = SETTINGS.permissions.deny, ask = SETTINGS.permissions.ask, allow, hooks = SETTINGS.hooks.PreToolUse } = {}) {
  return { permissions: { deny, ask, ...(allow ? { allow } : {}) }, ...(hooks.length ? { hooks: { PreToolUse: hooks } } : {}) };
}
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

// A practice copy with `files` over the start, each script executable unless
// named in `plain`.
function copy(files = {}, { plain = [] } = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  for (const p of Object.keys(files)) if (p.endsWith('.sh') && !plain.includes(p)) chmodSync(join(dir, p), 0o755);
  return openRepo(dir);
}
const DONE = { [SHARED]: json(SETTINGS), [GUARD_PATH]: GUARD, [i4.GUIDE]: GUIDE };
const VALID_B = {
  [SHARED]: json(settings({ deny: ['Read(./**/private/**)'], hooks: [hook('protect-sources.sh'), hook('no-private-numbers.sh')] })),
  [PROTECT_PATH]: PROTECT,
  [GUARD_PATH]: GUARD_EVERY,
  [i4.GUIDE]: GUIDE,
};
const passes = (r, items = i4.items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

// What a guard does with a Write of `content` to the March guide: its exit code.
function probe(script, content) {
  const r = spawnSync('bash', ['-c', `printf '%s' "$1" | bash "$0"`, join(COURSE, script), JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/home/learner/fixit/march/attendee-guide.md', content } })], { encoding: 'utf8' });
  return r.status;
}

test('the untouched start fails every item', () => {
  const r = copy();
  assert.equal(r.read(SHARED), null);
  says(privateFolders, r, /There's no `fixit\/\.claude\/settings\.json` yet/);
  says(sources, r, /There's no `fixit\/\.claude\/settings\.json` yet/);
  says(guard, r, /There's no `fixit\/\.claude\/settings\.json` yet/);
  says(ask, r, /There's no `fixit\/\.claude\/settings\.json` yet/);
  says(guide, r, /no line for access questions with the library's 555-0100 yet/);
  // The start holds the risks the lesson names, and the roster it hides.
  assert.match(START['fixit/sources/flyer-2026-10.md'].toString(), /555-0187/);
  assert.equal(START['fixit/march/private/roster.csv'].toString().trim().split('\n').length, 11);
  assert.equal(START['fixit/.claude/settings.json'], undefined);
});

test('valid A, the solution, passes every item, and its guard lets 555-0175 through', () => {
  passes(copy(DONE));
  assert.equal(probe('solutions/i-4/fixit/dot-claude/hooks/no-private-numbers.sh', 'Call Jordan on 555-0175'), 0);
});

test('valid B, a hook for the sources and a guard on every number but the library\'s, passes every item, and blocks 555-0175', () => {
  passes(copy(VALID_B));
  assert.equal(probe('test/fixtures/i-4/no-private-numbers-every.sh', 'Call Jordan on 555-0175'), 2);
});

test("near miss: the sources rule in local settings and the guard on Edit only, each named", () => {
  const r = copy({
    ...DONE,
    [SHARED]: json(settings({ deny: ['Read(./**/private/**)'], hooks: [hook('no-private-numbers.sh', 'Edit')] })),
    [LOCAL]: json({ permissions: { deny: ['Edit(./sources/**)', 'Edit(./**/booking-*)', 'Edit(./**/venue-email-*)'] } }),
  });
  says(sources, r, /The sources rule is in your local settings, `\.claude\/settings\.local\.json`\. Sam won't have it/);
  says(guard, r, /A Write of 555-0187 to the guide wasn't blocked: match `Edit\|Write`\./);
  passes(r, [privateFolders, ask, guide]);
});

test('near miss: a deny on reading the flyer instead of a guard', () => {
  const r = copy({ ...DONE, [SHARED]: json(settings({ deny: [...SETTINGS.permissions.deny, 'Read(./sources/flyer-2026-10.md)'], hooks: [] })) });
  says(guard, r, /No guard checks what's written\. Denying the flyer hides it, but a number in any other file still gets through\./);
  passes(r, [privateFolders, sources, ask, guide]);
});

test('private folders: any depth or one month down passes; one month, a local rule or a bare Read deny fails', () => {
  for (const rule of ['Read(**/private/**)', 'Read(*/private/**)', 'Read(./**/private/**)', 'Read(private/)'])
    assert.equal(privateFolders.check(copy({ [SHARED]: json(settings({ deny: [rule, ...SOURCE_DENY] })) })), true, rule);
  says(privateFolders, copy({ [SHARED]: json(settings({ deny: ['Read(./march/private/**)', ...SOURCE_DENY] })) }), /covers one month's `private\/` folder only: next month's isn't covered/);
  says(privateFolders, copy({ [SHARED]: json(settings({ deny: ['Read', ...SOURCE_DENY] })) }), /`Read` denies more than `private\/`/);
  says(privateFolders, copy({ [SHARED]: json(settings({ deny: SOURCE_DENY })), [LOCAL]: json({ permissions: { deny: ['Read(./**/private/**)'] } }) }), /is in your local settings/);
  says(privateFolders, copy({ [SHARED]: json(settings({ deny: SOURCE_DENY })) }), /Nothing stops Claude reading `march\/private\/roster\.csv` yet/);
  // An allow or ask rule is no deny.
  says(privateFolders, copy({ [SHARED]: json(settings({ deny: SOURCE_DENY, ask: ['Bash', 'Read(./**/private/**)'] })) }), /Nothing stops/);
});

test('sources: every month\'s bookings and emails, editable guides, and a hook that fails closed', () => {
  const only = (deny, more = {}) => copy({ ...DONE, [SHARED]: json(settings({ deny: ['Read(./**/private/**)', ...deny] })), ...more });
  says(sources, only(['Edit(./sources/**)']), /`may\/booking-confirmation-may\.md` can still be changed/);
  says(sources, only(['Edit(./sources/**)', 'Edit(./march/booking-*)', 'Edit(./march/venue-email-*)']), /`may\/booking-confirmation-may\.md` can still be changed/);
  says(sources, only(['Edit(./sources/flyer-2026-10.md)', 'Edit(./**/booking-*)', 'Edit(./**/venue-email-*)']), /`sources\/group-notes\.md` can still be changed/);
  says(sources, only(['Edit(./**)']), /`Edit\(\.\/\*\*\)` also stops Claude editing `march\/facts\.md`/);
  says(sources, only(['Edit']), /`Edit` also stops Claude editing/);
  // A Read deny on sources is no protection from edits.
  says(sources, only(['Read(./sources/**)', 'Read(./**/booking-*)', 'Read(./**/venue-email-*)']), /Nothing stops Claude changing `sources\/` yet/);
  // Bare names match at any depth.
  assert.equal(sources.check(only(['Edit(sources/)', 'Edit(booking-*)', 'Edit(venue-email-*)'])), true);
  const hooked = (h, script = PROTECT, plain = []) => copy({ ...DONE, [SHARED]: json(settings({ deny: ['Read(./**/private/**)'], hooks: [h, hook('no-private-numbers.sh')] })), [PROTECT_PATH]: script }, { plain });
  says(sources, hooked(hook('protect-sources.sh', 'Edit')), /A Write to `sources\/flyer-2026-10\.md` wasn't blocked: your hook runs for Edit only\. Match `Edit\|Write`\./);
  says(sources, hooked(hook('protect-sources.sh', 'Edit|Write', {})), /Add `"onFailure": "block"` to it, so it fails closed/);
  says(sources, hooked(hook('protect-sources.sh'), PROTECT.replace("*) echo \"protect-sources: no file_path in the tool input\" >&2; exit 2 ;;", '*) exit 0 ;;')), /lets an edit through when it can't read the input/);
  says(sources, hooked(hook('protect-sources.sh'), '#!/bin/sh\ncat >/dev/null\nexit 2\n'), /Your hook also blocks a Write to `march\/facts\.md`/);
  says(sources, hooked(hook('protect-sources.sh'), PROTECT, [PROTECT_PATH]), /`\.claude\/hooks\/protect-sources\.sh` isn't executable/);
  says(sources, copy({ ...DONE, [SHARED]: json(settings({ deny: ['Read(./**/private/**)'], hooks: [hook('protect-sources.sh'), hook('no-private-numbers.sh')] })) }), /there's no such file in `fixit\/`/);
  // A hook in local settings is named as such.
  says(sources, copy({ ...DONE, [SHARED]: json(settings({ deny: ['Read(./**/private/**)'] })), [LOCAL]: json({ hooks: { PreToolUse: [hook('protect-sources.sh')] } }), [PROTECT_PATH]: PROTECT }), /in your local settings/);
});

test('the guard: reads an edit too, fails closed, lets the public number and private notes through', () => {
  const with_ = (script, extra = { onFailure: 'block' }, more = {}, plain = []) => copy({ ...DONE, [SHARED]: json(settings({ hooks: [hook('no-private-numbers.sh', 'Edit|Write', extra)] })), [GUARD_PATH]: script, ...more }, { plain });
  says(guard, with_(GUARD, {}), /Add `"onFailure": "block"` to its hook, so it fails closed/);
  says(guard, with_(GUARD.replace("*) echo \"no-private-numbers: no file_path in the tool input\" >&2; exit 2 ;;", '*) exit 0 ;;')), /lets an edit through when it can't read the input/);
  says(guard, with_(GUARD.replace("'555[ .-]?0187'", "'555-01[0-9]{2}'")), /Your hooks also block 555-0100, the library's public number/);
  says(guard, with_(GUARD.replace(/printf '%s' "\$input" \\\n {2}\| grep -Eq '"file_path"[^\n]*\n {2}\|\| exit 0\n/, '')), /blocks 555-0187 in `march\/private\/notes\.md`, a private note/);
  // A guard that reads only a Write's content misses an edit.
  const contentOnly = GUARD.replace("if printf '%s' \"$input\" | grep -Eq '555[ .-]?0187'; then", "if printf '%s' \"$input\" | grep -Eq '\"content\" *: *\"[^\"]*555[ .-]?0187'; then");
  assert.notEqual(contentOnly, GUARD);
  says(guard, with_(contentOnly), /555-0187 edited into the guide wasn't blocked/);
  says(guard, with_(GUARD, { onFailure: 'block' }, {}, [GUARD_PATH]), /`\.claude\/hooks\/no-private-numbers\.sh` isn't executable/);
  says(guard, copy({ ...DONE, [SHARED]: json(settings({ hooks: [] })), [LOCAL]: json({ hooks: { PreToolUse: [hook('no-private-numbers.sh')] } }), [GUARD_PATH]: GUARD }), /The guard is in your local settings/);
  says(guard, copy({ ...DONE, [SHARED]: json(settings({ hooks: [] })) }), /No guard checks what's written to a public page yet/);
  // A guard that blocks every edit isn't a guard on what's written.
  says(guard, with_('#!/bin/sh\ncat >/dev/null\nexit 2\n'), /also block 555-0100/);
  // The guard's matcher may be a regular expression or `*`.
  for (const matcher of ['Edit|Write', 'Write|Edit|MultiEdit', '.*', '*', ''])
    assert.equal(guard.check(copy({ ...DONE, [SHARED]: json(settings({ hooks: [hook('no-private-numbers.sh', matcher)] })) })), true, matcher);
});

test('ask before every command; no allow rule broader than one command', () => {
  says(ask, copy({ ...DONE, [SHARED]: json(settings({ ask: [] })) }), /The shared settings don't ask before commands/);
  says(ask, copy({ ...DONE, [SHARED]: json(settings({ ask: ['Bash(git push *)'] })) }), /don't ask before commands/);
  for (const rule of ['Bash(npm run *)', 'Bash(npm *)', 'Bash(*)', 'Bash', 'Bash(npm:*)'])
    says(ask, copy({ ...DONE, [SHARED]: json(settings({ allow: [rule] })) }), new RegExp(`\`${rule.replace(/[()*]/g, '\\$&')}\` lets every matching command run without asking`));
  says(ask, copy({ ...DONE, [LOCAL]: json({ permissions: { allow: ['Bash(npm run *)'] } }) }), /lets every matching command/);
  assert.equal(ask.check(copy({ ...DONE, [SHARED]: json(settings({ allow: ['Bash(npm test)'] })) })), true);
  assert.equal(ask.check(copy({ ...DONE, [SHARED]: json(settings({ ask: ['Bash(*)'] })) })), true);
});

test('the March guide: Priya\'s number in any spacing fails, and so does a guide without the access line', () => {
  for (const n of ['555-0187', '555 0187', '5550187', '555.0187'])
    says(guide, copy({ ...DONE, [i4.GUIDE]: `${GUIDE}**Questions about access?** Text Priya on ${n}.\n` }), /The March guide has 555-0187, Priya's private number: "\*\*Questions about access\?\*\* Text Priya on/);
  says(guide, copy({ ...DONE, [i4.GUIDE]: START['fixit/march/attendee-guide.md'].toString() }), /no line for access questions/);
  const r = copy(DONE);
  rmSync(join(r.dir, i4.GUIDE));
  says(guide, r, /There's no `fixit\/march\/attendee-guide\.md`/);
});

test('settings that are not JSON are named', () => {
  const r = copy({ ...DONE, [SHARED]: '{ "permissions": { "deny": ["Read(./**/private/**)",] } }' });
  for (const item of [privateFolders, sources, guard, ask]) says(item, r, /`fixit\/\.claude\/settings\.json` isn't valid JSON/);
});

test('rule paths match as the permissions docs anchor them', () => {
  assert.equal(i4.covers('./**/private/**', 'march/private/roster.csv'), true);
  assert.equal(i4.covers('**/private/**', 'private/roster.csv'), true);
  assert.equal(i4.covers('*/private/**', 'march/private/roster.csv'), true);
  assert.equal(i4.covers('*/private/**', 'a/b/private/roster.csv'), false);
  assert.equal(i4.covers('private/**', 'march/private/roster.csv'), false);
  assert.equal(i4.covers('./sources/**', 'sources/flyer-2026-10.md'), true);
  assert.equal(i4.covers('./**/booking-*', 'march/booking-confirmation-march.pdf'), true);
  assert.equal(i4.covers('booking-*', 'may/booking-confirmation-may.md'), true);
  assert.equal(i4.covers('//home/learner/fixit/sources/**', 'sources/flyer-2026-10.md'), false);
});
