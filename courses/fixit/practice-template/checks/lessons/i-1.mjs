// @ts-check
// Turn a repeated job into a skill (Fix-It, Intermediate lesson 2). The
// check reads the attendee-guide skill the Learner keeps in
// fixit/.claude/skills/: its description, tried against four requests by
// the rule Questerm's Skill match uses, and its steps, for the rule that
// settles March's limit; the March guide the skill wrote, and that it was
// saved after the skill last changed; and the line in fixit/KIT.md that
// says how to run it. Which Skill call wrote the guide is the host's to
// record (a record no Check reads yet), so the guide's content and its
// time are all this check reads of it.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { flag, frontmatter } from '../frontmatter.mjs';
import { claims, quote } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */

export const title = 'Turn a repeated job into a skill';

export const SKILL = 'fixit/.claude/skills/attendee-guide/SKILL.md';
export const GUIDE = 'fixit/march/attendee-guide.md';
export const KIT = 'fixit/KIT.md';
const NAME = 'attendee-guide';

// A description's words as Questerm's Skill match folds them: lower case,
// an apostrophe inside a word dropped, split on anything but letters and
// digits, in clauses that end at a full stop, semicolon, question or
// exclamation mark, or a line break.
/** @param {string} text */
const words = (text) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** @param {string} text */
const fold = (text) => words(text.normalize('NFKC').toLowerCase().replace(/[‘’ʼ]/gu, "'").replace(/(?<=[\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, ''));
/** @param {string} text */
export function clausesOf(text) {
  return text.split(/[.;!?]+(?=\s|$)|\n/u).map((raw) => ({ raw: raw.trim(), tokens: fold(raw) })).filter((c) => c.tokens.length);
}

// One letter's difference (an insertion, deletion, substitution or swap),
// allowed on words of five letters or more, as Skill match allows it.
/** @param {string} a @param {string} b */
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (i === a.length && i === b.length) return true;
  const rest = (/** @type {number} */ p, /** @type {number} */ q) => a.slice(p) === b.slice(q);
  if (a.length === b.length) return rest(i + 1, i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(i + 2, i + 2));
  return a.length > b.length ? rest(i + 1, i) : rest(i, i + 1);
}
/** @param {string} want @param {string} got */
const meets = (want, got) => want === got || (want.length >= 5 && /^\p{L}+$/u.test(want) && /^\p{L}+$/u.test(got) && oneEdit(want, got));

// Negation: a negation word up to three words before a term, as in every
// rubric; and, in a description, the rest of a clause after "not for",
// "never for", "don't use" or "do not use", or a whole clause that starts
// with a negation word, so "Not for volunteer rotas, internal briefs or
// meeting notes" rules out all three.
const NEGATIONS = new Set(['dont', 'not', 'never', 'without', 'no']);
const CUES = [['not', 'for'], ['never', 'for'], ['dont', 'use'], ['do', 'not', 'use'], ['never', 'use']];
/** @param {string[]} tokens */
function negatedFrom(tokens) {
  if (NEGATIONS.has(/** @type {string} */ (tokens[0]))) return 0;
  for (let i = 0; i < tokens.length; i += 1) if (CUES.some((cue) => cue.every((w, k) => tokens[i + k] === w))) return i;
  return Infinity;
}

/** @param {{ raw: string, tokens: string[] }[]} clauses @param {readonly string[]} terms */
function positive(clauses, terms) {
  for (const clause of clauses) {
    const { tokens } = clause;
    const from = negatedFrom(tokens);
    for (const term of terms) {
      const phrase = fold(term);
      for (let i = 0; i + phrase.length <= tokens.length; i += 1) {
        if (!phrase.every((w, k) => meets(w, /** @type {string} */ (tokens[i + k])))) continue;
        const near = tokens.slice(Math.max(0, i - 3), i).some((t) => NEGATIONS.has(t)) && !NEGATIONS.has(/** @type {string} */ (phrase[0]));
        if (!near && i < from) return clause.raw;
      }
    }
  }
  return null;
}

// The four requests Questerm's Skill match y1 tries, each with the words
// that load the skill for it: scenarios/lexicon.md in Questerm holds the
// same lists, as the classes attendee-guide, guide-check, volunteer-rota
// and meeting-summary. A description that calls every document the group
// writes its business loads for all four.
export const BROAD = ['saturday documents', 'fix it documents', 'fixers documents', 'group documents', 'our documents', 'any document', 'all documents', 'every document'];
export const PROBES = /** @type {const} */ ([
  {
    ask: 'make the attendee guide for february',
    load: true,
    terms: [...BROAD, 'attendee guide', 'event page', 'event pages', 'events page', 'public page', 'public pages', 'public guide', 'visitor guide', 'before you come', 'members of the public'],
    miss: "its description never names the attendee guide or the public page it makes. Say what the skill makes and who reads it.",
  },
  {
    ask: 'can you check the March attendee guide',
    load: true,
    terms: [...BROAD, 'check', 'checking', 'review', 'update', 'refresh', 'proofread', 'edit', 'revise'],
    miss: "its description doesn't say to use it when someone asks to check or update a guide. Say when to use it: making, checking or updating the attendee guide.",
  },
  {
    ask: 'draft the volunteer rota for March',
    load: false,
    terms: [...BROAD, 'rota', 'rotas', 'volunteer', 'internal', 'schedule'],
    hit: 'fits the rota too',
  },
  {
    ask: 'summarise the 20 February meeting',
    load: false,
    terms: [...BROAD, 'minutes', 'meeting', 'meetings', 'summary', 'summaries', 'summarise', 'summarize'],
    hit: 'fits a meeting summary too',
  },
]);

/** @param {string | string[] | undefined} v */
const one = (v) => (Array.isArray(v) ? v.join(' ') : (v ?? '')).trim();

/** @type {Item} */
export const describes = {
  text: '`fixit/.claude/skills/attendee-guide/SKILL.md` has a name and a description that load it for requests about the attendee guide, and not for the volunteer rota or a meeting summary',
  check(repo) {
    const text = repo.read(SKILL);
    if (text === null) return `There's no \`${SKILL}\` yet. Ask Claude to make the attendee-guide skill from how you made the March guide.`;
    const fm = frontmatter(text);
    if (!fm) return `\`${SKILL}\` must start with its frontmatter between two lines of dashes: \`name:\` and \`description:\`.`;
    const name = one(fm.fields.name);
    if (name !== NAME) return name ? `\`${SKILL}\` names the skill \`${name}\`, so \`/attendee-guide\` won't run it. Write \`name: ${NAME}\`.` : `\`${SKILL}\` has no \`name:\`. Write \`name: ${NAME}\` in its frontmatter.`;
    const description = one(fm.fields.description);
    if (!description) return `\`${SKILL}\` has no \`description:\`, the line Claude reads in every session to decide when to use the skill. Write one: what it makes, when to use it, and what it's not for.`;
    if (flag(fm.fields['disable-model-invocation']) === true) return `\`${SKILL}\` has \`disable-model-invocation: true\`, so it never loads on its own, even for the attendee guide. Delete that line.`;
    const clauses = clausesOf(description);
    for (const p of PROBES) {
      const hit = positive(clauses, p.terms);
      if (p.load && !hit) return `The request "${p.ask}" wouldn't load the skill: ${p.miss}`;
      if (!p.load && hit) return `The request "${p.ask}" would load the skill: "${quote(hit)}" ${p.hit}. Name the public page it makes, then say what it's not for in a sentence of its own, starting "Not for".`;
    }
    return true;
  },
};

// The skill's steps: a fact table with a source for every fact, the source
// order in CLAUDE.md, open items published as being confirmed, and the
// March rule, that our notes decide our own arrangements (the sign-up cap,
// what to bring) while the venue's word stands on everything else.
const FACT_TABLE = /\bfact table\b|\bfacts\.md\b/i;
const SOURCED = /\bsources?\b|\bcit(?:e|es|ing)\b/i;
const ORDER = /\bsource order\b|\border\b[^\n]*\bCLAUDE\.md\b|\bCLAUDE\.md\b[^\n]*\border\b/i;
const OPEN = /\bbeing confirmed\b/i;
// Our notes, not a file whose name says notes.
const NOTES = /\b(?:our |the group['’]s |meeting |latest |own )?notes?\b|\bminutes\b/i;
const NOT_A_FILE = /[\w/.-]*notes?[\w-]*\.md\b/gi;
const OWN = /\bown arrangements?\b|\barrangements? (?:we|the group) (?:make|decide|set)|\bsign-?ups?\b|\bcaps?\b|\bwhat to bring\b|\bbring list\b|\bour own\b/i;
const WINS = /\b(?:wins?|beats?|over|overrides?|decides?|settles?|comes? first|takes? priority|trumps?)\b/gi;
const LOSES = /\b(?:lose|loses|lost|second|after|below|under|behind)\b/i;
const EVERYTHING = /\b(?:always|everything|anything|whatever|every (?:fact|time|case)|all (?:facts|cases|sources)|in all cases)\b/i;
const VENUE = /\b(?:venue|booking|confirmation|library|centre|center)\b/gi;
const NOTES_G = new RegExp(NOTES.source, 'gi');

// A clause where our notes win: the last of our notes or the venue named
// before a word like "win" is our notes. It overreaches when it wins on
// everything, or over the venue, with no word confining it to our own
// arrangements and none that puts the notes second.
/** @param {string} text */
function overreaches(text) {
  if (!NOTES.test(text) || OWN.test(text)) return false;
  const win = [...text.matchAll(WINS)][0];
  if (!win || win.index === undefined) return false;
  const before = text.slice(0, win.index);
  const last = (/** @type {RegExp} */ re) => Math.max(-1, ...[...before.matchAll(re)].map((m) => m.index ?? -1));
  if (last(NOTES_G) <= last(VENUE)) return false;
  return EVERYTHING.test(text) || (new RegExp(VENUE.source, 'i').test(text) && !LOSES.test(text));
}

// The skill's steps as clauses, each with the number of the step it is in.
/** @param {string} body */
function stepClauses(body) {
  /** @type {{ step: number | null, text: string }[]} */
  const out = [];
  let step = null;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const n = line.match(/^\s*(\d+)[.)]\s/);
    if (n) step = Number(n[1]);
    else if (!line.trim() || /^\s*#/.test(line)) step = null;
    for (const text of line.replace(NOT_A_FILE, ' ').split(/[.;]+(?=\s|$)/)) if (text.trim()) out.push({ step, text });
  }
  return out;
}
const where = (/** @type {number | null} */ step) => (step ? `Step ${step}` : 'The skill');

/** @type {Item} */
export const settles = {
  text: "the skill's steps ask for a fact table with sources, apply the source order, publish open items as being confirmed, and let our notes decide only our own arrangements",
  check(repo) {
    const text = repo.read(SKILL);
    if (text === null) return `There's no \`${SKILL}\` yet. Ask Claude to make the attendee-guide skill.`;
    const body = frontmatter(text)?.body ?? text;
    if (!FACT_TABLE.test(body) || !SOURCED.test(body)) return "The skill's steps don't ask for a fact table with a source for every fact. Put that step back: it's how you checked the March guide.";
    if (!ORDER.test(body)) return "The skill's steps don't apply the source order in `CLAUDE.md`. Put that step back, so the venue's written confirmation wins on the venue's facts.";
    if (!OPEN.test(body)) return "The skill's steps don't say what to do with a detail nobody has confirmed. Put that step back: publish it as being confirmed, with the venue's public number.";
    const clauses = stepClauses(body);
    const over = clauses.find((c) => overreaches(c.text));
    if (over) return `${where(over.step)} now lets our notes beat the venue's confirmation on everything: "${quote(over.text.trim())}". Limit it to our own arrangements (sign-up cap, what to bring).`;
    if (!clauses.some((c) => NOTES.test(c.text) && OWN.test(c.text))) return "The skill's steps don't say whose word wins on our own arrangements, so Claude can't settle March's limit: the booking allows 40 people including volunteers, and our notes cap sign-ups at 30. Add the rule to step 3: our notes win on our own arrangements, such as the sign-up cap and what to bring.";
    return true;
  },
};

/** @param {string} path @param {import('../repo.mjs').Repo} repo */
const savedAt = (repo, path) => {
  try {
    return statSync(join(repo.dir, path)).mtimeMs;
  } catch {
    return null;
  }
};

const WRONG_LIMIT = /\b(?:40|60|forty|sixty)\s*(?:places|people|persons|seats|spaces|visitors|sign-?ups)\b|\bjust turn up\b|\bno need to book\b/i;
const RIGHT_LIMIT = /\b(?:30|thirty)\s*(?:places|spaces|seats|sign-?ups)\b|\bplaces are limited\b/i;
const ACCESS = /\b(?:lift|step[- ]free|wheelchair|access(?:ible|ibility)?|stairs)\b/i;
const STILL_OPEN = /\b(?:being confirmed|to be confirmed|not (?:yet )?confirmed|unconfirmed|tbc|being checked)\b/i;
const OVERCLAIM = /\b(?:step[- ]free|wheelchair[- ]accessible|fully accessible|level access|accessible by lift)\b/i;

/** @type {Item} */
export const marchGuide = {
  text: '`fixit/march/attendee-guide.md` was saved after your last change to the skill, gives 30 places or says places are limited, never 40, 60 or just turn up, and says step-free access is being confirmed',
  check(repo) {
    const text = repo.read(GUIDE);
    if (text === null) return `There's no \`${GUIDE}\` yet. Run the skill on March: \`/attendee-guide march\`.`;
    const guide = savedAt(repo, GUIDE);
    const skill = savedAt(repo, SKILL);
    if (guide !== null && skill !== null && guide < skill) return `\`${GUIDE}\` is older than your last change to the skill, so it didn't come from the skill as it is now. Run \`/attendee-guide march\` again.`;
    const parts = claims(text).flatMap((c) => c.replace(/\*\*/g, '').split(/(?<=[.!?])\s+/));
    const wrong = parts.find((c) => WRONG_LIMIT.test(c));
    if (wrong) return `The March guide says "${quote(wrong)}". The booking's 40 includes our ten volunteers, and our notes cap sign-ups at 30.`;
    if (!parts.some((c) => RIGHT_LIMIT.test(c))) return "The March guide doesn't say how many places there are. Our notes cap sign-ups at 30.";
    const settled = parts.find((c) => OVERCLAIM.test(c) && !STILL_OPEN.test(c));
    if (settled) return `The March guide says "${quote(settled)}" as if it were settled. Line 12 of \`fixit/march/meeting-notes-2027-02-20.md\` says Priya must confirm the lift first.`;
    if (!parts.some((c) => ACCESS.test(c) && STILL_OPEN.test(c))) return "The March guide doesn't say step-free access is being confirmed. That's the rule for a detail nobody has confirmed, and the skill's step for open items.";
    return true;
  },
};

const RUNS = /\/attendee-guide\s+(?:<[^>\n]+>|`?[a-z][\w-]*`?)|\battendee-guide\b[^\n]*\b(?:month|folder)\b/i;

/** @type {Item} */
export const kitLine = {
  text: '`fixit/KIT.md` says how to run the skill: `/attendee-guide` with the month\'s folder',
  check(repo) {
    const text = repo.read(KIT);
    if (text === null) return `There's no \`${KIT}\`. It's the kit's instructions for whoever makes the next guide: put it back, then add how to run the skill.`;
    if (!RUNS.test(text)) return `\`${KIT}\` doesn't say how to run the skill yet. Under "How to run it", add one line: the skill's name and the month's folder to give it.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [describes, settles, marchGuide, kitLine];
