// @ts-check
// Reconcile conflicting findings (Fix-It, Advanced lesson 2). The check reads
// Sam's hand edit of the August page and the decision note the Learner
// writes beside it: the private number and the parking line no source backs
// are gone, the toilet line the stale review flagged is kept, and the note
// says what was acted on, what was set aside and why, and the one question
// still open.
import { claims, quote } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */

export const title = 'Reconcile conflicting findings';

export const PAGE = 'fixit/summer/a-8/august-sam-2027-06-09.md';
export const NOTE = 'fixit/summer/a-8/august-decision.md';
const NOTE_NAME = 'august-decision.md';

/** The text a reader sees: no HTML comments, no struck-through text, straight apostrophes. @param {string} text */
const shown = (text) => text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/~~[^~]*~~/g, ' ').replace(/[‘’]/g, "'");

/** A page's sentences, one claim at a time, its bold and heading marks aside. @param {string} text */
const sentences = (text) =>
  claims(shown(text))
    .map((c) => c.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/^#+\s+/, ''))
    .flatMap((c) => c.split(/(?<=[.;!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);

// The numbers the kit's hook knows, written as it reads them.
const NUMBER = /555[ .-]?01\d{2}/g;
const PUBLIC_NUMBERS = new Set(['555-0100', '555-0130']);

// A claim that parking is free, wherever it is, or that there is parking at
// the centre itself. A sentence that leaves parking open ("being confirmed",
// "ask the office") claims neither, but "free" is a claim however it is
// hedged: no source says what parking costs.
const PARKING = /\b(?:parking|car\s?park|park)\b/i;
const FREE = /\bfree\b/i;
const ON_SITE = /\b(?:at the centre|on[- ]site|its own|the centre's|our)\b|\bcar\s?park\b/i;
const OPEN = /\b(?:being confirmed|to be confirmed|not (?:yet )?confirmed|unconfirmed|tbc|ask|check with)\b|\?/i;

/** @type {Item} */
export const pageRight = {
  text: "`august-sam-2027-06-09.md` gives the Northside office's number and no private one, and claims no parking",
  check(repo) {
    const text = repo.read(PAGE);
    if (text === null) return `\`${PAGE}\` is missing. Reset this step to bring it back.`;
    const numbers = [...shown(text).matchAll(NUMBER)].map(([n]) => n.replace(/^555[ .-]?/, '555-'));
    const other = numbers.filter((n) => !PUBLIC_NUMBERS.has(n));
    if (other.includes('555-0162'))
      return "The page still gives 555-0162, Sam's mobile. A public page gives only the venue's public number: the Northside office, 555-0130.";
    if (other.length) return `The page gives ${other[0]}, which is not a public number. A public page gives only the Northside office, 555-0130.`;
    if (!numbers.includes('555-0130')) return "The page gives no number to call now. Kofi's email gives the public one: the Northside office, 555-0130.";
    const parking = sentences(text).find((s) => PARKING.test(s) && (FREE.test(s) || (ON_SITE.test(s) && !OPEN.test(s))));
    if (parking) return `The page says "${parking}" Which source says that?`;
    return true;
  },
};

// The toilet line as Kofi's email of 25 May has it: the accessible toilet is
// back in use. A word for a closed or missing toilet in that sentence is the
// stale review's.
const TOILET = /\baccessible toilets?\b/i;
const CLOSED = /\bno (?:accessible )?toilets?\b|\bnot\b|n't\b|\bunavailable\b|\bclosed\b|\bout of (?:use|order|service)\b|\bbeing (?:repaired|fixed|worked on)\b/i;

/** @type {Item} */
export const toiletKept = {
  text: "the page still says the accessible toilet is available, as Kofi's email of 25 May does",
  check(repo) {
    const text = repo.read(PAGE);
    if (text === null) return `\`${PAGE}\` is missing. Reset this step to bring it back.`;
    if (/refurbish/i.test(shown(text)))
      return "The page now says the toilet is being refurbished. Kofi's email of 25 May says it's back in use. Which source is newer?";
    const line = sentences(text).find((s) => TOILET.test(s));
    if (!line) return "The page no longer mentions the accessible toilet. Kofi's email of 25 May says it's back in use, so the page can say so.";
    if (CLOSED.test(line)) return `The page says "${line}" Kofi's email of 25 May says the accessible toilet is back in use. Which source is newer?`;
    return true;
  },
};

/**
 * A note's units: each list item, paragraph or table row, with the heading
 * it sits under (below the title), so "## Accessibility" then "Set aside."
 * reads as one line about one finding.
 * @param {string} text
 */
function units(text) {
  let heading = '';
  return claims(shown(text).replace(/^([ \t]*\|.*)$/gm, '\n$1\n')).flatMap((claim) => {
    const h = claim.match(/^#{2,}\s+(.*)/);
    if (h) {
      heading = h[1] ?? '';
      return [claim];
    }
    if (/^#\s/.test(claim)) return [claim];
    return [heading ? `${heading} ${claim}` : claim];
  });
}

const REVIEWS = ['accuracy', 'accessibility', 'privacy'];
// A finding set aside, in the note's words. "Not set aside" is the opposite.
const SET_ASIDE =
  /(?<!\bnot |n't |never )\b(?:set aside|setting it aside|put aside|rejected|dismissed|ignored|overruled|overridden|superseded)\b|\b(?:not acted|didn't act|did not act|stale|older|out of date|outdated|no longer)\b/i;
// The newer evidence: Kofi's email, by its sender or its date.
const NEWER = /\bkofi'?s? (?:e-?mail|message|reply|note)\b|\b25(?:th)? may\b|\bmay 25(?:th)?\b|northside-august-email/i;
// The one question: asked, of the person who can answer it, about the line
// nobody's evidence covers.
const ASKED = /\?|\bask(?:s|ed|ing)?\b/i;
const ABOUT = /\bkofi\b|\bparking\b|\bcar\s?park\b/i;

/** @type {Item} */
export const noteWritten = {
  text: "`august-decision.md` says which findings you acted on, which you set aside and why, and the one question you're asking",
  check(repo) {
    const raw = repo.read(NOTE);
    if (raw === null)
      return `There's no \`${NOTE}\` yet. Write it beside Sam's page: which findings you acted on, which you set aside and why, and the one question you're asking.`;
    const lines = units(raw);
    const missing = REVIEWS.find((r) => !lines.some((l) => new RegExp(`\\b${r}\\b`, 'i').test(l)));
    if (missing) return `\`${NOTE_NAME}\` doesn't say what you did with the ${missing} review. Name each of the three: accuracy, accessibility and privacy.`;
    const access = lines.filter((l) => /\baccessibility\b/i.test(l));
    if (!access.some((l) => SET_ASIDE.test(l)))
      return `\`${NOTE_NAME}\` says "${quote(access[0] ?? '')}". Did you act on the accessibility finding, or set it aside? Say which on its line, and why.`;
    if (!lines.some((l) => NEWER.test(l))) return `\`${NOTE_NAME}\` doesn't name the newer evidence. Which email settles the toilet line, and when was it sent?`;
    if (!lines.some((l) => ASKED.test(l) && ABOUT.test(l)))
      return `\`${NOTE_NAME}\` doesn't give the one question you're asking. What does nobody's evidence cover, and who can answer it?`;
    return true;
  },
};

export const items = [pageRight, toiletKept, noteWritten];
