// @ts-check
// Hand the kit to Sam (Fix-It, the Intermediate capstone). The kit starts
// with three faults: tier 1 of the source order trusts only a signed
// booking, the contacts rule names only Priya's number, private/ folders
// and rosters, and the number guard knows only 555-0187. The check reads the
// kit for the fixes and runs the guard on test edits, as Claude Code runs it
// before an Edit or a Write (i-4's runner), so any guard that behaves right
// passes. It reads the April guide and its fact table for what a fresh run
// of the fixed kit makes, and KIT.md and the note to Sam. Which session wrote
// the guide, and whether the attendee-guide skill ran, is the host's to
// record (a record no Check reads yet): the files are what this check reads,
// and a guide that reads right while the kit's source order still trusts
// only a signed booking is one the kit can't have made.
import { frontmatter } from '../frontmatter.mjs';
import { claims, quote } from './fixit-claims.mjs';
import { blockedBy, blocks, call, hooksOf, rules, ruleFor, run, UNREADABLE, unrunnable } from './i-4.mjs';
import { stepsOf } from './i-7.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Hand the kit to Sam';

export const CLAUDE = 'fixit/CLAUDE.md';
export const SKILL = 'fixit/.claude/skills/attendee-guide/SKILL.md';
export const SHARED = 'fixit/.claude/settings.json';
export const LOCAL = 'fixit/.claude/settings.local.json';
export const GUIDE = 'fixit/april/attendee-guide.md';
export const FACTS = 'fixit/april/facts.md';
export const KIT = 'fixit/KIT.md';
export const NOTE = 'fixit/april/handoff-note.md';
const RUN_AGAIN = 'Fix the kit, then run it again in a fresh session, as Sam will.';

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

/** @param {Repo} repo @returns {{ error: string } | { shared: any, local: any }} */
function settings(repo) {
  const shared = json(repo, SHARED);
  if ('error' in shared) return shared;
  const local = json(repo, LOCAL);
  if ('error' in local) return local;
  return { shared: shared.value, local: local.value };
}

// The lines under the first heading `re` matches, up to the next heading;
// null when no heading matches.
/** @param {string} text @param {RegExp} re */
function section(text, re) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const at = lines.findIndex((l) => /^#+\s/.test(l) && re.test(l));
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && /^#+\s/.test(l));
  return lines.slice(at + 1, end < 0 ? undefined : end).join('\n');
}

// The source order's tiers: the numbered lines under "Which source wins",
// or the file's numbered lines when that heading is gone.
/** @param {string} text */
const tiersOf = (text) => stepsOf(section(text, /\bwhich source wins\b|\bsource order\b|\bsources? wins?\b/i) ?? text);

