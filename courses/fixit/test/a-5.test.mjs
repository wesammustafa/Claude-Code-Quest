// The a-5 lab's check against the work a Learner may leave in a new copy of
// the website repository: the two valid routes (the July page fixed before
// the merge, and the booking link merged as it was), the untouched start, a
// run record typed by hand, the near misses the lab names, and one mistake
// per item. Each is played with real git, in a copy laid out as a practice
// copy is (project/ below the git root), with a bare repository as origin
// and GitHub's merge commit made as GitHub makes it. GitHub's runs and
// secrets come from a stand-in gh on PATH that answers `gh run list` and
// `gh secret list` from each test's state, as the Simulated GitHub does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, GUIDE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, write, rootWrite } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const a5 = await import(pathToFileURL(join(checks, 'lessons/a-5.mjs')).href);
const [manualWorkflow, manualRun, reviewWorkflow, skillOnMain, reviewedHead, merged, tornDown] = a5.items;

// The lab's starting files, with the guide's inert names made live.
const { RESTORE } = await import(pathToFileURL(join(GUIDE, 'quest/release/src/replay.mjs')).href);
const START = {};
const OWN = 'practice-template/lessons/a-5/project';
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
const solution = (p) => readFileSync(join(COURSE, 'solutions/a-5', p), 'utf8');
const MANUAL = solution('.github/workflows/linkcheck-report.yml');
const REVIEW = solution('.github/workflows/claude-review.yml');
const JULY_FIXED = solution('samples/july.md');
const SKILL = START['practice/a-5/team-review/SKILL.md'];
const ROOT_MANUAL = '.github/workflows/linkcheck-report.yml';
const ROOT_REVIEW = '.github/workflows/claude-review.yml';
const ROOT_SKILL = '.claude/skills/team-review/SKILL.md';

// A stand-in gh: `gh run list --workflow <file> --json <fields>` and `gh
// secret list`, from the JSON file FAKE_GH_STATE names.
const bin = mkdtempSync(join(tmpdir(), 'fake-gh-'));
writeFileSync(
  join(bin, 'gh'),
  `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const state = JSON.parse(readFileSync(process.env.FAKE_GH_STATE, 'utf8'));
const a = process.argv.slice(2);
const opt = (k) => { const i = a.indexOf(k); return i === -1 ? undefined : a[i + 1]; };
if (a[0] === 'run' && a[1] === 'list') {
  const runs = state.runs[opt('--workflow')];
  if (!runs) { process.stderr.write('could not find any workflows named ' + opt('--workflow') + '\\n'); process.exit(1); }
  const fields = opt('--json').split(',');
  process.stdout.write(JSON.stringify(runs.map((r) => Object.fromEntries(fields.map((f) => [f, r[f]])))) + '\\n');
} else if (a[0] === 'secret' && a[1] === 'list') {
  process.stdout.write(state.secrets.map((s) => s + '\\t2026-11-25T10:00:00Z\\n').join(''));
} else { process.stderr.write('unknown command\\n'); process.exit(1); }
`,
);
chmodSync(join(bin, 'gh'), 0o755);
writeFileSync(join(bin, 'package.json'), '{"type":"commonjs"}\n');
process.env.PATH = `${bin}:${process.env.PATH}`;
const STATE = join(bin, 'state.json');
/** GitHub as the stand-in answers it until the next call. */
const github = (state) => {
  process.env.FAKE_GH_STATE = STATE;
  writeFileSync(STATE, JSON.stringify({ runs: {}, secrets: [], ...state }));
};

const GIT_ENV = { GIT_AUTHOR_NAME: 'Practice Learner', GIT_AUTHOR_EMAIL: 'learner@example.invalid', GIT_COMMITTER_NAME: 'Practice Learner', GIT_COMMITTER_EMAIL: 'learner@example.invalid' };
const git = (dir, args, env = {}) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = (dir) => git(dir, ['rev-parse', 'HEAD']);
const commitAll = (dir, message) => {
  git(dir, ['add', '-A', '..']);
  git(dir, ['commit', '-q', '-m', message]);
  return head(dir);
};

/** A fresh copy at its first commit on main, pushed to a bare origin; returns project/. */
function start() {
  const dir = repo(START, { nested: true });
  const origin = mkdtempSync(join(tmpdir(), 'origin-'));
  git(origin, ['init', '-q', '--bare']);
  commitAll(dir, 'Start from the practice template');
  git(dir, ['branch', '-M', 'main']);
  git(dir, ['remote', 'add', 'origin', origin]);
  git(dir, ['push', '-q', '-u', 'origin', 'main']);
  return dir;
}

