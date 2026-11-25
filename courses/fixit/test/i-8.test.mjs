// The i-8 lab's check against the work a Learner may leave in the website
// repository and in Claude Code's records: the solution's route (both trials
// from their panels, the recommender shared), a second valid route (the
// trial and the share from the shell, commit-commands shared), the same
// records copied to another home folder, the untouched start, a hand-written
// install list, and one mistake per item, each played with real git in a
// copy laid out as a practice copy is (project/ below the git root), with a
// home folder of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, GUIDE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write, rootWrite } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i8 = await import(pathToFileURL(join(checks, 'lessons/i-8.mjs')).href);
const [shared, installed, trial] = i8.items;

// The lab's starting files, with the guide's inert names made live
// (`dot-claude` is `.claude`), as Questerm lays them in the copy.
const { RESTORE } = await import(pathToFileURL(join(GUIDE, 'quest/release/src/replay.mjs')).href);
const START = {};
const OWN = 'practice-template/lessons/i-8/project';
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

const LSP = 'typescript-lsp@claude-plugins-official';
const SETUP = 'claude-code-setup@claude-plugins-official';
const COMMIT = 'commit-commands@claude-plugins-official';
const VERSIONS = { 'typescript-lsp': '1.0.0', 'claude-code-setup': '1.0.0', 'commit-commands': '1.0.1' };
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** A fresh practice copy at its first commit, with a home folder of its own; returns both. */
function start() {
  const dir = repo(START, { nested: true });
  commit(dir, 'Start from the practice template');
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  return { dir, home };
}

/** Reads a JSON file, or {} when there is none. */
const read = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
};
const put = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, json(value));
};

/**
 * What Claude Code writes for an install, from `/plugin`'s panel or
 * `claude plugin install --scope <scope>` run in project/: enabledPlugins in
 * the scope's settings file, the install record and the plugin's files in
 * the cache. The panel keeps the local file at the git root; the shell, in
 * project/. `recorded` is the home folder the record names, when the copy
 * and its home were written elsewhere and moved here.
 */
function install({ dir, home }, id, scope, { from = 'panel', files = true, recorded = home, ran = dir } = {}) {
  const name = id.split('@')[0];
  const settings =
    scope === 'user' ? join(home, '.claude/settings.json') : scope === 'project' ? join(dir, '.claude/settings.json') : join(from === 'panel' ? dirname(dir) : dir, '.claude/settings.local.json');
  const s = read(settings);
  put(settings, { ...s, enabledPlugins: { ...s.enabledPlugins, [id]: true } });
  const cache = `.claude/plugins/cache/claude-plugins-official/${name}/${VERSIONS[name] ?? '1.0.0'}`;
  const records = join(home, '.claude/plugins/installed_plugins.json');
  const r = read(records);
  const projectPath = scope === 'user' ? {} : { projectPath: ran.replace(home, recorded) };
  const list = [...(r.plugins?.[id] ?? []), { scope, ...projectPath, installPath: join(recorded, cache), version: VERSIONS[name] }];
  put(records, { version: 2, plugins: { ...r.plugins, [id]: list } });
  if (files) put(join(home, cache, '.claude-plugin/plugin.json'), { name, version: VERSIONS[name] });
}

/** Commits the shared settings alone, as Your turn step 4 asks. */
const share = ({ dir }) => commit(dir, 'Share the plugin the team chose', ['.claude/settings.json']);

/** The solution's route: both trials from their panels at local scope, the recommender at project scope, committed. */
function solution(copy = start()) {
  install(copy, LSP, 'local');
  install(copy, SETUP, 'local');
  install(copy, SETUP, 'project');
  share(copy);
  return copy;
}

function run(item, { dir, home }) {
  const before = process.env.HOME;
  process.env.HOME = home;
  try {
    return item.check(openRepo(dir));
  } finally {
    process.env.HOME = before;
  }
}
const passes = (copy, items = i8.items) => {
  for (const i of items) assert.equal(run(i, copy), true, i.text);
};
const says = (item, copy, re) => {
  const got = run(item, copy);
  assert.notEqual(got, true, item.text);
  assert.match(got, re);
};

