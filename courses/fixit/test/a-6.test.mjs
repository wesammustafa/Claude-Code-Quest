// The a-6 check against the folders a Learner may leave. Each run goes
// through the refresh runner as prepared, with a stand-in `claude` that
// writes the August page and prints the run's result, so the record the
// check reads is the one the runner writes. The cases: the call written
// down as a note (valid A), Kofi's email saved instead (valid B), the
// manuscript's near miss (the page edited by hand, the card left
// overclaiming), and the misses beyond it: the card unshared or shared
// before its correction, a card missing a part, a note that leaves a part
// out or a source edited instead, a page edited after the run, a run
// refused a call, a run record written by hand, the personal settings file
// shared, and the team's deny rules or the run's bounds loosened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a6 = await import(pathToFileURL(join(checks, 'lessons/a-6.mjs')).href);
const [card, note, ran, scopes] = a6.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
// The starting files, with the guide's inert names made live, as the
// practice copy lays them.
const LIVE = { 'dot-claude': '.claude', 'dot-mcp.json': '.mcp.json', 'CLAUDE.example.md': 'CLAUDE.md' };
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/a-6/project']) {
  const walk = (d, rel = '') => {
    for (const e of readdirSync(join(COURSE, d, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(d, r);
      else START[r.split('/').map((s) => LIVE[s] ?? s).join('/')] = read(`${d}/${r}`);
    }
  };
  walk(dir);
}

const CARD = 'fixit/summer/LIMITS.md';
const AUGUST = 'fixit/summer/public/august.md';
const CALL = 'fixit/summer/august-kofi-call-2027-06-14.md';
const EMAIL = 'fixit/summer/northside-parking-email-2027-06-14.md';
const RUN = 'fixit/summer/run';
const WORKED = read('solutions/a-6/worked/fixit/summer/LIMITS.md');
const FINAL = read('solutions/a-6/fixit/summer/LIMITS.md');
const CALL_NOTE = read('solutions/a-6/fixit/summer/august-kofi-call-2027-06-14.md');
const PARKING =
  '**Parking:** the centre car park is closed on 14 August for resurfacing. Use the leisure centre car park on Park Lane.\n';
const PAGE = START[AUGUST].replace('**Bring:**', `${PARKING}**Bring:**`);
assert.notEqual(PAGE, START[AUGUST]);
// The overclaiming draft, as Claude first writes it.
const DRAFT = WORKED.replace(
  /- Rewrites the pages in `summer\/public\/` \(`bounds\.json`: `Edit\(\.\/summer\/public\/\*\.md\)`\), from the confirmations and notes saved in `summer\/`\.\n/,
  '- Rewrites the pages in `summer/public/` (`bounds.json`: `Edit(./summer/public/*.md)`).\n- Keeps the pages in sync with the venues\' latest confirmations.\n',
).replace(/- See a change[^\n]*\n- Know registration[^\n]*\n- Check its own work[^\n]*\n/, '');
assert.notEqual(DRAFT, WORKED);
const EMAIL_NOTE = [
  'From: Kofi, Centre Manager, Northside Community Centre <office@northside.example>',
  'To: Sam, Millbrook Fixers',
  'Date: Mon 14 June 2027',
  'Subject: Re: Parking on 14 August',
  '',
  'Hi Sam, confirming what I said on the phone: the centre car park is closed on Saturday 14 August for resurfacing. Please send people to the leisure centre car park on Park Lane.',
  '',
  'Kofi',
  '',
].join('\n');
const EMAIL_CARD = WORKED.replace(
  '- Know registration',
  '- Use anything but a written confirmation: a phone change counts once the venue confirms it by email and the email is saved in `summer/`.\n- Know registration',
);

const git = (r, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: r.dir, encoding: 'utf8' });

/** A copy as the lesson starts it, committed, with `files` written over it. */
function copy(files = {}) {
  const dir = repo(START, { nested: true });
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}

/** Saves the card as a version teammates get, as Claude does in W2. */
const share = (r) => commit(r.dir, 'Pack refresh: limits card', [CARD, `${RUN}/refresh.sh`, `${RUN}/bounds.json`]);

let ids = 0;
const result = (cost, denials = []) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  duration_ms: 9000,
  duration_api_ms: 9000,
  num_turns: 5,
  result: 'I refreshed august.md from its sources.',
  session_id: `7c2e4d1b-3a5f-4b6c-8d9e-${String(++ids).padStart(12, '0')}`,
  total_cost_usd: cost,
  permission_denials: denials,
});

