// The a-4 lab's check against the work a Learner may leave in the website
// repository: the solution's own steps.sh, a second valid route, the untouched
// start, JSON written by hand, and the near misses of each item, each played
// with real git, bash, jq and `npm test` in a copy laid out as a practice copy
// is (project/ below the git root). Claude Code's real run is a stand-in here
// that answers as Claude Code's JSON does and keeps its session's file under
// $HOME/.claude/projects/, as Claude Code keeps every run's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

// NODE_TEST_CONTEXT would make the check's own `npm test` runs skip their tests.
delete process.env.NODE_TEST_CONTEXT;

const checks = layChecks();
const { repo, write, rootWrite } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a4 = await import(pathToFileURL(join(checks, 'lessons/a-4.mjs')).href);
const [executable, call, behaves, saved, acted] = a4.items;

const START = {};
const OWN = 'practice-template/lessons/a-4/project';
const walk = (rel = '') => {
  for (const e of readdirSync(join(COURSE, OWN, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(r);
    else START[r] = readFileSync(join(COURSE, OWN, r), 'utf8');
  }
};
walk();
const SOLUTION = join(COURSE, 'solutions/a-4');
const solution = (p) => readFileSync(join(SOLUTION, p), 'utf8');
const SCRIPT = 'scripts/review-staged.sh';

const made = [];
test.after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

// A home of its own for each test's runs, so the sessions it finds are the
// ones its runs kept, and a bin folder whose `claude` stands in for Claude
// Code's real run.
const HOME = mkdtempSync(join(tmpdir(), 'a4-home-'));
made.push(HOME);
const BIN = join(HOME, 'bin');
mkdirSync(BIN);
// FAKE_TURNS sets num_turns, FAKE_FINDINGS the findings' JSON, FAKE_KEEP=0
// keeps no session, as `--no-session-persistence` does.
writeFileSync(join(BIN, 'claude'), `#!/usr/bin/env node
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
readFileSync(0);
const id = randomUUID();
const findings = JSON.parse(process.env.FAKE_FINDINGS ?? JSON.stringify([
  { file: 'src/links.js', line: 12, problem: 'Only a comment that opens and closes on one line is skipped.' },
  { file: 'src/links.js', line: 11, problem: 'No test covers this change.' },
]));
if (process.env.FAKE_KEEP !== '0') {
  const dir = join(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME, '.claude'), 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, id + '.jsonl'), JSON.stringify({ type: 'user', sessionId: id, cwd: process.cwd() }) + '\\n');
}
const result = JSON.stringify({ findings });
process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: Number(process.env.FAKE_TURNS ?? 2), result, session_id: id, total_cost_usd: 0.05, permission_denials: [], structured_output: { findings } }) + '\\n');
`);
chmodSync(join(BIN, 'claude'), 0o755);
process.env.HOME = HOME;
delete process.env.CLAUDE_CONFIG_DIR;
const ENV = { ...process.env, PATH: `${BIN}:${process.env.PATH}`, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: ENV }).trim();
const sh = (dir, line, env = {}) => execFileSync('bash', ['-c', line], { cwd: dir, encoding: 'utf8', env: { ...ENV, ...env } });

/** A fresh practice copy at its first commit, the root's .gitignore as the base lays it; returns project/. */
function start() {
  const dir = repo(START, { nested: true });
  made.push(dirname(dir));
  rootWrite(dir, { '.gitignore': '.practice/\nnode_modules/\n' });
  git(dirname(dir), 'add', '-A');
  git(dirname(dir), 'commit', '-q', '-m', 'Start from the practice template');
  git(dirname(dir), 'branch', '-M', 'main');
  return dir;
}

/** The skeleton's call with `call` in place of its placeholders, committed executable. */
function script(dir, line, { extra = {}, mode = 0o755 } = {}) {
  const text = START[SCRIPT].replace('git diff --cached | claude -p "PROMPT GOES HERE" FLAGS_GO_HERE > "$out"', line);
  assert.notEqual(text, START[SCRIPT], 'the skeleton has its placeholder line');
  write(dir, { [SCRIPT]: text, ...extra });
  chmodSync(join(dir, SCRIPT), mode);
  git(dir, 'add', SCRIPT, ...Object.keys(extra));
  git(dir, 'commit', '-q', '-m', 'Review the staged change');
}

const FLAGS = `--output-format json --permission-mode dontAsk --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" --settings '{"disableAllHooks": true}' --strict-mcp-config --max-turns 5 --json-schema "$schema"`;
const A = "Review the staged diff on stdin. Report each problem as file, line and one sentence. Don't edit anything.";
const B = 'You are reviewing a change to a link checker. Using only the diff on stdin and files you read, list concrete defects with their file and line. Make no changes.';
const line = (flags = FLAGS, prompt = A) => `git diff --cached | claude -p "${prompt}" ${flags} > "$out"`;

/** Sam's change applied and staged, and the script run on it once. */
function review(dir, env = {}) {
  git(dir, 'apply', 'practice/a-4/comment-links.patch');
  git(dir, 'add', 'src/links.js', 'test/links.test.js');
  return sh(dir, SCRIPT, env);
}

/** The fix for comments over several lines and its test, committed with Sam's change. */
function finish(dir, files = { 'src/links.js': solution('src/links.js'), 'test/links.test.js': solution('test/links.test.js') }) {
  write(dir, files);
  git(dir, 'add', ...Object.keys(files));
  git(dir, 'commit', '-q', '-m', "Skip links in editors' notes, on one line or several");
}

const passes = (dir, items = a4.items) => {
  const r = openRepo(dir);
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, dir, re) => {
  const got = item.check(openRepo(dir));
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};

test('the solution, its steps.sh run as written, passes every item', () => {
  const dir = start();
  const out = execFileSync('sh', [join(SOLUTION, 'steps.sh')], { cwd: dir, env: { ...ENV, SOLUTION }, encoding: 'utf8' });
  // The script printed each finding, not the JSON.
  assert.match(out, /^src\/links\.js:12 Only a comment/m);
  assert.doesNotMatch(out, /session_id/);
  passes(dir);
  assert.equal(git(dir, 'status', '--porcelain', '--', 'src', 'test', 'scripts'), '');
});

test('valid B: prompt B after the flags, a settings file, the lists as separate words, another fix with its test in a file of its own, pass', () => {
  const dir = start();
  const flags = `--output-format=json --max-turns 8 --json-schema "$schema" --permission-mode dontAsk --strict-mcp-config --settings scripts/review-settings.json`;
  script(dir, `git diff --cached | claude -p ${flags} --tools Read Grep Glob --allowedTools Read Grep Glob -- "${B}" > "$out"`, { extra: { 'scripts/review-settings.json': '{ "disableAllHooks": true }\n' } });
  review(dir);
  finish(dir, {
    'src/links.js': solution('src/links.js').replace(
      "const text = markdown.replace(/<!--[\\s\\S]*?-->/g, (comment) => comment.replace(/[^\\n]/g, ' '));",
      "let text = '';\n  let rest = markdown;\n  for (let at = rest.indexOf('<!--'); at >= 0; at = rest.indexOf('<!--')) {\n    const end = rest.indexOf('-->', at + 4);\n    const stop = end < 0 ? rest.length : end + 3;\n    text += rest.slice(0, at) + rest.slice(at, stop).replace(/[^\\n]/g, ' ');\n    rest = rest.slice(stop);\n  }\n  text += rest;",
    ),
    'test/comments.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { findLinks } from '../src/links.js';\n\ntest('a note over three lines hides its link', () => {\n  const md = `<!--\\nnote\\n[old](old.md) -->\\n[new](new.md)\\n`;\n  assert.deepEqual(findLinks(md).map((l) => l.line), [4]);\n});\n",
  });
  passes(dir);
});

test('the untouched start fails every item, each with its reason', () => {
  const dir = start();
  says(executable, dir, /isn't executable\. Run `chmod \+x scripts\/review-staged\.sh`/);
  says(call, dir, /still has the skeleton.s placeholders/);
  says(saved, dir, /There is no `\.practice\/a-4-result\.json` yet/);
  says(acted, dir, /No commit changes `src\/links\.js` yet/);
});

test('JSON written by hand fails: an id no session has, and the stand-in\'s', () => {
  const dir = start();
  script(dir, line());
  mkdirSync(join(dir, '.practice'), { recursive: true });
  const hand = { type: 'result', subtype: 'success', is_error: false, num_turns: 2, result: '{}', session_id: '6f1c2a40-0000-4000-8000-000000000001', total_cost_usd: 0.05, structured_output: { findings: [{ file: 'src/links.js', line: 12, problem: 'x' }] } };
  writeFileSync(join(dir, '.practice/a-4-result.json'), JSON.stringify(hand));
  says(saved, dir, /No Claude Code session on this computer has the `session_id`/);
  writeFileSync(join(dir, '.practice/a-4-result.json'), JSON.stringify({ ...hand, session_id: '00000000-0000-4000-8000-00000000c0de' }));
  says(saved, dir, /holds the check's stand-in reply/);
  // A real run that kept no session can't be told from one written by hand.
  review(dir, { FAKE_KEEP: '0' });
  says(saved, dir, /No Claude Code session on this computer/);
});

test('a session kept under CLAUDE_CONFIG_DIR counts too', () => {
  const dir = start();
  script(dir, line());
  const config = mkdtempSync(join(tmpdir(), 'a4-config-'));
  made.push(config);
  review(dir, { CLAUDE_CONFIG_DIR: config });
  process.env.CLAUDE_CONFIG_DIR = config;
  try {
    assert.equal(saved.check(openRepo(dir)), true);
  } finally {
    delete process.env.CLAUDE_CONFIG_DIR;
  }
});

test('the call: each flag the lab names, missing or wrong, gets its own reason', () => {
  const cases = [
    [FLAGS.replace('--allowedTools "Read,Grep,Glob"', '--allowedTools Read'), /`--allowedTools` leaves out `Grep` and `Glob`/],
    [FLAGS.replace('--allowedTools "Read,Grep,Glob"', '--allowedTools "Read,Grep,Glob,Bash(npm test)"'), /`--allowedTools` names `Bash\(npm test\)`/],
    [FLAGS.replace('--tools "Read,Grep,Glob" ', ''), /doesn't set the tools the run can use/],
    [FLAGS.replace('--tools "Read,Grep,Glob"', '--tools "Read,Grep,Glob,Edit"'), /`--tools` names `Edit`/],
    [FLAGS.replace(' --json-schema "$schema"', ''), /doesn't ask for its findings in a shape/],
    [FLAGS.replace('--json-schema "$schema"', `--json-schema '{"type":"object","properties":{"summary":{"type":"string"}}}'`), /no `findings` list/],
    [FLAGS.replace('--json-schema "$schema"', `--json-schema '{"type":"object","properties":{"findings":{"type":"array","items":{"type":"object","properties":{"file":{"type":"string"}}}}}}'`), /lacks `line` and `problem`/],
    [FLAGS.replace('--max-turns 5', '--max-turns 11'), /`--max-turns 11` is above 10/],
    [FLAGS.replace(' --max-turns 5', ''), /sets no turn cap/],
    [FLAGS.replace('--permission-mode dontAsk', '--permission-mode acceptEdits'), /runs in `acceptEdits` mode/],
    [FLAGS.replace(` --settings '{"disableAllHooks": true}'`, ''), /doesn't turn hooks off/],
    [FLAGS.replace(` --settings '{"disableAllHooks": true}' --strict-mcp-config`, ' --bare'), /`--bare` skips the claude\.ai login, so its run needs `ANTHROPIC_API_KEY`/],
    [FLAGS.replace(' --strict-mcp-config', ''), /doesn't keep the project's MCP servers out/],
    [FLAGS.replace('--output-format json', '--output-format text'), /asks for `--output-format text`/],
  ];
  for (const [flags, re] of cases) {
    const dir = start();
    script(dir, line(flags));
    says(call, dir, re);
  }
});

test('the call: a prompt a tool list took, an empty prompt, and a settings file that is missing, uncommitted or leaves hooks on', () => {
  let dir = start();
  script(dir, `git diff --cached | claude -p --output-format json --permission-mode dontAsk --settings '{"disableAllHooks": true}' --strict-mcp-config --max-turns 5 --json-schema "$schema" --tools Read,Grep,Glob --allowedTools Read,Grep,Glob "${A}" > "$out"`);
  says(call, dir, /isn't one of the review's tools: `--allowedTools` takes a list/);
  dir = start();
  script(dir, line(FLAGS, ''));
  says(call, dir, /The prompt is empty/);
  dir = start();
  script(dir, line(FLAGS.replace(`'{"disableAllHooks": true}'`, 'scripts/review-settings.json')));
  says(call, dir, /names `scripts\/review-settings\.json`, which isn't in the repository/);
  write(dir, { 'scripts/review-settings.json': '{"disableAllHooks": true}\n' });
  says(call, dir, /which isn't committed/);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'settings');
  assert.equal(call.check(openRepo(dir)), true);
  write(dir, { 'scripts/review-settings.json': '{"disableAllHooks": false}\n' });
  git(dir, 'commit', '-q', '-am', 'hooks on');
  says(call, dir, /don't set `"disableAllHooks": true`/);
});

test('the call: --bare counts for hooks and MCP servers only in a script that runs with an API key', () => {
  const dir = start();
  const bare = FLAGS.replace(` --settings '{"disableAllHooks": true}' --strict-mcp-config`, ' --bare');
  script(dir, `if [ -z "\${ANTHROPIC_API_KEY:-}" ]; then echo "--bare needs ANTHROPIC_API_KEY" >&2; fi\n${line(bare)}`);
  assert.equal(call.check(openRepo(dir)), true);
});

test('the behaviour: the raw JSON printed, the diff in the prompt, and a run that hides a failure each fail item 2', () => {
  let dir = start();
  script(dir, line());
  write(dir, { [SCRIPT]: `${readFileSync(join(dir, SCRIPT), 'utf8')}cat "$out"\n` });
  git(dir, 'commit', '-q', '-am', 'print the JSON');
  says(behaves, dir, /It prints the raw JSON/);
  dir = start();
  script(dir, `claude -p "${A} $(git diff --cached)" ${FLAGS} > "$out"`);
  says(behaves, dir, /It puts the diff in the prompt/);
  dir = start();
  script(dir, line());
  write(dir, { [SCRIPT]: readFileSync(join(dir, SCRIPT), 'utf8').replace('set -euo pipefail', 'set -u').replace(`jq -e '.is_error == false and .subtype == "success"' "$out" > /dev/null || {`, 'true || {') });
  git(dir, 'commit', '-q', '-am', 'hide failures');
  says(behaves, dir, /When `claude -p` exits non-zero .* it exited 0/);
  // The nothing-staged guard taken out, and the argument ignored.
  dir = start();
  script(dir, line());
  write(dir, { [SCRIPT]: readFileSync(join(dir, SCRIPT), 'utf8').replace(/if git diff --cached --quiet; then[\s\S]*?\nfi\n/, '') });
  git(dir, 'commit', '-q', '-am', 'no guard');
  says(behaves, dir, /With nothing staged, it still ran `claude -p`/);
  dir = start();
  script(dir, line());
  write(dir, { [SCRIPT]: readFileSync(join(dir, SCRIPT), 'utf8').replace('out="${1:-.practice/a-4-result.json}"', 'out=.practice/a-4-result.json') });
  git(dir, 'commit', '-q', '-am', 'fixed path');
  says(behaves, dir, /It saved the JSON to `\.practice\/a-4-result\.json`, though its first argument named another path/);
  // The skeleton's plumbing, untouched, passes it.
  dir = start();
  script(dir, line());
  assert.equal(behaves.check(openRepo(dir)), true);
});

test('the saved run: over the cap, with no findings, or stopped at the cap, fails item 3', () => {
  let dir = start();
  script(dir, line());
  review(dir, { FAKE_TURNS: '6' });
  says(saved, dir, /took 6 turns, more than `--max-turns 5` allows/);
  dir = start();
  script(dir, line());
  review(dir, { FAKE_FINDINGS: '[]' });
  says(saved, dir, /found nothing to report/);
  mkdirSync(join(dir, '.practice'), { recursive: true });
  writeFileSync(join(dir, '.practice/a-4-result.json'), JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 1, session_id: 'x' }));
  says(saved, dir, /stopped early \(`error_max_turns`\).*Raise the cap/);
});

test('a script fixed during the review: its run counts uncommitted, within any cap the call may set, and item 1 wants it committed on its own at the end', () => {
  const dir = start();
  script(dir, line(FLAGS.replace('--max-turns 5', '--max-turns 1'), 'Review the diff and fix anything wrong.'));
  // The prompt and the cap fixed in the work tree, with Sam's change staged.
  const fixed = START[SCRIPT].replace('git diff --cached | claude -p "PROMPT GOES HERE" FLAGS_GO_HERE > "$out"', line());
  write(dir, { [SCRIPT]: fixed });
  review(dir, { FAKE_TURNS: '2' });
  assert.equal(saved.check(openRepo(dir)), true);
  says(executable, dir, /has changes that aren't committed\. Commit them on their own/);
  finish(dir);
  git(dir, 'add', SCRIPT);
  git(dir, 'commit', '-q', '-m', 'Ask the review for no edits, with room to read');
  passes(dir);
});

test('acting on the review: Sam\'s change alone, staged or committed, fails item 4 with finding 1', () => {
  const dir = start();
  script(dir, line());
  review(dir);
  says(acted, dir, /Sam's change is staged but not committed yet/);
  git(dir, 'commit', '-q', '-m', 'Sam');
  says(acted, dir, /A link inside a comment over several lines is still reported as broken, as finding 1 says\./);
});

test('acting on finding 2, a second test for a comment on one line, fails item 4 and says finding 2 was wrong', () => {
  const dup = "\ntest('skips a link in an HTML comment', () => {\n  assert.deepEqual(findLinks('<!-- [a](a.md) -->\\n').length, 0);\n});\n";
  let dir = start();
  script(dir, line());
  review(dir);
  finish(dir, { 'test/links.test.js': `${readFileSync(join(dir, 'test/links.test.js'), 'utf8')}${dup}` });
  says(acted, dir, /still reported as broken, as finding 1 says\. Your tests also test a comment on one line 2 times: .*finding 2 was wrong/);
  // With the fix and its test too, the second one-line test still fails it.
  dir = start();
  script(dir, line());
  review(dir);
  finish(dir, { 'src/links.js': solution('src/links.js'), 'test/links.test.js': `${solution('test/links.test.js')}${dup}` });
  says(acted, dir, /^Your tests also test a comment on one line 2 times.*Keep one test for a comment on one line/);
});

test('acting on the review: a fix with no test of its own, a fix left uncommitted, and fixes that lose links fail item 4', () => {
  let dir = start();
  script(dir, line());
  review(dir);
  finish(dir, { 'src/links.js': solution('src/links.js') });
  says(acted, dir, /Your tests still pass with Sam's change as it was staged/);

  dir = start();
  script(dir, line());
  review(dir);
  git(dir, 'commit', '-q', '-m', 'Sam');
  write(dir, { 'src/links.js': solution('src/links.js'), 'test/links.test.js': solution('test/links.test.js') });
  says(acted, dir, /`src\/links\.js` and `test\/links\.test\.js` have changes that aren't committed/);

  // Dropping every line a comment touches loses the link after one on its line.
  dir = start();
  script(dir, line());
  review(dir);
  finish(dir, {
    'src/links.js': solution('src/links.js').replace(
      "const text = markdown.replace(/<!--[\\s\\S]*?-->/g, (comment) => comment.replace(/[^\\n]/g, ' '));",
      "const text = markdown.replace(/<!--[\\s\\S]*?-->/g, (comment) => comment.replace(/[^\\n]/g, ' ')).split('\\n').map((l, i) => (markdown.split('\\n')[i].includes('<!--') ? '' : l)).join('\\n');",
    ),
    'test/links.test.js': solution('test/links.test.js'),
  });
  says(acted, dir, /no longer reports a broken link after a comment at its own line/);

  // Removing the comment with its line breaks moves every link below it.
  dir = start();
  script(dir, line());
  review(dir);
  finish(dir, {
    'src/links.js': solution('src/links.js').replace("(comment) => comment.replace(/[^\\n]/g, ' ')", "''"),
    'test/links.test.js': solution('test/links.test.js').replace("[['setup.md', 4]]", "[['setup.md', 1]]"),
  });
  says(acted, dir, /no longer reports a broken link after a comment at its own line: .* it gives another line/);
});

test("the check's copies of src/links.js are the lab's start and Sam's patch applied to it", () => {
  assert.equal(a4.START_LINKS, START['src/links.js']);
  const dir = start();
  git(dir, 'apply', 'practice/a-4/comment-links.patch');
  assert.equal(a4.STAGED_LINKS, readFileSync(join(dir, 'src/links.js'), 'utf8'));
});
