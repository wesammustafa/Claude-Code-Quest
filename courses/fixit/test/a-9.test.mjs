// The a-9 check against the folders a Learner may leave. Each run goes
// through the easy-read runner as prepared, with a stand-in `claude` that
// makes the run's edits and prints its result, so the record the check
// reads is the one the runner writes. The cases: the two-page rerun
// (valid A), all three pages with a bigger budget (valid B), the
// manuscript's near misses (a bypass, a hand edit), and the misses beyond
// them: the 08:30 run alone, a run refused a call, a run that changed one
// page, the bounds widened or changed after the run, an original page or
// the runner changed, a run record written by hand, and notes that leave a
// part out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a9 = await import(pathToFileURL(join(checks, 'lessons/a-9.mjs')).href);
const [july, ran, kept, note] = a9.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/a-9/project']) {
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
const BOUNDS = 'fixit/summer/run/easy-bounds.json';
const RUNNER = 'fixit/summer/run/easy-refresh.sh';
const RECORD = 'fixit/summer/run/easy-last-run';
const NOTE = 'fixit/summer/a-9/recovery.md';
const EASY = Object.fromEntries(['june', 'july', 'august'].map((m) => [m, read(`test/fixtures/a-9/${m}-easy.md`)]));
const SOLVED_NOTE = read('solutions/a-9/fixit/summer/a-9/recovery.md');

// The original pages after the Worked example's rerun: July not step-free,
// June at 24 places, and the schedule's two rows to match.
const REFRESHED = {
  [`${PUBLIC}/july.md`]: START[`${PUBLIC}/july.md`].replace(
    "**Step-free access by lift** next to the children's library.",
    '**Not step-free on 10 July:** the lift is out of service until at least 20 July. If you need step-free access, call the events desk on 555-0100.',
  ),
  [`${PUBLIC}/june.md`]: START[`${PUBLIC}/june.md`].replace('**Booking:** 32 places.', '**Booking:** 24 places.'),
  [`${PUBLIC}/schedule.md`]: START[`${PUBLIC}/schedule.md`]
    .replace('| Room A | Step-free | 32 |', '| Room A | Step-free | 24 |')
    .replace('| Room B | Step-free by lift | 32 |', '| Room B | Not step-free (lift out of service) | 32 |'),
};

/** A copy as the lesson starts it, committed, with `files` written over it. */
function copy(files = REFRESHED) {
  const dir = repo(START, { nested: true });
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}

let ids = 0;
const result = (subtype, cost, denials = []) => ({
  type: 'result',
  subtype,
  is_error: subtype !== 'success',
  duration_ms: 14000,
  duration_api_ms: 14000,
  num_turns: 7,
  ...(subtype === 'success' ? { result: 'I refreshed the pages I was asked to.' } : {}),
  session_id: `5b1e3f0a-6c2d-4e8f-9a7b-${String(++ids).padStart(12, '0')}`,
  total_cost_usd: cost,
  permission_denials: denials,
});

/**
 * Runs the easy-read runner as prepared in `r`, with a stand-in `claude`
 * that writes `pages` (name to text, in summer/public/), prints `reply` and
 * exits 1 when it is an error, as `claude -p` does.
 */
