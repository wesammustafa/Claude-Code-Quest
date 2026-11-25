// The a-1 lab's check against the work a Learner may leave in the website
// repository: the solution's own steps.sh, a second valid route, the near
// miss that gives one session both jobs, the untouched start, a worktree
// listing written by hand, and one mistake per item, each played with real
// git and real `npm test` in a copy laid out as a practice copy is (project/
// below the git root, where `claude --worktree` makes .claude/worktrees/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

// NODE_TEST_CONTEXT would make the check's own `npm test` runs skip their tests.
delete process.env.NODE_TEST_CONTEXT;

const checks = layChecks();
const { repo, write, rootWrite } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a1 = await import(pathToFileURL(join(checks, 'lessons/a-1.mjs')).href);
const [ignores, merged, works, removed] = a1.items;

const START = {};
const OWN = 'practice-template/lessons/a-1/project';
const walk = (rel = '') => {
  for (const e of readdirSync(join(COURSE, OWN, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(r);
    else START[r] = readFileSync(join(COURSE, OWN, r), 'utf8');
  }
};
walk();
const SOLUTION = join(COURSE, 'solutions/a-1');
const solution = (p) => readFileSync(join(SOLUTION, p), 'utf8');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: ENV }).trim();
const top = (dir) => dirname(dir);
const wt = (dir, name) => join(top(dir), '.claude/worktrees', name);

const made = [];
test.after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A fresh practice copy at its first commit, the root's .gitignore as the base lays it; returns project/. */
function start() {
  const dir = repo(START, { nested: true });
  made.push(top(dir));
  rootWrite(dir, { '.gitignore': '.practice/\nnode_modules/\n' });
  git(top(dir), 'add', '-A');
  git(top(dir), 'commit', '-q', '-m', 'Start from the practice template');
  git(top(dir), 'branch', '-M', 'main');
  return dir;
}

/** Step 1's commit: the worktrees folder ignored at the root. */
function ignore(dir, rule = '.claude/worktrees/\n') {
  rootWrite(dir, { '.gitignore': `.practice/\nnode_modules/\n${rule}` });
  git(dir, 'add', ':/.gitignore');
  git(dir, 'commit', '-q', '-m', 'Ignore Claude Code worktrees');
}

/** A worktree as `claude --worktree <name>` makes it, with `files` written and committed there. */
function job(dir, name, files, message) {
  git(dir, 'worktree', 'add', '-q', '-b', `worktree-${name}`, wt(dir, name));
  write(join(wt(dir, name), 'project'), files);
  if (message) {
    git(wt(dir, name), 'add', '-A');
    git(wt(dir, name), 'commit', '-q', '-m', message);
  }
}

const COMMENTS = () => ({ 'src/links.js': solution('src/links.js'), 'test/links.test.js': solution('test/links.test.js') });
const SCHEDULE = () => ({ 'test/schedule.test.js': solution('test/schedule.test.js') });

