// The i-5 lab's check against the work a Learner may leave in the website
// repository: the solution, a second valid route, the loop-guard near miss,
// the untouched start, gates and guards that only look right, and one
// mistake per item, each played with real git, real bash and jq, and the
// real `npm test` in a copy laid out as a practice copy is (project/ below
// the git root).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, GUIDE, layChecks } from '../tools/lay.mjs';

// NODE_TEST_CONTEXT would make the check's own `npm test` runs skip their tests.
delete process.env.NODE_TEST_CONTEXT;

const checks = layChecks();
const { repo, commit, write, setMode } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i5 = await import(pathToFileURL(join(checks, 'lessons/i-5.mjs')).href);
const [committed, guarded, gate, stopped, guard, denied, kept, testsPass] = i5.items;

// The lab's starting files, with the guide's inert names made live
// (`dot-claude` is `.claude`), as Questerm lays them in the copy.
const { RESTORE } = await import(pathToFileURL(join(GUIDE, 'quest/release/src/replay.mjs')).href);
const START = {};
const OWN = 'practice-template/lessons/i-5/project';
const walk = (rel = '', to = '') => {
  for (const e of readdirSync(join(COURSE, OWN, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    const live = RESTORE[e.name] ?? e.name;
    const t = to ? `${to}/${live}` : live;
    if (e.isDirectory()) walk(r, t);
    else START[t] = readFileSync(join(COURSE, OWN, r), 'utf8');
  }
};
walk();
const solution = (p) => readFileSync(join(COURSE, 'solutions/i-5', p.replace(/^\.claude\//, 'dot-claude/')), 'utf8');

const GUARD = '.claude/hooks/protect-files.sh';
const GATE = '.claude/hooks/test-gate.sh';
const SETTINGS = '.claude/settings.json';
const HOOK_FILES = [GUARD, GATE, SETTINGS];

/** A fresh practice copy at its first commit; returns the project/ folder. */
function start() {
  const dir = repo(START, { nested: true });
  commit(dir, 'Start from the practice template');
  return dir;
}

/** The start's settings with `add` merged in, as Claude's merges write them. */
function settings(add) {
  const base = JSON.parse(START[SETTINGS]);
  return `${JSON.stringify({ ...base, ...add, permissions: { ...base.permissions, ...add.permissions } }, null, 2)}\n`;
}
const hook = (script, extra = {}) => ({ type: 'command', command: `\${CLAUDE_PROJECT_DIR}/.claude/hooks/${script}`, args: [], ...extra });
const PRE = [{ matcher: 'Edit|Write', hooks: [hook('protect-files.sh', { onFailure: 'block' })] }];
const STOP = [{ hooks: [hook('test-gate.sh')] }];
const DENY = [...JSON.parse(START[SETTINGS]).permissions.deny, 'Edit(./secrets/**)'];

/** Lays the hooks with these settings and gate, executable, and commits them. */
function lab(dir, { settings: text = solution(SETTINGS), gate: script = solution(GATE), guard: g = START['practice/i-5/protect-files.sh'], commitIt = true } = {}) {
  mkdirSync(join(dir, '.claude/hooks'), { recursive: true });
  write(dir, { [GUARD]: g, [GATE]: script, [SETTINGS]: text });
  chmodSync(join(dir, GUARD), 0o755);
  chmodSync(join(dir, GATE), 0o755);
  if (commitIt) {
    commit(dir, 'Guard protected files and gate stopping on the tests', HOOK_FILES);
    setMode(dir, GUARD, 0o755);
    setMode(dir, GATE, 0o755);
    commit(dir, 'Keep the hook scripts executable', []);
  }
  return dir;
}
const passes = (dir, items = i5.items) => {
  const r = openRepo(dir);
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, dir, re) => {
  const got = item.check(openRepo(dir));
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};
const BUT_GATE = [committed, guarded, stopped, guard, denied, kept, testsPass];

// Valid B's gate, the one Claude might write for "only once per stop so it
// can't loop": no jq, the tests' output dropped, its own reason on stderr.
const GATE_B = `#!/bin/bash
input=$(cat)
if echo "$input" | grep -q '"stop_hook_active": *true'; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 1
if npm test > /dev/null 2>&1; then
  exit 0
fi
echo "The tests fail. Run npm test and fix them before you stop." >&2
exit 2
`;
// The manuscript's near miss: "Write a Stop hook that runs the tests and
// exits 2 if they fail." No loop guard.
const NO_GUARD = `#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 1
if ! npm test 2>&1; then
  echo "Blocked: the tests fail." >&2
  exit 2
fi
exit 0
`;

test('valid A, the solution: the guard, the gate, the deny rule and the settings committed together, passes every item', () => {
  const dir = lab(start());
  assert.equal(readFileSync(join(dir, SETTINGS), 'utf8'), solution(SETTINGS));
  passes(dir);
});

test('valid B: another matcher spelling, a shell-form command, an Edit deny without ./, and a gate without jq, passes every item', () => {
  const text = settings({
    permissions: { deny: ['Edit(secrets/**)'] },
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo checked' }] },
        { matcher: 'Write|Edit', hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/protect-files.sh', onFailure: 'block' }] },
      ],
      Stop: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/test-gate.sh' }] }],
    },
  });
  passes(lab(start(), { settings: text, gate: GATE_B }));
});

test("the near miss: a gate with no loop guard fails the gate item on the retry, and only that item", () => {
  const dir = lab(start(), { gate: NO_GUARD });
  says(gate, dir, /^With `stop_hook_active` true, the gate still blocks/);
  passes(dir, BUT_GATE);
});

test('the untouched start fails the hook items, and keeps the protected files and the tests', () => {
  const dir = start();
  says(committed, dir, /^There is no `\.claude\/hooks\/protect-files\.sh`/);
  says(guarded, dir, /no hook command names `\.claude\/hooks\/protect-files\.sh`/);
  says(gate, dir, /^There is no `\.claude\/hooks\/test-gate\.sh`/);
  says(stopped, dir, /doesn't run test-gate\.sh as a `Stop` hook/);
  says(guard, dir, /^There is no `\.claude\/hooks\/protect-files\.sh`/);
  says(denied, dir, /^Add `Edit\(\.\/secrets\/\*\*\)` to `permissions\.deny`/);
  passes(dir, [kept, testsPass]);
});

test('gates that only look right: one that never runs the tests, one that always blocks, one that never does, and one that blocks with no reason', () => {
  says(gate, lab(start(), { gate: '#!/bin/bash\nnode --version\nexit 0\n' }), /didn't run the repository's tests/);
  says(gate, lab(start(), { gate: '#!/bin/bash\nnpm test 2>&1\necho "Blocked" >&2\nexit 2\n' }), /^With the tests passing, the gate exits 2/);
  says(gate, lab(start(), { gate: '#!/bin/bash\nnpm test 2>&1\nexit 0\n' }), /^While the tests fail, the gate exits 0/);
  says(gate, lab(start(), { gate: '#!/bin/bash\nnpm test 2>&1 || exit 1\nexit 0\n' }), /^While the tests fail, the gate exits 1/);
  says(gate, lab(start(), { gate: '#!/bin/bash\nnpm test > /dev/null 2>&1 || exit 2\nexit 0\n' }), /without a reason on stderr/);
  // A loop guard read the wrong way round lets Claude stop at once.
  says(gate, lab(start(), { gate: solution(GATE).replace('= "true"', '= "false"') }), /exited 0 without running it.*exit early only when `stop_hook_active` is true/);
});

test('a gate run while a test is still broken on purpose says to put it back', () => {
  const dir = lab(start());
  write(dir, { 'test/links.test.js': START['test/links.test.js'].replace(", false);", ', true);') });
  says(gate, dir, /put it back first/);
  says(testsPass, dir, /^`npm test` fails/);
});

test('the guard item: an Edit|Write matcher only on Edit, no onFailure, the local file, a list matcher, and another path each name what is wrong', () => {
  const only = (pre) => settings({ hooks: { PreToolUse: pre, Stop: STOP }, permissions: { deny: DENY } });
  says(guarded, lab(start(), { settings: only([{ matcher: 'Edit', hooks: [hook('protect-files.sh', { onFailure: 'block' })] }]) }), /the `matcher` "Edit" doesn't match both tool names/);
  says(guarded, lab(start(), { settings: only([{ matcher: 'Edit|Write', hooks: [hook('protect-files.sh')] }]) }), /^Add `"onFailure": "block"`/);
  says(guarded, lab(start(), { settings: only([{ matcher: ['Edit', 'Write'], hooks: [hook('protect-files.sh', { onFailure: 'block' })] }]) }), /is a list/);
  says(guarded, lab(start(), { settings: only([{ matcher: 'Edit|Write', hooks: [hook('protect-files.off', { onFailure: 'block' })] }]) }), /names `\.claude\/hooks\/protect-files\.off`/);
  says(guarded, lab(start(), { settings: settings({ hooks: { PostToolUse: PRE, Stop: STOP }, permissions: { deny: DENY } }) }), /it is under `PostToolUse`/);
  const local = lab(start(), { settings: settings({ hooks: { Stop: STOP }, permissions: { deny: DENY } }) });
  write(local, { '.claude/settings.local.json': `${JSON.stringify({ hooks: { PreToolUse: PRE } }, null, 2)}\n` });
  says(guarded, local, /^The guard is registered in `\.claude\/settings\.local\.json`/);
  says(guarded, lab(start(), { settings: '{ "permissions": { "deny": [] }, }\n' }), /is not valid JSON/);
});

test('the Stop item: the gate under another event, or only in the local file, says so', () => {
  says(stopped, lab(start(), { settings: settings({ hooks: { PreToolUse: PRE, PostToolUse: STOP }, permissions: { deny: DENY } }) }), /names test-gate\.sh, but not under `"Stop"`/);
  const local = lab(start(), { settings: settings({ hooks: { PreToolUse: PRE }, permissions: { deny: DENY } }) });
  write(local, { '.claude/settings.local.json': `${JSON.stringify({ hooks: { Stop: STOP } }, null, 2)}\n` });
  says(stopped, local, /^The gate is registered in `\.claude\/settings\.local\.json`/);
});

test('the guard script item: a guard that lets secrets/ through, or blocks everything, fails; one that probes Write as well as Edit is needed', () => {
  const guardText = START['practice/i-5/protect-files.sh'];
  says(guard, lab(start(), { guard: guardText.replace('*/secrets/*)', '*/no-such-folder/*)') }), /^For an Edit of `secrets\/api\.txt`, protect-files\.sh exits 0 instead of 2/);
  says(guard, lab(start(), { guard: '#!/bin/bash\ncat > /dev/null\necho "Blocked" >&2\nexit 2\n' }), /^For an Edit of `src\/links\.js`, which it doesn't protect, protect-files\.sh exits 2 instead of 0/);
  // A guard that reads only an Edit's input lets a Write of package-lock.json through.
  const editOnly = guardText.replace('INPUT=$(cat)', 'INPUT=$(cat)\n[ "$(echo "$INPUT" | jq -r .tool_name)" = "Edit" ] || exit 0');
  says(guard, lab(start(), { guard: editOnly }), /^For a Write of `package-lock\.json`, protect-files\.sh exits 0 instead of 2/);
  // .env.example stays editable, as the guard's own case says.
  says(guard, lab(start(), { guard: guardText.replace('  .env.example) ;;\n', '') }), /^For an Edit of `\.env\.example`, which it doesn't protect/);
});

test('the deny item: a Read rule, a rule for one file, one under ask, a Bash rule and the local file each name what is wrong; any depth passes', () => {
  const deny = (rules, extra = {}) => lab(start(), { settings: settings({ hooks: { PreToolUse: PRE, Stop: STOP }, permissions: { deny: rules, ...extra } }) });
  says(denied, deny(['Read(./secrets/**)']), /^A `Read` rule stops Claude reading `secrets\/`, not changing it/);
  says(denied, deny(['Edit(./secrets/api.txt)']), /^`Edit\(\.\/secrets\/api\.txt\)` doesn't cover every file in `secrets\/`/);
  says(denied, deny([], { ask: ['Edit(./secrets/**)'] }), /^`Edit\(\.\/secrets\/\*\*\)` is under `ask`, not `deny`/);
  says(denied, deny(['Bash(echo *)', 'Bash(* >> secrets/*)']), /^A `Bash` rule matches a command as it is written/);
  const local = deny([]);
  write(local, { '.claude/settings.local.json': `${JSON.stringify({ permissions: { deny: ['Edit(./secrets/**)'] } }, null, 2)}\n` });
  says(denied, local, /^The `secrets\/` rule is in `\.claude\/settings\.local\.json`/);
  passes(deny(['Edit(**/secrets/**)']), [denied]);
  passes(deny(['Edit(/secrets/*)']), [denied]);
});

test('the commit item: scripts committed without the executable bit, settings left out, or a change after the commit, each fail', () => {
  const plain = start();
  lab(plain, { commitIt: false });
  commit(plain, 'Hooks', HOOK_FILES);
  setMode(plain, GUARD, 0o644);
  commit(plain, 'Drop the bit', []);
  chmodSync(join(plain, GUARD), 0o644);
  says(committed, plain, /^`\.claude\/hooks\/protect-files\.sh` is committed without its executable bit/);

  const noSettings = start();
  lab(noSettings, { commitIt: false });
  commit(noSettings, 'Only the scripts', [GUARD, GATE]);
  setMode(noSettings, GUARD, 0o755);
  setMode(noSettings, GATE, 0o755);
  commit(noSettings, 'Keep them executable', []);
  says(committed, noSettings, /^`\.claude\/settings\.json` has changes that aren't committed yet/);

  const later = lab(start());
  write(later, { [SETTINGS]: settings({ hooks: { PreToolUse: PRE }, permissions: { deny: DENY } }) });
  says(committed, later, /^`\.claude\/settings\.json` has changes that aren't committed yet/);
});

test('the kept item: the line the shell command appended to secrets/api.txt, left or committed, and an edited package-lock.json each fail', () => {
  const left = lab(start());
  appendFileSync(join(left, 'secrets/api.txt'), '# Checked by Ade on 2 May\n');
  says(kept, left, /^`secrets\/api\.txt` has changed since the lab started.*`git checkout -- secrets\/api\.txt`/);

  const committedLine = lab(start());
  appendFileSync(join(committedLine, 'secrets/api.txt'), '# Checked by Ade on 2 May\n');
  commit(committedLine, 'Everything', ['secrets/api.txt']);
  says(kept, committedLine, /A commit changed it/);

  const lock = lab(start());
  write(lock, { 'package-lock.json': START['package-lock.json'].replace('"version": "1.0.0"', '"version": "1.0.1"') });
  says(kept, lock, /^`package-lock\.json` has changed since the lab started, so an edit got past the guard/);
});

test('a guard renamed away and never put back fails both guard items, as Your turn step 2 leaves it if the last mv is skipped', () => {
  const dir = lab(start());
  renameSync(join(dir, GUARD), join(dir, '.claude/hooks/protect-files.off'));
  says(guard, dir, /^There is no `\.claude\/hooks\/protect-files\.sh`/);
  says(committed, dir, /^`\.claude\/hooks\/protect-files\.sh` has changes that aren't committed yet/);
});