/**
 * Runs the refresh runner as prepared in `r`, with a stand-in `claude` that
 * writes `page` as august.md (when given) and prints `reply`.
 */
function refresh(r, page = null, reply = result(0.06)) {
  const base = mkdtempSync(join(tmpdir(), 'fixit-a6-run-'));
  try {
    mkdirSync(join(base, 'bin'));
    writeFileSync(join(base, 'reply.json'), `${JSON.stringify(reply)}\n`);
    const lines = ['#!/bin/sh'];
    if (page !== null) {
      writeFileSync(join(base, 'august.md'), page);
      lines.push(`cp '${join(base, 'august.md')}' summer/public/august.md`);
    }
    lines.push(`cat '${join(base, 'reply.json')}'`);
    writeFileSync(join(base, 'bin', 'claude'), `${lines.join('\n')}\n`);
    chmodSync(join(base, 'bin', 'claude'), 0o755);
    const run = spawnSync('sh', ['fixit/summer/run/refresh.sh', 'Refresh august.md from its sources. Change nothing else.'], {
      cwd: r.dir,
      env: { ...process.env, PATH: `${join(base, 'bin')}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    return run.stdout;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

/** The Worked example: the corrected card, shared, and Sam's dry run. */
function worked(cardText = WORKED) {
  const r = copy({ [CARD]: cardText });
  share(r);
  refresh(r, START[AUGUST]);
  return r;
}

/** Valid A: the call as a dated note, the rerun with it, the card's phone line. */
function solved() {
  const r = worked();
  write(r.dir, { [CALL]: CALL_NOTE });
  refresh(r, PAGE);
  write(r.dir, { [CARD]: FINAL });
  return r;
}

const all = [card, note, ran, scopes];
const passes = (r, items = all) => {
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};
const fileOf = (r, p) => readFileSync(join(r.dir, p), 'utf8');

test('valid A: the card corrected and shared, the dry run, the call saved as a note, the rerun and the phone line, passes every item', () => {
  const r = solved();
  passes(r);
  const runs = fileOf(r, `${RUN}/runs.txt`).split('\n\n');
  assert.match(runs[0], /files changed:\n {2}none$/);
  assert.match(fileOf(r, `${RUN}/last-run/report.txt`), /files changed:\n {2}summer\/public\/august\.md\n$/);
  assert.equal(fileOf(r, `${RUN}/last-run/pages/august.md`), PAGE);
});

test('valid B: Kofi\'s email saved instead of a note, the rerun, and "only written confirmations count", passes too', () => {
  const r = worked();
  write(r.dir, { [EMAIL]: EMAIL_NOTE });
  refresh(r, PAGE.replace('Use the leisure centre car park on Park Lane.', 'Please use the leisure centre car park on Park Lane.'));
  write(r.dir, { [CARD]: EMAIL_CARD });
  share(r);
  passes(r);
});

test('the untouched starting state fails every item with its own line', () => {
  const r = copy();
  says(card, r, /^There's no `summer\/LIMITS\.md` yet\./);
  says(note, r, /^No new file in `summer\/` records Kofi's call yet/);
  says(ran, r, /^No run of the refresh has a record yet\. Rerun the refresh for August: in `fixit\/`/);
  passes(r, [scopes]);
});

test('the Worked example alone passes the card and the scopes; the note and the run wait for Your turn', () => {
  const r = worked();
  passes(r, [card, scopes]);
  says(note, r, /^No new file in `summer\/`/);
  says(ran, r, /^No run that ended in `success` with no denials has changed `august\.md` yet\./);
});

test('the near miss: the page edited by hand, "check with Kofi" in CLAUDE.md, and the card still overclaiming, fails items 1, 2 and 3', () => {
  const r = copy({ [CARD]: DRAFT });
  share(r);
  refresh(r, START[AUGUST]);
  write(r.dir, { [AUGUST]: PAGE, 'fixit/CLAUDE.md': `${START['fixit/CLAUDE.md']}\nCheck with Kofi about parking before August.\n` });
  says(card, r, /^`LIMITS\.md` still says "Keeps the pages in sync with the venues' latest confirmations\."\. The run only sees what someone saved in `summer\/`/);
  says(note, r, /^`august\.md` has the parking line, but no file in summer\/ says it\. The next refresh will remove it\.$/);
  says(ran, r, /^No run that ended in `success` with no denials changed `august\.md`, so the change was made by hand\./);
  passes(r, [scopes]);
});

test('a card never shared, or shared before its correction, fails on the shared version', () => {
  const unshared = copy({ [CARD]: WORKED });
  says(card, unshared, /^`LIMITS\.md` isn't in the shared version yet, so Sam won't get it\./);
  const early = copy({ [CARD]: DRAFT });
  share(early);
  write(early.dir, { [CARD]: WORKED });
  says(card, early, /^The shared version still has the old card\. It still says "Keeps the pages in sync/);
  // The phone line added after sharing needs no second save: the shared card has every part.
  const later = worked();
  write(later.dir, { [CARD]: FINAL });
  passes(later, [card]);
});

test('a card missing a part fails with the part it lacks; bold leads instead of headings pass', () => {
  const without = (re) => WORKED.replace(re, '');
  const cases = [
    [without(/## What it does\n(- [^\n]*\n)+\n/), /doesn't say what the run does/],
    [without(/## Who decides\n(- [^\n]*\n)+\n/), /doesn't say who decides/],
    [without(/\n## How to stop it\n(- [^\n]*\n)+/), /doesn't say how to stop the run/],
    [without(/- See a change[^\n]*\n/), /misses a change that arrives by phone call/],
    [without(/- Know registration[^\n]*\n/), /can't know registration numbers/],
  ];
  for (const [text, re] of cases) {
    assert.notEqual(text, WORKED);
    says(card, copy({ [CARD]: text }), re);
  }
  const bold = [
    '# Pack refresh limits',
    '',
    "**What it does.** Rewrites the pages in `summer/public/` from what's saved in `summer/`.",
    '',
    "**What it cannot do.** Read `private/`. See a call nobody saved in `summer/`. Know registration numbers.",
    '',
    '**Who decides.** The coordinator reads the report; Maya publishes; Priya sends the email.',
    '',
    '**How to stop it.** Rename `summer/run/bounds.json`.',
    '',
  ].join('\n');
  const r = copy({ [CARD]: bold });
  share(r);
  passes(r, [card]);
  // "In sync" with what's saved is no overclaim.
  says(card, copy({ [CARD]: bold.replace('Rewrites the pages', 'Keeps the pages up to date with the venues. Rewrites them') }), /still says "Keeps the pages up to date with the venues/);
  const fair = copy({ [CARD]: bold.replace('Rewrites the pages in `summer/public/` from', 'Keeps the pages in sync with the venues\' confirmations saved in') });
  share(fair);
  passes(fair, [card]);
});

test('a note that leaves a part out, or a source edited instead of a note, fails', () => {
  const r = worked();
  write(r.dir, { [CALL]: CALL_NOTE.replace(/Saturday 14 August/g, 'Saturday') });
  refresh(r, PAGE);
  says(note, r, /^The note in `summer\/` doesn't mention Kofi, the car park and 14 August together\./);
  const edited = worked();
  const email = 'fixit/summer/northside-august-email.md';
  write(edited.dir, { [email]: `${START[email]}\nParking: the centre car park is closed on 14 August. Use the leisure centre car park on Park Lane.\n` });
  says(note, edited, /^No new file in `summer\/` records Kofi's call yet/);
});

test('the note saved but no rerun fails on the page and the run', () => {
  const r = worked();
  write(r.dir, { [CALL]: CALL_NOTE });
  says(note, r, /^`august\.md` doesn't send people to the leisure centre car park on Park Lane yet\./);
  says(ran, r, /^No run that ended in `success` with no denials has changed `august\.md` yet\./);
});

test('the page changed by hand after the run fails; a hand edit the next run rewrites passes; a rerun that changes nothing still passes', () => {
  const after = solved();
  write(after.dir, { [AUGUST]: PAGE.replace('Park Lane.', 'Park Lane. Check with Kofi on the day.') });
  says(ran, after, /^`august\.md` has changed since the last run wrote it\./);
  const before = worked();
  write(before.dir, { [AUGUST]: PAGE.replace('Use the', 'Please use the'), [CALL]: CALL_NOTE });
  refresh(before, PAGE);
  write(before.dir, { [CARD]: FINAL });
  passes(before);
  const again = solved();
  refresh(again, PAGE);
  passes(again);
});

test('a hand edit, a run that removes it, then the same edit by hand again, fails on the run item', () => {
  const r = worked();
  write(r.dir, { [AUGUST]: PAGE });
  refresh(r, START[AUGUST]);
  write(r.dir, { [CALL]: CALL_NOTE, [AUGUST]: PAGE, [CARD]: FINAL });
  passes(r, [card, note]);
  says(ran, r, /^`august\.md` has changed since the last run wrote it\./);
});

test('a run refused a call, or one under bounds changed since, fails the run item', () => {
  const denied = worked();
  write(denied.dir, { [CALL]: CALL_NOTE });
  refresh(denied, PAGE, result(0.06, [{ tool_name: 'Read', tool_input: { file_path: 'summer/private/roster.md' } }]));
  says(ran, denied, /^No run that ended in `success` with no denials changed `august\.md`/);
  const moved = solved();
  write(moved.dir, { [`${RUN}/bounds.json`]: `${fileOf(moved, `${RUN}/bounds.json`)}\n` });
  says(ran, moved, /^The last run ran before `summer\/run\/bounds\.json` last changed\./);
});

test('a run record written by hand fails: a history with no result, a result that is no run, or a report from another run', () => {
  const report = 'exit status: 0\nresult subtype: success\nturns: 5 (limit 25)\nestimated cost: $0.06 (limit $1.00)\npermission denials: 0\nfiles changed:\n  summer/public/august.md\n';
  const printed = (files) => {
    const r = worked();
    write(r.dir, { [CALL]: CALL_NOTE, [AUGUST]: PAGE, [CARD]: FINAL });
    rmSync(join(r.dir, RUN, 'last-run'), { recursive: true, force: true });
    rmSync(join(r.dir, RUN, 'runs.txt'), { force: true });
    write(r.dir, files);
    return r;
  };
  says(ran, printed({ [`${RUN}/runs.txt`]: `${report}\n` }), /^No run of the refresh has a record yet\./);
  says(ran, printed({ [`${RUN}/runs.txt`]: `${report}\n`, [`${RUN}/last-run/result.json`]: '{"ok": true}\n' }), /isn't the result of a `claude -p` run/);
  says(
    ran,
    printed({
      [`${RUN}/runs.txt`]: `${report}\n`,
      [`${RUN}/last-run/result.json`]: JSON.stringify(result(0.06)),
      [`${RUN}/last-run/report.txt`]: report.replace('$0.06', '$0.09'),
    }),
    /don't describe the same last run/,
  );
});

test('the scopes: the personal settings file shared, the deny on private/ gone, or the run given web access, fails', () => {
  const local = solved();
  git(local, 'add', '-f', 'fixit/.claude/settings.local.json');
  git(local, 'commit', '-q', '-m', 'share my settings');
  says(scopes, local, /^`\.claude\/settings\.local\.json` is in the shared version\./);
  const kit = solved();
  const settings = JSON.parse(START['fixit/.claude/settings.json']);
  settings.permissions.deny = settings.permissions.deny.filter((rule) => !rule.includes('private'));
  write(kit.dir, { 'fixit/.claude/settings.json': JSON.stringify(settings, null, 2) });
  says(scopes, kit, /^`\.claude\/settings\.json` no longer denies `Read\(\.\/\*\*\/private\/\*\*\)`/);
  const web = solved();
  const bounds = JSON.parse(START[`${RUN}/bounds.json`]);
  bounds.permissions.deny = bounds.permissions.deny.filter((rule) => rule !== 'WebFetch');
  write(web.dir, { [`${RUN}/bounds.json`]: JSON.stringify(bounds, null, 2) });
  says(scopes, web, /^`summer\/run\/bounds\.json` no longer denies `WebFetch`/);
  const wider = solved();
  bounds.permissions.deny.push('WebFetch');
  bounds.permissions.allow.push('WebFetch(domain:northside.example)');
  write(wider.dir, { [`${RUN}/bounds.json`]: JSON.stringify(bounds, null, 2) });
  says(scopes, wider, /^`summer\/run\/bounds\.json` now allows `WebFetch\(domain:northside\.example\)`/);
});

test('the starting state: the personal settings file is ignored, and the runner refuses to run without its bounds', () => {
  const r = copy();
  assert.equal(r.git('ls-files', '--', 'fixit/.claude/settings.local.json'), '');
  assert.ok(r.exists('fixit/.claude/settings.local.json'));
  rmSync(join(r.dir, RUN, 'bounds.json'));
  const run = spawnSync('sh', ['fixit/summer/run/refresh.sh'], { cwd: r.dir, encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /^Refusing to run without summer\/run\/bounds\.json\.$/m);
  // The card's line number for that refusal is the runner's.
  const line = START[`${RUN}/refresh.sh`].split('\n').findIndex((l) => l.startsWith('if [ ! -f summer/run/bounds.json ]')) + 1;
  assert.match(WORKED, new RegExp(`\\(\`refresh\\.sh\`, line ${line}\\)`));
});
