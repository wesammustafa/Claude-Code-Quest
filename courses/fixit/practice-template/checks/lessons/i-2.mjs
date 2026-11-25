// @ts-check
// Decide what Claude should remember (Fix-It, Intermediate lesson 1). The
// check reads the project memory the Learner keeps in fixit/CLAUDE.md, by
// what its lines say rather than their exact words; Claude's auto memory
// for this copy; the scoped rules in fixit/.claude/rules/; and the access
// note a fresh session wrote from memory. When that session started is the
// host's to record (a session-start record no Check reads yet), so the
// note's content is all this check reads of it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { frontmatter } from '../frontmatter.mjs';
import { claims, quote } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Decide what Claude should remember';

export const PROJECT = 'fixit';
export const MEMORY = 'fixit/CLAUDE.md';
export const RULES = 'fixit/.claude/rules';
export const NOTE = 'fixit/march/access-note.md';

// Claude Code's auto memory folder for a repository: its root's path with
// every character but a letter or digit made `-`.
/** @param {string} root */
export const projectName = (root) => root.replace(/\\/g, '/').replace(/[^A-Za-z0-9]/g, '-');

// This copy's auto memory index, `~/.claude/projects/<project>/memory/MEMORY.md`.
// A copy that was moved keeps the folder named after where it was, so when
// no folder has this root's name, the longest name its own ends with counts.
/** @param {Repo} repo */
export function autoMemory(repo) {
  const projects = join(homedir(), '.claude', 'projects');
  let names;
  try {
    names = readdirSync(projects).filter((n) => n.startsWith('-') && statSync(join(projects, n)).isDirectory());
  } catch {
    return null;
  }
  let want;
  try {
    want = projectName(repo.top);
  } catch {
    return null;
  }
  const name = names.includes(want) ? want : names.filter((n) => want.endsWith(n)).sort((a, b) => b.length - a.length)[0];
  if (!name) return null;
  const path = join(projects, name, 'memory', 'MEMORY.md');
  try {
    return { path, text: readFileSync(path, 'utf8') };
  } catch {
    return null;
  }
}

// A file's lines, numbered from 1, and its blocks: runs of lines with no
// blank line between them, so a numbered list or a section reads as one.
/** @param {string} text */
function linesOf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((line, i) => ({ n: i + 1, line }));
}
/** @param {{ n: number, line: string }[]} lines */
function blocksOf(lines) {
  /** @type {{ n: number, line: string }[][]} */
  const blocks = [];
  let run = [];
  for (const l of lines) {
    if (l.line.trim()) {
      run.push(l);
      continue;
    }
    if (run.length) blocks.push(run);
    run = [];
  }
  if (run.length) blocks.push(run);
  return blocks.map((b) => ({ n: b[0]?.n ?? 1, line: b.map((l) => l.line).join('\n') }));
}
const shown = (/** @type {string} */ line) => quote(line.replace(/\*\*/g, ''));

// Which source wins: the venue's written word, then the group's notes, then
// old flyers and listings.
const VENUE = /\b(?:bookings?|confirmations?|confirmed in writing|signed|venue)\b/i;
const NOTES = /\bnotes?\b|\bminutes\b/i;
const FLYERS = /\b(?:flyers?|newsletters?|listings?|posters?)\b/i;
const FAMILIES = /** @type {const} */ ([
  ['venue', VENUE, "the venue's written confirmation"],
  ['notes', NOTES, 'our notes'],
  ['flyers', FLYERS, 'old flyers'],
]);

// Where `text` names each family first, in the order it names them; null
// unless it names all three. The first family out of place is `wrong`,
// named where it should come `instead`, at offset `at` in the text.
/** @param {string} text */
function order(text) {
  const found = FAMILIES.map(([, re, words]) => ({ at: text.search(re), words }));
  if (found.some((f) => f.at < 0)) return null;
  const sorted = [...found].sort((a, b) => a.at - b.at);
  const k = sorted.findIndex((f, i) => f !== found[i]);
  if (k < 0) return { right: true };
  const wrong = /** @type {{ at: number, words: string }} */ (sorted[k]);
  return { right: false, at: wrong.at, wrong: wrong.words, instead: /** @type {{ words: string }} */ (found[k]).words };
}

