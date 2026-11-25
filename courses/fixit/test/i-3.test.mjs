// The i-3 lab's check against the work a Learner may leave in the website
// repository: the solution, a second valid route, the speed-up near miss,
// the untouched start, a hand-written entry, and one mistake per item, each
// played with real git, the real checker and real `npm test` in a copy laid
// out as a practice copy is (project/ below the git root).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

// NODE_TEST_CONTEXT would make the check's own `npm test` runs skip their tests.
delete process.env.NODE_TEST_CONTEXT;

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i3 = await import(pathToFileURL(join(checks, 'lessons/i-3.mjs')).href);
const [settings, depth, together, entry, testsPass] = i3.items;

const START = {};
const OWN = 'practice-template/lessons/i-3/project';
const walk = (rel = '') => {
  for (const e of readdirSync(join(COURSE, OWN, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(r);
    else START[r] = readFileSync(join(COURSE, OWN, r), 'utf8');
  }
};
walk();
const solution = (p) => readFileSync(join(COURSE, 'solutions/i-3', p.replace(/^\.claude\//, 'dot-claude/')), 'utf8');

const CHANGELOG = '.claude/skills/changelog/SKILL.md';
const FIVE_WHYS = '.claude/skills/five-whys/SKILL.md';
const ENTRY_A = '- Malformed percent escapes such as `bad%.md` are now reported as broken links instead of crashing the checker.';

/** A fresh practice copy at its first commit; returns the project/ folder. */
function start() {
  const dir = repo(START, { nested: true });
  commit(dir, 'Start from the practice template');
  return dir;
}

/** The changelog skill with these settings and why line. */
const skill = (model, effort, why = 'The input is an exact diff and I review the line, so less is enough.') =>
  START[CHANGELOG].replace('model: TODO', `model: ${model}`).replace('effort: TODO', `effort: ${effort}`).replace('TODO: one line on what makes this task routine.', why);
const changelog = (...entries) => START['CHANGELOG.md'].replace('## Unreleased\n\n', `## Unreleased\n\n${entries.map((e) => `${e}\n`).join('')}\n`);

// The three requested changes, each with a test, as Claude makes them.
const ESCAPE = { 'src/check-links.js': solution('src/check-links.js'), 'test/links.test.js': solution('test/links.test.js') };
const MARKDOWN = {
  'src/check-links.js': START['src/check-links.js'].replace("path.endsWith('.md')", '/\\.(md|markdown)$/.test(path)'),
  'test/markdown.test.js': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brokenLinks } from '../src/check-links.js';

test('checks .markdown files as well as .md ones', () => {
  const dir = mkdtempSync(join(tmpdir(), 'md-'));
  writeFileSync(join(dir, 'old.markdown'), '[gone](gone.md)\\n');
  assert.deepEqual(brokenLinks(dir, { files: ['.'], ignore: [] }), [{ file: 'old.markdown', line: 1, target: 'gone.md' }]);
});
`,
};
const TITLE = {
  'src/cli.js': START['src/cli.js'].replace(
    'for (const b of broken) console.log(`${b.file}:${b.line}: broken link to ${b.target}`);',
    "const titleOf = (file) => readFileSync(join(root, file), 'utf8').match(/^# (.+)$/m)?.[1];\nfor (const b of broken) {\n  const title = titleOf(b.file);\n  console.log(`${b.file}:${b.line}: broken link to ${b.target}${title ? ` (on \"${title}\")` : ''}`);\n}",
  ),
};
const SKILLS = { [FIVE_WHYS]: solution(FIVE_WHYS), [CHANGELOG]: solution(CHANGELOG) };

/** The change, its entry and both skills, in one commit, as Your turn step 4 asks. */
function release(dir, change, entries, skills = SKILLS) {
  const files = { ...skills, ...change, 'CHANGELOG.md': changelog(...entries) };
  write(dir, files);
  commit(dir, 'Release one change with its entry', Object.keys(files));
}
const passes = (dir, items = i3.items) => {
  const r = openRepo(dir);
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, dir, re) => {
  const got = item.check(openRepo(dir));
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};

test('valid A, the solution: haiku at low effort, the malformed escape change and its entry, passes every item', () => {
  const dir = start();
  release(dir, ESCAPE, [ENTRY_A], { [FIVE_WHYS]: solution(FIVE_WHYS), [CHANGELOG]: solution(CHANGELOG) });
  assert.equal(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), solution('CHANGELOG.md'));
  passes(dir);
});

test('valid B: sonnet at low effort, the .markdown change and its entry, passes every item', () => {
  const dir = start();
  release(dir, MARKDOWN, ['- The checker also reads `.markdown` files.'], { [FIVE_WHYS]: solution(FIVE_WHYS), [CHANGELOG]: skill('sonnet', 'low') });
  passes(dir);
});

test("the near miss: the title change committed with Claude's uncorrected entry fails the entry item, naming the speed-up", () => {
  const dir = start();
  release(dir, TITLE, ['- Faster link checking.']);
  says(entry, dir, /^The entry claims a speed-up; the diff adds the page title to the output\./);
  passes(dir, [settings, depth, together, testsPass]);
});

test('the title change with an entry that names it passes, and a later commit that corrects the entry does too', () => {
  const right = start();
  release(right, TITLE, ['- Each broken link is reported with the title of the page it is on.']);
  passes(right);

  const corrected = start();
  release(corrected, TITLE, ['- Faster link checking.']);
  write(corrected, { 'CHANGELOG.md': changelog('- Each broken link is reported with the title of its page.') });
  says(entry, corrected, /corrected entry isn't committed yet/);
  commit(corrected, 'Correct the entry', ['CHANGELOG.md']);
  passes(corrected);
});

test('the untouched start fails every item but the tests', () => {
  const dir = start();
  says(settings, dir, /Set the model/);
  says(depth, dir, /Add the effort line/);
  says(together, dir, /No commit adds an entry/);
  says(entry, dir, /There is no new entry/);
  passes(dir, [testsPass]);
});

test('hand-written evidence: an entry committed with no change fails, and so does one whose change is in another commit', () => {
  const alone = start();
  write(alone, { ...SKILLS, 'CHANGELOG.md': changelog(ENTRY_A) });
  commit(alone, 'Write the entry', [...Object.keys(SKILLS), 'CHANGELOG.md']);
  says(together, alone, /holds none of the three requested changes/);
  says(entry, alone, /can't be read against it/);

  const apart = start();
  write(apart, ESCAPE);
  commit(apart, 'The change');
  write(apart, { ...SKILLS, 'CHANGELOG.md': changelog(ENTRY_A) });
  commit(apart, 'Its entry and the skills');
  says(together, apart, /holds none of the three requested changes.*changes .*CHANGELOG\.md/s);
});

test('a commit holding two of the changes fails, naming both', () => {
  const dir = start();
  release(dir, { ...ESCAPE, ...TITLE }, [ENTRY_A]);
  says(together, dir, /holds 2 of the three requested changes: Sun-hee's change.*Lin's change/s);
  says(entry, dir, /can't be read against it/);
});

test('an entry that names nothing the change does fails: the template line, and a line about the wrong change', () => {
  const template = start();
  release(template, ESCAPE, ['- Update the staged files.']);
  says(entry, template, /`- Update the staged files\.` doesn't say what the change does .*reports a malformed percent escape/s);

  const wrong = start();
  release(wrong, MARKDOWN, ['- Each broken link now shows its page title.']);
  says(entry, wrong, /checks `\.markdown` files as well/);

  const half = start();
  release(half, ESCAPE, ['- Malformed percent escapes no longer crash the checker.']);
  says(entry, half, /doesn't say what the change does/);
});

test('before the commit, the entry item reads the working tree: a speed-up fails, a right entry passes, no change fails', () => {
  const dir = start();
  write(dir, { ...TITLE, 'CHANGELOG.md': changelog('- Faster link checking.') });
  says(entry, dir, /claims a speed-up; the diff adds the page title/);
  says(together, dir, /entry isn't committed yet/);
  write(dir, { 'CHANGELOG.md': changelog('- The checker prints the page title next to each broken link.') });
  passes(dir, [entry]);

  const none = start();
  write(none, { 'CHANGELOG.md': changelog(ENTRY_A) });
  says(entry, none, /describes nothing/);
});

test('the changelog skill: each setting that costs no less, or is not set, fails with its reason', () => {
  const cases = [
    [skill('opus', 'medium'), /costs no less/],
    [skill('default', 'medium'), /costs no less/],
    [skill('fable', 'low'), /is larger than the session's Opus/],
    [skill('haiku', 'high'), /is higher than the session's medium/],
    [skill('gpt-5', 'low'), /isn't a model alias or name/],
    [skill('haiku', 'lowest'), /isn't an effort level/],
    [skill('TODO', 'low'), /Set the model/],
    [skill('haiku', 'TODO'), /Set the effort/],
    [skill('haiku', 'low', 'TODO: one line on what makes this task routine.'), /Write one line/],
    [skill('haiku', 'low').replace('## Why these settings', '## Notes'), /has no heading/],
  ];
  for (const [text, re] of cases) {
    const dir = start();
    release(dir, ESCAPE, [ENTRY_A], { [FIVE_WHYS]: solution(FIVE_WHYS), [CHANGELOG]: text });
    says(settings, dir, re);
  }
});

test('the changelog skill: a smaller model, a lower effort, or a provider name of a smaller model, each passes', () => {
  for (const [model, effort] of [['opus', 'low'], ['sonnet', 'medium'], ['haiku', 'medium'], ['claude-haiku-4-5', 'low'], ['sonnet[1m]', 'low']]) {
    const dir = start();
    release(dir, ESCAPE, [ENTRY_A], { [FIVE_WHYS]: solution(FIVE_WHYS), [CHANGELOG]: skill(model, effort) });
    passes(dir, [settings]);
  }
});

test('the skills: an uncommitted edit, another effort, or the line outside the frontmatter fails', () => {
  const uncommitted = start();
  write(uncommitted, SKILLS);
  says(settings, uncommitted, /isn't committed yet/);
  says(depth, uncommitted, /isn't committed yet/);

  const xhigh = start();
  release(xhigh, ESCAPE, [ENTRY_A], { [FIVE_WHYS]: solution(FIVE_WHYS).replace('effort: high', 'effort: xhigh'), [CHANGELOG]: solution(CHANGELOG) });
  says(depth, xhigh, /runs at `effort: xhigh`\. Give it high effort/);

  const body = start();
  release(body, ESCAPE, [ENTRY_A], { [FIVE_WHYS]: `${START[FIVE_WHYS]}\neffort: high\n`, [CHANGELOG]: solution(CHANGELOG) });
  says(depth, body, /Add the effort line/);
});

test('a change whose tests fail fails the tests item', () => {
  const dir = start();
  release(dir, { ...ESCAPE, 'test/links.test.js': `${ESCAPE['test/links.test.js']}\ntest('fails', () => assert.equal(1, 2));\n` }, [ENTRY_A]);
  says(testsPass, dir, /`npm test` fails/);
});