/** GitHub's merge of `branch` into main, then the Learner's pull. */
function githubMerge(dir, branch, { by = 'GitHub' } = {}) {
  git(dir, ['switch', '-q', 'main']);
  git(dir, ['merge', '-q', '--no-ff', '-m', `Merge pull request #1 from practice-learner/${branch}\n\nAdd the July session's page`, branch], { GIT_COMMITTER_NAME: by, GIT_COMMITTER_EMAIL: 'noreply@github.com' });
  git(dir, ['push', '-q']);
}

const green = (id, sha, event) => ({ databaseId: id, headSha: sha, event, status: 'completed', conclusion: 'success' });
const failed = (id, sha, event) => ({ databaseId: id, headSha: sha, event, status: 'completed', conclusion: 'failure' });

/**
 * The lab played through, with each part replaceable: the change the pull
 * request makes, whether the July claim is fixed before the merge, the two
 * workflows, where the skill goes, the merge and the teardown. Returns the
 * project/ folder and GitHub's state for the runs it made.
 */
function lab({ change = 'july', fix = true, manual = MANUAL, review = REVIEW, skillOnMain: onMain = true, merge = true, teardown = true, push = true } = {}) {
  const dir = start();
  rootWrite(dir, { [ROOT_MANUAL]: manual });
  const manualSha = commitAll(dir, 'Report broken links on the sample pages, on demand');
  git(dir, ['push', '-q']);
  git(dir, ['switch', '-q', '-c', 'july-page']);
  rootWrite(dir, { [ROOT_REVIEW]: review, [ROOT_SKILL]: SKILL });
  commitAll(dir, 'Review every pull request with the team review skill');
  git(dir, ['apply', change === 'july' ? 'practice/a-5/add-july-page.patch' : 'practice/a-5/fix-booking-link.patch']);
  const first = commitAll(dir, change === 'july' ? "Add the July session's page" : 'Fix the booking link on the March page');
  git(dir, ['push', '-q', '-u', 'origin', 'july-page']);
  const reviews = [failed(3, first, 'pull_request')];
  let last = first;
  if (onMain) {
    git(dir, ['switch', '-q', 'main']);
    rootWrite(dir, { [ROOT_SKILL]: SKILL });
    commitAll(dir, 'Add the team review skill');
    git(dir, ['push', '-q']);
    git(dir, ['switch', '-q', 'july-page']);
    git(dir, ['merge', '-q', '--no-edit', 'main']);
    git(dir, ['push', '-q']);
    last = head(dir);
    reviews.unshift(green(4, last, 'pull_request'));
  }
  if (change === 'july' && fix) {
    write(dir, { 'samples/july.md': JULY_FIXED });
    last = commitAll(dir, 'Say Room B is upstairs, not step-free by lift');
    git(dir, ['push', '-q']);
    reviews.unshift(green(5, last, 'pull_request'));
  }
  if (merge) githubMerge(dir, 'july-page');
  if (teardown) {
    git(dir, ['rm', '-q', `../${ROOT_MANUAL}`, `../${ROOT_REVIEW}`]);
    git(dir, ['commit', '-q', '-m', 'Remove the Claude workflows']);
    if (push) git(dir, ['push', '-q']);
  }
  const state = {
    runs: { 'linkcheck-report.yml': [green(2, manualSha, 'workflow_dispatch'), failed(1, manualSha, 'workflow_dispatch')], 'claude-review.yml': reviews },
    secrets: teardown ? [] : ['ANTHROPIC_API_KEY'],
  };
  return { dir, state, manualSha, last };
}

const passes = (dir, state, items = a5.items) => {
  github(state);
  const r = openRepo(dir);
  for (const i of items) assert.equal(i.check(r), true, i.text);
};
const says = (item, dir, state, re) => {
  github(state);
  const got = item.check(openRepo(dir));
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};

test('valid B: the July page, its step-free claim fixed on the branch before the merge, passes every item', () => {
  const { dir, state } = lab();
  passes(dir, state);
});

test('valid A: the booking link merged as the review passed it passes every item', () => {
  const { dir, state } = lab({ change: 'booking' });
  passes(dir, state);
});

