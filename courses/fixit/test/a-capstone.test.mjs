// The a-capstone check against the folders a Learner may leave. Each rerun
// goes through the refresh runner as prepared, with a stand-in `claude`
// that writes the run's pages and prints its result, so the record the
// check reads is the one the runner writes. The cases: valid A (July
// corrected, the email held, the solution's note), valid B (July held back
// by a hold notice, the email cancelled, a June email, a note in other
// words), the untouched start, the manuscript's near misses (the note that
// ships on success, every page as the run left it, everything held, a
// bypass, a hand edit, a widened bounds file), and the misses beyond them:
// a rerun before the bounds changed, the bounds changed after the run, a
// run record written by hand, pages with a wrong room, places, access line
// or battery rule, a private number, an email still scheduled, notes that
// leave a part out, and a reviewer's report that doesn't cover the pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const { STUB_SESSION } = await import(pathToFileURL(join(checks, 'stub-claude.mjs')).href);
const cap = await import(pathToFileURL(join(checks, 'lessons/a-capstone.mjs')).href);
const [june, july, schedule, battery, numbers, outbox, note, ran, reviewed] = cap.items;
const all = cap.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/a-capstone/project']) {
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
const fixture = (n) => read(`test/fixtures/a-capstone/${n}`);
const solution = (p) => read(`solutions/a-capstone/${p}`);
const BOUNDS = 'fixit/summer/run/bounds.json';
const RUNNER = 'fixit/summer/run/refresh.sh';
const RECORD = 'fixit/summer/run/last-run';
const OUTBOX = 'fixit/summer/outbox/reminder-2027-06-11-1400.md';
const NOTE = 'fixit/summer/go-no-go.md';
const REVIEW = 'fixit/summer/reviews/release-check.md';
const FOLDER_BOUNDS = solution(BOUNDS);
const HELD = solution(OUTBOX);
const NOTE_A = solution(NOTE);
const NOTE_B = fixture('go-no-go-b.md');
const REVIEWED = solution(REVIEW);

/** The bounds as they started, changed by `change`. */
const bounds = (change) => {
  const b = JSON.parse(START[BOUNDS]);
  change(b);
  return `${JSON.stringify(b, null, 2)}\n`;
};
const JULY_LINE = bounds((b) => b.permissions.allow.push('Edit(./summer/public/july.md)'));

/** A copy as the lesson starts it, committed, with `files` written over it. */
function copy(files = {}) {
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
  duration_ms: 31000,
  duration_api_ms: 29000,
  num_turns: 8,
  ...(subtype === 'success' ? { result: 'I updated the pages I was asked to.' } : {}),
  session_id: `7c2a9e41-3b5d-4f60-8e1a-${String(++ids).padStart(12, '0')}`,
  total_cost_usd: cost,
  permission_denials: denials,
});
const JULY_DENIED = [{ tool_name: 'Write', tool_use_id: 'toolu_01', tool_input: { file_path: '/home/learner/claude-code-practice/project/fixit/summer/public/july.md' } }];

/**
 * Runs the refresh runner as prepared in `r`, with a stand-in `claude` that
 * writes `pages` (name to text, in summer/public/), prints `reply` and exits
 * 1 when it is an error, as `claude -p` does.
 */