test('valid A, the solution: the trials from their panels, the recommender shared and committed, passes every item', () => {
  const copy = solution();
  passes(copy);
  const settings = JSON.parse(readFileSync(join(copy.dir, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(settings.enabledPlugins), [SETUP]);
  assert.deepEqual(settings.permissions.allow, ['Bash(npm test)']);
});

test('valid B: the trial and the share from the shell, commit-commands chosen, passes every item', () => {
  const copy = start();
  install(copy, LSP, 'local', { from: 'shell' });
  install(copy, SETUP, 'local', { from: 'shell' });
  install(copy, COMMIT, 'project', { from: 'shell' });
  share(copy);
  passes(copy);
});

test('a record Claude Code wrote at the git root, above project/, counts as this repository', () => {
  const copy = start();
  install(copy, LSP, 'local', { ran: dirname(copy.dir) });
  install(copy, COMMIT, 'project', { ran: dirname(copy.dir) });
  share(copy);
  passes(copy);
});

test('the same records copied with their home folder to another place still name this repository, as in the real-tools gate', () => {
  // The copy sits in its home folder, as /home/learner/claude-code-practice does.
  const at = start();
  const root = join(at.home, 'claude-code-practice');
  cpSync(dirname(at.dir), root, { recursive: true });
  const copy = { dir: join(root, 'project'), home: at.home };
  for (const [id, scope] of [
    [LSP, 'local'],
    [SETUP, 'project'],
  ])
    install(copy, id, scope, { recorded: '/home/learner' });
  share(copy);
  const records = read(join(copy.home, '.claude/plugins/installed_plugins.json'));
  assert.match(records.plugins[SETUP][0].projectPath, /^\/home\/learner\//);
  passes(copy);
});

test('the untouched start fails every item, each with its own fix', () => {
  const copy = start();
  says(shared, copy, /turns on neither plugin the team could choose/);
  says(installed, copy, /^Share the plugin the team chose first/);
  says(trial, copy, /turn on no code intelligence plugin/);
});

test("a hand-written install list and hand-edited settings fail: Claude Code's own records show nothing installed", () => {
  const copy = start();
  const here = copy.dir;
  write(copy.dir, {
    '.practice/i-8-plugins.json': json([
      { id: SETUP, scope: 'project', enabled: true, projectPath: here, projectEnabled: true },
      { id: LSP, scope: 'local', enabled: true, projectPath: here },
    ]),
    '.claude/settings.json': json({ ...JSON.parse(START['.claude/settings.json']), enabledPlugins: { [SETUP]: true } }),
  });
  rootWrite(copy.dir, { '.claude/settings.local.json': json({ enabledPlugins: { [LSP]: true } }) });
  share(copy);
  assert.equal(run(shared, copy), true);
  says(installed, copy, /don't list `claude-code-setup@claude-plugins-official`: turning it on in a settings file doesn't install it/);
  says(trial, copy, /don't list `typescript-lsp@claude-plugins-official`/);
});

test('an install record written by hand, with no plugin files in the cache, fails the install item', () => {
  const copy = start();
  install(copy, LSP, 'local');
  install(copy, SETUP, 'project', { files: false });
  share(copy);
  says(installed, copy, /names plugin files that aren't in the plugin cache/);
});

test("a record naming a folder that doesn't exist, and isn't this repository's place under the recorded home, isn't here", () => {
  const copy = start();
  install(copy, LSP, 'local');
  install(copy, SETUP, 'project', { ran: '/nowhere/else/project' });
  share(copy);
  says(installed, copy, /installed at project scope for another folder, `\/nowhere\/else\/project`/);
});

test('the code intelligence trial shared with the team fails the trial item, and the share item still passes', () => {
  const copy = start();
  install(copy, LSP, 'local');
  install(copy, LSP, 'project');
  install(copy, SETUP, 'project');
  share(copy);
  assert.equal(run(shared, copy), true);
  says(trial, copy, /^`typescript-lsp@claude-plugins-official` is turned on in `.claude\/settings.json`, so every teammate gets your trial/);
});

test('the local settings file committed fails the trial item', () => {
  const copy = start();
  install(copy, LSP, 'local', { from: 'shell' });
  install(copy, SETUP, 'project');
  commit(copy.dir, 'Commit everything');
  says(trial, copy, /`.claude\/settings.local.json` is committed, so your trial reaches the team/);
});

test('both plugins shared fails the share item: share only the one the team chose', () => {
  const copy = start();
  install(copy, LSP, 'local');
  install(copy, SETUP, 'project');
  install(copy, COMMIT, 'project');
  share(copy);
  says(shared, copy, /turns on both `claude-code-setup@claude-plugins-official` and `commit-commands@claude-plugins-official`/);
});

test('a plugin the team was not offered fails the share item, alone or beside the chosen one', () => {
  const alone = start();
  install(alone, LSP, 'local');
  install(alone, 'security-guidance@claude-plugins-official', 'project');
  share(alone);
  says(shared, alone, /turns on `security-guidance@claude-plugins-official`, which isn't a plugin the team could choose/);
  const beside = solution();
  install(beside, 'security-guidance@claude-plugins-official', 'project');
  share(beside);
  says(shared, beside, /also turns on `security-guidance@claude-plugins-official`, which the team didn't choose/);
});

test('the share installed but not committed fails the share item, naming the file to commit', () => {
  const copy = start();
  install(copy, LSP, 'local');
  install(copy, COMMIT, 'project');
  says(shared, copy, /turns on `commit-commands@claude-plugins-official`, but the commit doesn't yet\. Commit `.claude\/settings.json`/);
  says(installed, copy, /^Share the plugin the team chose first/);
});

test('the plugin turned on by hand in the shared settings, but installed only at local scope, fails the install item', () => {
  const copy = start();
  install(copy, LSP, 'local');
  install(copy, SETUP, 'local');
  const s = JSON.parse(readFileSync(join(copy.dir, '.claude/settings.json'), 'utf8'));
  write(copy.dir, { '.claude/settings.json': json({ ...s, enabledPlugins: { [SETUP]: true } }) });
  share(copy);
  says(installed, copy, /is installed at local scope, which turns it on only for you/);
});

test('another marketplace, or the earlier settings dropped, fails the share item', () => {
  const market = start();
  install(market, LSP, 'local');
  install(market, 'claude-code-setup@claude-code-plugins', 'project');
  share(market);
  says(shared, market, /names another marketplace: the part after @ is the marketplace's name, `claude-plugins-official`/);
  const dropped = solution();
  write(dropped.dir, { '.claude/settings.json': json({ enabledPlugins: { [SETUP]: true } }) });
  share(dropped);
  says(shared, dropped, /lost its `permissions` block/);
});

test('a code intelligence plugin installed only for the user, with the local settings edited by hand, fails the trial item', () => {
  const copy = solution();
  const records = join(copy.home, '.claude/plugins/installed_plugins.json');
  const r = read(records);
  put(records, { ...r, plugins: { ...r.plugins, [LSP]: [{ scope: 'user', installPath: r.plugins[LSP][0].installPath }] } });
  says(trial, copy, /installed, but not at local scope for this repository/);
});
