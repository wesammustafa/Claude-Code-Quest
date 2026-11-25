// @ts-check
// Release engineering: Claude review on a pull request (Fix-It course, the
// Advanced lab a-5). In a new copy of the website repository with a GitHub
// origin, the Learner has Claude write two workflows at the repository's
// root, where GitHub reads them: one started by hand that runs the link
// checker, and one that reviews each pull request with the team's skill.
// The Learner runs the first until it is green, opens a pull request before
// the skill is on main, acts on what the review names, merges, and tears
// both workflows and the secret down.
//
// The workflow items read the newest committed version of each file in
// HEAD's history, from the git root, so they pass before and after the
// teardown. The run items ask GitHub themselves, with `gh run list`, and
// tie each green run to the commit it judged: no saved record stands in for
// a run. The merge is read from git, as GitHub's merge commit, whose second
// parent is the pull request's head at the merge. The review's one
// catalogued finding, an unsupported step-free claim on the July page, is
// read from that commit too. Which line of the report the Learner's
// decision rests on, and who can reach Claude through a pull request, are
// self-checks.
//
// In the Fix-It course this file takes the place of the guide's own a-5
// check, so it keeps the exports the guide's a-capstone check imports:
// boundedWorkflow, chosenWorkflow and originRepo.
import { execFileSync } from 'node:child_process';
import { claudeArgWords, claudeWorkflowsAt, entryOf, parseYaml, readWorkflow } from '../actions.mjs';
import { ruleList } from '../claude-args.mjs';
import { openRepo } from '../repo.mjs';
/** @import { Node, Step } from '../actions.mjs' */
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Release engineering: Claude review on a pull request';

