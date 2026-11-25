// @ts-check
// Connect an outside tool when it earns its place (Fix-It, Intermediate
// lesson 5). The check reads fixit/.mcp.json, the project's shared server
// list, for the bookings server pinned to an exact version and started
// read-only; the shared settings, for the cancel tool denied and no rule
// that allows every tool the server may ever offer; the attendee-guide
// skill, for a step that looks the booking up before the fact table and
// says what to do when the connection is down; and the March fact table,
// for the open item the down run leaves. Which tools the session called is
// the host's to record (a record no Check reads yet), so the calls
// themselves are a self-check on the card.
import { frontmatter } from '../frontmatter.mjs';
import { claims, quote } from './fixit-claims.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Connect an outside tool when it earns its place';

export const MCP = 'fixit/.mcp.json';
export const SHARED = 'fixit/.claude/settings.json';
export const LOCAL = 'fixit/.claude/settings.local.json';
export const SKILL = 'fixit/.claude/skills/attendee-guide/SKILL.md';
export const FACTS = 'fixit/march/facts.md';
export const GUIDE = 'fixit/march/attendee-guide.md';
const PACKAGE = 'fixers-bookings-mcp';
const CANCEL = 'mcp__bookings__cancel_booking';

/**
 * A JSON file's parsed value, null when there is none, or the hint for a
 * file that isn't JSON.
 * @param {Repo} repo
 * @param {string} path
 * @returns {{ value: any } | { error: string }}
 */
function json(repo, path) {
  const text = repo.read(path);
  if (text === null) return { value: null };
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `\`${path}\` isn't valid JSON (${/** @type {Error} */ (error).message}). Fix it in the files tab, or ask Claude to.` };
  }
}

// The package a stdio server runs through npx: its first argument that
// isn't an option, as Claude Code's own `npx -y <package>` entries name it.
/** @param {unknown} args */
const packageArg = (args) => (Array.isArray(args) ? args.find((a) => typeof a === 'string' && !a.startsWith('-')) : undefined);

/** @type {Item} */
export const server = {
  text: '`fixit/.mcp.json` adds the `bookings` server at an exact version of `fixers-bookings-mcp`, started with `--read-only`',
  check(repo) {
    const read = json(repo, MCP);
    if ('error' in read) return read.error;
    if (read.value === null) {
      if (repo.exists('.mcp.json')) return "`.mcp.json` is in the practice copy's top folder, not in `fixit/`, where the kit's sessions start. Add the server again from `fixit/`, and remove the other one.";
      return "There's no `fixit/.mcp.json` yet. A server added without `--scope project` is yours alone and isn't part of the kit: add it at project scope, from `fixit/`.";
    }
    const entry = read.value?.mcpServers?.bookings;
    if (!entry || typeof entry !== 'object') return '`fixit/.mcp.json` has no `bookings` server. Name it `bookings`, as the settings rules and the skill do.';
    const args = Array.isArray(entry.args) ? entry.args : [];
    const spec = packageArg(args);
    if (typeof spec !== 'string' || !(spec === PACKAGE || spec.startsWith(`${PACKAGE}@`))) return `The \`bookings\` server doesn't run \`${PACKAGE}\`, the library's connector that the library's IT team tested.`;
    if (!new RegExp(`^${PACKAGE}@\\d+\\.\\d+\\.\\d+$`).test(spec)) return `The package isn't pinned: \`${spec}\`. Everyone would run whatever version was published last. Name the exact version you reviewed, such as \`@1.4.2\`.`;
    if (!args.includes('--read-only')) return "The server runs without `--read-only`, so it offers `cancel_booking` too. Start it read-only.";
    return true;
  },
};

/** @param {any} value @param {'allow' | 'ask' | 'deny'} list @returns {string[]} */
const rules = (value, list) => {
  const xs = value?.permissions?.[list];
  return Array.isArray(xs) ? xs.filter((r) => typeof r === 'string').map((r) => r.trim()) : [];
};
// A rule that covers every tool of the bookings server: the server's name
// alone, or with a wildcard for its tool.
/** @param {string} rule */
const everyTool = (rule) => rule === 'mcp__bookings' || /^mcp__bookings__\*$/.test(rule);
/** @param {string} rule */
const coversCancel = (rule) => rule === CANCEL || everyTool(rule);

