// The a-7 check against the folders a Learner may leave: three named
// easy-read pages (valid A), the `*-easy.md` pattern (valid B), the
// manuscript's near miss (a folder pattern kept after June was restored),
// and the misses beyond it: a runner that skips its checks, a slice run
// before the bounds last changed, a June page left changed, and a slice
// record written by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a7 = await import(pathToFileURL(join(checks, 'lessons/a-7.mjs')).href);
const [bounds, runner, slice, june] = a7.items;

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/a-7/project']) {
  const walk = (d, rel = '') => {
    for (const e of readdirSync(join(COURSE, d, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(d, r);
      else START[r] = read(`${d}/${r}`);
    }
  };
  walk(dir);
}

const BOUNDS = 'fixit/summer/run/easy-bounds.json';
const RUNNER = 'fixit/summer/run/easy-refresh.sh';
const RESULT = 'fixit/summer/run/easy-last-run/result.json';
const USED = 'fixit/summer/run/easy-last-run/bounds.json';
const JUNE = 'fixit/summer/public/june.md';
const NARROW = read('solutions/a-7/fixit/summer/run/easy-bounds.json');
const PATTERN = read('test/fixtures/a-7/easy-bounds-B.json');
const RAN = read('test/fixtures/a-7/easy-result.json');
const JUNE_START = START[JUNE];
// The June page after the Worked example's slice: one line, "mains rewiring".
const JUNE_SLICED = JUNE_START.replace('rewiring inside the casing', 'mains rewiring inside the casing');
const TIDIED = JUNE_SLICED.replace(
  "**Booking:** 32 places. Book on the library's events page; walk-ins at 11:00 if there's space.",
  "**Booking:** There are 32 places. Please book on the library's events page.",
);

/** The folder at the end of a slice run with `b` as the bounds, June as `page`. */
const ran = (b, page = JUNE_SLICED) => ({
  'fixit/summer/run/bounds.json': read('solutions/a-7/fixit/summer/run/bounds.json'),
  [BOUNDS]: b,
  [RESULT]: RAN,
  [USED]: b,
  [JUNE]: page,
});
/** The bounds with their allow list changed by `edit`. */
const allowing = (edit, from = NARROW) => {
  const b = JSON.parse(from);
  b.permissions.allow = edit(b.permissions.allow);
  return JSON.stringify(b, null, 2);
};
const withJson = (change, from = NARROW) => {
  const b = JSON.parse(from);
  change(b);
  return JSON.stringify(b, null, 2);
};

function copy(files = {}) {
  const dir = repo(START, { nested: true });
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const all = [bounds, runner, slice, june];
const passes = (r, items = all) => {
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, r, re) => {
  const got = item.check(r);
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};

test('valid A: three named easy-read pages, a slice run with them, June as the Worked example left it, passes every item', () => {
  passes(copy(ran(NARROW)));
});

test('valid B: the *-easy.md pattern passes too', () => {
  passes(copy(ran(PATTERN)));
});

test('the untouched starting state fails: no easy-read bounds and no slice yet; the runner and June pass', () => {
  const r = copy();
  says(bounds, r, /^There's no `summer\/run\/easy-bounds\.json` yet\./);
  says(slice, r, /^There's no slice result yet\. Run the slice: `fixit\/summer\/run\/easy-refresh\.sh june`\.$/);
  passes(r, [runner, june]);
});

test('the June page as the lesson began, before the Worked example slice, passes too', () => {
  passes(copy(ran(NARROW, JUNE_START)), [june]);
});

test("the near miss: a folder pattern, June restored, the bounds left as they were, fails on the bounds", () => {
  const folder = allowing((a) => [...a.filter((x) => !x.startsWith('Edit(')), 'Edit(./summer/public/*.md)']);
  const r = copy(ran(folder));
  says(bounds, r, /^`Edit\(\.\/summer\/public\/\*\.md\)` lets the run change `summer\/public\/june\.md` too, not just the easy-read pages\./);
  passes(r, [runner, slice, june]);
});

test('the folder pattern with June still tidied fails on the bounds and on June', () => {
  const folder = allowing((a) => [...a.filter((x) => !x.startsWith('Edit(')), 'Edit(./summer/public/*.md)']);
  const r = copy(ran(folder, TIDIED));
  says(bounds, r, /lets the run change `summer\/public\/june\.md` too/);
  says(june, r, /^`summer\/public\/june\.md` has changed, and the easy-read run wasn't asked to touch it\./);
});

test('the bounds narrowed after the slice, with no slice since, fails until the slice runs again', () => {
  const folder = allowing((a) => [...a.filter((x) => !x.startsWith('Edit(')), 'Edit(./summer/public/*.md)']);
  const r = copy({ ...ran(folder), [BOUNDS]: NARROW });
  says(slice, r, /^The last slice ran before `summer\/run\/easy-bounds\.json` last changed\./);
  passes(r, [bounds, june]);
});

test('a hand-written slice record fails: no bounds copy, the wrong shape, or the stand-in reply', () => {
  const printed = { ...ran(NARROW), [RESULT]: '{"type":"result","subtype":"success","is_error":false,"num_turns":1,"total_cost_usd":0.01,"session_id":"x"}\n' };
  delete printed[USED];
  says(slice, copy(printed), /no copy of the bounds it ran with/);
  says(slice, copy({ ...ran(NARROW), [RESULT]: 'slice ran fine, $0.08\n' }), /isn't the result of a `claude -p` run/);
  says(slice, copy({ ...ran(NARROW), [RESULT]: RAN.replace('headless-5f0c2a91b7e4', '00000000-0000-4000-8000-00000000c0de') }), /holds the check's stand-in reply/);
});

test('a slice that hit a limit, or cost the whole budget, fails', () => {
  says(slice, copy({ ...ran(NARROW), [RESULT]: RAN.replace('"subtype":"success"', '"subtype":"error_max_budget_usd"') }), /ended with `error_max_budget_usd`, not `success`\. It stopped at the spend limit/);
  says(slice, copy({ ...ran(NARROW), [RESULT]: RAN.replace('"total_cost_usd":0.08', '"total_cost_usd":0.3') }), /cost \$0\.3, which isn't under the runner's spend limit of \$0\.3\./);
});

test('wide or misplaced edit rules fail, each naming the file they would let the run change', () => {
  const cases = [
    ['Edit', /^`Edit` lets the run change `summer\/public\/june\.md` too/],
    ['Edit(*)', /^`Edit\(\*\)` lets the run change `summer\/public\/june\.md` too/],
    ['Write(./summer/**)', /^`Write\(\.\/summer\/\*\*\)` lets the run change `summer\/public\/june\.md` too/],
    ['Edit(./summer/public)', /lets the run change `summer\/public\/june\.md` too/],
    ['Edit(*.md)', /lets the run change `summer\/public\/june\.md` too/],
    ['Edit(./sources/**)', /^`Edit\(\.\/sources\/\*\*\)` lets the run change `sources\/group-notes\.md`\. This run edits only the three easy-read pages\.$/],
    ['Edit(CLAUDE.md)', /lets the run change `CLAUDE\.md`/],
    ['Edit(//home/learner/**)', /names a path from outside `fixit\/`/],
  ];
  for (const [rule, re] of cases) says(bounds, copy(ran(allowing((a) => [...a, rule]))), re);
});

test('an easy-read page no rule allows fails; any spelling that covers all three passes', () => {
  says(bounds, copy(ran(allowing((a) => a.filter((x) => !x.includes('august-easy'))))), /lets the run edit `summer\/public\/august-easy\.md`/);
  for (const rule of ['Edit(summer/public/*-easy.md)', 'Edit(*-easy.md)', 'Edit(./**/*-easy.md)'])
    passes(copy(ran(allowing((a) => [...a.filter((x) => !x.startsWith('Edit(')), rule]))), [bounds]);
});

test('the deny list must keep private folders and the sources out', () => {
  says(bounds, copy(ran(withJson((b) => (b.permissions.deny = b.permissions.deny.filter((x) => !x.includes('private')))))), /No deny rule keeps the run out of a `private\/` folder/);
  says(bounds, copy(ran(withJson((b) => (b.permissions.deny = b.permissions.deny.filter((x) => !x.includes('sources')))))), /No deny rule stops the run changing `sources\/`/);
  passes(copy(ran(withJson((b) => (b.permissions.deny = ['Read(./**/private/**)', 'Write(./sources/**)'])))), [bounds]);
});

test('a command rule that lets anything or a git write through fails, however it is spelled', () => {
  const cases = [
    ['Bash', /^`Bash` lets the run run `rm -rf summer`/],
    ['Bash(*)', /^`Bash\(\*\)` lets the run run/],
    ['Bash(sh -c *)', /^`Bash\(sh -c \*\)` lets the run run `sh -c 'rm -rf summer'`/],
    ['Bash(bash -c *)', /lets the run run `bash -c 'git push'`/],
    ['Bash(node -e *)', /lets the run run `node -e/],
    ['Bash(git *)', /lets the run run `git add/],
    ['Bash(git commit *)', /lets the run run `git commit -m 'Refresh'`/],
    ['Bash(git -C . commit *)', /lets the run run `git -C \. commit -m 'Refresh'`/],
    ['Bash(git:*)', /lets the run run `git add/],
  ];
  for (const [rule, re] of cases) says(bounds, copy(ran(allowing((a) => [...a, rule]))), re);
  passes(copy(ran(allowing((a) => [...a, 'Bash(git diff *)']))), [bounds]);
});

test('the sandbox must be on, strict, and required to start', () => {
  says(bounds, copy(ran(withJson((b) => delete b.sandbox))), /has no `sandbox` settings/);
  says(bounds, copy(ran(withJson((b) => (b.sandbox.enabled = false)))), /Set `"enabled": true`/);
  says(bounds, copy(ran(withJson((b) => delete b.sandbox.failIfUnavailable))), /Set `"failIfUnavailable": true`/);
  says(bounds, copy(ran(withJson((b) => (b.sandbox.allowUnsandboxedCommands = true)))), /Set `"allowUnsandboxedCommands": false`/);
  says(bounds, copy(ran(withJson((b) => (b.sandbox.autoAllowBashIfSandboxed = true)))), /autoAllowBashIfSandboxed/);
  says(bounds, copy(ran(withJson((b) => (b.permissions.defaultMode = 'bypassPermissions')))), /bypassPermissions/);
});

test('bounds that are not JSON, or not an object, fail with their own line', () => {
  says(bounds, copy(ran(NARROW.replace('"WebFetch"]', '"WebFetch",]'))), /isn't valid JSON/);
  says(bounds, copy(ran('[]\n')), /isn't one JSON object/);
});

test('a runner that skips its checks, or loses a bound, fails with the flag it needs', () => {
  const text = START[RUNNER];
  const runnerWith = (from, to) => copy({ ...ran(NARROW), [RUNNER]: text.replace(from, to) });
  says(runner, runnerWith('--permission-mode dontAsk', '--dangerously-skip-permissions'), /skips permission checks/);
  says(runner, runnerWith('--permission-mode dontAsk', '--permission-mode bypassPermissions'), /`bypassPermissions` mode/);
  says(runner, runnerWith('--permission-mode dontAsk', '--permission-mode acceptEdits'), /starts in `acceptEdits` mode/);
  says(runner, runnerWith('--settings summer/run/easy-bounds.json', '--settings summer/run/bounds.json'), /doesn't pass the easy-read bounds/);
  says(runner, runnerWith('  --max-turns 15 \\\n', ''), /sets no turn limit/);
  says(runner, runnerWith('  --max-budget-usd 0.30 \\\n', ''), /sets no spend limit/);
  says(runner, runnerWith('--output-format json', '--output-format text'), /doesn't ask for a JSON result/);
  says(runner, runnerWith('claude -p "', 'echo "'), /never reached its `claude -p` command/);
  const r = copy(ran(NARROW));
  rmSync(join(r.dir, RUNNER));
  says(runner, r, /^`summer\/run\/easy-refresh\.sh` is missing\./);
});

test("the runner as prepared passes even before the bounds exist, and refuses to start without them", () => {
  passes(copy(), [runner]);
});

test('any other change to the June page fails, a blank line included', () => {
  says(june, copy(ran(NARROW, `${JUNE_SLICED}\n`)), /has changed/);
  says(june, copy(ran(NARROW, JUNE_SLICED.replace('32 places', '30 places'))), /has changed/);
});