const MANUAL = '.github/workflows/linkcheck-report.yml';
const REVIEW = '.github/workflows/claude-review.yml';
const SKILL = '.claude/skills/team-review/SKILL.md';
const JULY = 'project/samples/july.md';
const CREDENTIALS = ['anthropic_api_key', 'claude_code_oauth_token'];
const SECRET_NAMES = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'];
const KEY = /sk-ant-[A-Za-z0-9_-]{20,}/;
const PINNED = /^(?:v\d+\.\d+\.\d+|[0-9a-f]{40})$/i;
const SECRET = /^\$\{\{\s*secrets(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\s*(['"])[A-Za-z_][A-Za-z0-9_]*\1\s*\])\s*\}\}$/;
const JOB_TOKEN = /^\$\{\{\s*(?:github\.token|secrets\.GITHUB_TOKEN)\s*\}\}$/;
const GIT_DIFF = /^Bash\(\s*git diff(?:[ :]\*)?\s*\)$/;
const TIMEOUT_MAX = 30;
const RUN_FIELDS = 'databaseId,headSha,event,status,conclusion';
// A line that says a room is step-free, and doesn't hedge it.
const STEP_FREE = /step[- ]free/i;
const HEDGE = /\b(?:not|no|isn't|unless|if|call|ask|check|confirm(?:ed)?|tbc)\b/i;
const GITHUB_REMOTE = /^(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?(?:www\.)?github\.com(?::\d+)?[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

/**
 * What a workflow must hold: the events it starts on, its turn cap, and
 * whether it is the review, which also needs the history, `git diff`, the
 * team's skill and a concurrency group.
 * @typedef {{ path: string, triggers: string[], why: string, turnsMax: number, review: boolean }} Spec
 */

/** @type {Spec} */
const MANUAL_SPEC = { path: MANUAL, triggers: ['workflow_dispatch'], why: 'so it runs only when you start it', turnsMax: 5, review: false };
/** @type {Spec} */
const REVIEW_SPEC = { path: REVIEW, triggers: ['pull_request'], why: 'so it reviews each pull request', turnsMax: 8, review: true };

const code = (/** @type {string} */ text) => `\`${text}\``;
const short = (/** @type {string} */ sha) => sha.slice(0, 7);
const and = (/** @type {string[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : (list[0] ?? ''));
const scalar = (/** @type {Node | null | undefined} */ node) => (node?.type === 'scalar' ? node.text : null);
// Where a root path is, seen from project/, where the Learner works.
const fromProject = (/** @type {string} */ path) => `../${path}`;

/** @type {WeakMap<Repo, Repo | null>} */
const roots = new WeakMap();

/**
 * The repository at the git root above project/, where GitHub reads
 * workflows and the action loads skills; null outside git.
 * @param {Repo} repo
 */
function rootOf(repo) {
  if (!roots.has(repo)) {
    try {
      roots.set(repo, openRepo(repo.top));
    } catch {
      roots.set(repo, null);
    }
  }
  return /** @type {Repo | null} */ (roots.get(repo));
}

/**
 * `path`'s text at `commit`, or null where that commit doesn't hold it.
 * @param {Repo} root
 * @param {string} commit
 * @param {string} path
 */
function fileAt(root, commit, path) {
  try {
    return root.gitLocal('show', `${commit}:${path}`);
  } catch {
    return null;
  }
}

/**
 * The newest commit in HEAD's history that holds `path`, with its text:
 * after a teardown, the last version before the removal.
 * @param {Repo} root
 * @param {string} path
 * @returns {{ commit: string, text: string } | null}
 */
function newest(root, path) {
  /** @type {string[]} */
  let commits = [];
  try {
    commits = root.gitLocal('log', '--full-history', '--format=%H', '--', path).split('\n').filter(Boolean);
  } catch {
    return null;
  }
  for (const commit of commits) {
    const text = fileAt(root, commit, path);
    if (text !== null) return { commit, text };
  }
  return null;
}

// The ways to write a Bash rule that matches every command.
/** @param {string} entry */
function anyBash(entry) {
  if (entry === 'Bash') return true;
  const m = entry.match(/^Bash\((.*)\)$/s);
  return Boolean(m && /^\*+$/.test(/** @type {string} */ (m[1]).replace(/[\s:]/g, '')));
}

/**
 * The tool rules `--allowedTools` names, and the words it took them from.
 * @param {string[]} words
 */
function allowedRules(words) {
  /** @type {string[]} */
  const values = [];
  let named = false;
  for (let i = 0; i < words.length; i += 1) {
    const w = /** @type {string} */ (words[i]);
    if (w === '--allowedTools' || w === '--allowed-tools') {
      named = true;
      while (i + 1 < words.length && !/** @type {string} */ (words[i + 1]).startsWith('--')) values.push(/** @type {string} */ (words[(i += 1)]));
    } else if (/^--(?:allowedTools|allowed-tools)=/.test(w)) {
      named = true;
      values.push(w.slice(w.indexOf('=') + 1));
    }
  }
  return { named, values, rules: ruleList(values) };
}

/**
 * The action's job's steps, in order.
 * @param {Node} doc
 * @param {Step} step
 */
function jobSteps(doc, step) {
  const jobs = entryOf(doc, 'jobs')?.value;
  const job = entryOf(jobs, step.job)?.value;
  const list = entryOf(job, 'steps')?.value;
  return { job, steps: list?.type === 'seq' ? list.items : [] };
}

const usesOf = (/** @type {Node} */ s) => String(scalar(entryOf(s, 'uses')?.value) ?? '').trim().toLowerCase();

/**
 * Why a review at this version couldn't read the change, or null when it
 * could: the whole history checked out and `git diff` allowed.
 * @param {string} text
 */
function blindness(text) {
  let read;
  try {
    read = readWorkflow(text);
  } catch {
    return "isn't a workflow the check can read";
  }
  const step = read.steps[0];
  if (!step) return 'runs no `anthropics/claude-code-action` step';
  const { steps } = jobSteps(parseYaml(text), step);
  const checkout = steps.find((s) => usesOf(s).startsWith('actions/checkout'));
  const depth = scalar(entryOf(entryOf(checkout, 'with')?.value, 'fetch-depth')?.value)?.trim();
  const { rules } = allowedRules(claudeArgWords(step.inputs.claude_args?.text ?? '').words);
  if (!rules.some((r) => GIT_DIFF.test(r))) return "doesn't allow `Bash(git diff *)`";
  if (depth !== '0') return 'checks out one commit, with no `fetch-depth: 0`';
  return null;
}

/**
 * Everything wrong with a workflow against its spec, most basic first.
 * @param {string} text
 * @param {Spec} spec
 * @returns {string[]}
 */
function problemsOf(text, spec) {
  /** @type {string[]} */
  const out = [];
  let read;
  let doc;
  try {
    doc = parseYaml(text);
    read = readWorkflow(text);
  } catch (error) {
    return [`It isn't YAML the check can read: ${/** @type {Error} */ (error).message}.`];
  }
  const leaked = text.split('\n').findIndex((line) => KEY.test(line));
  if (leaked !== -1) out.push(`Line ${leaked + 1} looks like a Claude API key. Treat it as leaked: delete it on the Claude Console now, because removing it from the file leaves it in the history. Keep the key only in the repository's secret.`);

  const on = read.triggers;
  if (on.includes('pull_request_target')) out.push('Remove `pull_request_target`: it runs a stranger\'s pull request with this repository\'s secrets and a token that can write.');
  const others = on.filter((t) => !spec.triggers.includes(t) && t !== 'pull_request_target');
  if (!on.some((t) => spec.triggers.includes(t)) || others.length) {
    const named = (others.length ? others : on).map(code);
    out.push(`It starts on ${named.length ? and(named) : 'no event the check can read'}${on.some((t) => spec.triggers.includes(t)) ? ' too' : ''}: write ${code(`on: ${spec.triggers[0]}`)} and nothing else, ${spec.why}.`);
  }

  const step = read.steps[0];
  if (!step) {
    out.push('It runs no `anthropics/claude-code-action` step.');
    return out;
  }
  if (!step.ref) out.push(`Line ${step.line} runs \`anthropics/claude-code-action\` without a version. Pin the release: \`@v1.0.258\`.`);
  else if (!PINNED.test(step.ref)) out.push(`\`@${step.ref}\` on line ${step.line} can move to a new release, which changes what runs without a commit of yours. Pin \`@v1.0.258\`, or that release's full commit SHA.`);

  const { job, steps } = jobSteps(doc, step);
  const at = (/** @type {string} */ prefix) => steps.findIndex((s) => usesOf(s).startsWith(prefix));
  const action = at('anthropics/claude-code-action');
  const checkout = at('actions/checkout');
  const node = at('actions/setup-node');
  if (checkout === -1 || checkout > action) out.push('Check out the repository with `actions/checkout` before the action, or Claude has no files to work on.');
  if (node === -1 || node > action) out.push('Set up Node.js with `actions/setup-node` before the action, so the link checker can run.');
  if (spec.review && checkout !== -1) {
    const depth = scalar(entryOf(entryOf(steps[checkout], 'with')?.value, 'fetch-depth')?.value)?.trim();
    if (depth !== '0') out.push('The checkout holds one commit, so Claude can\'t compare the branch with `main`. Give `actions/checkout` `fetch-depth: 0` under `with:`.');
  }

  const given = CREDENTIALS.filter((k) => step.inputs[k]);
  if (!given.length) out.push('The step passes no credential: add `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` under `with:`.');
  for (const k of given) {
    const v = step.inputs[k];
    if (!SECRET.test((v?.text ?? '').trim())) out.push(`\`${k}\` on line ${v?.line} isn't read from a secret: write \`${k}: \${{ secrets.ANTHROPIC_API_KEY }}\`, and keep the key itself out of the file.`);
  }
  const token = step.inputs.github_token;
  if (!token) out.push('The step passes no `github_token`, so the action asks for the Claude GitHub App, which this repository doesn\'t have. Add `github_token: ${{ github.token }}`, so Claude acts with this job\'s token and its `permissions`.');
  else if (!JOB_TOKEN.test((token.text ?? '').trim())) out.push(`\`github_token\` on line ${token.line} isn't this job's own token, so the job's \`permissions\` don't limit it. Write \`github_token: \${{ github.token }}\`.`);
  if ((step.inputs.display_report?.text ?? '').trim() !== 'true') out.push('Set `display_report: true`, so Claude\'s report shows on the run\'s page.');

  const prompt = (step.inputs.prompt?.text ?? '').trim();
  if (!prompt) out.push('The step has no `prompt`, so Claude waits for `@claude` in an issue and does nothing on this run. Give it its task.');
  else if (spec.review && !/^\/team-review\b/.test(prompt)) out.push('The prompt doesn\'t start with `/team-review`, so the team\'s skill doesn\'t run. Start it with `/team-review`.');
  else if (!spec.review && !/linkcheck/.test(prompt)) out.push('The prompt doesn\'t ask Claude to run the link checker: name `npm --prefix project run linkcheck -- samples` in it.');

  const args = step.inputs.claude_args;
  const { words, comment } = claudeArgWords(args?.text ?? '');
  if (comment && /--max-turns|--allowed-?tools/i.test(comment)) out.push('An unquoted `#` in `claude_args` starts a comment that runs to the end of the value, so the action never reads the flags after it. Move the comment to a line of its own.');
  const range = `a number from 1 to ${spec.turnsMax}`;
  /** @type {string | null | undefined} */
  let turns;
  for (let i = 0; i < words.length; i += 1) {
    const w = /** @type {string} */ (words[i]);
    if (w === '--max-turns') turns = words[i + 1] ?? null;
    else if (w.startsWith('--max-turns=')) out.push(`Write \`--max-turns <n>\` as two words, not ${code(w)}: the action reads a flag's value from the word after it.`);
  }
  if (turns === undefined && !words.some((w) => w.startsWith('--max-turns='))) out.push(`\`claude_args\` sets no \`--max-turns\`, so nothing caps the run: add \`--max-turns\` with ${range}.`);
  else if (turns === null) out.push(`\`--max-turns\` has no number after it: write ${range}.`);
  else if (turns !== undefined && (!/^\d+$/.test(turns) || Number(turns) < 1 || Number(turns) > spec.turnsMax)) out.push(`\`--max-turns ${turns}\` isn't ${range}.`);

  const tools = allowedRules(words);
  const count = (/** @type {string} */ t, /** @type {string} */ ch) => t.split(ch).length - 1;
  if (!tools.named) out.push('`claude_args` names no link-check command: add `--allowedTools "Bash(npm --prefix project run linkcheck *)"`.');
  else if (tools.rules.some((r) => count(r, '(') !== count(r, ')'))) out.push(`\`--allowedTools\` gets ${and(tools.values.slice(0, 3).map(code))} as separate words, because the action splits \`claude_args\` at spaces outside quotes. Put each rule in quotes.`);
  else {
    const broad = tools.rules.find(anyBash);
    if (broad) out.push(`\`--allowedTools\` lists ${code(broad)}, which lets Claude run any command. Allow only the commands it needs.`);
    const link = tools.rules.filter((r) => /^Bash\(/.test(r) && /linkcheck|src\/cli\.js/.test(r));
    if (!link.length) out.push('`--allowedTools` names no link-check command: allow `Bash(npm --prefix project run linkcheck *)`.');
    else if (!link.some((r) => /--prefix[ =]\.?\/?project\b|\bproject\/src\/cli\.js/.test(r))) out.push(`${code(/** @type {string} */ (link[0]))} runs at the repository's root, where the action starts Claude, and the root's package.json has no linkcheck script. Name the website's folder: \`Bash(npm --prefix project run linkcheck *)\`.`);
    if (spec.review && !tools.rules.some((r) => GIT_DIFF.test(r))) out.push('`--allowedTools` doesn\'t allow `Bash(git diff *)`, so Claude can\'t read the change it reviews.');
  }

  const p = step.permissions;
  if (!p) out.push('Neither the workflow nor its job sets `permissions`, so the job token can get write access. Add `permissions:` with `contents: read`.');
  else if (p.all === 'write-all') out.push(`\`permissions: write-all\` on line ${p.line} gives the job token write access to everything. Use \`contents: read\`.`);
  else {
    const writes = (p.scopes ?? []).filter((s) => s.level === 'write' && s.scope !== 'id-token');
    if (writes.length) out.push(`${and(writes.map((s) => code(`${s.scope}: write`)))} on line ${writes[0]?.line} gives the job token write access, and this job only reads. Make it \`read\`.`);
  }
  const timeouts = [step.stepTimeout, step.jobTimeout].filter((t) => t !== null);
  if (!timeouts.length) out.push(`The job sets no \`timeout-minutes\`, so only GitHub's default stops a run that hangs. Add \`timeout-minutes\` with a number from 1 to ${TIMEOUT_MAX}.`);
  for (const t of timeouts) {
    const v = (t?.text ?? '').trim();
    if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > TIMEOUT_MAX) out.push(`\`timeout-minutes: ${v}\` on line ${t?.line} isn't a number from 1 to ${TIMEOUT_MAX}.`);
  }

  if (spec.review) {
    const group = entryOf(doc, 'concurrency')?.value ?? entryOf(job, 'concurrency')?.value;
    const name = group?.type === 'scalar' ? group.text : scalar(entryOf(group, 'group')?.value);
    const cancel = group?.type === 'map' && scalar(entryOf(group, 'cancel-in-progress')?.value)?.trim() === 'true';
    if (!name?.trim() || !cancel) out.push('Add `concurrency` with a `group` and `cancel-in-progress: true`, so a new push cancels the older review instead of paying for both.');
  }
  return out;
}

/**
 * Why there is no committed version of `spec.path` at the root.
 * @param {Repo} repo
 * @param {Repo} root
 * @param {Spec} spec
 * @param {string} where The page step that says how to write it.
 */
function missing(repo, root, spec, where) {
  const name = fromProject(spec.path);
  if (root.exists(spec.path)) return `${code(name)} isn't committed: run \`git add ${name}\` and commit it.`;
  const inProject = repo.exists(spec.path) || newest(root, `${repo.prefix}${spec.path}`) !== null;
  if (inProject && repo.prefix) return `${code(spec.path)} is in the website's folder, \`project/\`, where GitHub never runs a workflow: it reads only the repository root's \`.github/workflows/\`. Ask Claude to move it up one folder, to ${code(name)}, and commit the move.`;
  return `There is no committed ${code(name)} at the repository's root. Ask Claude for it (${where}), then commit it.`;
}

/**
 * One workflow item's message: where, the first three problems, and a note
 * when the working copy has changes that aren't committed.
 * @param {Repo} root
 * @param {{ commit: string, text: string }} found
 * @param {string} path
 * @param {string[]} problems
 */
function report(root, found, path, problems) {
  const now = root.read(path);
  const inHead = fileAt(root, 'HEAD', path) === found.text;
  const where = inHead ? code(fromProject(path)) : `${code(fromProject(path))}, as committed in ${short(found.commit)},`;
  const more = problems.length > 3 ? ` And ${problems.length - 3} more: fix these and check again.` : '';
  const pending = inHead && now !== null && now.replace(/\s+$/, '') !== found.text ? ' Your copy has changes that aren\'t committed: if they fix this, commit them.' : '';
  return `${where}: ${problems.slice(0, 3).join(' ')}${more}${pending}`;
}

/**
 * A workflow item: the newest committed version of the spec's file meets it.
 * @param {Spec} spec
 * @param {string} text
 * @param {string} where
 * @returns {Item}
 */
function workflowItem(spec, text, where) {
  return {
    text,
    check(repo) {
      const root = rootOf(repo);
      if (!root) return 'This folder isn\'t in a git repository. Run the check in this lab\'s copy.';
      const found = newest(root, spec.path);
      if (!found) return missing(repo, root, spec, where);
      const problems = problemsOf(found.text, spec);
      return problems.length ? report(root, found, spec.path, problems) : true;
    },
  };
}

/** @type {WeakMap<Repo, Map<string, string | any[]>>} */
const asked = new WeakMap();

/**
 * gh's answer to `args`, run where the check runs, once per check.
 * @param {Repo} repo
 * @param {string[]} args
 * @returns {{ out: string } | { error: string }}
 */
function gh(repo, args) {
  try {
    return { out: execFileSync('gh', args, { cwd: repo.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    const e = /** @type {{ code?: string, stderr?: string | Buffer, message: string }} */ (error);
    if (e.code === 'ENOENT') return { error: 'gh isn\'t installed where the check runs' };
    return { error: String(e.stderr ?? '').trim().split('\n')[0] || e.message };
  }
}

/**
 * The runs GitHub lists for a workflow file, newest first, or why gh
 * couldn't list them. A workflow GitHub doesn't know yet has none.
 * @param {Repo} repo
 * @param {string} file
 * @returns {string | { databaseId: number, headSha: string, event: string, status: string, conclusion: string }[]}
 */
function runsOf(repo, file) {
  if (!asked.has(repo)) asked.set(repo, new Map());
  const cache = /** @type {Map<string, string | any[]>} */ (asked.get(repo));
  const key = `runs ${file}`;
  if (!cache.has(key)) {
    const r = gh(repo, ['run', 'list', '--workflow', file, '--json', RUN_FIELDS, '--limit', '100']);
    if ('error' in r) cache.set(key, /not found|could not find/i.test(r.error) ? [] : `gh couldn't list the runs of ${code(file)}: ${r.error}. Check \`gh auth status\` where the check runs.`);
    else {
      try {
        const value = JSON.parse(r.out);
        cache.set(key, Array.isArray(value) ? value : `gh listed the runs of ${code(file)} in a shape the check can't read.`);
      } catch {
        cache.set(key, `gh couldn't list the runs of ${code(file)} as JSON.`);
      }
    }
  }
  return /** @type {any} */ (cache.get(key));
}

/**
 * The repository's secret names, or why gh couldn't list them.
 * @param {Repo} repo
 * @returns {string | string[]}
 */
function secretsOf(repo) {
  const r = gh(repo, ['secret', 'list']);
  if ('error' in r) return `gh couldn't list the repository's secrets: ${r.error}. Check \`gh auth status\` where the check runs.`;
  return r.out.split('\n').map((line) => line.split('\t')[0]?.trim() ?? '').filter(Boolean);
}

const done = (/** @type {{ status: string, conclusion: string }} */ r) => r.status === 'completed' && r.conclusion === 'success';

/**
 * The newest merge GitHub made into `ref`: its commit and the pull
 * request's head at the merge (the merge's second parent), or null.
 * @param {Repo} root
 * @param {string} ref
 */
function lastMerge(root, ref) {
  let out = '';
  try {
    out = root.gitLocal('log', '--merges', '--format=%H %P%x09%cn%x09%s', ref);
  } catch {
    return null;
  }
  for (const line of out.split('\n')) {
    const [ids = '', who, subject = ''] = line.split('\t');
    const [commit, , head] = ids.split(' ');
    if (who === 'GitHub' && /^Merge pull request #\d+/.test(subject) && commit && head) return { commit, head };
  }
  return null;
}

/**
 * The pull request's head the review items judge: the branch's latest
 * commit while you're on it, else the head GitHub merged into `main`.
 * @param {Repo} root
 * @returns {{ sha: string, merged: boolean } | null}
 */
function pullHead(root) {
  let branch = '';
  try {
    branch = root.git('rev-parse', '--abbrev-ref', 'HEAD');
  } catch {
    return null;
  }
  if (branch && branch !== 'main' && branch !== 'HEAD') return { sha: root.git('rev-parse', 'HEAD'), merged: false };
  const merge = lastMerge(root, 'refs/heads/main');
  return merge ? { sha: merge.head, merged: true } : null;
}

/**
 * The first line of the July page that says it is step-free and doesn't
 * hedge it, 1-based, with its text; null when there is none.
 * @param {string} text
 */
function stepFreeClaim(text) {
  const lines = text.split('\n');
  const n = lines.findIndex((line) => STEP_FREE.test(line) && !HEDGE.test(line));
  return n === -1 ? null : { line: n + 1, text: /** @type {string} */ (lines[n]).trim() };
}

/** @type {Item} */
const manualWorkflow = workflowItem(
  MANUAL_SPEC,
  "the repository root's `.github/workflows/linkcheck-report.yml` is committed: it starts only by hand, checks out the repository and sets up Node.js before a pinned `anthropics/claude-code-action`, reads its credential from a secret, shows Claude's report, and keeps its limits in the file",
  'Worked example step 1',
);

/** @type {Item} */
const manualRun = {
  text: 'GitHub ran it by hand to success on the newest commit that changed it',
  check(repo) {
    const root = rootOf(repo);
    const found = root && newest(root, MANUAL);
    if (!found) return 'There is no committed `linkcheck-report.yml` yet, so GitHub has no run of it to read. Commit and push it first, as the item above says.';
    const runs = runsOf(repo, 'linkcheck-report.yml');
    if (typeof runs === 'string') return runs;
    const manual = runs.filter((r) => r.event === 'workflow_dispatch');
    if (manual.some((r) => r.headSha === found.commit && done(r))) return true;
    const latest = manual.find((r) => r.headSha === found.commit);
    if (latest?.status && latest.status !== 'completed') return `Run ${latest.databaseId} on ${short(found.commit)} is still ${latest.status.replace('_', ' ')}: follow it with \`gh run watch ${latest.databaseId}\`, then check again.`;
    if (latest) return `Run ${latest.databaseId} on ${short(found.commit)} ended with \`${latest.conclusion}\`. \`gh run view ${latest.databaseId} --log-failed\` says why: fix that, then start it again with \`gh workflow run linkcheck-report.yml\` (Worked example step 3).`;
    const green = manual.find(done);
    if (green) return `Run ${green.databaseId} passed on ${short(green.headSha)}, but the newest commit that changed the workflow is ${short(found.commit)}, so that run judged another version. Push it if you haven't, start it with \`gh workflow run linkcheck-report.yml\` and follow it to the end (Worked example step 3).`;
    const other = manual[0];
    if (other) return `Run ${other.databaseId} on ${short(other.headSha)} ended with \`${other.conclusion || other.status}\`, and no run is on ${short(found.commit)}, the newest commit that changed the workflow. Push it, then start it with \`gh workflow run linkcheck-report.yml\`.`;
    return 'GitHub has no run of `linkcheck-report.yml` started by hand yet. Push the workflow to `main`, start it with `gh workflow run linkcheck-report.yml` and follow it with `gh run watch` (Worked example step 2).';
  },
};

/** @type {Item} */
const reviewWorkflow = workflowItem(
  REVIEW_SPEC,
  "the root's `.github/workflows/claude-review.yml` is committed: it reviews each pull request with `/team-review`, can read the change, cancels an older review on a new push, and keeps the same limits",
  'Your turn step 1',
);

/** @type {Item} */
const skillOnMain = {
  text: '`.claude/skills/team-review/SKILL.md` is on GitHub\'s `main`',
  check(repo) {
    const root = rootOf(repo);
    if (!root) return 'This folder isn\'t in a git repository. Run the check in this lab\'s copy.';
    const holds = (/** @type {string} */ ref) => fileAt(root, ref, SKILL) !== null;
    if (holds('refs/remotes/origin/main')) return true;
    if (holds('refs/heads/main')) return `${code(fromProject(SKILL))} is committed on \`main\`, but that commit isn't pushed, and the action reads GitHub's \`main\`. Run \`git push\` on \`main\` (Your turn step 3).`;
    if (holds('HEAD')) {
      let branch = 'your branch';
      try {
        branch = code(root.git('rev-parse', '--abbrev-ref', 'HEAD'));
      } catch {
        // Keep the plain words.
      }
      return `${code(fromProject(SKILL))} is only on ${branch}: the action loads \`.claude/\` from the pull request's base branch, \`main\`, so commit the skill alone on \`main\` and push it (Your turn step 3).`;
    }
    return `There is no ${code(fromProject(SKILL))} on \`main\`. Copy it from \`practice/a-5/team-review/\`, commit it on \`main\` and push it (Your turn step 3).`;
  },
};

/** @type {Item} */
const reviewedHead = {
  text: "the pull request's latest commit has a green review that could read the change, and nothing the review named is left in it",
  check(repo) {
    const root = rootOf(repo);
    if (!root) return 'This folder isn\'t in a git repository. Run the check in this lab\'s copy.';
    const pull = pullHead(root);
    if (!pull) return 'Your copy is on `main`, and GitHub hasn\'t merged a pull request into it yet, so there\'s no pull request for the check to read: switch to your branch, `git switch july-page`, and check again.';
    const runs = runsOf(repo, 'claude-review.yml');
    if (typeof runs === 'string') return runs;
    const reviews = runs.filter((r) => r.event === 'pull_request');
    const mine = reviews.filter((r) => r.headSha === pull.sha);
    const green = mine.find(done);
    if (!green) {
      const latest = mine[0];
      if (latest?.status && latest.status !== 'completed') return `The review of ${short(pull.sha)}, run ${latest.databaseId}, is still ${latest.status.replace('_', ' ')}: follow it with \`gh run watch ${latest.databaseId}\`, then check again.`;
      if (latest?.conclusion === 'cancelled') return `The review of ${short(pull.sha)}, run ${latest.databaseId}, was cancelled: a newer push started another review. Follow the newest one, then check again.`;
      if (latest) return `The review of ${short(pull.sha)}, run ${latest.databaseId}, ended with \`${latest.conclusion}\`. \`gh run view ${latest.databaseId} --log-failed\` says why.`;
      const passed = reviews.find(done);
      if (passed) return `Run ${passed.databaseId} passed on ${short(passed.headSha)}, but the pull request's latest commit is ${short(pull.sha)}. Push it if you haven't, and wait for its review with \`gh run watch\` (Your turn step 3).`;
      return `${short(pull.sha)}, the pull request's latest commit, has no review run. Push the branch and open the pull request: \`gh pr create --fill\` (Your turn step 2).`;
    }
    const workflow = fileAt(root, pull.sha, REVIEW);
    const blind = workflow === null ? `has no ${code(REVIEW)}` : blindness(workflow);
    if (blind) return `Run ${green.databaseId} is green on ${short(pull.sha)}, but the review workflow at that commit ${blind}, so the review couldn't read the change, and its report says nothing about it. Fix the workflow on the branch, push, and wait for the new review.`;
    const july = fileAt(root, pull.sha, JULY);
    const claim = july === null ? null : stepFreeClaim(july);
    if (claim && pull.merged) return `GitHub merged the pull request with \`samples/july.md\` line ${claim.line} still saying it is step-free, and nothing in the repository supports that. Fix it in a new pull request: start a branch from \`main\`, ask Claude to fix the access line, push the branch, open the pull request, and merge it once its review is green (Your turn step 4).`;
    if (claim) return `The review of ${short(pull.sha)} names \`samples/july.md\` line ${claim.line}, which says it is step-free, and nothing in the repository supports that. Ask Claude to fix the access line on the branch and push it, then follow the new review to the end and check again (Your turn step 4).`;
    return true;
  },
};

/** @type {Item} */
const merged = {
  text: "GitHub merged the pull request into `main` at the commit its review passed, and your copy's `main` has the merge",
  check(repo) {
    const root = rootOf(repo);
    if (!root) return 'This folder isn\'t in a git repository. Run the check in this lab\'s copy.';
    const merge = lastMerge(root, 'refs/heads/main');
    if (!merge) {
      if (lastMerge(root, 'refs/remotes/origin/main')) return 'GitHub merged it, but your copy\'s `main` doesn\'t have the merge yet: run `git switch main`, then `git pull`.';
      return 'The pull request isn\'t merged yet. Once the review of its latest commit is green, merge it on its page, then run `git switch main` and `git pull` (Your turn step 4).';
    }
    const runs = runsOf(repo, 'claude-review.yml');
    if (typeof runs === 'string') return runs;
    if (!runs.some((r) => r.event === 'pull_request' && r.headSha === merge.head && done(r))) return `GitHub merged at ${short(merge.head)}, which has no green review. Merge only once the review of the branch's latest commit is green (Your turn step 4).`;
    return true;
  },
};

/** @type {Item} */
const tornDown = {
  text: 'the workflows are gone from `main`, the repository holds no `ANTHROPIC_API_KEY` secret, and no Claude key is in the history',
  check(repo) {
    const root = rootOf(repo);
    if (!root) return 'This folder isn\'t in a git repository. Run the check in this lab\'s copy.';
    const running = (/** @type {string} */ ref) => {
      try {
        return claudeWorkflowsAt(root, root.gitLocal('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)).map((f) => fromProject(f.path));
      } catch {
        return [];
      }
    };
    const here = running('HEAD');
    if (here.length) return `${and(here.map(code))} still runs \`anthropics/claude-code-action\`. Remove ${here.length > 1 ? 'them' : 'it'} with \`git rm\`, commit and push (Your turn step 5).`;
    if (running('refs/remotes/origin/main').length) return 'The workflows are gone from your copy, but the removals aren\'t pushed, so GitHub\'s `main` still runs them. Run `git push` (Your turn step 5).';
    const secrets = secretsOf(repo);
    if (typeof secrets === 'string') return secrets;
    const held = secrets.filter((s) => SECRET_NAMES.includes(s.toUpperCase()));
    if (held.length) return `The repository still holds the ${code(/** @type {string} */ (held[0]))} secret. Delete it with \`gh secret delete ${held[0]}\`, then delete the key it held on the Claude Console (Your turn step 5).`;
    /** @type {string[]} */
    let commits = [];
    try {
      commits = root.gitLocal('log', '--full-history', '--format=%H', '--', '.github/workflows').split('\n').filter(Boolean);
    } catch {
      // No commits yet.
    }
    for (const commit of commits) {
      for (const f of claudeWorkflowsAt(root, commit)) {
        if (KEY.test(f.text)) return `Commit ${short(commit)} holds what looks like a Claude API key in ${code(fromProject(f.path))}. Treat it as leaked and delete it on the Claude Console now: removing it from the file leaves it in the history.`;
      }
    }
    return true;
  },
};

/** @type {Item[]} */
export const items = [manualWorkflow, manualRun, reviewWorkflow, skillOnMain, reviewedHead, merged, tornDown];

// The exports the guide's a-capstone check imports. A file option names a
// path from the git root, as GitHub reads it.

/** @param {Repo} repo */
export function originRepo(repo) {
  try {
    const m = repo.git('remote', 'get-url', 'origin').match(GITHUB_REMOTE);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ triggers?: string[], file?: string }} o
 * @returns {Spec}
 */
const specOf = (o) => {
  const triggers = o.triggers ?? ['pull_request'];
  const review = triggers.includes('pull_request');
  return { ...(review ? REVIEW_SPEC : MANUAL_SPEC), path: o.file ?? (review ? REVIEW : MANUAL), triggers };
};

/**
 * The newest committed version of the workflow on `triggers`, with what is
 * wrong with it, or null.
 * @param {Repo} repo
 * @param {string[]} triggers
 * @param {{ file?: string }} [options]
 */
export function chosenWorkflow(repo, triggers, options = {}) {
  const root = rootOf(repo);
  const spec = specOf({ ...options, triggers });
  const found = root && newest(root, spec.path);
  if (!found) return null;
  const step = readWorkflow(found.text).steps[0];
  if (!step) return null;
  return { file: { commit: found.commit, path: spec.path, text: found.text, steps: [step] }, step, setup: [], limits: problemsOf(found.text, spec) };
}

/**
 * Both workflow parts as one item, on `options.triggers`.
 * @param {{ triggers?: string[], file?: string, guide?: string }} [options]
 * @returns {Item}
 */
export function boundedWorkflow(options = {}) {
  const spec = specOf(options);
  return workflowItem(spec, `a committed workflow runs \`anthropics/claude-code-action\` on ${and(spec.triggers.map(code))}, with every limit in the file`, options.guide ?? 'the page');
}
