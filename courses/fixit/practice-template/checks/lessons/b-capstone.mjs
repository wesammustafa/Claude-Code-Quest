// @ts-check
// The Beginner capstone of the Fix-It pilot: the March attendee guide Maya
// asked for, and the readiness note that shows why it's right. The check
// reads each claim by what it says, not its exact words, and quotes the line
// it judged.
import { claims, quote, untouched } from './fixit-claims.mjs';
import { START_10, START_1030 } from './b-6.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'The March attendee guide, ready to hand over';

export const GUIDE = 'fixit/march/attendee-guide.md';
export const NOTE = 'fixit/march/readiness-note.md';
const BOOKING = 'fixit/march/booking-confirmation-march.pdf';
const BOOKING_TEXT = 'fixit/march/booking-confirmation-march-text.md';
const NOTES = 'fixit/march/meeting-notes-2027-02-20.md';
const BRIEF = 'fixit/march/BRIEF.md';
const GROUP = 'fixit/sources/group-notes.md';
export const SOURCES = [
  BRIEF,
  BOOKING,
  BOOKING_TEXT,
  NOTES,
  'fixit/march/priya-message.md',
  GROUP,
  'fixit/sources/flyer-2026-10.md',
  'fixit/sources/flyer-2026-10.png',
];

/** @param {Repo} repo */
function readGuide(repo) {
  const text = repo.read(GUIDE);
  if (text === null)
    return { error: `There's no \`${GUIDE}\` yet. Ask Claude for a draft, or write one yourself.` };
  // One line at a time: a guide is short lines, often a label and its fact.
  const lines = claims(text).flatMap((c) => c.split(/\s+(?=\*\*[^*]+:\*\*)/)).filter(Boolean);
  return { text, lines };
}

/** @type {Item} */
export const sourcesKept = {
  text: 'the sources are as they arrived',
  check(repo) {
    for (const path of SOURCES) {
      const text = repo.read(path);
      if (text === null) return `\`${path}\` is missing. Sources stay as they arrived: reset this step to bring it back.`;
      if (!untouched(repo, path, text)) return `\`${path}\` has changed. Sources stay as they arrived, so Maya can check them: undo the change, or reset this step.`;
    }
    return true;
  },
};

const MARCH_13 = /\b13(?:th)?\s+march\b|\bmarch\s+13(?:th)?\b|\b13[/.]0?3(?:[/.](?:20)?27)?\b/i;

/** @type {Item} */
export const dateRight = {
  text: 'the guide gives the date, Saturday 13 March',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    if (!MARCH_13.test(g.text)) return `The guide doesn't say which day. The booking's Date line gives it: \`${BOOKING_TEXT}\` line 10, or page 1 of the PDF.`;
    return true;
  },
};

const END_1 = /\b1(?::00)?\s*(?:pm|p\.m\.)|\b13:00\b|\bone o['’]?clock\b|\b1pm\b/i;

/** @type {Item} */
export const timesRight = {
  text: 'the guide gives 10:30 to 1pm',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const early = g.lines.find((c) => START_10.test(c));
    if (early) return `The guide says "${quote(early)}". The booking admits the public from 10:30 (\`${BOOKING_TEXT}\` line 12), and line 7 of \`${NOTES}\` says what happened in February to people who came at 10.`;
    if (!START_1030.test(g.text)) return `The guide doesn't say when the public can come in. The booking's Public admission line gives it (\`${BOOKING_TEXT}\` line 12).`;
    if (!END_1.test(g.text)) return 'The guide doesn\'t say when the session ends. Every source that gives an end time says 1pm.';
    return true;
  },
};

