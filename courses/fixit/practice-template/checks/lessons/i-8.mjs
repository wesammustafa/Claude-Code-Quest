// @ts-check
// Evaluate, trial and share a plugin (Fix-It course, the Intermediate lab
// i-8). The Learner installs the TypeScript language server, reads the code
// intelligence plugin's panel, trials it at local scope and asks it for a
// function's references before any change; trials the recommender the same
// way and asks what the website repository lacks; then shares one plugin,
// the one the team chose at Your turn step 4, at project scope, and commits
// the shared settings.
//
// No item reads a list the Learner writes. Each reads Claude Code's own
// records: the settings file of each scope, and the install records in the
// home folder (~/.claude/plugins/installed_plugins.json), with the plugin's
// files in the plugin cache they name. The check can't see which option the
// Learner picked, so it passes either plugin the lab offers, and only one;
// the Step that shares it checks the pick. Whether the lookup at Your turn
// step 1 came from the language server is the prompt's rubric's to judge.
//
// In the Fix-It course this file takes the place of the guide's own i-8
// check, which the guide's i-capstone check imports, so it keeps its
// exports: title and items.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Evaluate, trial and share a plugin';

const MARKET = 'claude-plugins-official';
// The two plugins Your turn step 4 offers the team.
const CHOICES = ['claude-code-setup', 'commit-commands'].map((name) => `${name}@${MARKET}`);
const SHARED = '.claude/settings.json';
const LOCAL = '.claude/settings.local.json';
const LSP = /-lsp@/;

/** @param {string} path */
const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/**
 * JSON text's value, null when there is no text, or the parse error.
 * @param {string | null} text
 * @returns {{ value: any } | { error: string } | null}
 */
function parse(text) {
  if (text === null) return null;
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: /** @type {Error} */ (error).message };
  }
}

/** @param {any} settings */
const enabled = (settings) =>
  settings?.enabledPlugins && typeof settings.enabledPlugins === 'object'
    ? Object.entries(settings.enabledPlugins)
        .filter(([, on]) => on === true)
        .map(([id]) => id)
    : [];

/**
 * The committed shared settings: their value, the parse error, or null when
 * no commit holds them.
 * @param {Repo} repo
 */
function committed(repo) {
  let text;
  try {
    text = repo.git('show', `HEAD:./${SHARED}`);
  } catch {
    return null;
  }
  return parse(text);
}

/** @param {Repo} repo */
const sharedNow = (repo) => parse(repo.read(SHARED));

/**
 * The plugin the committed settings share: one of CHOICES, or why not.
 * @param {Repo} repo
 * @returns {{ id: string } | { fault: string }}
 */
function sharedPlugin(repo) {
  const head = committed(repo);
  const now = enabled(/** @type {any} */ (sharedNow(repo))?.value);
  const unsaved = now.filter((id) => CHOICES.includes(id));
  if (head === null) {
    return { fault: unsaved.length ? `\`${SHARED}\` turns on \`${unsaved[0]}\`, but it isn't committed yet. Commit \`${SHARED}\` (Your turn step 4).` : `There is no committed \`${SHARED}\`. Run the check in this lab's practice copy.` };
  }
  if ('error' in head) return { fault: `The committed \`${SHARED}\` is not valid JSON: ${head.error}. Look for a missing comma between two blocks, or one too many.` };
  const ids = enabled(head.value);
  const chosen = ids.filter((id) => CHOICES.includes(id));
  if (chosen.length > 1) return { fault: `The committed \`${SHARED}\` turns on both ${chosen.map((id) => `\`${id}\``).join(' and ')}. Share only the one the team chose at Your turn step 4: take the other out of \`enabledPlugins\` and commit.` };
  const extra = ids.filter((id) => !CHOICES.includes(id) && !LSP.test(id));
  const others = extra.map((id) => `\`${id}\``).join(', ');
  if (!chosen.length) {
    if (unsaved.length) return { fault: `\`${SHARED}\` turns on \`${unsaved[0]}\`, but the commit doesn't yet. Commit \`${SHARED}\` (Your turn step 4).` };
    const wrongMarket = ids.find((id) => CHOICES.some((c) => id.split('@')[0] === c.split('@')[0]));
    if (wrongMarket) return { fault: `\`${wrongMarket}\` names another marketplace: the part after @ is the marketplace's name, \`${MARKET}\`. Install it again from \`${MARKET}\` with project scope.` };
    if (extra.length) return { fault: `The committed \`${SHARED}\` turns on ${others}, which isn't a plugin the team could choose at Your turn step 4. Share \`${CHOICES.join('` or `')}\` instead.` };
    return { fault: `The committed \`${SHARED}\` turns on neither plugin the team could choose, \`${CHOICES.join('` nor `')}\`. Install the one the team chose with project scope, then commit \`${SHARED}\` (Your turn step 4).` };
  }
  if (extra.length) return { fault: `The committed \`${SHARED}\` also turns on ${others}, which the team didn't choose. Share only the plugin chosen at Your turn step 4: take ${extra.length > 1 ? 'them' : 'it'} out of \`enabledPlugins\` and commit.` };
  if (!head.value?.permissions) return { fault: `The committed \`${SHARED}\` lost its \`permissions\` block. Put the earlier settings back beside \`enabledPlugins\`, and commit.` };
  return { id: /** @type {string} */ (chosen[0]) };
}

/**
 * Claude Code's install records on this machine, by plugin id, or null when
 * it has none.
 * @returns {Record<string, any[]> | null}
 */