/** @type {Item} */
export const limits = {
  text: '`fixit/.claude/settings.json` denies `mcp__bookings__cancel_booking`, and no rule allows every bookings tool',
  check(repo) {
    const read = json(repo, SHARED);
    if ('error' in read) return read.error;
    if (read.value === null) return "There's no `fixit/.claude/settings.json`. It's the kit's shared settings: put it back from your practice copy, then deny the cancel tool there.";
    const s = read.value;
    const allowAll = rules(s, 'allow').find(everyTool);
    if (allowAll) return `\`${allowAll}\` in \`allow\` lets every tool the server offers run without asking, now or later, including one that cancels bookings. Allow the two reading tools by name.`;
    if (rules(s, 'allow').includes(CANCEL)) return '`mcp__bookings__cancel_booking` is in `allow`, so Claude could cancel a booking without asking. Deny it.';
    const denyAll = rules(s, 'deny').find(everyTool);
    if (denyAll) return `\`${denyAll}\` in \`deny\` blocks every bookings tool, so the guide can't look the booking up either. Deny \`${CANCEL}\` by name.`;
    if (!rules(s, 'deny').some(coversCancel)) {
      const local = json(repo, LOCAL);
      if ('value' in local && rules(local.value, 'deny').some(coversCancel)) return "The cancel rule is in your local settings, `settings.local.json`, which is yours alone: Sam's sessions could still cancel. Put it in the shared `.claude/settings.json`.";
      if (rules(s, 'ask').includes(CANCEL)) return "`mcp__bookings__cancel_booking` is set to ask, not deny: one wrong yes cancels a booking. Deny it outright.";
      return "The shared settings don't deny `mcp__bookings__cancel_booking`. `--read-only` hides it today, but a later version, or someone removing the flag, could bring it back.";
    }
    if (!rules(s, 'deny').includes('Read(./**/private/**)')) return 'The shared settings no longer keep Claude out of the `private/` folders. Keep the rules the kit had, and add the bookings ones beside them.';
    return true;
  },
};