// How to publish what nobody has confirmed, with someone to call.
const OPEN_RULE = /\b(?:being confirmed|to be confirmed|unconfirmed|not (?:yet )?confirmed|tbc|needs? confirming|can['’]t (?:be )?confirm(?:ed)?)\b/i;
const CONTACT = /\b(?:numbers?|phone|call|contact|desk)\b|\b555[- .]?01\d\d\b/i;

// Private numbers stay off public pages; enquiries go to the venue's number.
const PRIVATE = /\b(?:private|personal|priya['’]s|rosters?|mobiles?|volunteers['’]? numbers?)\b/i;
const NUMBER = /\b(?:numbers?|phones?|mobiles?|contacts?)\b/i;
const KEEP = /\b(?:never|not|don['’]t|no|only|off)\b/i;
const PUBLIC = /\bpublic\b/i;
const VENUE_NUMBER = /\b(?:venue|library|centre|center)['’]?s?\b[^\n]*\b(?:number|phone|desk)\b|\bpublic (?:number|enquir(?:y|ies)|contact)/i;

const LIMIT = 60;

/** @type {Item} */
export const memoryRules = {
  text: '`fixit/CLAUDE.md` is short and gives the rules that hold every month: which source wins, how to publish an unconfirmed detail, and whose number goes on a public page',
  check(repo) {
    const text = repo.read(MEMORY);
    if (text === null) return `There's no \`${MEMORY}\` yet. Ask Claude to save the project memory: the source order, the rule for unconfirmed details, the rule for private numbers, and the house style.`;
    const lines = linesOf(text);
    if (lines.length >= LIMIT) return `\`${MEMORY}\` has ${lines.length} lines. Every line costs attention in every session: keep it under ${LIMIT}, and cut what Claude can find by looking.`;
    const candidates = [...lines, ...blocksOf(lines)];
    const ranked = candidates.map((c) => ({ c, o: order(c.line) })).filter((x) => x.o);
    if (!ranked.length) return `\`${MEMORY}\` doesn't say which source wins. Add the order: the venue's written confirmation, then our notes, then old flyers.`;
    if (!ranked.some((x) => x.o?.right)) {
      const [{ c, o }] = /** @type {[{ c: { n: number, line: string }, o: { at: number, wrong: string, instead: string } }]} */ (ranked);
      const before = c.line.slice(0, o.at).split('\n');
      const line = c.line.split('\n')[before.length - 1] ?? '';
      return `\`${MEMORY}\` line ${c.n + before.length - 1} puts ${o.wrong} above ${o.instead}: "${shown(line)}". The venue's written confirmation wins over our notes, and our notes over old flyers.`;
    }
    const open = candidates.filter((c) => OPEN_RULE.test(c.line));
    if (!open.length) return `\`${MEMORY}\` doesn't say how to publish a detail nobody has confirmed. Add the March decision: say it's being confirmed, and give the venue's public number.`;
    if (!open.some((c) => CONTACT.test(c.line))) {
      const [first] = /** @type {[{ n: number, line: string }]} */ (open);
      return `\`${MEMORY}\` line ${first.n} says how to mark an unconfirmed detail, but not who to call: "${shown(first.line.split('\n')[0] ?? '')}". Add the venue's public number.`;
    }
    const privacy = candidates.some((c) => PRIVATE.test(c.line) && NUMBER.test(c.line) && KEEP.test(c.line) && PUBLIC.test(c.line));
    if (!privacy || !VENUE_NUMBER.test(text)) return `\`${MEMORY}\` has no rule that keeps private numbers off public pages. Add one: Priya's number, and anything from a \`private/\` folder or a roster, never goes on a public page; public enquiries go to the venue's public number.`;
    return true;
  },
};

// What changes by month or venue: dates, hours, room limits, people's
// numbers, and a tour of the folders Claude can see for itself.
const DATE = /\b2027\b|\b\d{1,2}(?:st|nd|rd|th)? (?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i;
const DATE_STYLE = /\bdates?\b[^\n]*\b(?:as|like)\b/i;
const HOURS = /\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*(?:to|-|–|until)\s*\d{1,2}(?:[:.]\d{2})\s*(?:am|pm)?\b/i;
export const ROOM_LIMIT = /\b\d+\s*(?:people|persons|places|seats|visitors|sign-?ups|max(?:imum)?)\b|\b(?:holds|capacity(?: of| is)?|limit(?:ed)?(?: of| to| is)?|max(?:imum)?(?: of)?|up to)\s*\d+\b/i;
const PHONE = /\b555[- .]?01\d\d\b/g;
const PUBLIC_NUMBERS = ['5550100', '5550130'];
const FOLDER = /(?:^|[\s`(])(?:sources|feb|march|april|summer|kit|exemplars|public|private)\/(?=[\s`),.:]|$)|\bthis folder (?:has|holds|contains|is)\b/i;
const RULE_WORD = /\b(?:never|don['’]t|do not|always|must|only|use|read|prefer|treat|keep|put|publish|give|check|ask|say)\b/i;
const TOUR = 3;

/** @type {Item} */
export const noEventFacts = {
  text: '`fixit/CLAUDE.md` holds no event facts: no dates, hours, room limits, personal numbers or folder tour',
  check(repo) {
    const text = repo.read(MEMORY);
    if (text === null) return `There's no \`${MEMORY}\` yet. Ask Claude to save the project memory.`;
    const lines = linesOf(text).filter((l) => l.line.trim() && !/^\s*#/.test(l.line));
    const at = (/** @type {{ n: number, line: string }} */ l) => `\`${MEMORY}\` line ${l.n}`;
    for (const l of lines) {
      const other = [...l.line.matchAll(PHONE)].map((m) => m[0]).find((n) => !PUBLIC_NUMBERS.includes(n.replace(/\D/g, '')));
      if (other) return `${at(l)} gives ${other}: "${shown(l.line)}". Memory a session reads is memory it can repeat: keep the rule, not the number.`;
      if (ROOM_LIMIT.test(l.line)) return `${at(l)} holds a room limit: "${shown(l.line)}". Facts like this come from the month's sources.`;
      if (DATE.test(l.line) && !DATE_STYLE.test(l.line)) return `${at(l)} holds a date: "${shown(l.line)}". Dates change every month: they come from that month's sources.`;
      if (HOURS.test(l.line)) return `${at(l)} holds a session's hours: "${shown(l.line)}". Hours change by venue: they come from that month's sources.`;
    }
    const tour = lines.filter((l) => FOLDER.test(l.line) && !RULE_WORD.test(l.line));
    if (tour.length > TOUR) {
      const [first] = /** @type {[{ n: number, line: string }]} */ (tour);
      return `${at(first)} starts a tour of the folders, ${tour.length} lines long: "${shown(first.line)}". Claude can see the folders: cut the tour.`;
    }
    return true;
  },
};

/** @type {Item} */
export const autoMemoryClean = {
  text: "Claude's auto memory gives no room limit",
  check(repo) {
    const memory = autoMemory(repo);
    if (!memory) return true;
    const stale = linesOf(memory.text).find((l) => /\broom\b|\bhall\b/i.test(l.line) && ROOM_LIMIT.test(l.line));
    if (stale) return `Claude's auto memory still says "${shown(stale.line)}". A session that remembers it will use it where it's wrong: ask Claude to delete that line from its auto memory.`;
    return true;
  },
};

// A rule's `paths:` value: a YAML list, or a string of comma-separated
// patterns (commas inside {braces} belong to the pattern).
/** @param {unknown} value @returns {string[]} */
function patterns(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  /** @type {string[]} */
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of String(value ?? '')) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out.filter(Boolean).map((p) => p.replace(/^(['"])(.*)\1$/, '$2'));
}

/** @param {string} pattern @returns {string[]} */
function expandBraces(pattern) {
  const m = pattern.match(/^(.*?)\{([^{}]*)\}(.*)$/);
  if (!m) return [pattern];
  return /** @type {string} */ (m[2]).split(',').flatMap((alt) => expandBraces(`${m[1]}${alt}${m[3]}`));
}

// A rule's glob against a path from the folder that holds its `.claude/`:
// ** spans folders, * and ? stay within one, the whole path must match.
/** @param {string} pattern */
export function globMatcher(pattern) {
  const regexes = expandBraces(pattern.trim().replace(/^\.?\//, '')).map((p) => {
    let re = '';
    for (let i = 0; i < p.length; i += 1) {
      if (p.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
      else if (p.startsWith('**', i)) { re += '.*'; i += 1; }
      else if (p[i] === '*') re += '[^/]*';
      else if (p[i] === '?') re += '[^/]';
      else re += /** @type {string} */ (p[i]).replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
  });
  return (/** @type {string} */ path) => regexes.some((r) => r.test(path));
}

// Every file under fixit/, from fixit/, its own .claude/ left out.
/** @param {Repo} repo */
function projectFiles(repo) {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {string} */ rel) => {
    for (const name of readdirSync(join(repo.dir, PROJECT, rel))) {
      if (!rel && name === '.claude') continue;
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(join(repo.dir, PROJECT, r)).isDirectory()) walk(r);
      else out.push(r);
    }
  };
  walk('');
  return out;
}

/** @type {Item} */
export const rulesScoped = {
  text: 'a rule in `fixit/.claude/rules/` loads only for the files it covers, and every scoped rule matches a file in `fixit/`',
  check(repo) {
    /** @type {string[]} */
    let names = [];
    try {
      names = readdirSync(join(repo.dir, RULES)).filter((n) => n.endsWith('.md')).sort();
    } catch {
      names = [];
    }
    if (!names.length) return `There's no rule in \`${RULES}/\` yet. Ask Claude to put Sam's public-page checklist in a rule that loads only for public pages.`;
    const rules = names.map((name) => ({ path: `.claude/rules/${name}`, globs: patterns(frontmatter(repo.read(`${RULES}/${name}`) ?? '')?.fields.paths) }));
    const scoped = rules.filter((r) => r.globs.length);
    if (!scoped.length) return `No rule in \`${RULES}/\` has \`paths:\`, so each one loads in every session. Scope the public-page checklist with \`paths:\` to the files it's for.`;
    const files = projectFiles(repo);
    const dead = scoped.filter((r) => !r.globs.some((g) => files.some(globMatcher(g))));
    if (dead.length) return dead.map((r) => `\`${r.path}\` is scoped to \`${r.globs.join('`, `')}\`, which matches no file in \`${PROJECT}/\`. It will never load.`).join(' ');
    return true;
  },
};

const ACCESS = /\b(?:lift|step[- ]free|wheelchair|access(?:ible|ibility)?|stairs)\b/i;
const OPEN = /\b(?:being confirmed|to be confirmed|not (?:yet )?confirmed|unconfirmed|tbc|being checked)\b/i;
const OVERCLAIM = /\b(?:step[- ]free|wheelchair[- ]accessible|fully accessible|level access|accessible by lift)\b/i;

/** @type {Item} */
export const accessNote = {
  text: "`fixit/march/access-note.md` says step-free access is being confirmed, and gives only the library's public number",
  check(repo) {
    const text = repo.read(NOTE);
    if (text === null) return `There's no \`${NOTE}\` yet. In a new session, ask Claude for the two-line access note, without mentioning any rule.`;
    // One sentence at a time, so "being confirmed" in one never covers a
    // promise of step-free access in the next.
    const parts = claims(text).flatMap((c) => c.split(/(?<=[.!?])\s+/));
    const numbers = [...text.matchAll(PHONE)].map((m) => m[0]);
    const other = numbers.find((n) => n.replace(/\D/g, '') !== '5550100');
    if (other) return `The access note gives ${other}. Line 22 of \`fixit/sources/group-notes.md\` gives the library's public number, 555-0100, and only that one goes on a public page.`;
    const settled = parts.find((c) => OVERCLAIM.test(c) && !OPEN.test(c));
    if (settled) return `The access note says "${quote(settled)}" as if it were settled. Line 12 of \`fixit/march/meeting-notes-2027-02-20.md\` says Priya must confirm the lift first. Was the note written in a session that started after \`${MEMORY}\` was saved?`;
    if (!parts.some((c) => ACCESS.test(c) && OPEN.test(c))) return `The access note doesn't say step-free access is being confirmed. That's the rule for unconfirmed details in \`${MEMORY}\`: did a session that started after you saved it write the note?`;
    if (!numbers.length) return "The access note gives no number to call. The rule for unconfirmed details sends people to the venue's public number, 555-0100.";
    return true;
  },
};

/** @type {Item[]} */
export const items = [memoryRules, noEventFacts, autoMemoryClean, rulesScoped, accessNote];
