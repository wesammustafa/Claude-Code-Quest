// @ts-check
// Hand it over: show it is ready (Fix-It, Beginner lesson 5). The check reads
// what Maya will publish and the readiness note that lets anyone verify it:
// the door sign's time, a source named for each fact the note lists, a line
// saying which source wins when two disagree, what the note leaves open, and
// the guide's facts from lessons 3 and 4. Whether the final check ran in a
// fresh session is the Prompt rubric's to judge: no record of it reaches a
// check (handoff N7), so the note's content stands in.
import { claims, quote } from './fixit-claims.mjs';
import { parkingRight } from './b-4.mjs';
import { START_10, START_1030, bookingSaid, numberSaid, startSaid } from './b-6.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Hand it over: show it is ready';

export const GUIDE = 'fixit/feb/attendee-guide.md';
export const SIGN = 'fixit/feb/door-sign.md';
export const NOTE = 'fixit/feb/readiness-note.md';
const NOTES = 'fixit/feb/meeting-notes-2027-01-28.md';

/** @type {Item} */
export const signRight = {
  text: "the door sign gives the guide's time, 10:30",
  check(repo) {
    const text = repo.read(SIGN);
    if (text === null) return `There's no \`${SIGN}\`. Maya prints it with the guide: reset this step to bring it back, then correct its time.`;
    const said = claims(text);
    const early = said.find((c) => START_10.test(c));
    if (early) return `\`${SIGN}\` says "${quote(early)}". Maya prints it with the guide, and the guide says 10:30, from line 5 of \`${NOTES}\`.`;
    if (!said.some((c) => START_1030.test(c))) return `\`${SIGN}\` doesn't say when the public comes in. Maya prints it with the guide: give it the guide's time, 10:30.`;
    return true;
  },
};