// Head counts, each read for what it counts. The booking's 40 is the room's
// limit with the organisers, volunteers and staff in it; the meeting capped
// the public at 30; ten of the people in the room are volunteers. A number is
// bound to the nearest word that says what it counts, so "30 volunteers" or
// "40 public places" is caught even though each number is in the sources.
const COUNT_WORDS = { ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
const PUBLIC_WORD = /^(?:places?|seats?|spaces?|spots?|sign-?ups?|signups?|sign|tickets?|visitors?|attendees?|guests?|public|cap|capped|capping)$/i;
const VOLUNTEER_WORD = /^(?:volunteers?|fixers?|helpers?|organi[sz]ers?|staff|trainees?)$/i;
const ROOM_WORD = /^(?:room|room['’]s|occupancy|holds|hold|licensed|total|altogether|maximum)$/i;
const NEUTRAL_WORD = /^(?:people|persons|capacity|limit|limited|max)$/i;
// "40 minus our volunteers" is the room's total too.
const INCLUDING = /^(?:minus|less|leaves|leaving|including|includes|include|incl|inc|counting|counts|count|covers|covering|with)$/i;
// A clause that reports a number in order to reject it: the flyer's 60, the
// draft's 40.
const REJECTED = /\b(?:not|isn['’]t|wasn['’]t|aren['’]t|wrong|incorrect|out of date|outdated|old|flyer|draft|claude(?:['’]s)?|instead of|rather than|corrected|mistake|misread)\b/i;
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';

/** @param {string} text */
const clausesOf = (text) => text.replace(/\*\*|__|`/g, '').split(/\||[;!?]|\.(?=\s|$)/).map((c) => c.trim()).filter(Boolean);

/**
 * Every head count in `text`, with what it counts: `public` (places, sign-ups,
 * visitors), `volunteers`, `total` (the room's limit with everyone in it), or
 * `unknown`; `rejected` when its clause reports the number to set it aside.
 * @param {string} text
 * @returns {{ n: number, kind: 'public' | 'volunteers' | 'total' | 'unknown', rejected: boolean, clause: string }[]}
 */
export function headcounts(text) {
  /** @type {{ n: number, kind: 'public' | 'volunteers' | 'total' | 'unknown', rejected: boolean, clause: string }[]} */
  const out = [];
  for (const clause of clausesOf(text)) {
    const plain = clause
      .replace(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, ' ')
      .replace(/\b\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.|o['’]?clock)/gi, ' ')
      // "walk-ins at 11", "from 10": a clock time, not a count.
      .replace(/\b(at|from|until|till|after|before|by|around|since)\s+(?:[1-9]|1[0-2])\b(?!\s*(?:places?|seats?|spaces?|people|persons|volunteers?|sign-?ups?|visitors?))/gi, '$1 ')
      .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\b|\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), ' ')
      .replace(/\b(?:lines?|page|p\.|ref|item|step)\s+\d+(?:\s*(?:to|-|–|and)\s*\d+)?/gi, ' ')
      .replace(/\b555[- .]?\d{4}\b|\b\d{4}\b/g, ' ');
    /** @type {string[]} */
    const tokens = plain.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? [];
    const word = (/** @type {number} */ j) => tokens[j] ?? '';
    const value = (/** @type {string} */ t) => (/^\d{1,3}$/.test(t) ? Number(t) : COUNT_WORDS[/** @type {keyof typeof COUNT_WORDS} */ (t.toLowerCase())]);
    const at = tokens.map((t, i) => (value(t) !== undefined ? i : -1)).filter((i) => i >= 0);
    at.forEach((i, k) => {
      const lo = (at[k - 1] ?? -1) + 1;
      const hi = at[k + 1] ?? tokens.length;
      const n = /** @type {number} */ (value(word(i)));
      /** @type {{ d: number, j: number, word: string } | undefined} */
      let near;
      for (let j = lo; j < hi; j++) {
        if (j === i) continue;
        const w = word(j);
        if (!(PUBLIC_WORD.test(w) || VOLUNTEER_WORD.test(w) || ROOM_WORD.test(w) || NEUTRAL_WORD.test(w))) continue;
        const d = Math.abs(j - i) - (j > i ? 0.5 : 0);
        if (d <= 4 && (!near || d < near.d)) near = { d, j, word: w };
      }
      /** @type {'public' | 'volunteers' | 'total' | 'unknown'} */
      let kind = 'unknown';
      // "40 people including our ten volunteers": the volunteers may come after
      // their own number.
      const after = tokens.slice(i + 1, i + 8);
      const includesVolunteers = after.some((w, x) => {
        if (!INCLUDING.test(w) || x >= hi - i - 1) return false;
        const next = after.slice(x + 1, x + 5);
        const v = next.findIndex((t) => VOLUNTEER_WORD.test(t));
        // A smaller number of volunteers fits inside this one; the same or more doesn't.
        return v >= 0 && next.slice(0, v).every((t) => value(t) === undefined || /** @type {number} */ (value(t)) < n);
      });
      if (near) {
        const w = near.word;
        const between = tokens.slice(Math.min(i, near.j) + 1, Math.max(i, near.j));
        if (VOLUNTEER_WORD.test(w)) kind = between.some((b) => INCLUDING.test(b)) ? 'total' : 'volunteers';
        else if (ROOM_WORD.test(w)) kind = 'total';
        else if (PUBLIC_WORD.test(w)) kind = includesVolunteers ? 'total' : 'public';
        else kind = includesVolunteers || tokens.slice(lo, hi).some((t) => ROOM_WORD.test(t)) ? 'total' : 'public';
      }
      if (kind !== 'unknown') out.push({ n, kind, rejected: REJECTED.test(clause), clause });
    });
  }
  return out;
}

// Where a count is wrong for what it counts: a sentence for the hint, or null.
/** @param {{ n: number, kind: string, rejected: boolean }} c */
function miscount(c) {
  if (c.rejected) return null;
  if (c.n === 60) return 'flyer';
  if (c.kind === 'public' && c.n === 40) return 'forty';
  if (c.kind === 'public' && c.n !== 30) return 'public';
  if (c.kind === 'volunteers' && c.n !== 10) return 'volunteers';
  if (c.kind === 'total' && c.n !== 40) return 'total';
  return null;
}
const PUBLIC_30 = (/** @type {{ n: number, kind: string, rejected: boolean }} */ c) => c.n === 30 && c.kind === 'public' && !c.rejected;
const LIMITED = /\b(?:places|spaces?|seats|numbers?|spots)\b[^.\n]{0,20}\blimited\b|\blimited\s+(?:places|spaces?|seats|numbers|spots|capacity)\b|\bbook early\b|\bfills? up\b|\bfirst come\b/i;
const TURN_UP = /\bjust turn up\b|\bno need to book\b|\bno booking\b|\bdrop in any ?time\b|\bplenty of (?:space|room|places)\b/i;
const BOOK = /\bbook(?:s|ed|ing)?\b|\bevents page\b|\bsign[- ]?up\b|\bregister\b/i;

/** @param {{ clause: string }} c */
const said = (c) => quote(c.clause);
/**
 * The hint for a wrong count, in the guide or the note.
 * @param {string} where
 * @param {{ n: number, kind: string, clause: string }} c
 * @param {string} why
 */
function countHint(where, c, why) {
  if (why === 'flyer') return `${where} says "${said(c)}". That's the October flyer's number, and the flyer isn't about March.`;
  if (why === 'forty') return `${where} says "${said(c)}". Read the booking's occupancy line to the end of the sentence (\`${BOOKING_TEXT}\` line 14), then line 11 of \`${NOTES}\`.`;
  if (why === 'public') return `${where} says "${said(c)}". Line 11 of \`${NOTES}\` caps March sign-ups at 30.`;
  if (why === 'volunteers') return `${where} says "${said(c)}". Line 11 of \`${NOTES}\` says how many volunteers there are; which number is that?`;
  return `${where} says "${said(c)}". The booking's occupancy line gives the room's limit with everyone in it (\`${BOOKING_TEXT}\` line 14).`;
}

/** @type {Item} */
export const capacityRight = {
  text: 'the guide offers no more places than the meeting agreed, and asks people to book',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    for (const line of g.lines) {
      for (const c of headcounts(line)) {
        const why = miscount(c);
        if (why) return countHint('The guide', { ...c, clause: line }, why);
      }
    }
    const open = g.lines.find((c) => TURN_UP.test(c));
    if (open) return `The guide says "${quote(open)}". Line 18 of \`${GROUP}\` says the public books on the library's events page.`;
    if (!BOOK.test(g.text)) return `No line tells people to book. Line 18 of \`${GROUP}\` says how the public books: add it.`;
    if (!headcounts(g.text).some(PUBLIC_30) && !LIMITED.test(g.text)) return `The guide doesn't say there's a limit, so nobody knows to book early. Line 11 of \`${NOTES}\` caps sign-ups: give that number, or say places are limited.`;
    return true;
  },
};

const ACCESS = /\baccess(?:ible|ibility)?\b|\blift\b|\bstep[- ]free\b|\bwheelchair\b|\bstairs?\b|\bupstairs\b|\belevator\b/i;
const ASSERTS_ACCESS = /\bstep[- ]free\b|\bwheelchair[- ]accessible\b|\bfully accessible\b|\baccessible by lift\b|\blevel access\b|\bthere(?:['’]s| is) a (?:working )?lift\b|\blift is working\b|\blift access\b|\bwheelchair users?\b[^.]{0,20}\b(?:can|may|will)\b/i;
const QUALIFIED = /\b(?:being confirmed|not (?:yet )?confirmed|unconfirmed|to be confirmed|tbc|still confirming|confirming|check|call|ring|phone|ask|may not|might not|out of (?:service|order)|had repairs|repairs?)\b/i;

/** @type {Item} */
export const accessRight = {
  text: 'the guide answers how to reach Room B, without promising step-free access',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    if (!g.lines.some((c) => ACCESS.test(c))) return 'The guide doesn\'t say how to get to Room B. Maya\'s brief says it\'s the question people ask most (line 13 of `fixit/march/BRIEF.md`).';
    // A claim that says step-free, or accessible by lift, with nothing in the
    // same sentence that leaves it open.
    const sentences = g.lines.flatMap((c) => c.split(/(?<=[.!?])\s+/));
    const firm = sentences.find((s) => !/\?\s*$/.test(s) && ASSERTS_ACCESS.test(s) && !QUALIFIED.test(s) && !/\bnot\b|\bisn['’]t\b|\bcan['’]t\b/i.test(s));
    if (firm) return `The guide says "${quote(firm)}". Line 12 of \`${NOTES}\` says what has to happen before anyone tells the public it's step-free.`;
    return true;
  },
};

/** @type {Item} */
export const rulesRight = {
  text: 'the guide names what you can\'t bring, this month\'s new rule included',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const all = g.lines.find((c) => /\bfix (?:anything|everything)\b|\bbring anything\b/i.test(c));
    if (all) return `The guide says "${quote(all)}". Lines 11 to 15 of \`${GROUP}\` list what the group doesn't accept.`;
    const t = g.text;
    const missing = [
      [/\bmicrowaves?\b/i, 'microwaves'],
      [/\bgas\b/i, 'gas appliances'],
      [/\b(?:swollen|cracked|damaged)\b[^.\n]{0,30}\bbatter(?:y|ies)\b|\bbatter(?:y|ies)\b[^.\n]{0,30}\b(?:swollen|cracked|damaged)\b/i, 'swollen or cracked batteries'],
    ].filter(([re]) => !/** @type {RegExp} */ (re).test(t)).map(([, name]) => name);
    if (missing.length > 0) return `The guide doesn't say it can't take ${missing.join(', ')}. Lines 11 to 15 of \`${GROUP}\` list them.`;
    if (!/\be-?\s?bikes?\b|\be-?\s?scooters?\b/i.test(t)) return `The guide misses a rule that's new this month. Read every line of \`${NOTES}\` about March.`;
    return true;
  },
};

const PHONE = /\b555[- .]?01\d\d\b/g;
const LIBRARY = '5550100';

/** @type {Item} */
export const privacyRight = {
  text: 'no personal number is on the guide',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const other = [...g.text.matchAll(PHONE)].map((m) => m[0]).find((n) => n.replace(/\D/g, '') !== LIBRARY);
    if (other) return `The guide gives ${other}. Maya's brief asks for no personal numbers (line 16 of \`${BRIEF}\`), and line 23 of \`${GROUP}\` says Priya's number never goes on anything public.`;
    return true;
  },
};