const SIGNED = /\bsigned\s+(?:booking|form|contract|agreement)s?(?:\s+(?:confirmation|form)s?)?/gi;
const WRITTEN = /\b(?:e-?mails?|e-?mailed|written|in writing|writes|messages?|letters?|texts?|texted|confirm(?:ation|ations|s|ed|ing)?)\b/i;
const VENUE_KIND = /\b(?:venues?|venue['’]s|centres?|centers?|staff|managers?|caretakers?|hosts?|organi[sz]ations?)\b/i;
const VENUE_NAME = /\b(?:northside|st\.?\s*anne['’]?s|kofi|gary|grove street|elm lane|millbrook)\b/i;
const FLYER = /\b(?:flyers?|listings?|newsletters?|posters?|leaflets?)\b/i;
const NOT_FLYER = /\b(?:not|never|no|isn['’]t|aren['’]t|except|rather than|instead of)\b[^.;]*\b(?:flyers?|listings?|newsletters?|posters?|leaflets?)\b/i;
// What a rule names once its examples are set aside: text in brackets, or
// after "for example", "such as" or "like", is an example, not the rule.
/** @param {string} s */
const ruleOnly = (s) => s.replace(/\([^)]*\)/g, ' ').replace(/\b(?:for example|for instance|e\.g\.|such as|like|including)\b[^.;]*/gi, ' ');
// Whether a rule trusts something written by the venue beyond a signed
// booking, and whose it is.
/** @param {string} s */
const trustsWritten = (s) => WRITTEN.test(s.replace(SIGNED, ' '));

/**
 * Why tier 1 of the source order is wrong, or null when it names the
 * venue's written confirmation in general.
 * @param {Repo} repo
 * @returns {string | null}
 */
function tierFault(repo) {
  const text = repo.read(CLAUDE);
  if (text === null) return `There's no \`${CLAUDE}\`. It's the kit's memory, which says which source wins: put it back from your practice copy.`;
  const tiers = tiersOf(text);
  const tier1 = tiers.find((t) => t.n === 1);
  if (!tier1) return "`fixit/CLAUDE.md` has no tier 1 in its source order. Which source wins on venue facts? Put it first, numbered 1.";
  const rule = ruleOnly(tier1.text);
  if (VENUE_NAME.test(rule)) return 'Tier 1 names one venue. The next venue may confirm another way. Describe the kind of source, not the venue.';
  if (FLYER.test(tier1.text) && !NOT_FLYER.test(tier1.text)) return `Tier 1 now lets a flyer or a listing win: "${quote(tier1.text)}". Old flyers and forwarded listings stay last: they never decide times, capacity, access, parking or contacts.`;
  if (!trustsWritten(rule)) return `Tier 1 still trusts only a signed booking: "${quote(tier1.text)}". Kofi's email says the centre doesn't do signed forms, so nothing he confirmed can win. Name the venue's written confirmation, whatever form it takes.`;
  if (!VENUE_KIND.test(rule)) return `Tier 1 says "${quote(tier1.text)}", but not whose. An email from anyone isn't the venue's confirmation: say it comes from the venue or its staff.`;
  if (!tiers.some((t) => t.n > 1 && FLYER.test(t.text))) return "The source order no longer names old flyers and forwarded listings. Keep them last: they never decide times, capacity, access, parking or contacts.";
  return null;
}

// A skill step that says what wins on venue facts.
const SAYS_WINS = /\bwins?\b|\bsource order\b|\bconfirmation\b/i;
const SIGNED_WINS = /\bsigned\b/i;

/** @type {Item} */
export const sourceOrder = {
  text: 'tier 1 of the source order in `fixit/CLAUDE.md`, and the skill\'s step that applies it, name the venue\'s written confirmation in any form, not one venue\'s, with flyers and listings still last',
  check(repo) {
    const fault = tierFault(repo);
    if (fault) return fault;
    const text = repo.read(SKILL);
    if (text === null) return `There's no \`${SKILL}\`. It's the kit's skill: put it back from your practice copy, then make its step 3 match the source order.`;
    for (const step of stepsOf(frontmatter(text)?.body ?? text).filter((s) => SAYS_WINS.test(s.text))) {
      const rule = ruleOnly(step.text);
      if (VENUE_NAME.test(rule)) return `Step ${step.n} of the skill names one venue: "${quote(step.text)}". The next venue may confirm another way. Describe the kind of source, as tier 1 does.`;
      if (SIGNED_WINS.test(step.text) && !(trustsWritten(rule) && VENUE_KIND.test(rule))) return `Step ${step.n} of the skill still says the signed booking wins on venue facts: "${quote(step.text)}". Sam's runs follow the skill too: make it say what tier 1 says.`;
    }
    return true;
  },
};

// Test edits for the guard: numbers it must block on a public page, and the
// venues' public numbers it must let through.
const SAM = 'On the day, ring Sam on 555-0162.';
/** @type {[string, string, string][]} */
const PRIVATE = [
  ['555-0175', "Jordan's number from the roster", 'Welcome desk: Jordan, 555-0175.'],
  ['555-0168', "a caretaker's mobile", 'If the gate is locked, text 555-0168.'],
  ['555 0187', "Priya's number, written with a space", 'Access questions: Priya, 555 0187.'],
];
/** @type {[string, string, string][]} */
const PUBLIC = [
  ['555-0130', "the centre's public number", 'Questions: Northside Community Centre office, 555-0130.'],
  ['555-0100', "the library's public number", 'Questions: Millbrook Library events desk, 555-0100.'],
];
const APRIL = 'april/attendee-guide.md';
const MAY = 'may/attendee-guide.md';
const PRIVATE_NOTE = 'april/private/contacts.md';
const MOVE = "Sam won't have it: put it in the shared `.claude/settings.json`.";

// Whether CLAUDE.md's contacts rule covers numbers wherever they come from,
// so Claude leaves Sam's out on its own.
const CONTACTS_GENERAL = /\bonly\b[^.]*\bpublic\b|\b(?:every|any|all)\s+other\b[^.]*\b(?:numbers?|contacts?)\b|\bwherever\b|\bno (?:other |personal |private )?(?:phone )?numbers?\b[^.]*\bexcept\b|\b(?:personal|mobile)\b[^.]*\bnumbers?\b|\bSam\b|555[ .-]?0162/i;
/** @param {Repo} repo */
const contactsGeneral = (repo) => CONTACTS_GENERAL.test(section(repo.read(CLAUDE) ?? '', /\bcontacts?\b/i) ?? '');

/** @type {Item} */
export const numberGuard = {
  text: "the number guard blocks Sam's, a volunteer's, a caretaker's and Priya's numbers on a public page, lets the venues' public numbers and private notes through, blocks when it can't read the edit, and is registered on Edit and Write, failing closed, in the shared settings",
  check(repo) {
    const f = settings(repo);
    if ('error' in f) return f.error;
    const all = hooksOf(f.shared);
    const both = all.filter((h) => h.edit && h.write);
    const broken = unrunnable(repo, both);
    if (broken) return broken;
    const guide = (/** @type {'Write' | 'Edit'} */ tool, /** @type {string} */ text) => call(repo, tool, APRIL, text);
    const blocked = (/** @type {string} */ input) => blockedBy(repo, both, input).length > 0;
    const guards = blockedBy(repo, both, guide('Write', SAM));
    if (guards.length === 0) {
      if (blockedBy(repo, hooksOf(f.local), guide('Write', SAM)).length) return `The guard is in your local settings, \`.claude/settings.local.json\`. ${MOVE}`;
      if (blockedBy(repo, all.filter((h) => h.edit && !h.write), guide('Write', SAM)).length) return "A Write of 555-0162 to the April guide wasn't blocked: your guard runs for Edit only. Match `Edit|Write`.";
      const hidden = ruleFor([...rules(f.shared, 'deny'), ...rules(f.local, 'deny')], 'Read', 'april/sam-notes.md');
      if (hidden) return `\`${hidden}\` hides Sam's notes, and his cap of 40 and the e-bike reminder with them. It protects one file in one month: the guard still lets 555-0162 onto a public page from any other file. Widen the guard instead.`;
      if (f.shared === null) return `There's no \`${SHARED}\`. It's the kit's shared settings, where the guard is registered: put it back from your practice copy.`;
      if (contactsGeneral(repo)) return 'The guard still allows 555-0162 on a public page. Guidance worked this time; the guard is what makes it hold every time.';
      return "The guard still lets 555-0162, Sam's mobile, onto a public page: it knows only Priya's number. Make it block every number but the venues' public ones.";
    }
    for (const [n, whose, line] of PRIVATE) if (!blocked(guide('Write', line))) return `The guard blocks 555-0162 but lets ${n}, ${whose}, onto a public page. Block every number but the venues' public ones, in any spacing.`;
    if (!blocked(guide('Edit', `**Questions:** ${SAM}`))) return "555-0162 edited into the guide wasn't blocked, only written in a whole new file. Make the guard read an edit's new text too.";
    if (!guards.some((h) => h.block)) return 'Your guard lets edits through if the script itself can\'t run. Add `"onFailure": "block"` to its hook, so it fails closed.';
    if (!guards.some((h) => run(repo, h, UNREADABLE).exit === 2)) return "Your guard lets an edit through when it can't read the input. Make it block then, with exit 2.";
    for (const [n, whose, line] of PUBLIC) if (blocked(guide('Write', line))) return `Your guard also blocks ${n}, ${whose}, on the April guide. A public page must still give it.`;
    if (guards.every((h) => blocks(h, run(repo, h, call(repo, 'Write', PRIVATE_NOTE, SAM))))) return `Your guard blocks 555-0162 in \`${PRIVATE_NOTE}\`, a private note. Only public pages are guarded.`;
    return true;
  },
};

const ROSTER = 'april/private/roster.csv';
const NEXT_ROSTER = 'may/private/roster.csv';

/** @type {Item} */
export const privateFolders = {
  text: '`fixit/.claude/settings.json` still keeps Claude out of every `private/` folder',
  check(repo) {
    const f = settings(repo);
    if ('error' in f) return f.error;
    if (f.shared === null) return `There's no \`${SHARED}\`. It's the kit's shared settings: put it back from your practice copy.`;
    const deny = rules(f.shared, 'deny');
    const april = ruleFor(deny, 'Read', ROSTER);
    const next = ruleFor(deny, 'Read', NEXT_ROSTER);
    if (april && next) return true;
    if (april || next) return `\`${april ?? next}\` covers one month's \`private/\` folder only. Keep the kit's rule for every month: \`Read(./**/private/**)\`.`;
    return `The shared settings no longer keep Claude out of the \`private/\` folders: \`${ROSTER}\` can be read. A fix must not remove an earlier guard: put \`Read(./**/private/**)\` back in \`deny\`.`;
  },
};

const PENDING = /\bbeing confirmed\b|\bto be confirmed\b|\bnot (?:yet )?confirmed\b|\bunconfirmed\b|\btbc\b|\bstill confirming\b/i;
const PHONE = /\b555[ .-]?\d{4}\b/g;
const PUBLIC_NUMBER = /^555[ .-]?01(?:00|30)$/;
const DATE = /\bSat(?:urday)?\.?,?\s+(?:10(?:th)?\s+April|April\s+10(?:th)?)\b/i;
const HOURS = /\b10(?:[:.]00)?\s?(?:am|a\.m\.)?\s*(?:to|until|till|-|–)\s*(?:12[:.]30\s?(?:pm|p\.m\.)?|half past twelve)/i;
const FLYER_HOURS = /\b10(?:[:.]00)?\s?(?:am)?\s*(?:to|until|till|-|–)\s*(?:1\s?pm|13[:.]00)\b/i;
const MAIN_HALL = /\bmain hall\b/i;
const STEP_FREE = /\bstep-?\s?free\b|\blevel (?:access|floor|entrance)\b|\bno steps\b/i;
const TOILET = /\btoilets?\b/i;
const TOILET_SHUT = /\brefurbish|\bclosed\b|\bout of (?:use|order|service)\b|\bunavailable\b|\bnot available\b|\bisn['’]t available\b|\bnot in use\b/i;
const TOILET_ELSEWHERE = /\blibrary\b|\bacross the road\b|\bnearest\b/i;
const PLACES_WRONG = /\b(?:50|60|fifty|sixty)\s+(?:places|people|spaces|seats|sign-?ups)\b|\bjust turn up\b/i;
const PLACES = /\b(?:40|forty)\s+(?:places|people|spaces|seats|sign-?ups)\b|\b(?:places|spaces) are limited\b|\blimited (?:places|spaces|numbers)\b/i;
const EBIKE = /\be-?\s?bikes?\b/i;

// A page's claims, one per line: a guide's bold-labelled lines run on with
// no blank line between them, and each is a fact of its own.
/** @param {string} text */
const lineClaims = (text) => claims(text.replace(/\r?\n/g, '\n\n'));

// What hides Sam's notes from Claude, for the hints that need it.
/** @param {Repo} repo */
function notesHidden(repo) {
  const f = settings(repo);
  if ('error' in f) return null;
  return ruleFor([...rules(f.shared, 'deny'), ...rules(f.local, 'deny')], 'Read', 'april/sam-notes.md') ?? null;
}

/** @type {Item} */
export const aprilGuide = {
  text: "`fixit/april/attendee-guide.md` gives Kofi's facts as facts, Sam's 40 places and the e-bike rule, and no number but a venue's public one",
  check(repo) {
    const text = repo.read(GUIDE);
    if (text === null) return `There's no \`${GUIDE}\` yet. Run the kit as Sam would: a fresh session in \`fixit/\`, Sam's words.`;
    const lines = lineClaims(text);
    const open = lines.find((c) => PENDING.test(c));
    if (open) return `The April guide still says "${quote(open)}". Kofi confirmed the date, hours, room and access in writing, so none of it is being confirmed. ${RUN_AGAIN}`;
    for (const c of lines) {
      const leak = [...c.matchAll(PHONE)].map((m) => m[0]).find((n) => !PUBLIC_NUMBER.test(n));
      if (leak) return `The April guide gives ${leak}: "${quote(c)}". Only a venue's public number goes on the noticeboard: here, the centre's 555-0130.`;
    }
    if (!DATE.test(text)) return "The April guide doesn't give the date, Saturday 10 April 2027.";
    const flyer = lines.find((c) => FLYER_HOURS.test(c));
    if (flyer) return `The April guide says "${quote(flyer)}". That's the old flyer's time. Kofi's email lets the public in from 10:00 and asks you to wrap up by 12:30.`;
    if (!HOURS.test(text)) return "The April guide doesn't give the public hours from Kofi's email: 10am to 12:30pm.";
    if (!MAIN_HALL.test(text)) return "The April guide doesn't say where: Kofi's email books the Main Hall.";
    if (!STEP_FREE.test(text)) return "The April guide doesn't say how to get in. Kofi's email says the main entrance on Grove Street is step-free, with a level floor throughout.";
    if (!lines.some((c) => TOILET.test(c) && TOILET_SHUT.test(c) && TOILET_ELSEWHERE.test(c))) return "The April guide doesn't say the centre's accessible toilet is being refurbished, and where the nearest one is. Someone who needs it decides from that line whether they can come.";
    const hidden = notesHidden(repo);
    const why = hidden ? ` Claude can't read \`april/sam-notes.md\`: \`${hidden}\` denies it, so it never saw Sam's cap or the e-bike reminder.` : '';
    const wrong = lines.find((c) => PLACES_WRONG.test(c));
    if (wrong) return `The April guide says "${quote(wrong)}". 50 is the hall's limit with the helpers; Sam's notes cap sign-ups at 40.${why}`;
    if (!PLACES.test(text)) return `The April guide doesn't say how many can book. Sam's notes cap sign-ups at 40.${why}`;
    if (!EBIKE.test(text)) return `The April guide leaves out the e-bike battery rule, new since March: Sam's notes ask for a reminder.${why}`;
    const kit = repo.read(CLAUDE);
    const tier1 = kit === null ? undefined : tiersOf(kit).find((t) => t.n === 1);
    if (!tier1 || !trustsWritten(ruleOnly(tier1.text))) return `The guide reads right, but the kit as it stands can't have made it: tier 1 of its source order still trusts only a signed booking, so Sam's run would mark Kofi's facts as being confirmed. ${RUN_AGAIN}`;
    return true;
  },
};

const VENUE_EMAIL = /venue-email-northside|\bvenue['’]?s? e-?mail\b|\bkofi['’]?s? e-?mail\b|\bcentre['’]?s? e-?mail\b/i;
/** @type {[string, RegExp][]} */
const TOPICS = [
  ['the public hours', /\bhours\b|\btimes?\b|\bwhen\b/i],
  ['the room', /\broom\b|\bhall\b|\bwhere\b/i],
  ['access', /\baccess\b|\bgetting in\b|\bentrance\b|\bstep-?free\b/i],
];

// A fact table's rows, each as its cells; none for a file with no table.
/** @param {string} text */
const rowsOf = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s|:-]*\|?\s*$/.test(l))
    .map((l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()));

/** @type {Item} */
export const aprilFacts = {
  text: "`fixit/april/facts.md` cites Kofi's email for the hours, the room and access",
  check(repo) {
    const text = repo.read(FACTS);
    if (text === null) return `There's no \`${FACTS}\` yet. The skill writes it beside the guide: run the kit as Sam would.`;
    const rows = rowsOf(text).slice(1);
    for (const [name, topic] of TOPICS) {
      const row = rows.find((r) => topic.test(r[0] ?? ''));
      if (row) {
        if (PENDING.test(row.join(' '))) return `\`${FACTS}\` still has ${name} as being confirmed: "${quote(row.join(' | '))}". ${RUN_AGAIN}`;
        if (!VENUE_EMAIL.test(row[2] ?? '')) return `\`${FACTS}\` doesn't cite Kofi's email, \`venue-email-northside.md\`, for ${name}: "${quote(row.join(' | '))}". It's the venue's written confirmation, so it wins on venue facts.`;
        continue;
      }
      const line = lineClaims(text).find((c) => topic.test(c) && VENUE_EMAIL.test(c));
      if (!line) return `\`${FACTS}\` doesn't cite Kofi's email, \`venue-email-northside.md\`, for ${name}. It's the venue's written confirmation, so it wins on venue facts.`;
      if (PENDING.test(line)) return `\`${FACTS}\` still has ${name} as being confirmed: "${quote(line)}". ${RUN_AGAIN}`;
    }
    return true;
  },
};

const DOES_NOT = /\bdo(?:es)?\s*(?:not|n['’]t)\b|\bwon['’]t\b|\bcan['’]?t\b|\bcannot\b|\blimits?\b|\blimitations?\b/i;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\S/;
const TESTED = /\blast tested\b|\btested (?:on|with|in|against)\b|\btest(?:ed)?:/i;
const HEADING = /^\s*(?:#+\s+.*|\*\*[^*]+\*\*:?)\s*$/;

// KIT.md's parts: each heading, or line that is bold alone, with the lines
// under it.
/** @param {string} text */
function partsOf(text) {
  /** @type {{ heading: string, body: string[] }[]} */
  const out = [{ heading: '', body: [] }];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (HEADING.test(line)) out.push({ heading: line, body: [] });
    else out.at(-1)?.body.push(line);
  }
  return out;
}

/** @type {Item} */
export const kitLimits = {
  text: '`fixit/KIT.md` says what the kit does not do, at least two things, and when it was last tested, on April',
  check(repo) {
    const text = repo.read(KIT);
    if (text === null) return `There's no \`${KIT}\`. It's what Sam reads first: put it back from your practice copy, then say what the kit does not do.`;
    const parts = partsOf(text);
    const limits = parts.find((p) => DOES_NOT.test(p.heading));
    if (!limits) return "`fixit/KIT.md` doesn't say what the kit does not do. Sam needs its limits as much as its features: add a part for them, with at least two.";
    const count = limits.body.filter((l) => ITEM.test(l)).length;
    if (count < 2) return `\`fixit/KIT.md\` lists ${count === 0 ? 'nothing' : 'one thing'} the kit does not do. Name at least two honest limits, each as its own line.`;
    const tested = parts.find((p) => TESTED.test(p.heading)) ?? parts.find((p) => p.body.some((l) => TESTED.test(l)));
    if (!tested) return "`fixit/KIT.md` doesn't say when the kit was last tested on a real input. Add a line: which session, and how you ran it.";
    const said = TESTED.test(tested.heading) ? [tested.heading, ...tested.body].join(' ') : tested.body.filter((l) => TESTED.test(l)).join(' ');
    if (!/\bapril\b/i.test(said)) return "`fixit/KIT.md`'s last-tested line doesn't name April, the run you've just made. Say which session you tested it on.";
    return true;
  },
};

const KIT_PART = /\bCLAUDE\.md\b|\bsource order\b|\bwhich source wins\b|\btier (?:1|one)\b|\bSKILL\.md\b|\bskill\b|\bhooks?\b|\bguard\b|no-private-numbers|\bsettings(?:\.json)?\b|public-contacts|\bcontacts? (?:rule|line)\b|\bmemory\b/i;

/** @type {Item} */
export const handoffNote = {
  text: '`fixit/april/handoff-note.md` tells Sam which part of the kit you changed',
  check(repo) {
    const text = repo.read(NOTE);
    if (text === null || !text.trim()) return `There's no \`${NOTE}\` yet. Write Sam a short note: what you changed in the kit and why, and what to look at before sending.`;
    if (!KIT_PART.test(text)) return "Your note to Sam doesn't say which part of the kit you changed. Name it: the source order in CLAUDE.md, the skill, the guard or the settings.";
    return true;
  },
};

const GARY = 'If the side gate is locked, text Gary on 555-0168.';

/** @type {Item} */
export const mayGuard = {
  text: "the number guard blocks the caretaker's 555-0168 on `may/attendee-guide.md` too",
  check(repo) {
    const f = settings(repo);
    if ('error' in f) return f.error;
    const both = hooksOf(f.shared).filter((h) => h.edit && h.write);
    const broken = unrunnable(repo, both);
    if (broken) return broken;
    if (blockedBy(repo, both, call(repo, 'Write', MAY, GARY)).length) return true;
    if (!blockedBy(repo, both, call(repo, 'Write', APRIL, GARY)).length) return "No guard blocks 555-0168, the caretaker's mobile, on a public page. Widen the guard first: every number but the venues' public ones.";
    return "Your guard blocks 555-0168 on April's guide but not on `may/attendee-guide.md`. It must guard every month's public pages, not only April's.";
  },
};

/** @type {Item[]} */
export const items = [sourceOrder, numberGuard, privateFolders, aprilGuide, aprilFacts, kitLimits, handoffNote, mayGuard];
