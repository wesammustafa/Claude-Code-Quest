// The b-3 lab's check against the work a Learner may leave in the website
// repository: the solution, a second valid route, the widening near miss,
// the untouched start, and one mistake per item, each played with real git
// and real `npm test` in a copy laid out as a practice copy is (project/
// below the git root, so Ade's patch applies from project/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

// NODE_TEST_CONTEXT would make the check's own `npm test` runs skip their tests.
delete process.env.NODE_TEST_CONTEXT;

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const b3 = await import(pathToFileURL(join(checks, 'lessons/b-3.mjs')).href);
const [titles, links, flaw, together, scope, folder, red, named, testsPass, clean] = b3.items;

const START = {};
const OWN = 'practice-template/lessons/b-3/project';
const walk = (rel = '') => {
  for (const e of readdirSync(join(COURSE, OWN, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(r);
    else START[r] = readFileSync(join(COURSE, OWN, r), 'utf8');
  }
};
walk();
const solution = (p) => readFileSync(join(COURSE, 'solutions/b-3', p), 'utf8');
const sh = (dir, ...args) => execFileSync(args[0], args.slice(1), { cwd: dir, encoding: 'utf8' });

/** A fresh practice copy at its first commit; returns the project/ folder. */
function start() {
  const dir = repo(START, { nested: true });
  commit(dir, 'Start from the practice template');
  return dir;
}
const apply = (dir) => sh(dir, 'git', 'apply', 'practice/b-3/protocol-relative.patch');

/** Part 1 as the solution does it: the patch, the fix and its test, one commit. */
function part1(dir, files = {}) {
  apply(dir);
  write(dir, { 'test/external.test.js': solution('test/external.test.js'), 'src/links.js': solution('src/links.js'), ...files });
  commit(dir, 'Skip only protocol-relative links', ['src/links.js', 'test/external.test.js', ...Object.keys(files)]);
}
/** Part 2 as the solution does it: the named test and the fix, one commit. */
function part2(dir, files = {}) {
  const all = {
    'test/links.test.js': solution('test/links.test.js'),
    'src/check-links.js': solution('src/check-links.js'),
    'src/cli.js': solution('src/cli.js'),
    ...files,
  };
  write(dir, all);
  commit(dir, 'Stop with an error when linkcheck.json names a missing folder', Object.keys(all));
}
const passes = (dir, items = b3.items) => {
  const r = openRepo(dir);
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, dir, re) => {
  const got = item.check(openRepo(dir));
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};

test('the solution passes every item', () => {
  const dir = start();
  part1(dir);
  part2(dir);
  passes(dir);
});

test('valid B: a regex fix, a test on /index.md, and a missing-folder fix in the CLI with a test that runs it, pass', () => {
  const dir = start();
  apply(dir);
  write(dir, {
    'src/links.js': solution('src/links.js').replace("target.startsWith('//')", '/^\\/\\//.test(target)'),
    'test/external.test.js': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExternal } from '../src/links.js';

test('treats protocol-relative links as external', () => {
  assert.equal(isExternal('//cdn.example.com/app.js'), true);
});

test('root-relative links are checked again', () => {
  assert.equal(isExternal('/index.md'), false);
});
`,
  });
  commit(dir, 'Check single-slash links again', ['src/links.js', 'test/external.test.js']);
  const cli = START['src/cli.js'].replace(
    "const broken = brokenLinks(root, config);",
    "const gone = config.files.find((entry) => !existsSync(join(root, entry)));\nif (gone) {\n  console.error(`linkcheck: ${gone} does not exist`);\n  process.exit(2);\n}\nconst broken = brokenLinks(root, config);",
  );
  const cliTest = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('a missing folder in linkcheck.json stops the checker and names it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-'));
  writeFileSync(join(dir, 'linkcheck.json'), '{ "files": ["docs"] }');
  const run = spawnSync(process.execPath, ['src/cli.js', dir], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /docs/);
});
`;
  write(dir, { 'src/cli.js': cli, 'test/cli.test.js': cliTest });
  commit(dir, 'Report a missing folder', ['src/cli.js', 'test/cli.test.js']);
  passes(dir);
});

test('the near miss: a rule that skips every link starting with a slash fails, naming the booking link', () => {
  const dir = start();
  apply(dir);
  write(dir, {
    'src/links.js': START['src/links.js'].replace('return /^', "return target.startsWith('/') || /^"),
    'test/external.test.js': solution('test/external.test.js').replace("isExternal('/events/fixit-booking.md'), false", "isExternal('/events/fixit-booking.md'), true"),
  });
  commit(dir, 'Skip all absolute paths', ['src/links.js', 'test/external.test.js']);
  says(links, dir, /skips `\/events\/fixit-booking\.md`.*booking link on the events page/s);
  says(flaw, dir, /still pass with Ade's `isExternal` put back/);
  says(together, dir, /still has Ade's `isExternal`/);
});

test('the untouched start fails: the CDN link is reported, no test catches anything, nothing is committed', () => {
  const dir = start();
  says(links, dir, /still reports `\/\/cdn\.example\.com\/app\.js`/);
  says(flaw, dir, /would have caught his patch/);
  says(together, dir, /no commit of yours yet/);
  says(folder, dir, /exits with code 0, not 2: Sun-hee's bug/);
  says(red, dir, /catches Sun-hee's bug/);
  says(named, dir, /only that an error is thrown/);
  passes(dir, [titles, testsPass, clean]);
});

test("Ade's patch as he sent it, committed, fails on the links it skips and on its own commit", () => {
  const dir = start();
  apply(dir);
  commit(dir, "Ade's patch");
  says(links, dir, /Your commit still skips `\/events\/fixit-booking\.md` and `\/missing\.md`/);
  says(together, dir, /still has Ade's `isExternal`/);
});

test('a test with no fix fails: the tests fail as they are, and the booking link is still skipped', () => {
  const dir = start();
  apply(dir);
  write(dir, { 'test/external.test.js': solution('test/external.test.js') });
  says(links, dir, /no longer reports `\/events\/fixit-booking\.md`/);
  says(flaw, dir, /The tests fail as they are/);
  says(testsPass, dir, /`npm test` fails/);
});

test('src/cli.js in the fix commit fails the scope item, and only that one', () => {
  const dir = start();
  part1(dir, { 'src/cli.js': START['src/cli.js'].replace("folder's Markdown files.", "folder's Markdown files. Links such as //cdn ones are external.") });
  says(scope, dir, /also changes `src\/cli\.js`, which the request didn't name/);
  passes(dir, [titles, links, flaw, together, testsPass, clean]);
});

test('the fix and the test in separate commits fail: the test comes first, or the fix does', () => {
  const testFirst = start();
  apply(testFirst);
  commit(testFirst, 'Add the test', ['test/external.test.js']);
  write(testFirst, { 'src/links.js': solution('src/links.js'), 'test/external.test.js': solution('test/external.test.js') });
  commit(testFirst, 'Fix it');
  says(together, testFirst, /changes nothing in `src\/links\.js`/);

  const fixFirst = start();
  apply(fixFirst);
  write(fixFirst, { 'src/links.js': solution('src/links.js') });
  commit(fixFirst, 'Fix it', ['src/links.js']);
  write(fixFirst, { 'test/external.test.js': solution('test/external.test.js') });
  commit(fixFirst, 'Add the tests');
  says(together, fixFirst, /changes nothing in `src\/links\.js`/);
});

test('a commit that undoes the patch fails: the CDN link is reported again, and the commit holds no fix', () => {
  const dir = start();
  apply(dir);
  write(dir, { 'src/links.js': START['src/links.js'], 'test/external.test.js': solution('test/external.test.js').replace("'//cdn.example.com/app.js'), true", "'//cdn.example.com/app.js'), false") });
  commit(dir, 'Undo the patch');
  says(links, dir, /still reports `\/\/cdn/);
  says(together, dir, /changes nothing in `src\/links\.js`/);
});

test('a change that breaks links with a title fails the title item', () => {
  const dir = start();
  part1(dir);
  write(dir, { 'src/links.js': solution('src/links.js').replace(/for \(const m of prose\.matchAll\(.*\)\) \{/, "for (const m of prose.matchAll(/(?<!!)\\[([^\\]]*)\\]\\(([^)\\s]+)\\)/g)) {").replace('target: m[2] ?? m[3]', 'target: m[2]') });
  says(titles, dir, /a change broke them/);
});

test('part 2 with the weak test fails only on the named-folder item', () => {
  const dir = start();
  part1(dir);
  part2(dir, { 'test/links.test.js': solution('test/links.test.js').replace(', /no such file or folder: nowhere/', '') });
  says(named, dir, /only that an error is thrown/);
  passes(dir, [folder, red, testsPass, clean]);
});

test('part 2 fixes that check only the first folder, or name docs whatever is missing, fail on the second input', () => {
  const first = start();
  part1(first);
  part2(first, {
    'src/check-links.js': START['src/check-links.js'],
    'src/cli.js': START['src/cli.js'].replace(
      'const broken = brokenLinks(root, config);',
      "if (!existsSync(join(root, config.files[0]))) {\n  console.error(`linkcheck: no such file or folder: ${config.files[0]}`);\n  process.exit(2);\n}\nconst broken = brokenLinks(root, config);",
    ),
  });
  says(folder, first, /misses a missing folder that isn't the first one listed/);

  const docs = start();
  part1(docs);
  part2(docs, { 'src/check-links.js': solution('src/check-links.js').replace('${entry}', 'docs') });
  says(folder, docs, /doesn't name `archive`/);
});

test('a part 2 fix with no test of its own fails the red item', () => {
  const dir = start();
  part1(dir);
  part2(dir, { 'test/links.test.js': START['test/links.test.js'] });
  says(red, dir, /catches Sun-hee's bug/);
  passes(dir, [folder, testsPass, clean]);
});

test('work left uncommitted fails the clean item', () => {
  const dir = start();
  part1(dir);
  write(dir, solutionFiles(['src/check-links.js', 'src/cli.js', 'test/links.test.js']));
  says(clean, dir, /uncommitted: src\/check-links\.js, src\/cli\.js, test\/links\.test\.js/);
});

test("the prepared files hold Ade's premise: his test passes with the patch, and the checker then reports nothing", () => {
  const dir = start();
  apply(dir);
  assert.match(sh(dir, 'npm', 'test', '--silent'), /pass \d+/);
  const out = sh(dir, 'node', 'src/cli.js', 'samples');
  assert.equal(out.trim(), 'All relative links resolve.');
});

test('a saved exit code stands in for no test run: with the test script gone, the tests item fails', () => {
  const dir = start();
  part1(dir);
  part2(dir);
  const pkg = JSON.parse(START['package.json']);
  delete pkg.scripts.test;
  write(dir, { 'package.json': `${JSON.stringify(pkg, null, 2)}\n`, '.practice/b-3-tests.txt': '0\n' });
  commit(dir, 'No tests', ['package.json']);
  says(testsPass, dir, /no `npm test` script/);
});

function solutionFiles(paths) {
  return Object.fromEntries(paths.map((p) => [p, solution(p)]));
}
