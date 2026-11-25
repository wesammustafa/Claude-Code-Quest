// The a-3 lab's check against the work a Learner may leave in the website
// repository: the solution, another valid route, the untouched start, the
// manuscript's near misses, and workflows that only look right, each played
// with real git and the committed script really run with the check's
// stand-in agents, in a copy laid out as a practice copy is (project/ below
// the git root, where /workflows saves to the project location).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, GUIDE, layChecks } from '../tools/lay.mjs';

// NODE_TEST_CONTEXT would make the check's own `npm test` run skip its tests.
delete process.env.NODE_TEST_CONTEXT;

const checks = layChecks();
const { repo, commit, write, rootWrite } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a3 = await import(pathToFileURL(join(checks, 'lessons/a-3.mjs')).href);
const [migrated, workflow, testsPass, clean] = a3.items;

// The lab's starting files, with the guide's inert names made live, as
// Questerm lays them in the copy.
const { RESTORE } = await import(pathToFileURL(join(GUIDE, 'quest/release/src/replay.mjs')).href);
const START = {};
const OWN = 'practice-template/lessons/a-3/project';
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
const solution = (p) => readFileSync(join(COURSE, 'solutions/a-3', p.replace(/^\.claude\//, 'dot-claude/')), 'utf8');

const PAGES = ['samples/june.md', 'samples/july.md', 'samples/schedule.md'];
const SCRIPT = '.claude/workflows/audit-dropped-errors.js';
const ROOT_SCRIPT = `../${SCRIPT}`;
const migrate = (text) => text.replaceAll('library.example/events/', 'library.example/whats-on/');

/** A fresh practice copy at its first commit; returns the project/ folder. */
function start() {
  const dir = repo(START, { nested: true });
  commit(dir, 'Start from the practice template');
  return dir;
}

/** The goal's work: the pages migrated (by `change`) and committed on their own. */
function goal(dir, { change = migrate, pages = PAGES, commitIt = true } = {}) {
  write(dir, Object.fromEntries(pages.map((p) => [p, change(START[p])])));
  if (commitIt) commit(dir, 'Point the library links at /whats-on/', pages);
  return dir;
}

/** The saved workflow, `text`, at the repository root (or in project/ with `here`), committed. */
function saved(dir, text = solution(SCRIPT), { here = false, commitIt = true } = {}) {
  if (here) write(dir, { [SCRIPT]: text });
  else rootWrite(dir, { [SCRIPT]: text });
  if (commitIt) commit(dir, 'Add a workflow that audits dropped errors', [here ? SCRIPT : ROOT_SCRIPT]);
  return dir;
}

const lab = () => saved(goal(start()));
const passes = (dir, items = a3.items) => {
  const r = openRepo(dir);
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, dir, re) => {
  const got = item.check(openRepo(dir));
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};
/** The solution's script with `from` replaced by `to`. */
const edited = (from, to) => {
  const text = solution(SCRIPT);
  assert.ok(text.includes(from), `the solution holds ${from}`);
  return text.replace(from, to);
};

// The script Claude writes for the audit before it takes args: the folder
// named in the script, as the page shows it.
const HARDCODED = edited(
  "const folder = Array.isArray(args) ? args[0] : args\nif (!folder) throw new Error('Name a folder: Run /audit-dropped-errors on <folder>')",
  "const folder = 'src'",
);

test('valid A, the solution: the pages committed on their own and the workflow saved at the repository root, passes every item', () => {
  passes(lab());
});

test('valid B: two migration commits, and a workflow in project/.claude/workflows/ with parallel(), JSON verdicts and its own wording, passes', () => {
  const dir = goal(start(), { pages: PAGES.slice(0, 2) });
  goal(dir, { pages: PAGES.slice(2) });
  const script = `// Usage: /find-swallowed <folder>
export const meta = { name: 'find-swallowed', description: 'Each file, then each finding, checked twice' }

const [dir] = args
phase('Find')
const { paths } = await agent(\`Give me the paths of all files in \${dir}/.\`, {
  schema: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } } },
})
const perFile = await parallel(paths, (p) => agent(\`Read \${p}. Report every catch that swallows an error, one per line as path:line: why.\`))
const candidates = perFile.flatMap((text) => text.split('\\n')).filter((l) => l.includes(':'))
phase('Verify')
const checked = await parallel(candidates, (c) =>
  agent(\`Be skeptical. Is this a real swallowed error? \${c}\`, {
    schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['confirmed', 'refuted'] }, why: { type: 'string' } } },
  }),
)
return candidates.filter((c, i) => checked[i].verdict === 'confirmed')
`;
  saved(dir, script, { here: true });
  passes(dir);
});

test('the untouched start fails the migration and the workflow, and passes the tests and a clean tree', () => {
  const dir = start();
  says(migrated, dir, /^`samples\/july\.md`, `samples\/june\.md` and `samples\/schedule\.md` still link to `library\.example\/events\/` at `HEAD`: .*\(Worked example step 2\)/);
  says(workflow, dir, /^There is no workflow script in `\.claude\/workflows\/`/);
  passes(dir, [testsPass, clean]);
});

test('the migration item: left uncommitted, a link cut instead of moved, and a commit that also changes another file, each name what is wrong', () => {
  const pending = saved(goal(start(), { commitIt: false }));
  says(migrated, pending, /but not in your working tree: the migration isn't committed.*\(Worked example step 3\)/);
  says(clean, pending, /^These changes are uncommitted: samples\//);

  const cut = saved(goal(start(), { change: (t) => migrate(t).replace('/whats-on/fixit-saturday-june', '/whats-on/') }));
  says(migrated, cut, /^`samples\/june\.md` no longer links to `https:\/\/library\.example\/whats-on\/fixit-saturday-june`/);

  const wide = goal(start(), { commitIt: false });
  write(wide, { 'README.md': `${START['README.md']}- The library's events pages moved to /whats-on/.\n` });
  commit(wide, 'Point the library links at /whats-on/', [...PAGES, 'README.md']);
  says(migrated, saved(wide), /^The commit "Point the library links at \/whats-on\/" changes the library links and also `README\.md`, outside `samples\/`/);
});

test('the plausible mistake: the migration and the workflow in one commit fails the migration item and names the workflow', () => {
  const dir = goal(start(), { commitIt: false });
  saved(dir, solution(SCRIPT), { commitIt: false });
  commit(dir, 'Migrate the links and add the audit', [...PAGES, ROOT_SCRIPT]);
  says(migrated, dir, /also `\.\.\/\.claude\/workflows\/audit-dropped-errors\.js`, outside `samples\/`.*git reset --soft HEAD~1/);
  passes(dir, [workflow, testsPass, clean]);
});

test("the manuscript's gaps: the script from before args, one that returns every verdict, and one that checks a file's whole answer at once", () => {
  says(workflow, saved(goal(start()), HARDCODED), /never reads `args`, so it audits the folder it names itself.*\(Your turn step 2\)/);

  const everyVerdict = edited("findings.filter((_, i) => verdicts[i]?.startsWith('CONFIRMED')).join('\\n') || 'No confirmed findings.'", "verdicts.join('\\n')");
  says(workflow, saved(goal(start()), everyVerdict), /returns `lib\/fetch\.js:30`, a finding its checking agent refuted/);

  // The guide's old script: each file agent's whole answer is one finding.
  const wholeAnswer = edited(
    "found.flatMap((answer) => (!answer || answer.trim() === 'NONE' ? [] : answer.split('\\n').filter((line) => line.trim())))",
    "found.filter((answer) => answer && answer.trim() !== 'NONE')",
  );
  says(workflow, saved(goal(start()), wholeAnswer), /one checking agent of .* gets 2 findings at once/);
});

test('workflows that only look right: no checking stage, one agent for the whole folder, a fix request, a confirmed finding left out, and findings written by hand', () => {
  const noCheck = `export const meta = { name: 'audit', description: 'Audit a folder' }
const listing = await agent(\`List every file under \${args[0]}/.\`, { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } } } } })
const found = await pipeline(listing.files, (f) => agent(\`List each error caught and dropped in \${f}, as file:line: reason.\`))
return found.join('\\n')
`;
  says(workflow, saved(goal(start()), noCheck), /reports what its file agents found without a second agent checking any of it/);

  const oneAgent = `export const meta = { name: 'audit', description: 'Audit a folder' }
const found = await agent(\`Find every error caught and dropped in the files under \${args[0]}/, one per line.\`)
const verdicts = await pipeline(found.split('\\n'), (x) => agent(\`Is this right? \${x}\`))
return verdicts.join('\\n')
`;
  says(workflow, saved(goal(start()), oneAgent), /has no agent look at one file on its own/);

  const fixer = edited('Answer CONFIRMED or REFUTED, then one sentence.', 'Answer CONFIRMED or REFUTED, then fix it.');
  says(workflow, saved(goal(start()), fixer), /asks an agent to change code/);
  // A negated one is no fix request.
  passes(saved(goal(start()), edited('Answer CONFIRMED or REFUTED', "Don't fix anything. Answer CONFIRMED or REFUTED")), [workflow]);

  const firstOnly = edited(".join('\\n') || 'No confirmed findings.'", ".slice(0, 1).join('\\n') || 'No confirmed findings.'");
  says(workflow, saved(goal(start()), firstOnly), /leaves out `lib\/parse\.js:41`, a finding its checking agent confirmed/);

  const byHand = "export const meta = { name: 'audit', description: 'Audit a folder' }\nreturn `${args[0]}/check-links.js:24: the URIError is dropped`\n";
  says(workflow, saved(goal(start()), byHand), /never calls `agent\(\)`/);
});

test('scripts Claude Code would refuse or misread: a module import, a meta that is not literal, args read as an object, and an error at run time', () => {
  says(workflow, saved(goal(start()), edited('const folder =', "const { readdirSync } = await import('node:fs')\nconst folder =")), /uses `import`\. A workflow script has no module, file or shell access/);
  says(workflow, saved(goal(start()), edited("name: 'audit-dropped-errors',", "name: ['audit', 'dropped'].join('-'),")), /`meta` holds a function call/);
  says(workflow, saved(goal(start()), edited('Array.isArray(args) ? args[0] : args', 'args.folder')), /through `args` \(`\["lib"\]`\), .* stops before it starts an agent: Name a folder.*first item of `args`/);
  says(workflow, saved(goal(start()), edited('listing.files', 'listing.items')), /stops with an error: .*\(Your turn step 2\)/);
});

test('the workflow item: a script left uncommitted, one saved in a subfolder, and one with an uncommitted fix, each say so', () => {
  says(workflow, saved(goal(start()), solution(SCRIPT), { commitIt: false }), /^`\.\.\/\.claude\/workflows\/audit-dropped-errors\.js` isn't committed\. Run `git add \.\.\/\.claude\/workflows\/audit-dropped-errors\.js`/);

  const nested = goal(start());
  rootWrite(nested, { '.claude/workflows/old/audit.js': solution(SCRIPT) });
  commit(nested, 'Keep the audit', ['../.claude/workflows/old/audit.js']);
  says(workflow, nested, /is under `\.claude\/workflows\/`, but Claude Code reads only `\.js` files directly in that folder/);

  const fixedLater = saved(goal(start()), HARDCODED);
  rootWrite(fixedLater, { [SCRIPT]: solution(SCRIPT) });
  says(workflow, fixedLater, /has changes that aren't committed: if they fix this, commit them/);
});

test("the check's own runs of the script leave the repository as they found it", () => {
  const dir = lab();
  passes(dir);
  assert.equal(openRepo(dir).git('status', '--porcelain', '--ignored', '--', '..'), '');
});