const passes = (dir, items = a1.items) => {
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
  execFileSync('sh', [join(SOLUTION, 'steps.sh')], { cwd: dir, env: { ...ENV, SOLUTION }, encoding: 'utf8' });
  passes(dir);
  // The merge kept both jobs' commits on their own lines, under one merge.
  assert.match(git(dir, 'log', '-1', '--format=%s'), /^Merge branch 'worktree-schedule-test'/);
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('valid B: the other merge order, a test of its own naming the dates another way, a comment fix of its own, and Keep then git worktree remove, pass', () => {
  const dir = start();
  ignore(dir);
  job(dir, 'comments-fix', {
    'src/links.js': START['src/links.js'].replace(
      "markdown.split('\\n').forEach((line, i) => {",
      "let inComment = false;\n  markdown.split('\\n').forEach((line, i) => {\n    let kept = '';\n    let rest = line;\n    while (rest) {\n      if (inComment) {\n        const end = rest.indexOf('-->');\n        if (end < 0) rest = '';\n        else { inComment = false; rest = rest.slice(end + 3); }\n      } else {\n        const at = rest.indexOf('<!--');\n        if (at < 0) { kept += rest; rest = ''; }\n        else { kept += rest.slice(0, at); inComment = true; rest = rest.slice(at + 4); }\n      }\n    }\n    line = kept;",
    ),
    'test/comments.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { findLinks } from '../src/links.js';\n\ntest('a commented-out link is not a link', () => {\n  assert.deepEqual(findLinks('<!-- [x](x.md) -->\\n[y](y.md)\\n'), [{ text: 'y', target: 'y.md', line: 2 }]);\n});\n",
  }, 'Ignore links in HTML comments');
  job(dir, 'schedule-test', {
    'test/summer-dates.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n\ntest('the schedule lists every summer Saturday', () => {\n  const text = readFileSync('pages/schedule.md', 'utf8');\n  for (const d of ['12 June', '10 July', '14 August']) assert.ok(text.includes(d), d);\n});\n",
  }, 'Test the summer dates');
  git(dir, 'merge', '-q', 'worktree-schedule-test');
  git(dir, 'merge', '-q', '--no-edit', 'worktree-comments-fix');
  git(dir, 'worktree', 'remove', wt(dir, 'comments-fix'));
  git(dir, 'worktree', 'remove', wt(dir, 'schedule-test'));
  passes(dir);
});

test('before the worktrees are removed, items 0 to 2 pass and the cleanup item names each worktree, and a running session in it', () => {
  const dir = start();
  ignore(dir);
  job(dir, 'comments-fix', COMMENTS(), 'Skip links inside HTML comments');
  job(dir, 'schedule-test', SCHEDULE(), 'Test the schedule dates');
  git(dir, 'merge', '-q', 'worktree-comments-fix');
  git(dir, 'merge', '-q', '--no-edit', 'worktree-schedule-test');
  passes(dir, [ignores, merged, works]);
  says(removed, dir, /`\.claude\/worktrees\/comments-fix` is still there: run `git worktree remove \.claude\/worktrees\/comments-fix`.*schedule-test/s);
  git(dir, 'worktree', 'lock', '--reason', 'claude session schedule-test (pid 7 start 2027-05-28T09:00:00.000Z)', wt(dir, 'schedule-test'));
  says(removed, dir, /schedule-test` is still there, and the Claude Code session in it is still running: run `\/exit`/);
});

test('the near miss: one session given both jobs fails, as one commit or as two on one line of history', () => {
  const one = start();
  ignore(one);
  job(one, 'comments-fix', { ...COMMENTS(), ...SCHEDULE() }, 'Fix the comment links and write the schedule test');
  git(one, 'merge', '-q', 'worktree-comments-fix');
  git(one, 'worktree', 'remove', wt(one, 'comments-fix'));
  says(merged, one, /One commit, [0-9a-f]{7}, holds both jobs/);
  says(removed, one, /Merge both branches into `main` before you remove either worktree/);

  const line = start();
  ignore(line);
  job(line, 'comments-fix', COMMENTS(), 'Skip links inside HTML comments');
  write(join(wt(line, 'comments-fix'), 'project'), SCHEDULE());
  git(wt(line, 'comments-fix'), 'add', '-A');
  git(wt(line, 'comments-fix'), 'commit', '-q', '-m', 'Test the schedule dates');
  git(line, 'merge', '-q', 'worktree-comments-fix');
  says(merged, line, /the schedule test was made on top of the comment fix, one after the other on one line of history/);
});

test('the untouched start fails every item, and a worktree listing written by hand changes nothing', () => {
  const dir = start();
  says(ignores, dir, /\.claude\/worktrees\//);
  says(merged, dir, /`main` has no commit that changes `src\/links\.js` yet\. Start the comment fix's session with `claude --worktree comments-fix`/);
  says(works, dir, /no commit that changes `src\/links\.js`/);
  says(removed, dir, /Merge both branches/);
  // The guide's own a-1 took this file as evidence.
  write(dir, {
    '.practice/a-1-worktrees.txt': `worktree ${top(dir)}\nHEAD ${git(dir, 'rev-parse', 'HEAD')}\nbranch refs/heads/main\n\nworktree ${top(dir)}/.claude/worktrees/comments-fix\nHEAD ${'1'.repeat(40)}\nbranch refs/heads/worktree-comments-fix\n\nworktree ${top(dir)}/.claude/worktrees/schedule-test\nHEAD ${'2'.repeat(40)}\nbranch refs/heads/worktree-schedule-test\n`,
  });
  for (const i of [merged, works, removed]) assert.notEqual(i.check(openRepo(dir)), true, i.text);
});

test('item 0: a rule only in .git/info/exclude, one left uncommitted, and one that hides the shared settings each fail', () => {
  const exclude = start();
  write(top(exclude), { '.git/info/exclude': '.practice/\n.claude/worktrees/\n' });
  says(ignores, exclude, /exclude/);

  const loose = start();
  rootWrite(loose, { '.gitignore': '.practice/\nnode_modules/\n.claude/worktrees/\n' });
  says(ignores, loose, /commit/);

  const wide = start();
  ignore(wide, '.claude/\n');
  says(ignores, wide, /would hide the settings you share with your team/);
});

test('item 1: a branch not merged, or not yet committed, is named with what to do', () => {
  const dir = start();
  ignore(dir);
  job(dir, 'comments-fix', COMMENTS(), 'Skip links inside HTML comments');
  job(dir, 'schedule-test', SCHEDULE());
  git(dir, 'merge', '-q', 'worktree-comments-fix');
  says(merged, dir, /`worktree-schedule-test` has no commit of its own\. Once you've compared both diffs, tell the session in `\.claude\/worktrees\/schedule-test` to commit/);
  git(wt(dir, 'schedule-test'), 'add', '-A');
  git(wt(dir, 'schedule-test'), 'commit', '-q', '-m', 'Test the schedule dates');
  says(merged, dir, /it is on `worktree-schedule-test`, which isn't merged\. From your main checkout, run `git merge worktree-schedule-test`/);
  git(dir, 'merge', '-q', '--no-edit', 'worktree-schedule-test');
  passes(dir, [merged]);
});

test("item 1: a job's commit that also changes the other job's file fails", () => {
  const dir = start();
  ignore(dir);
  job(dir, 'comments-fix', COMMENTS(), 'Skip links inside HTML comments');
  job(dir, 'schedule-test', { ...SCHEDULE(), 'src/links.js': `${START['src/links.js']}// touched\n` }, 'Test the schedule dates');
  git(dir, 'merge', '-q', 'worktree-comments-fix');
  // The two edits to src/links.js conflict; the Learner keeps the fix.
  try {
    git(dir, 'merge', '-q', '--no-edit', 'worktree-schedule-test');
  } catch {
    write(dir, { 'src/links.js': solution('src/links.js') });
    git(dir, 'add', 'src/links.js');
    git(dir, 'commit', '-q', '--no-edit');
  }
  says(merged, dir, /One commit, [0-9a-f]{7}, holds both jobs|also changes `src\/links\.js`, the comment fix's file/);
});

test('item 2: a schedule test of one date, a fix for one-line comments only, and a fix that hides every link after a comment each fail', () => {
  const play = (comments, schedule) => {
    const dir = start();
    ignore(dir);
    job(dir, 'comments-fix', comments, 'Skip links inside HTML comments');
    job(dir, 'schedule-test', schedule, 'Test the schedule dates');
    git(dir, 'merge', '-q', 'worktree-comments-fix');
    git(dir, 'merge', '-q', '--no-edit', 'worktree-schedule-test');
    return dir;
  };
  const oneDate = play(COMMENTS(), { 'test/schedule.test.js': solution('test/schedule.test.js').replace("'Sat 12 June', 'Sat 10 July', 'Sat 14 August'", "'Sat 12 June'") });
  says(works, oneDate, /With Sat 10 July or Sat 14 August taken out of `pages\/schedule\.md`, the tests still pass/);
  passes(oneDate, [merged]);

  const oneLine = play(
    {
      'src/links.js': START['src/links.js'].replace("const prose = line.replace(/`[^`]*`/g, '');", "const prose = line.replace(/`[^`]*`/g, '').replace(/<!--.*?-->/g, '');"),
      'test/links.test.js': solution('test/links.test.js').replace(/test\('skips links inside HTML comments[\s\S]*?\n\}\);\n\n/, ''),
    },
    SCHEDULE(),
  );
  says(works, oneLine, /still reports `draft\.md`, inside an HTML comment/);

  const greedy = play(
    {
      'src/links.js': solution('src/links.js').replace('/<!--[\\s\\S]*?-->/g', '/<!--[\\s\\S]*-->/g'),
      'test/links.test.js': START['test/links.test.js'],
    },
    SCHEDULE(),
  );
  says(works, greedy, /no longer reports `between\.md` and `gone\.md`, broken links outside any comment/);
  const hides = play(
    {
      'src/links.js': solution('src/links.js').replace('/<!--[\\s\\S]*?-->/g', '/<!--[\\s\\S]*/g'),
      'test/links.test.js': START['test/links.test.js'],
    },
    SCHEDULE(),
  );
  says(works, hides, /no longer reports `between\.md` and `gone\.md` and `after\.md`/);
});

test('item 2: tests that fail on main fail it', () => {
  const dir = start();
  ignore(dir);
  job(dir, 'comments-fix', { 'src/links.js': solution('src/links.js'), 'test/links.test.js': solution('test/links.test.js').replace("['setup.md', 2], ['rules.md', 6]", "['setup.md', 3]") }, 'Skip links inside HTML comments');
  job(dir, 'schedule-test', SCHEDULE(), 'Test the schedule dates');
  git(dir, 'merge', '-q', 'worktree-comments-fix');
  git(dir, 'merge', '-q', '--no-edit', 'worktree-schedule-test');
  says(works, dir, /`npm test` fails on `main`/);
});

test("the prepared files hold Ade's premise: the checker reports the two links in comments, the tests pass, and the backlog names each job's files", () => {
  const dir = start();
  const run = spawnSync('node', ['src/cli.js', 'pages'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.deepEqual(run.stdout.trim().split('\n'), ['august.md:3: broken link to august-directions.md', 'schedule.md:1: broken link to book-summer.md', '2 broken link(s)']);
  assert.equal(spawnSync('npm', ['test', '--silent'], { cwd: dir, encoding: 'utf8' }).status, 0);
  const backlog = START['practice/a-1/backlog.md'];
  for (const file of ['src/links.js', 'test/links.test.js', 'src/check-links.js', 'pages/schedule.md']) assert.ok(backlog.includes(`\`${file}\``), file);
});

test('the guide capstone check imports still resolve: ignoresWorktrees and mergedWorktrees', () => {
  assert.equal(a1.ignoresWorktrees, ignores);
  const item = a1.mergedWorktrees('.practice/x.txt', { anywhere: true });
  assert.equal(typeof item.check, 'function');
  assert.match(item.text, /lists two worktrees of this repository/);
});