/** @type {Item} */
export const contactRight = {
  text: 'the guide gives the library\'s public number',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    if (![...g.text.matchAll(PHONE)].some((m) => m[0].replace(/\D/g, '') === LIBRARY)) return `The guide gives no number to call. Line 16 of \`${BRIEF}\` names the one the front desk answers.`;
    return true;
  },
};

// A source named the way a person would: by file, by kind, or by who sent it.
const SOURCE = /\bbooking(?:[- ]confirmation)?(?:-march)?(?:-text)?(?:\.md|\.pdf)?\b|\bmeeting[- ]notes\b|\bmeeting\b|\bminutes\b|\b20 feb(?:ruary)?\b|\bgroup[- ]notes\b|\bstanding notes\b|\bnotes\b|\bbrief(?:\.md)?\b|\bmaya['’]s (?:email|message|request)\b|\bpriya['’]s message\b|\bflyer\b|\b[\w-]+\.(?:md|pdf|png)\b/gi;
// The guide's facts, as a note would name them.
const FACTS = /** @type {const} */ ([
  ['the date', /\b13(?:th)?\s+march\b|\bmarch\s+13|\bdate\b|\bsaturday\b|\bwhich day\b/i],
  ['the times', /\b10[:.]30\b|\bhalf past ten\b|\b1\s*pm\b|\b13:00\b|\btimes?\b|\bhours\b|\badmission\b|\bdoors\b|\bstart(?:s|ing)?\b|\bfinish(?:es)?\b|\bends?\b/i],
  ['the room', /\broom b\b|\bfirst floor\b|\bvenue\b|\blocation\b|\bwhere\b/i],
  ['the places', /\bplaces?\b|\bcapacity\b|\bsign-?ups?\b|\bcap(?:ped)?\b|\blimit(?:ed)?\b|\b30\b|\bthirty\b/i],
  ['how to book', /\bevents page\b|\bwalk-?ins?\b|\bhow (?:to|people) book\b|\bbook(?:s|ing)? (?:on|through|via|online)\b|\bregist(?:er|ration)\b/i],
  ['what we can\'t take', /\bmicrowaves?\b|\bgas\b|\bbatter(?:y|ies)\b|\be-?\s?bikes?\b|\be-?\s?scooters?\b|\bcan['’]t (?:take|bring|accept|fix)\b|\b(?:not|don['’]t) accept\b|\bwhat to bring\b|\bbring\b/i],
  ['the contact number', /\b555[- .]?0100\b|\bcontact\b|\bphone\b|\bnumber\b|\bevents desk\b|\bfront desk\b/i],
]);
const FLYER_FIRST = /\bflyer\b[^.\n]*\b(?:wins?|over|above|before|first|trust(?:ed)?)\b[^.\n]*\bbooking\b/i;
const OPEN_HEADING = /^#{1,6}\s*(?:still open|open questions?|not yet confirmed|unconfirmed|open items?|to confirm|outstanding|open)\b/i;
const LIFT = /\blift\b|\bstep[- ]free\b|\belevator\b|\bwheelchair\b/i;
// What a claim about the lift must say: how it stands, not just the word.
const LIFT_STATUS = /\bwork(?:s|ing)?\b|\bfixed\b|\brepair(?:s|ed)?\b|\bout of (?:service|order)\b|\bbroken\b|\bengineer\b|\bconfirm\w*|\bcheck\w*|\bpriya\b|\bstep[- ]free\b|\btbc\b|\btbd\b|\bunknown\b|\bunconfirmed\b|\bverif\w*/i;
const UNSETTLED = /\bnot (?:yet )?(?:confirmed|known|sure|certain|checked|fixed)\b|\bunconfirmed\b|\bto be confirmed\b|\btbc\b|\btbd\b|\bunknown\b|\bunsure\b|\bwhether\b|\bpending\b|\bwaiting\b|\bopen\b|\bto confirm\b|\bconfirming\b|\bbeing (?:confirmed|checked|fixed|repaired)\b|\bto check\b|\bchecking\b|\buntil\b|\bonce\b|\bwhen (?:priya|she|the engineer|it)\b|\bif\b|\bhasn['’]t\b|\bhaven['’]t\b|\bisn['’]t (?:confirmed|known|fixed)\b|\bdue\b|\byet\b|\?/i;
// "The lift works", "step-free: confirmed": a settled claim the sources don't make.
const LIFT_SETTLED = /\b(?:lift|elevator|step[- ]free(?: access)?|access)\b[^.;|\n]{0,40}?\b(?:confirmed|working|works|fixed|repaired|sorted|fine|ok|okay|in service|guaranteed|no problem)\b|\b(?:confirmed|guaranteed|fully)\s+(?:step[- ]free|accessible|lift)\b/i;
const NOT_SETTLED = /\bnot\b|n['’]t\b|\bun\w+|\byet to\b|\bto be\b|\bbeing\b|\bstill to\b|\buntil\b|\bonce\b|\bwhen\b|\bif\b|\bwhether\b|\bto (?:confirm|check)\b|\bconfirm(?:s|ing)?\b(?! (?:that )?(?:it|the lift) (?:is|was))|\bbefore\b|\bnobody\b|\bno one\b|\bneeds? to\b|\bmust\b|\bshould\b|\bwill\b|\bdue\b|\?/i;

/** One claim per list item, paragraph or table row; a separator row is none. @param {string} text */
const noteClaims = (text) => claims(text.replace(/^(\s*\|.*)$/gm, '\n$1\n')).filter((c) => !/^\|?[\s:|-]+\|?$/.test(c));
const plainClaim = (/** @type {string} */ c) => c.replace(/\*\*|__|`/g, '').replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/\s*\|\s*/g, ' | ').trim();

/** @type {Item} */
export const noteRight = {
  text: '`fixit/march/readiness-note.md` gives the public limit and why, each fact\'s source, and where the lift really stands',
  check(repo) {
    const text = repo.read(NOTE);
    if (text === null) return `There's no \`${NOTE}\` yet. Write one for Maya: the public limit and the line that sets it, each fact with its source, and what's still open.`;
    const all = noteClaims(text).map(plainClaim);
    const body = all.filter((c) => !/^#/.test(c));
    // The same line over and over says nothing more each time.
    const seen = new Map();
    for (const c of body) seen.set(c.toLowerCase(), (seen.get(c.toLowerCase()) ?? 0) + 1);
    const [repeated, times] = [...seen.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    if (times >= 3) return `The readiness note says "${quote(body.find((c) => c.toLowerCase() === repeated) ?? repeated)}" ${times} times. Say which fact each source settles, so Maya can check it without asking you.`;
    if (FLYER_FIRST.test(text)) return 'The readiness note puts the flyer above the booking. Which of the two is about March, and which is signed?';

    // The public limit: right, explained, and never contradicted.
    for (const c of body) {
      for (const h of headcounts(c)) {
        const why = miscount(h);
        if (why) return countHint('The readiness note', h, why);
      }
    }
    const limit = body.find((c) => headcounts(c).some(PUBLIC_30));
    if (!limit) return `The readiness note doesn't give Maya the public limit. How many people can book, and which line of \`${NOTES}\` says so?`;
    const explained = /\bmeeting\b|\bminutes\b|\b20 feb|\bnotes\b/i.test(limit.replace(/\bgroup[- ]notes\b|\bstanding notes\b/gi, ''))
      || body.some((c) => headcounts(c).some((h) => h.n === 40 && h.kind === 'total'))
      || /\b(?:ten|10)\s+volunteers\b/i.test(text);
    if (!explained) return `The readiness note says "${quote(limit)}" but not why it's 30 when the booking says 40. Line 14 of \`${BOOKING_TEXT}\` says who the 40 includes, and line 11 of \`${NOTES}\` sets the cap.`;

    // The lift: how it stands, as the sources leave it.
    const sentences = body.flatMap((c) => c.split(/(?<=[.!?])\s+|\s+\|\s+/)).filter(Boolean);
    const settled = sentences.find((s) => LIFT_SETTLED.test(s) && !NOT_SETTLED.test(s));
    if (settled) return `The readiness note says "${quote(settled)}". Line 12 of \`${NOTES}\` says who has to confirm the lift before anyone calls it step-free, and nothing newer says they have.`;
    /** @type {string[]} */
    const underOpen = [];
    let open = false;
    for (const c of all) {
      if (/^#/.test(c)) { open = OPEN_HEADING.test(c); continue; }
      if (open) underOpen.push(c);
    }
    const lifts = body.filter((c) => LIFT.test(c));
    const honest = lifts.find((c) => LIFT_STATUS.test(c) && (UNSETTLED.test(c) || underOpen.includes(c)));
    if (!honest) {
      const bare = lifts[0];
      if (bare) return `The readiness note says "${quote(bare)}" but not where the lift stands. Is it working, and who is confirming it? Line 12 of \`${NOTES}\`.`;
      return `The readiness note doesn't say the lift is still to be confirmed. Line 12 of \`${NOTES}\` says what has to happen first.`;
    }

    // Every other fact with the file it comes from.
    const sourced = FACTS.filter(([, re]) => body.some((c) => {
      if (!re.test(c)) return false;
      // A source named apart from the fact's own words: "Booking: the group notes" names one, "Booking:" alone doesn't.
      const rest = c.replace(re, ' ');
      return (rest.match(SOURCE) ?? []).length > 0;
    })).map(([name]) => name);
    if (sourced.length < 4) {
      const missing = FACTS.map(([name]) => name).filter((n) => !sourced.includes(n));
      return `The readiness note names a source for ${sourced.length} of the guide's facts${sourced.length ? ` (${sourced.join(', ')})` : ''}. Add the file each comes from for the others: ${missing.join(', ')}.`;
    }
    return true;
  },
};

/** @type {Item[]} */
export const items = [sourcesKept, dateRight, timesRight, capacityRight, accessRight, rulesRight, privacyRight, contactRight, noteRight];