function refresh(r, args, reply, pages = {}) {
  const base = mkdtempSync(join(tmpdir(), 'fixit-acap-run-'));
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

const TASK_A =
  "Update july.md's access line and june.md's places line from summer/late-email-2027-06-10.md, with 24 places for June, then rebuild schedule.md from the three pages. Change nothing else.";
const PAGES_A = { 'july.md': fixture('july-fixed.md'), 'june.md': fixture('june-24.md'), 'schedule.md': fixture('schedule-24-fixed.md') };
const PAGES_B = { 'july.md': fixture('july-hold.md'), 'june.md': fixture('june-24.md'), 'schedule.md': fixture('schedule-24-hold.md') };
/** The bounded rerun of the Canonical path. */
const rerun = (r, pages = PAGES_A) => refresh(r, [TASK_A], result('success', 0.19), pages);

/** Valid A: the email held, the bounds' folder rule, the rerun, the note and the reviewer's report. */
function solved(files = {}) {
  const r = copy({ [OUTBOX]: HELD, [BOUNDS]: FOLDER_BOUNDS });
  const run = rerun(r);
  assert.equal(run.status, 0, run.stderr);
  write(r.dir, { [NOTE]: NOTE_A, [REVIEW]: REVIEWED, ...files });
  return r;
}

const passes = (r, items = all) => {
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};
const fileOf = (r, p) => readFileSync(join(r.dir, p), 'utf8');
const cancelled = (mail) => mail.replace('status: scheduled', 'status: cancelled');

test('valid A: July corrected, the email held, the bounds widened to the folder, one bounded rerun, the note and the review pass every item', () => {
  const r = solved();
  passes(r);
  const report = fileOf(r, `${RECORD}/report.txt`);
  assert.match(report, /^permission denials: 0$/m);
  assert.match(report, /files changed:\n {2}summer\/public\/july\.md\n {2}summer\/public\/june\.md\n {2}summer\/public\/schedule\.md\n$/);
});

test('valid B: July held back by a hold notice, the email cancelled, a June email instead, a line for july.md alone and a note in other words pass too', () => {
  const r = copy({ [OUTBOX]: cancelled(START[OUTBOX]), [BOUNDS]: JULY_LINE });
  assert.equal(rerun(r, PAGES_B).status, 0);
  write(r.dir, { 'fixit/summer/outbox/june-room-change.md': fixture('june-room-change.md'), [NOTE]: NOTE_B, [REVIEW]: fixture('release-check-clean.md') });
  passes(r);
  assert.equal(cap.isHold(fileOf(r, `${PUBLIC}/july.md`)), true);
});

test('June as places are limited, with no number, passes the June and schedule items', () => {
  const r = copy({ [BOUNDS]: FOLDER_BOUNDS });
  rerun(r, { 'july.md': fixture('july-fixed.md'), 'june.md': fixture('june-limited.md'), 'schedule.md': fixture('schedule-limited-fixed.md') });
  passes(r, [june, july, schedule, battery, numbers, ran]);
});

test('two more defensible notes in other words pass item 7: a list, and sentences with the email sent per session', () => {
  const list = `# For Maya and Priya

- june.md: GO. Room A, moved, 24 places (late email from Dee, 10 June).
- july.md: GO with the fix: not step-free on 10 July. Last night's run was refused july.md (permission_denials), so it still said step-free by lift.
- august.md: GO, unchanged.
- schedule.md: GO, rebuilt from the three pages.
- Reminder email: HOLD. Priya sends it per session after 15:00.
- June: 28 booked, 24 places. Maya to offer the extra 4 another date.
- Still open: Dee hasn't answered about July. If she confirms the lift, the July page changes.
`;
  const prose = `Go/no-go, 11:25.

The June page can go up: it gives Room A, as Dee's email of 10 June says, and 24 places.
The July page can go up as corrected. The overnight run was denied the edit to july.md, which is why it still claimed the lift.
August can go up as it is. The schedule can go up too: the rerun rebuilt it.
The 14:00 email should not send as drafted: I've held it.
June has 28 registrations for 24 places, so four people are over. Maya decides who moves, today.
What would change this: Dee confirming the lift before 10 July.
`;
  for (const text of [list, prose]) passes(copy({ [NOTE]: text }), [note]);
});

test('the untouched starting state fails: the pages, the email, the note, the run and the review; only the numbers and the battery rule pass', () => {
  const r = copy();
  says(june, r, /^`june\.md` offers 32 places, more than Room A can take/);
  says(july, r, /^`july\.md` still says "Step-free access by lift next to the children's library"\. The lift/);
  says(schedule, r, /^`schedule\.md`'s June row offers 32 places/);
  passes(r, [battery, numbers]);
  says(outbox, r, /^The 14:00 email is still `scheduled`, and its body says July is "Step-free by lift"\./);
  says(note, r, /^There's no `summer\/go-no-go\.md` yet\./);
  says(ran, r, /^No refresh has run since the overnight one\./);
  says(reviewed, r, /^There's no reviewer's report in `summer\/reviews\/release-check\.md`\./);
});

test('the near miss: every page as the run left it, the email scheduled and the note that ships on success fail items 1, 2, 3, 6 and 7', () => {
  const r = copy({ [NOTE]: fixture('go-no-go-near-miss.md') });
  for (const item of [june, july, schedule, outbox]) assert.notEqual(item.check(r), true, item.text);
  says(note, r, /^`go-no-go\.md` doesn't say the overnight run was refused `july\.md`\. The run said success: say what it was denied, and what that left wrong\.$/);
});

test('the near miss approach "hold everything": a note that holds every page fails item 7 by name', () => {
  const r = copy({
    [NOTE]: `# Hold

- june.md: hold
- july.md: hold
- august.md: hold
- schedule.md: hold
- The 14:00 email: held.
- The overnight run was denied july.md; Dee's late email of 10 June changed June and July.
- June has 28 for 24 places. Waiting on Dee.
`,
  });
  says(note, r, /^`go-no-go\.md` holds every page\. Holding isn't neutral/);
});

test('notes that leave a part out each get the item that names it', () => {
  const cases = [
    [NOTE_A.replace(/^- The overnight run.*$/m, '- The overnight run reported `success`.'), /doesn't say the overnight run was refused `july\.md`/],
    [NOTE_A.replaceAll('late email', 'email').replaceAll('Dee', 'the library').replaceAll('10 June', 'Thursday'), /doesn't cite the library's late email of 10 June/],
    [NOTE_A.replace(/^\| `august\.md`.*$\n/m, '').replace(/^- \*\*August.*$\n/m, ''), /doesn't make a call on `august\.md`/],
    [NOTE_A.replace(/^\| 14:00 reminder.*$\n/m, '').replaceAll(/email|reminder|outbox/gi, 'note'), /doesn't make a call on the 14:00 email/],
    [NOTE_A.replaceAll('28', 'all the').replaceAll('the other 4', 'the rest'), /doesn't say what happens to June's 28 registrations/],
    [NOTE_A.replace(/## Asked, not yet answered[\s\S]*$/, ''), /doesn't say what you asked and haven't heard back/],
  ];
  for (const [text, re] of cases) says(note, copy({ [NOTE]: text }), re);
});

test('the near miss, the rerun with a bypass flag: the runner refuses it and writes no record, so the run item fails', () => {
  for (const flags of [['--permission-mode', 'bypassPermissions'], ['--dangerously-skip-permissions'], ['--settings', 'other.json']]) {
    const r = copy({ [BOUNDS]: FOLDER_BOUNDS });
    const run = refresh(r, [TASK_A, ...flags], result('success', 0.19), PAGES_A);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /^Refusing to run without summer\/run\/bounds\.json: /);
    assert.equal(fileOf(r, `${PUBLIC}/july.md`), START[`${PUBLIC}/july.md`]);
    says(ran, r, /^No refresh has run since the overnight one\./);
  }
});

test('the near miss by another road: bounds that bypass, drop a deny, allow every command or private files, or reach past the pages fail the run item', () => {
  const cases = [
    [bounds((b) => (b.permissions.defaultMode = 'bypassPermissions')), /turns on bypassPermissions/],
    [bounds((b) => (b.permissions.deny = b.permissions.deny.filter((x) => !x.includes('private')))), /no longer denies reading `private\/` folders/],
    [bounds((b) => (b.permissions.deny = b.permissions.deny.filter((x) => !x.includes('sources')))), /no longer denies editing `sources\/`/],
    [bounds((b) => (b.permissions.deny = b.permissions.deny.filter((x) => !x.includes('git push')))), /no longer denies `git push`/],
    [bounds((b) => b.permissions.allow.push('Bash(*)')), /allows every shell command/],
    [bounds((b) => b.permissions.allow.push('Read(./summer/private/**)')), /allows `Read\(\.\/summer\/private\/\*\*\)`/],
    [bounds((b) => b.permissions.allow.push('Edit(./summer/**)')), /allows `Edit\(\.\/summer\/\*\*\)`, beyond the pages/],
  ];
  for (const [text, re] of cases) says(ran, solved({ [BOUNDS]: text }), re);
  says(ran, solved({ [RUNNER]: START[RUNNER].replace('--permission-mode dontAsk', '--permission-mode bypassPermissions') }), /^`summer\/run\/refresh\.sh` isn't as it was prepared\./);
});

test('the near miss, the pages fixed by hand and no run: the pages pass, the run item names the hand edit; a bounded rerun over it then passes', () => {
  const r = copy({ [BOUNDS]: FOLDER_BOUNDS, [OUTBOX]: HELD, [`${PUBLIC}/july.md`]: fixture('july-fixed.md'), [`${PUBLIC}/june.md`]: fixture('june-24.md'), [`${PUBLIC}/schedule.md`]: fixture('schedule-24-fixed.md'), [NOTE]: NOTE_A, [REVIEW]: REVIEWED });
  passes(r, [june, july, schedule, battery, numbers, outbox, note, reviewed]);
  says(ran, r, /^No bounded run wrote `july\.md` after the overnight one\. A hand edit fixes today's page, not the run: did you also fix the bounds, and rerun what failed\?$/);
  // The Learner's own words differ from the run's, so the run's writes show as changes.
  write(r.dir, {
    [`${PUBLIC}/july.md`]: fixture('july-fixed.md').replace('call the events desk', 'please call the events desk'),
    [`${PUBLIC}/schedule.md`]: fixture('schedule-24-fixed.md').replace('Not step-free (lift out of service)', 'Not step-free: no lift'),
  });
  assert.equal(rerun(r).status, 0);
  passes(r);
});

test('a rerun before the bounds changed is refused july.md; one after the bounds changed again is out of date', () => {
  const before = copy({ [OUTBOX]: HELD });
  refresh(before, [TASK_A], result('success', 0.12, JULY_DENIED), { 'june.md': fixture('june-24.md') });
  assert.match(fileOf(before, `${RECORD}/report.txt`), /^permission denials: 1$/m);
  says(ran, before, /^The last refresh was refused a call, so it didn't do everything it was asked\./);
  const after = solved({ [BOUNDS]: JULY_LINE });
  says(ran, after, /^The last refresh ran before `summer\/run\/bounds\.json` last changed\./);
});

test('a run that changed only the July page, and one that stopped at a limit, fail the run item', () => {
  const one = copy({ [BOUNDS]: FOLDER_BOUNDS });
  rerun(one, { 'july.md': fixture('july-fixed.md') });
  says(ran, one, /^No run that ended in `success` with no denials changed `schedule\.md`/);
  const stopped = copy({ [BOUNDS]: FOLDER_BOUNDS });
  refresh(stopped, [TASK_A], result('error_max_turns', 0.4), { 'july.md': fixture('july-fixed.md') });
  says(ran, stopped, /^The last refresh ended with `error_max_turns`, not `success`/);
});

test('a run record written by hand fails: a report alone, a result with no history, and the check\'s stand-in reply', () => {
  const report = `exit status: 0\nresult subtype: success\nturns: 8 (limit 25)\nestimated cost: $0.19 (limit $1.00)\npermission denials: 0\nfiles changed:\n  summer/public/july.md\n  summer/public/schedule.md\n`;
  const pages = { [`${PUBLIC}/july.md`]: PAGES_A['july.md'], [`${PUBLIC}/june.md`]: PAGES_A['june.md'], [`${PUBLIC}/schedule.md`]: PAGES_A['schedule.md'] };
  says(ran, copy({ [BOUNDS]: FOLDER_BOUNDS, ...pages, [`${RECORD}/report.txt`]: report }), /^No bounded run wrote `july\.md` after the overnight one\./);
  const r = copy({ [BOUNDS]: FOLDER_BOUNDS, ...pages, [`${RECORD}/report.txt`]: report, [`${RECORD}/result.json`]: `${JSON.stringify(result('success', 0.19))}\n` });
  says(ran, r, /^The run has no report of the files it changed/);
  const stub = solved();
  write(stub.dir, { [`${RECORD}/result.json`]: `${JSON.stringify({ ...result('success', 0.19), session_id: STUB_SESSION })}\n` });
  says(ran, stub, /holds the check's stand-in reply/);
});

test('June pages that are wrong get the June item by name: Room B, 32 or 40 places, no word that it moved', () => {
  const page = fixture('june-24.md');
  const cases = [
    [page.replace('**Room A** (ground floor). We\'ve moved from Room B because the lift is out of service. Room A is step-free.', 'Room B (first floor).'), /still gives Room B: "Where: Millbrook Library, Room B \(first floor\)\."/],
    [page.replace('24 places', '32 places'), /offers 32 places, more than Room A can take/],
    [page.replace('24 places', '40 places'), /offers 40 places/],
    [page.replace(" We've moved from Room B because the lift is out of service.", ''), /doesn't say the session has moved/],
  ];
  for (const [text, re] of cases) says(june, copy({ [`${PUBLIC}/june.md`]: text }), re);
});

test('July pages: a lift claim fails, a hold notice with no number fails, a page that says it is upstairs with no lift passes', () => {
  const page = fixture('july-fixed.md');
  says(july, copy({ [`${PUBLIC}/july.md`]: page.replace('**Not step-free on 10 July:** the lift is out of service until at least 20 July.', 'Step-free access: use the lift.') }), /still says "Step-free access: use the lift"\. /);
  says(july, copy({ [`${PUBLIC}/july.md`]: fixture('july-hold.md').replaceAll(' on 555-0100', '').replace(', 555-0100.', '.') }), /gives no number to call/);
  const upstairs = page.replace(/\*\*Not step-free on 10 July:\*\*.*$/m, 'Room B is upstairs, and on 10 July there is no lift: the library\'s events desk, 555-0100, can talk through options.');
  passes(copy({ [`${PUBLIC}/july.md`]: upstairs }), [july, battery]);
});

test('schedules that are wrong get the schedule item: July still step-free, June places that disagree with the page', () => {
  const r = copy({ [`${PUBLIC}/june.md`]: fixture('june-24.md'), [`${PUBLIC}/schedule.md`]: fixture('schedule-24-fixed.md').replace('Not step-free (lift out of service)', 'Step-free by lift') });
  says(schedule, r, /^`schedule\.md`'s July row still says "Step-free by lift"/);
  const off = copy({ [`${PUBLIC}/june.md`]: fixture('june-limited.md'), [`${PUBLIC}/schedule.md`]: fixture('schedule-24-fixed.md') });
  says(schedule, off, /^`schedule\.md`'s June row gives 24 places, and `june\.md` gives no number/);
});

test('a page without the battery rule fails item 4; a July hold notice needs none', () => {
  const r = copy({ [`${PUBLIC}/august.md`]: START[`${PUBLIC}/august.md`].replace('; lithium power tool batteries over 36 V', '') });
  says(battery, r, /^`august\.md` doesn't give the fire officer's rule/);
  passes(copy({ [`${PUBLIC}/july.md`]: fixture('july-hold.md') }), [battery]);
});

test('a private number on a page or in the outbox fails item 5', () => {
  says(numbers, copy({ [`${PUBLIC}/july.md`]: fixture('july-fixed.md').replace('555-0100.', '555-0187.') }), /^`summer\/public\/july\.md` gives 555-0187/);
  says(numbers, copy({ 'fixit/summer/outbox/june-room-change.md': fixture('june-room-change.md').replace('555-0100', '555 0187') }), /^`summer\/outbox\/june-room-change\.md` gives 555-0187/);
});

test('the email: held, cancelled or a draft passes; scheduled passes only with a corrected body; sent, no status or a missing file fail', () => {
  for (const status of ['held', 'cancelled', 'draft', 'on hold']) passes(copy({ [OUTBOX]: START[OUTBOX].replace('status: scheduled', `status: ${status}`) }), [outbox]);
  const body = START[OUTBOX]
    .replace('| Sat 12 June | Millbrook Library, Room A | Step-free | 32 |', '| Sat 12 June | Millbrook Library, Room A (moved) | Step-free | 24 |')
    .replace('| Sat 10 July | Millbrook Library, Room B | Step-free by lift | 32 |', '| Sat 10 July | Millbrook Library, Room B | Not step-free: the lift is out of service | 32 |');
  passes(copy({ [OUTBOX]: body }), [outbox]);
  says(outbox, copy({ [OUTBOX]: body.replace('| 24 |', '| 32 |') }), /its June line offers 32 places/);
  says(outbox, copy({ [OUTBOX]: body.replace('Questions: 555-0100', 'Questions: 555-0187') }), /its body gives 555-0187/);
  says(outbox, copy({ [OUTBOX]: START[OUTBOX].replace('status: scheduled', 'status: sent') }), /says `status: sent`/);
  says(outbox, copy({ [OUTBOX]: START[OUTBOX].replace('status: scheduled\n', '') }), /has no `status:` line/);
  const gone = copy();
  rmSync(join(gone.dir, OUTBOX));
  says(outbox, gone, /is missing/);
});

test("the reviewer's report: no Read line, or a Read line without the schedule, fails item 9", () => {
  says(reviewed, solved({ [REVIEW]: REVIEWED.replace(/^\*\*Read:\*\*.*$/m, '') }), /doesn't say what the reviewer read/);
  says(reviewed, solved({ [REVIEW]: REVIEWED.replace('summer/public/schedule.md, ', '') }), /The reviewer didn't read `schedule\.md`/);
});