function installs() {
  const read = parse(existsSync(join(homedir(), '.claude/plugins/installed_plugins.json')) ? readFileSync(join(homedir(), '.claude/plugins/installed_plugins.json'), 'utf8') : null);
  const plugins = read && 'value' in read ? read.value?.plugins : null;
  return plugins && typeof plugins === 'object' ? plugins : null;
}

/**
 * A path a record names, as it is on this machine. Claude Code writes
 * absolute paths. When a home folder and the repository in it are copied
 * elsewhere together, as Questerm's real-tools gate copies them, a recorded
 * path no longer exists; it is then the same path relative to this home
 * folder, below the home folder the record was written under, which its
 * plugin cache path shows.
 * @param {unknown} path
 * @param {any} record
 */
function onThisMachine(path, record) {
  if (typeof path !== 'string' || !isAbsolute(path)) return null;
  if (existsSync(path)) return real(path);
  const cache = typeof record?.installPath === 'string' ? record.installPath.split('/.claude/plugins/cache/') : [];
  if (cache.length < 2) return null;
  const rel = relative(/** @type {string} */ (cache[0]), path);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? real(join(homedir(), rel)) : null;
}

/**
 * Whether an install record belongs to this repository: Claude Code keeps
 * the folder it ran in, which is project/ or the git root above it.
 * @param {any} record
 * @param {Repo} repo
 */
function isHere(record, repo) {
  const at = onThisMachine(record?.projectPath, record);
  if (at === null) return false;
  if (at === real(repo.dir)) return true;
  try {
    return at === real(repo.top);
  } catch {
    return false;
  }
}

/**
 * Whether the record's plugin files are in the plugin cache: its manifest,
 * naming the plugin.
 * @param {any} record
 * @param {string} id
 */
function hasFiles(record, id) {
  const at = onThisMachine(record?.installPath, record);
  if (at === null) return false;
  const manifest = parse(existsSync(join(at, '.claude-plugin/plugin.json')) ? readFileSync(join(at, '.claude-plugin/plugin.json'), 'utf8') : null);
  return Boolean(manifest && 'value' in manifest && manifest.value?.name === id.split('@')[0]);
}

const notInstalled = (/** @type {string} */ id, /** @type {string} */ scope, /** @type {string} */ step) =>
  `Claude Code's install records on this machine don't list \`${id}\`: turning it on in a settings file doesn't install it. Install it with ${scope} scope (${step}).`;

/** @type {Item[]} */
export const items = [
  {
    text: `the committed \`${SHARED}\` turns on one plugin the team chose, \`claude-code-setup\` or \`commit-commands\`, and keeps its earlier settings`,
    check(repo) {
      const shared = sharedPlugin(repo);
      return 'fault' in shared ? shared.fault : true;
    },
  },
  {
    text: 'that plugin is installed at project scope for this repository, with its files in the plugin cache',
    local: true,
    check(repo) {
      const shared = sharedPlugin(repo);
      if ('fault' in shared) return 'Share the plugin the team chose first, then install it with project scope (Your turn step 4).';
      const { id } = shared;
      const step = 'Your turn step 4';
      const records = (installs()?.[id] ?? []).filter((r) => r && typeof r === 'object');
      if (!records.length) return notInstalled(id, 'project', step);
      const project = records.filter((r) => r.scope === 'project');
      const here = project.filter((r) => isHere(r, repo));
      if (!here.length) {
        if (project.length) return `\`${id}\` is installed at project scope for another folder, ${project.map((r) => `\`${r.projectPath}\``).join(', ')}. Install it from this repository's \`project/\` folder with project scope (${step}).`;
        return `\`${id}\` is installed at ${[...new Set(records.map((r) => r.scope))].join(' and ')} scope, which turns it on only for you. Install it with project scope, so the shared settings turn it on for the team (${step}).`;
      }
      return here.some((r) => hasFiles(r, id)) ? true : `\`${id}\`'s install record names plugin files that aren't in the plugin cache. Install it again with project scope (${step}).`;
    },
  },
  {
    text: 'a code intelligence plugin is on at local scope here, installed for this repository, and stays out of the shared settings',
    local: true,
    check(repo) {
      const step = 'Worked example step 2';
      const local = parse(repo.readAny(LOCAL));
      if (local && 'error' in local) return `\`${LOCAL}\` is not valid JSON: ${local.error}. Install the plugin again from its panel, local scope (${step}).`;
      const trials = enabled(local?.value).filter((id) => LSP.test(id));
      if (!trials.length) return `Your local settings, \`${LOCAL}\`, turn on no code intelligence plugin. Install \`typescript-lsp\` for you, in this repository only: local scope (${step}).`;
      const head = committed(repo);
      const now = sharedNow(repo);
      const shared = [...new Set([...enabled(head && 'value' in head ? head.value : null), ...enabled(now && 'value' in now ? now.value : null)])];
      const leaked = trials.filter((id) => shared.includes(id));
      if (leaked.length) return `\`${leaked[0]}\` is turned on in \`${SHARED}\`, so every teammate gets your trial. Take it out of \`enabledPlugins\` there, and commit.`;
      if (repo.trackedAny(LOCAL)) return `\`${LOCAL}\` is committed, so your trial reaches the team. Take it out of Git with \`git rm --cached\`, and commit: Claude Code keeps it out of Git for you.`;
      const records = installs();
      const missing = trials.find((id) => !(records?.[id] ?? []).some((r) => r?.scope === 'local' && isHere(r, repo)));
      if (missing === undefined) return true;
      const any = records?.[missing] ?? [];
      if (!any.length) return notInstalled(missing, 'local', step);
      return `Claude Code's records show \`${missing}\` installed, but not at local scope for this repository. Install it from its panel in this repository, local scope (${step}).`;
    },
  },
];