function runEasy(r, args, reply, pages = {}) {
  const base = mkdtempSync(join(tmpdir(), 'fixit-a9-run-'));
  try {
    mkdirSync(join(base, 'bin'));
    for (const [name, text] of Object.entries(pages)) writeFileSync(join(base, name), text);
    writeFileSync(join(base, 'reply.json'), `${JSON.stringify(reply)}\n`);
    const copies = Object.keys(pages).map((n) => `cp '${join(base, n)}' 'summer/public/${n}'`);
    writeFileSync(join(base, 'bin', 'claude'), `#!/bin/sh\n${copies.join('\n')}\ncat '${join(base, 'reply.json')}'\nexit ${reply.is_error ? 1 : 0}\n`);
    chmodSync(join(base, 'bin', 'claude'), 0o755);
    return spawnSync('sh', [RUNNER, ...args], {
      cwd: r.dir,
      env: { ...process.env, PATH: `${join(base, 'bin')}:${process.env.PATH}` },
      encoding: 'utf8',
    });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

const TWO = ['Refresh july-easy.md and august-easy.md from their sources. Change nothing else.', '--max-budget-usd', '0.40'];
/** The 08:30 run: June's page done, then the spend limit. */
const failedRun = (r) => runEasy(r, [], result('error_max_budget_usd', 0.33), { 'june-easy.md': EASY.june });
/** The two-page recovery. */
const recovery = (r) => runEasy(r, TWO, result('success', 0.28), { 'july-easy.md': EASY.july, 'august-easy.md': EASY.august });

/** A copy at the end of the canonical path: the 08:30 run, the two-page rerun and the note. */
function solved(files = {}) {
  const r = copy();
  failedRun(r);
  recovery(r);
  write(r.dir, { [NOTE]: SOLVED_NOTE, ...files });
  return r;
}

const all = [july, ran, kept, note];
const passes = (r, items = all) => {
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};
const fileOf = (r, p) => readFileSync(join(r.dir, p), 'utf8');

test('valid A: the 08:30 run, then only the two pages it left with a $0.40 limit, and the note, passes every item', () => {
  const r = solved();
  passes(r);
  const report = fileOf(r, `${RECORD}/report.txt`);
  assert.match(report, /estimated cost: \$0\.28 \(limit \$0\.40\)/);
  assert.match(report, /files changed:\n {2}summer\/public\/august-easy\.md\n {2}summer\/public\/july-easy\.md\n$/);
});

test('valid B: all three pages again with a $0.60 limit, and a note in other words, passes too', () => {
  const r = copy();
  failedRun(r);
  const all3 = runEasy(r, ['', '--max-budget-usd', '0.60'], result('success', 0.594), { 'june-easy.md': EASY.june, 'july-easy.md': EASY.july, 'august-easy.md': EASY.august });
  assert.equal(all3.status, 0);
  write(r.dir, {
    [NOTE]: '# Recovery note\n\nThe 08:30 run ran out of money: its $0.30 budget covered one page.\n\nI reran all three easy-read pages with $0.60, so July and August came from one run with June. The July easy page and the August easy page are both done.\n\nI checked the report (success, no denials) and read the two pages against their main pages.\n',
  });
  passes(r);
});

test('the untouched starting state fails: the July page, no run record, an empty note; the other files pass', () => {
  const r = copy({});
  says(july, r, /^`july-easy\.md` still says "Room B is upstairs\. There is a lift\."/);
  says(ran, r, /^There's no easy-read run record yet\./);
  passes(r, [kept]);
  says(note, r, /^`summer\/a-9\/recovery\.md` is still empty\./);
});

test('the Worked example left alone passes the original pages too: they may be as they started', () => {
  const r = copy({});
  failedRun(r);
  passes(r, [kept]);
});

test("Your turn's starting point, the 08:30 run alone, fails on its spend limit and the July page", () => {
  const r = copy();
  const run = failedRun(r);
  assert.equal(run.status, 1);
  assert.match(fileOf(r, `${RECORD}/report.txt`), /files changed:\n {2}summer\/public\/june-easy\.md\n$/);
  says(ran, r, /^The last easy-read run stopped at its spend limit \(`error_max_budget_usd`\) and didn't finish\./);
  says(july, r, /still says "Room B is upstairs\. There is a lift\."/);
  passes(r, [kept]);
});

test('the same run again at the same limit fails again on its spend limit', () => {
  const r = copy();
  failedRun(r);
  failedRun(r);
  says(ran, r, /stopped at its spend limit/);
});

test('the near miss, a rerun with bypass: the runner refuses it and nothing changes, so the run item fails', () => {
  for (const flags of [['--permission-mode', 'bypassPermissions'], ['--dangerously-skip-permissions'], ['--settings', 'summer/run/bounds.json'], ['--allowedTools', 'Edit']]) {
    const r = copy();
    failedRun(r);
    const before = fileOf(r, `${RECORD}/result.json`);
    const run = runEasy(r, ['Refresh july-easy.md and august-easy.md.', ...flags], result('success', 0.2), { 'july-easy.md': EASY.july, 'august-easy.md': EASY.august });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /^Refusing to run without summer\/run\/easy-bounds\.json: /);
    assert.equal(fileOf(r, `${PUBLIC}/july-easy.md`), START[`${PUBLIC}/july-easy.md`]);
    assert.equal(fileOf(r, `${RECORD}/result.json`), before);
    says(ran, r, /stopped at its spend limit/);
  }
});

test('the near miss by another road: bounds that bypass or widen, or a runner changed, fail the item that keeps them', () => {
  const widen = (change) => {
    const b = JSON.parse(START[BOUNDS]);
    change(b);
    return `${JSON.stringify(b, null, 2)}\n`;
  };
  for (const bounds of [
    widen((b) => (b.permissions.defaultMode = 'bypassPermissions')),
    widen((b) => b.permissions.allow.push('Edit(./summer/public/*.md)')),
    widen((b) => (b.permissions.deny = b.permissions.deny.filter((x) => !x.includes('private')))),
    widen((b) => (b.sandbox.failIfUnavailable = false)),
  ]) {
    const r = solved({ [BOUNDS]: bounds });
    says(kept, r, /^`summer\/run\/easy-bounds\.json` lets the run do more than it could when Your turn began\./);
  }
  const r = solved({ [RUNNER]: START[RUNNER].replace('--permission-mode dontAsk', '--permission-mode bypassPermissions') });
  says(kept, r, /^`summer\/run\/easy-refresh\.sh` isn't as it was prepared\./);
});

test('narrower bounds still keep: an allow rule dropped, a deny rule added', () => {
  const b = JSON.parse(START[BOUNDS]);
  b.permissions.allow = b.permissions.allow.filter((x) => !x.includes('june-easy'));
  b.permissions.deny.push('Edit(./summer/public/june.md)');
  const r = copy({ ...REFRESHED, [BOUNDS]: `${JSON.stringify(b, null, 2)}\n` });
  failedRun(r);
  recovery(r);
  write(r.dir, { [NOTE]: SOLVED_NOTE });
  passes(r);
});

test('the near miss, July edited by hand and no run since: the July page passes, the run item names the hand edit', () => {
  const r = copy();
  failedRun(r);
  write(r.dir, { [`${PUBLIC}/july-easy.md`]: EASY.july, [`${PUBLIC}/august-easy.md`]: EASY.august, [NOTE]: SOLVED_NOTE });
  passes(r, [july, kept, note]);
  says(ran, r, /^No run changed `july-easy\.md` after the failed one\. The recovery should go through the bounded run, so the next refresh doesn't undo it\.$/);
});

test('a hand edit, then the two-page run over it, passes: the run made the pages', () => {
  const r = copy();
  failedRun(r);
  write(r.dir, { [`${PUBLIC}/july-easy.md`]: EASY.july.replace('Room B is upstairs. The lift is out of service until at least 20 July.', 'No lift this time: Room B is upstairs.') });
  recovery(r);
  write(r.dir, { [NOTE]: SOLVED_NOTE });
  passes(r);
});

test('a hand edit, then a run that left July alone, fails on the hand edit', () => {
  const r = copy();
  failedRun(r);
  write(r.dir, { [`${PUBLIC}/july-easy.md`]: EASY.july, [NOTE]: SOLVED_NOTE });
  runEasy(r, ['Refresh august-easy.md from its sources.'], result('success', 0.15), { 'august-easy.md': EASY.august });
  says(ran, r, /^No run changed `july-easy\.md` after the failed one\./);
});

test('one page per run fails: the last run must hold the whole recovery', () => {
  const r = copy();
  failedRun(r);
  runEasy(r, ['Refresh july-easy.md from its sources.'], result('success', 0.15), { 'july-easy.md': EASY.july });
  says(ran, r, /^The last easy-read run didn't change `august-easy\.md`, which the 08:30 run left undone\./);
});

test('a run refused a call, one stopped at its turn limit, one ended in error, or one before the bounds changed, fails', () => {
  const denial = { tool_name: 'Edit', tool_use_id: 'toolu_1', tool_input: { file_path: '/home/learner/claude-code-practice/project/fixit/summer/public/august-easy.md' } };
  let r = copy();
  failedRun(r);
  runEasy(r, TWO, result('success', 0.2, [denial]), { 'july-easy.md': EASY.july });
  says(ran, r, /^The last easy-read run was refused a call/);

  r = copy();
  failedRun(r);
  runEasy(r, TWO, result('error_max_turns', 0.2), { 'july-easy.md': EASY.july });
  says(ran, r, /stopped at its turn limit \(`error_max_turns`\)/);

  r = copy();
  failedRun(r);
  runEasy(r, TWO, result('error_during_execution', 0.1));
  says(ran, r, /ended with `error_during_execution`, not `success`/);

  r = solved();
  write(r.dir, { [BOUNDS]: START[BOUNDS].replace('\n', '\n\n') });
  says(ran, r, /^The last easy-read run ran before `summer\/run\/easy-bounds\.json` last changed\./);
});

test('a run record written by hand fails: no report, no bounds copy, a report from another run, or the stand-in reply', () => {
  const ok = JSON.stringify(result('success', 0.28));
  const printed = (files) => {
    const r = copy();
    write(r.dir, { [`${PUBLIC}/july-easy.md`]: EASY.july, [`${PUBLIC}/august-easy.md`]: EASY.august, [NOTE]: SOLVED_NOTE, ...files });
    return r;
  };
  says(ran, printed({ [`${RECORD}/result.json`]: ok }), /has no report of the files it changed/);
  says(ran, printed({ [`${RECORD}/result.json`]: 'the run went fine, $0.28\n' }), /isn't the result of a `claude -p` run/);
  const report = 'exit status: 0\nresult subtype: success\nestimated cost: $0.28 (limit $0.40)\nfiles changed:\n  summer/public/july-easy.md\n  summer/public/august-easy.md\n';
  says(ran, printed({ [`${RECORD}/result.json`]: ok, [`${RECORD}/report.txt`]: report }), /no copy of the bounds it ran with/);
  says(ran, printed({ [`${RECORD}/result.json`]: ok, [`${RECORD}/report.txt`]: report.replace('0.28', '0.33') }), /don't describe the same run/);
  says(ran, printed({ [`${RECORD}/result.json`]: ok.replace(/"session_id":"[^"]+"/, '"session_id":"00000000-0000-4000-8000-00000000c0de"') }), /holds the check's stand-in reply/);
});

test('an original page changed, or missing, fails the item that keeps them', () => {
  says(kept, solved({ [`${PUBLIC}/june.md`]: REFRESHED[`${PUBLIC}/june.md`].replace('24 places', '22 places') }), /^`summer\/public\/june\.md` has changed, and the easy-read recovery wasn't asked to touch it\./);
  says(kept, solved({ [`${PUBLIC}/august.md`]: `${START[`${PUBLIC}/august.md`]}\n` }), /^`summer\/public\/august\.md` has changed/);
  const r = solved();
  rmSync(join(r.dir, `${PUBLIC}/schedule.md`));
  says(kept, r, /^`summer\/public\/schedule\.md` is missing\./);
});

test('the July page: a lift, step-free by lift, no steps, or no access line at all, fails; other honest wordings pass', () => {
  const with_ = (page) => copy({ ...REFRESHED, [`${PUBLIC}/july-easy.md`]: page });
  says(july, with_(EASY.july.replace('- Need step-free access?', '- There is a lift.\n- Need step-free access?')), /still says "There is a lift\."/);
  says(july, with_(EASY.july.replace('- On 10 July there is no step-free way in to Room B.', '- Step-free access by lift.')), /still says "Step-free access by lift\."/);
  says(july, with_(EASY.july.replace('- On 10 July there is no step-free way in to Room B.', '- There are no steps.')), /still says "There are no steps\."/);
  says(july, with_(EASY.july.replace('- Room B is upstairs. The lift is out of service until at least 20 July.\n- On 10 July there is no step-free way in to Room B.\n', '- Room B is upstairs.\n')), /doesn't say that Room B isn't step-free/);
  const r = copy();
  rmSync(join(r.dir, `${PUBLIC}/july-easy.md`));
  says(july, r, /is missing/);
  for (const line of ['- The lift is not working on 10 July.', '- Room B is not step-free on 10 July.', "- There is no lift to Room B on 10 July. It isn't step-free."])
    passes(with_(EASY.july.replace('- Room B is upstairs. The lift is out of service until at least 20 July.\n- On 10 July there is no step-free way in to Room B.', line)), [july]);
});

test('the note: each part it leaves out fails with its own line, and "easy-read" is no reading', () => {
  const with_ = (text) => solved({ [NOTE]: `${START[NOTE]}\n${text}\n` });
  says(note, with_('It stopped. I reran july-easy.md and august-easy.md and opened both.'), /doesn't say what stopped the run/);
  says(note, with_('It ran out of budget. I reran the July easy page and opened it.'), /doesn't name `august-easy\.md`/);
  says(note, with_('It ran out of budget. I reran july-easy.md and august-easy.md, the easy-read pages.'), /doesn't say how you checked the result/);
  passes(with_('Spend limit hit after one page. Reran july-easy.md and august-easy.md at $0.40. Read both against july.md and august.md.'), [note]);
  const r = solved();
  rmSync(join(r.dir, NOTE));
  says(note, r, /^There's no `summer\/a-9\/recovery\.md`\./);
});