// The readiness note, one logical line at a time: a table row, a heading, a
// list item with the lines it wraps onto, or a paragraph. A line that opens
// with a bold label ("**Still open:**") starts a paragraph of its own. Each
// line keeps the heading it sits under.
const ROW = /^\s*\|.*\|\s*$/;
const RULE = /^\s*\|[\s:|-]+\|\s*$/;
const HEADING = /^\s{0,3}#{1,6}\s/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;
const LABEL = /^\s*(?:\*\*|__)[^*_]+(?:\*\*|__)|^\s*[A-Z][\w' ]{0,30}:/;
const bare = (/** @type {string} */ s) => s.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

/**
 * @typedef {{ text: string, kind: 'row' | 'rule' | 'heading' | 'item' | 'para' | 'blank', heading: string }} Line
 * @param {string} text
 * @returns {Line[]}
 */
function noteLines(text) {
  /** @type {Line[]} */
  const out = [];
  let heading = '';
  for (const raw of text.replace(/<!--[\s\S]*?-->/g, ' ').split(/\r?\n/)) {
    const last = out.at(-1);
    if (!raw.trim()) out.push({ text: '', kind: 'blank', heading });
    else if (ROW.test(raw)) out.push({ text: raw.trim(), kind: RULE.test(raw) ? 'rule' : 'row', heading });
    else if (HEADING.test(raw)) {
      heading = bare(raw.replace(/^\s*#+/, ''));
      out.push({ text: raw.trim(), kind: 'heading', heading });
    } else if (LIST_ITEM.test(raw)) out.push({ text: raw.trim(), kind: 'item', heading });
    else if (last && (last.kind === 'item' || last.kind === 'para') && !LABEL.test(raw)) last.text += ` ${raw.trim()}`;
    else out.push({ text: raw.trim(), kind: 'para', heading });
  }
  return out;
}

// The Still open part: a heading, or a label with a colon, then what follows
// it. A heading's part runs to the next heading; a label's to the next label
// or the blank line after it has said something.
const OPEN = /^(?:(?:[-*+]|\d+[.)])\s+)?(?:still open|open questions|open items|open|not yet confirmed|unconfirmed|to confirm)\b\s*(?::|$)\s*/i;
const OPEN_HEADING = /^#{1,6}\s*(?:still open|open questions|open items|open|not yet confirmed|unconfirmed|to confirm)\b.*$/i;

/** @param {Line[]} lines */
function openPart(lines) {
  const start = lines.findIndex((l) => (l.kind === 'heading' ? OPEN_HEADING.test(bare(l.text)) : OPEN.test(bare(l.text))));
  if (start < 0) return null;
  const lead = /** @type {Line} */ (lines[start]);
  const byHeading = lead.kind === 'heading';
  const said = [byHeading ? '' : bare(lead.text).replace(OPEN, '')];
  let end = start + 1;
  for (; end < lines.length; end++) {
    const l = /** @type {Line} */ (lines[end]);
    if (l.kind === 'heading') break;
    if (!byHeading && l.kind === 'para' && LABEL.test(l.text)) break;
    if (!byHeading && l.kind === 'blank' && said.join('').trim()) break;
    said.push(l.kind === 'rule' ? '' : bare(l.text.replace(/\|/g, ' ').replace(LIST_ITEM, '')));
  }
  return { start, end, said: said.join(' ').trim() };
}

// A source, as a reader names it: a file, or the email, notes, update or flyer
// in words.
const SOURCE = /[\w./-]+\.md\b|\bvenue[- ]e-?mail|\b(?:meeting|group|standing|january|our)[- ]notes\b|\bnotes,? (?:line|item)|\b(?:library|dee|events desk|venue|booking)(?:['’]s)?\s+(?:e-?mails?|update|booking|confirmation)\b|\b(?:the|friday['’]s|12 feb\w*|18 jan\w*) (?:e-?mail|update)\b|\bupdate e-?mail\b|\bflyers?\b|\bnewsletters?\b|\bpartner[- ]e-?mail/i;
// What an attendee asks, as a list line's label names it.
const CRITERION = /\b(?:when|times?|date|day|start|where|place|venue|room|floor|parking|park|car|book\w*|places|sign[- ]?ups?|walk[- ]?ins?|bring|take|accept\w*|access\w*|lift|stairs|step[- ]free|contact|phone|number|call|questions?|enquir\w*|cost|price|free|tea)\b/i;

// The sources a ranking may put first, and the ones it never should. A
// flyer, newsletter or forwarded listing is masked before a trusted source
// is looked for, so "the partner email" is no library email.
const DISTRUSTED = /\b(?:old |october['’]s )?flyers?\b[\w.-]*|\bnewsletters?\b|\bpartner[- ]e-?mail[\w.-]*|\brepair network(?: e-?mail| listing)?\b/gi;
const TRUSTED = /\b(?:library(?:['’]s)?\s+e-?mails?|venue[- ]e-?mail[\w.-]*|dee['’]s e-?mails?|events desk|e-?mails?|(?:meeting|our|group|standing|january)[- ]notes|the notes|notes|booking)\b/i;
// Words that make a line a ranking: an order, a winner, or a disagreement.
const CUE = /\b(?:order of trust|in (?:this |that |the )?order|ranking|rank(?:ed|s)?|trust(?:ed|s|ing)?|wins?|win out|beats?|outranks?|loses? to|priority|prioriti[sz]e\w*|precedence|disagree\w*|conflict\w*|prefer\w*|(?:comes?|goes?) (?:first|last|after|below|above))\b|\s>\s/i;
// Said of the flyer: kept out of the ranking, or put last.
const NEVER = /\b(?:never|not|no|don['’]t|do not|isn['’]t|aren['’]t|ignore\w*|exclud\w*|out of date|outdated|last|least|lowest|bottom|only if|unless)\b/i;
const REVERSE = /\b(?:after|below|under|behind|loses? to|less than|lower than|beneath)\b/i;
const CLAUSE = /[,;:.()!?]|\b(?:but|while|whereas)\b/i;
const DATED = /\blast (?:october|year|month|autumn|november|time)\b/gi;

/**
 * How a ranking line places the flyer: 'flyer' when it puts the flyer above
 * the library's email or the notes, 'ok' when it doesn't, null when the line
 * names no source.
 * @param {string} line
 */
function rankingOf(line) {
  const text = bare(line).replace(DATED, (m) => ' '.repeat(m.length));
  // After "when sources disagree," comes the ranking itself.
  const lead = text.match(/\b(?:disagree|conflict|differ)\w*\b[^,.;:]*[,.;:]/i);
  const after = lead?.index === undefined ? '' : text.slice(lead.index + lead[0].length);
  const rest = SOURCE.test(after) ? after : text;
  const masked = rest.replace(DISTRUSTED, (m) => ' '.repeat(m.length));
  const t = masked.search(TRUSTED);
  const f = rest.search(DISTRUSTED);
  if (f < 0) return t < 0 ? null : 'ok';
  let from = f;
  while (from > 0 && !CLAUSE.test(rest.charAt(from - 1))) from--;
  const clause = rest.slice(from).split(CLAUSE)[0] ?? '';
  if (NEVER.test(clause)) return 'ok';
  if (t < 0) return 'flyer';
  if (f < t) return REVERSE.test(rest.slice(f, t)) ? 'ok' : 'flyer';
  return REVERSE.test(rest.slice(t, f)) ? 'flyer' : 'ok';
}

/**
 * The note's facts with their sources, its ranking lines and its Still open
 * part, or the hint when there's no note.
 * @param {Repo} repo
 */
function readNote(repo) {
  const text = repo.read(NOTE);
  if (text === null) return { error: `There's no \`${NOTE}\` yet. Ask Claude to write it, as in step 1, or write it yourself in the files tab: each thing an attendee needs to know, the guide's answer, and the file it comes from.` };
  const lines = noteLines(text);
  const open = openPart(lines);
  const inOpen = (/** @type {number} */ i) => open !== null && i >= open.start && i < open.end;
  /** @type {string[]} */
  const ranking = [];
  /** @type {string[]} */
  const facts = [];
  lines.forEach((l, i) => {
    if (inOpen(i) || l.kind === 'blank' || l.kind === 'rule' || l.kind === 'heading') return;
    if (l.kind === 'row') {
      if (lines[i + 1]?.kind !== 'rule') facts.push(bare(l.text.replace(/\|/g, ' ')));
      return;
    }
    if ((CUE.test(bare(l.text)) || CUE.test(l.heading)) && rankingOf(l.text) !== null) {
      ranking.push(l.text);
      return;
    }
    const label = l.kind === 'item' ? bare(l.text.replace(LIST_ITEM, '')).match(/^([^:]{1,40}):/)?.[1] : undefined;
    if (label && CRITERION.test(label)) facts.push(bare(l.text.replace(LIST_ITEM, '')));
  });
  return { facts, ranking, open };
}

// Maya's callers ask at least this many things.
const FACTS = 6;

/** @type {Item} */
export const noteSourced = {
  text: '`fixit/feb/readiness-note.md` gives a source for each fact, and says which source wins',
  check(repo) {
    const note = readNote(repo);
    if (note.error !== undefined) return note.error;
    const unsourced = note.facts.find((f) => !SOURCE.test(f));
    if (unsourced) return `This line of the readiness note names no source: "${quote(unsourced)}". Add the file it comes from, so Maya can check it herself.`;
    const flyerOnly = note.facts.find((f) => !SOURCE.test(f.replace(DISTRUSTED, ' ')));
    if (flyerOnly) return `This line of the readiness note rests on the flyer or the newsletter alone: "${quote(flyerOnly)}". They're out of date or second-hand: which of this month's files says it?`;
    const n = note.facts.length;
    if (n < FACTS) return `The readiness note gives ${String(n)} fact${n === 1 ? '' : 's'} with a source. Maya's callers ask about at least ${String(FACTS)} things: when, where, parking, booking, what to bring and what we can't take. Give each its own row and the file it comes from.`;
    const flyer = note.ranking.find((r) => rankingOf(r) === 'flyer');
    if (flyer) return `The readiness note ranks the flyer above the library's email: "${quote(bare(flyer))}". The guide's times come from the email and the meeting notes.`;
    if (!note.ranking.length) return "The readiness note doesn't say which source wins when two disagree. The fresh session had to guess: write the rule down, so the next check doesn't have to.";
    return true;
  },
};

/** @type {Item} */
export const openSaid = {
  text: "the readiness note says what's still open",
  check(repo) {
    const note = readNote(repo);
    if (note.error !== undefined) return note.error;
    if (note.open === null) return 'The readiness note has no *Still open* part. Add one: what the evidence can\'t settle yet, or that nothing is open.';
    if (!/\w/.test(note.open.said)) return "The readiness note's *Still open* part is empty. Is anything in the guide true only for this one Saturday, or not yet confirmed? If nothing is, say so.";
    return true;
  },
};

/** @type {Item} */
export const guideKept = {
  text: 'the guide still gives 10:30, booking, the public number and Park Lane',
  check(repo) {
    const text = repo.read(GUIDE);
    if (text === null) return `There's no \`${GUIDE}\`. It's what Maya posts: reset this step to bring it back.`;
    for (const said of [startSaid, bookingSaid, numberSaid]) {
      const r = said(text);
      if (r !== true) return r;
    }
    return parkingRight.check(repo);
  },
};

/** @type {Item[]} */
export const items = [signRight, noteSourced, openSaid, guideKept];