test('the untouched start fails every item', () => {
  const dir = start();
  const state = { secrets: ['ANTHROPIC_API_KEY'] };
  says(manualWorkflow, dir, state, /There is no committed `\.\.\/\.github\/workflows\/linkcheck-report\.yml`/);
  says(manualRun, dir, state, /no committed `linkcheck-report\.yml` yet/);
  says(reviewWorkflow, dir, state, /There is no committed `\.\.\/\.github\/workflows\/claude-review\.yml`/);
  says(skillOnMain, dir, state, /There is no `\.\.\/\.claude\/skills\/team-review\/SKILL\.md` on `main`/);
  says(reviewedHead, dir, state, /no pull request for the check to read/);
  says(merged, dir, state, /isn't merged yet/);
  says(tornDown, dir, state, /still holds the `ANTHROPIC_API_KEY` secret/);
});

test('a run record typed by hand is no run: the check asks GitHub', () => {
  const { dir, state, manualSha } = lab();
  write(dir, { '.practice/a-5-runs.json': JSON.stringify([green(2, manualSha, 'workflow_dispatch')]) });
  says(manualRun, dir, { ...state, runs: { ...state.runs, 'linkcheck-report.yml': [] } }, /GitHub has no run of `linkcheck-report\.yml` started by hand/);
});

test("near miss: the July page merged on a green review with its claim still in it fails the review item, naming the line", () => {
  const { dir, state } = lab({ fix: false });
  says(reviewedHead, dir, state, /`samples\/july\.md` line 5 still saying it is step-free.*Fix it in a new pull request/);
  // Before the merge, on the branch, the check says the same.
  const branch = lab({ fix: false, merge: false, teardown: false });
  says(reviewedHead, branch.dir, branch.state, /line 5, which says it is step-free/);
});

test("near miss: a review that couldn't run git diff is green but read nothing, so the review item fails", () => {
  const blind = REVIEW.replace('"Bash(git diff *),Bash(npm --prefix project run linkcheck *)"', '"Bash(npm --prefix project run linkcheck *)"');
  const { dir, state } = lab({ change: 'booking', review: blind });
  says(reviewedHead, dir, state, /doesn't allow `Bash\(git diff \*\)`, so the review couldn't read the change/);
  says(reviewWorkflow, dir, state, /doesn't allow `Bash\(git diff \*\)`/);
  const shallow = REVIEW.replace('        with:\n          fetch-depth: 0\n', '');
  const s = lab({ change: 'booking', review: shallow });
  says(reviewedHead, s.dir, s.state, /checks out one commit/);
});

test('a July fix that only hedges the claim passes, and one that keeps it in other words fails', () => {
  const hedged = lab({ merge: false, teardown: false, fix: false });
  write(hedged.dir, { 'samples/july.md': JULY_FIXED.replace(/\*\*Access:\*\*.*\n/, '**Access:** Step-free by lift, to be confirmed by the library.\n') });
  const sha = commitAll(hedged.dir, 'Hedge the access line');
  passes(hedged.dir, { ...hedged.state, runs: { ...hedged.state.runs, 'claude-review.yml': [green(6, sha, 'pull_request')] } }, [reviewedHead]);
  const kept = lab({ merge: false, teardown: false, fix: false });
  write(kept.dir, { 'samples/july.md': JULY_FIXED.replace(/\*\*Access:\*\*.*\n/, '**Access:** Room B, step-free.\n') });
  const sha2 = commitAll(kept.dir, 'Reword the access line');
  says(reviewedHead, kept.dir, { ...kept.state, runs: { ...kept.state.runs, 'claude-review.yml': [green(6, sha2, 'pull_request')] } }, /which says it is step-free/);
});

test("the workflow in the website's folder, where GitHub never runs it, fails the first item", () => {
  const dir = start();
  write(dir, { [ROOT_MANUAL]: MANUAL });
  commitAll(dir, 'Report broken links');
  says(manualWorkflow, dir, {}, /in the website's folder, `project\/`, where GitHub never runs a workflow/);
  const loose = start();
  rootWrite(loose, { [ROOT_MANUAL]: MANUAL });
  says(manualWorkflow, loose, {}, /isn't committed: run `git add \.\.\/\.github\/workflows\/linkcheck-report\.yml`/);
});

// One mistake per line of the manual workflow, each in a copy of its own.
const MANUAL_MISSES = [
  ['a second trigger', (t) => t.replace('on: workflow_dispatch', 'on: [workflow_dispatch, push]'), /starts on `push` too: write `on: workflow_dispatch`/],
  ['pull_request_target', (t) => t.replace('on: workflow_dispatch', 'on: [workflow_dispatch, pull_request_target]'), /Remove `pull_request_target`/],
  ['a moving tag', (t) => t.replace('@v1.0.258', '@v1'), /`@v1` on line \d+ can move to a new release/],
  ['no version', (t) => t.replace('anthropics/claude-code-action@v1.0.258', 'anthropics/claude-code-action'), /without a version/],
  ['no Node.js setup', (t) => t.replace('      - uses: actions/setup-node@v7\n        with:\n          node-version: lts/*\n', ''), /`actions\/setup-node` before the action/],
  ['the action before the checkout', (t) => t.replace('      - uses: actions/checkout@v7\n', '').concat('      - uses: actions/checkout@v7\n'), /`actions\/checkout` before the action/],
  ['no report', (t) => t.replace('          display_report: true\n', ''), /Set `display_report: true`/],
  ['too many turns', (t) => t.replace('--max-turns 5', '--max-turns 10'), /`--max-turns 10` isn't a number from 1 to 5/],
  ['no turn cap', (t) => t.replace('--max-turns 5 ', ''), /sets no `--max-turns`/],
  ['the checker run at the root', (t) => t.replace('Bash(npm --prefix project run linkcheck *)', 'Bash(npm run linkcheck *)'), /the root's package\.json has no linkcheck script/],
  ['any command', (t) => t.replace('"Bash(npm --prefix project run linkcheck *)"', 'Bash'), /lists `Bash`, which lets Claude run any command/],
  ['no link-check rule', (t) => t.replace('"Bash(npm --prefix project run linkcheck *)"', 'Read'), /names no link-check command/],
  ['an unquoted rule', (t) => t.replace('"Bash(npm --prefix project run linkcheck *)"', 'Bash(npm --prefix project run linkcheck *)'), /as separate words/],
  ['write access', (t) => t.replace('contents: read', 'contents: write'), /`contents: write` on line \d+ gives the job token write access/],
  ['no timeout', (t) => t.replace('    timeout-minutes: 10\n', ''), /sets no `timeout-minutes`/],
  ['a key in the file', (t) => t.replace('${{ secrets.ANTHROPIC_API_KEY }}', 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX'), /looks like a Claude API key/],
  ['no job token', (t) => t.replace('          github_token: ${{ github.token }}\n', ''), /passes no `github_token`/],
  ['no prompt', (t) => t.replace(/ {10}prompt: .*\n/, ''), /has no `prompt`/],
];
for (const [name, edit, re] of MANUAL_MISSES)
  test(`the manual workflow with ${name} fails the first item`, () => {
    const dir = start();
    rootWrite(dir, { [ROOT_MANUAL]: edit(MANUAL) });
    commitAll(dir, 'Report broken links');
    says(manualWorkflow, dir, {}, re);
  });

const REVIEW_MISSES = [
  ['a second trigger', (t) => t.replace('on: pull_request', 'on: [pull_request, push]'), /starts on `push` too: write `on: pull_request`/],
  ['pull_request_target', (t) => t.replace('on: pull_request', 'on: pull_request_target'), /Remove `pull_request_target`/],
  ['one commit checked out', (t) => t.replace('        with:\n          fetch-depth: 0\n', ''), /`fetch-depth: 0`/],
  ['no concurrency', (t) => t.replace(/concurrency:\n.*\n.*\n/, ''), /Add `concurrency`/],
  ['no cancel', (t) => t.replace('cancel-in-progress: true', 'cancel-in-progress: false'), /`cancel-in-progress: true`/],
  ['another prompt', (t) => t.replace('/team-review the changes', 'Review the changes'), /doesn't start with `\/team-review`/],
  ['no git diff', (t) => t.replace('Bash(git diff *),', ''), /doesn't allow `Bash\(git diff \*\)`/],
  ['too many turns', (t) => t.replace('--max-turns 8', '--max-turns 9'), /`--max-turns 9` isn't a number from 1 to 8/],
];
for (const [name, edit, re] of REVIEW_MISSES)
  test(`the review workflow with ${name} fails its item`, () => {
    const dir = start();
    rootWrite(dir, { [ROOT_REVIEW]: edit(REVIEW) });
    commitAll(dir, 'Review every pull request');
    says(reviewWorkflow, dir, {}, re);
  });

test('the manual run item reads the run on the newest commit that changed the workflow', () => {
  const { dir, state, manualSha } = lab();
  // A green run on an older version, and none on the newest.
  says(manualRun, dir, { ...state, runs: { ...state.runs, 'linkcheck-report.yml': [green(2, '0'.repeat(40), 'workflow_dispatch')] } }, /passed on 0000000, but the newest commit that changed the workflow is/);
  says(manualRun, dir, { ...state, runs: { ...state.runs, 'linkcheck-report.yml': [failed(1, manualSha, 'workflow_dispatch')] } }, /Run 1 on \w{7} ended with `failure`\. `gh run view 1 --log-failed`/);
  says(manualRun, dir, { ...state, runs: { ...state.runs, 'linkcheck-report.yml': [{ ...green(2, manualSha, 'workflow_dispatch'), status: 'in_progress', conclusion: '' }] } }, /is still in progress: follow it with `gh run watch 2`/);
  // A run a mention started is no manual run.
  says(manualRun, dir, { ...state, runs: { ...state.runs, 'linkcheck-report.yml': [green(2, manualSha, 'issue_comment')] } }, /has no run of `linkcheck-report\.yml` started by hand/);
});

test('the skill must be on GitHub\'s main, not only on the branch or only in the copy', () => {
  const branch = lab({ skillOnMain: false, merge: false, teardown: false });
  says(skillOnMain, branch.dir, branch.state, /is only on `july-page`: the action loads `\.claude\/` from the pull request's base branch/);
  const local = lab({ skillOnMain: false, merge: false, teardown: false });
  git(local.dir, ['switch', '-q', 'main']);
  rootWrite(local.dir, { [ROOT_SKILL]: SKILL });
  commitAll(local.dir, 'Add the team review skill');
  says(skillOnMain, local.dir, local.state, /committed on `main`, but that commit isn't pushed/);
});

test('the review item reads the review of the latest push, and a cancelled or failed one is no pass', () => {
  const { dir, state, last } = lab({ merge: false, teardown: false });
  says(reviewedHead, dir, { ...state, runs: { ...state.runs, 'claude-review.yml': state.runs['claude-review.yml'].slice(1) } }, /Run 4 passed on \w{7}, but the pull request's latest commit is/);
  says(reviewedHead, dir, { ...state, runs: { ...state.runs, 'claude-review.yml': [{ ...green(5, last, 'pull_request'), conclusion: 'cancelled' }] } }, /run 5, was cancelled: a newer push started another review/);
  says(reviewedHead, dir, { ...state, runs: { ...state.runs, 'claude-review.yml': [failed(5, last, 'pull_request')] } }, /run 5, ended with `failure`/);
  says(reviewedHead, dir, { ...state, runs: { ...state.runs, 'claude-review.yml': [] } }, /has no review run/);
});

test('the merge item wants GitHub\'s merge at the reviewed commit, in the copy\'s main', () => {
  const open = lab({ merge: false, teardown: false });
  says(merged, open.dir, open.state, /The pull request isn't merged yet/);
  // A merge the Learner made in the copy is not GitHub's.
  const own = lab({ merge: false, teardown: false });
  githubMerge(own.dir, 'july-page', { by: 'Practice Learner' });
  says(merged, own.dir, own.state, /isn't merged yet/);
  // GitHub merged before the last push was reviewed.
  const early = lab({ teardown: false });
  says(merged, early.dir, { ...early.state, runs: { ...early.state.runs, 'claude-review.yml': early.state.runs['claude-review.yml'].slice(1) } }, /GitHub merged at \w{7}, which has no green review/);
  // Merged on GitHub, not pulled yet.
  const unpulled = lab({ merge: false, teardown: false });
  githubMerge(unpulled.dir, 'july-page');
  git(unpulled.dir, ['reset', '-q', '--hard', 'HEAD^1']);
  says(merged, unpulled.dir, unpulled.state, /doesn't have the merge yet: run `git switch main`, then `git pull`/);
});

test('the teardown item wants the workflows gone and pushed, the secret deleted and no key in the history', () => {
  const kept = lab({ teardown: false });
  says(tornDown, kept.dir, { ...kept.state, secrets: [] }, /still runs `anthropics\/claude-code-action`/);
  const unpushed = lab({ push: false });
  says(tornDown, unpushed.dir, unpushed.state, /the removals aren't pushed/);
  const secret = lab();
  says(tornDown, secret.dir, { ...secret.state, secrets: ['ANTHROPIC_API_KEY'] }, /still holds the `ANTHROPIC_API_KEY` secret/);
  const leaked = lab({ manual: MANUAL.replace('${{ secrets.ANTHROPIC_API_KEY }}', 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX') });
  says(tornDown, leaked.dir, leaked.state, /holds what looks like a Claude API key in `\.\.\/\.github\/workflows\/linkcheck-report\.yml`/);
});

test("gh that can't list the runs fails the run items with gh's reason", () => {
  const { dir } = lab();
  process.env.FAKE_GH_STATE = join(bin, 'missing.json');
  const got = manualRun.check(openRepo(dir));
  assert.match(got, /gh couldn't list the runs of `linkcheck-report\.yml`/);
});

test('the solution writes no evidence file', () => {
  const steps = readFileSync(join(COURSE, 'solutions/a-5/steps.sh'), 'utf8');
  assert.doesNotMatch(steps, /printf|\.practice\//);
});