// The skill's numbered steps, each with its continuation lines.
/** @param {string} body */
export function stepsOf(body) {
  /** @type {{ n: number, text: string }[]} */
  const out = [];
  let open = false;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const last = out.at(-1);
    if (m) out.push({ n: Number(m[1]), text: /** @type {string} */ (m[2]) });
    else if (last && open && line.trim() && !/^\s*#/.test(line)) last.text += ` ${line.trim()}`;
    open = Boolean(m) || (open && line.trim() !== '');
  }
  return out;
}
const BOOKINGS = /\bbookings\b|\bget_booking\b/i;
const DOWN = /\b(?:not available|unavailable|isn['’]?t available|is not available|isn['’]?t (?:there|connected|responding|working)|not connected|not responding|is down|goes down|it['’]?s down|down\b|fails?|failed|can['’]?t (?:connect|reach|be reached|use it)|cannot (?:connect|reach))/i;
const FROM_FILES = /\b(?:continue|carry on|go on|keep going|work|make it|make the guide|build it|use)\b[^.;]*\b(?:files?|folder|sources?)\b|\bfrom the files\b|\bfiles alone\b|\bfiles only\b/i;
const SAY_SO = /\bsay so\b|\bsays? (?:that|it)\b|\btell\b|\breport\b|\bmention\b|\bopen item\b|\bnot re-?checked\b|\bnote (?:that|it)\b/i;
const FLYER = /\bflyers?\b/i;
// A flyer the step refuses, the negation governing the flyer itself: "If
// not, use the flyer" negates the connection, not the flyer.
const NOT_FLYER = /\b(?:never|don['’]?t|do not|not|no|without|except|rather than|instead of)\s+(?:(?:use|using|rely on|relying on|take|taking|fall back on|falling back on|fill (?:anything )?in from|from|on|the|an?|old|october)\s+)*flyers?\b/i;
const TABLE = /\bfacts\.md\b|\bfact table\b/i;

/** @type {Item} */
export const procedure = {
  text: "the attendee-guide skill looks the booking up through the `bookings` connection before it builds the fact table, and says what to do when the connection is down: carry on from the files and say so, never from a flyer",
  check(repo) {
    const text = repo.read(SKILL);
    if (text === null) return `There's no \`${SKILL}\`. It's the kit's skill: put it back from your practice copy, then add the bookings lookup to it.`;
    const steps = stepsOf(frontmatter(text)?.body ?? text);
    const step = steps.find((s) => BOOKINGS.test(s.text));
    if (!step) return "None of the skill's steps names the `bookings` connection, so Sam's sessions never look up the live booking. Add it to the step that reads the sources.";
    const table = steps.find((s) => s !== step && TABLE.test(s.text) && !BOOKINGS.test(s.text));
    if (table && table.n < step.n) return `Step ${step.n} looks the booking up after step ${table.n} builds the fact table, so the table never sees it. Look it up in the step that reads the sources.`;
    if (FLYER.test(step.text) && !NOT_FLYER.test(step.text)) return `Step ${step.n} falls back on the flyer: "${quote(step.text)}". The flyer is the least reliable source for room and access. When the connection is down, keep the booking's values and say they weren't re-checked.`;
    if (!DOWN.test(step.text)) return `Step ${step.n} looks the booking up, but doesn't say what to do when the connection is down. Add: if it isn't available, say so and carry on from the files.`;
    if (!FROM_FILES.test(step.text)) return `Step ${step.n} says what happens when the connection is down, but not where the facts come from then. Carry on from the files.`;
    if (!SAY_SO.test(step.text)) return `Step ${step.n} carries on from the files when the connection is down, but doesn't say so. Add: say so, and add an open item.`;
    return true;
  },
};

// The fact table's claims: each table row and each paragraph, so an open
// item written after the table counts as well as one in its Open column.
/** @param {string} text */
const factLines = (text) => claims(text.replace(/\r?\n/g, '\n\n'));
const LIVE = /\b(?:bookings? (?:connection|server|system|record)|live booking|library['’]?s (?:booking )?(?:record|system)|connection|get_booking)\b/i;
const NOT_RECHECKED = /\bnot re-?checked\b|\b(?:wasn['’]?t|was not|couldn['’]?t|could not|weren['’]?t|were not|can['’]?t|cannot|unable to|didn['’]?t|did not)\b[^.;|]*\b(?:re-?check(?:ed)?|check(?:ed)?|confirm(?:ed)?|verif(?:y|ied)|look(?:ed)? (?:it )?up)\b|\b(?:was|is|went) down\b|\bunavailable\b|\bnot available\b|\bwasn['’]?t available\b/i;
const RECHECKED = /\bre-?checked\b|\bchecked (?:today|again|live)\b|\bconfirmed (?:today|live)\b/i;
const TEN_AM = /\b10(?:[:.]00)?\s?am\b/i;
const TURN_UP = /\bjust turn up\b/i;

/** @type {Item} */
export const downRun = {
  text: "`fixit/march/facts.md` has an open item saying the live booking wasn't re-checked, and the March guide keeps the booking's values",
  check(repo) {
    const facts = repo.read(FACTS);
    if (facts === null) return `There's no \`${FACTS}\`. It's the fact table the skill keeps for March: put it back from your practice copy, then run the skill on March again.`;
    const guide = repo.read(GUIDE);
    if (guide !== null) {
      const flyer = factLines(guide).find((c) => TEN_AM.test(c) || TURN_UP.test(c));
      if (flyer) return `The March guide now says "${quote(flyer)}". That's the flyer's, the least reliable source for times and booking. Keep the booking's values, and mark them as not re-checked.`;
    }
    const lines = factLines(facts);
    const open = lines.find((c) => LIVE.test(c) && NOT_RECHECKED.test(c));
    if (open) return true;
    const claimed = lines.find((c) => LIVE.test(c) && RECHECKED.test(c));
    if (claimed) return `\`${FACTS}\` says "${quote(claimed)}", but the connection was down, so nothing was re-checked. Say what you couldn't check.`;
    return `\`${FACTS}\` has no open item saying the live booking wasn't re-checked. With the connection down, the fact table should say so, so Maya knows what wasn't checked.`;
  },
};

/** @type {Item[]} */
export const items = [server, limits, procedure, downRun];
