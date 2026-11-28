// @ts-check
// Shared by the Fix-It course's checks: a document read as claims, one per
// list item or paragraph, and the quoting the checks use in their hints.
/** @import { Repo } from '../repo.mjs' */

// One claim per list item or paragraph, each on one line, so a claim wrapped
// over several lines still reads as one. Struck-through text (`~~like
// this~~`) and HTML comments are left out: they are what the text no longer
// says, or what a reader never sees.
/** @param {string} text */
export function claims(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split(/\r?\n(?=\s*(?:[-*+]|\d+[.)])\s)|\r?\n\s*\r?\n/)
    .map((claim) => claim.replace(/~~[^~]*~~/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// A claim as a hint quotes it: no list marker or heading hashes, no closing
// stop, at most 120 characters.
/** @param {string} claim */
export function quote(claim) {
  const plain = claim.replace(/^(?:[-*+]|\d+[.)]|#+)\s+/, '').replace(/[.\s]+$/, '');
  return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
}

// Whether `path` reads as it did in the copy's first commit, line ends and
// trailing space aside: false when that commit lacks it or git can't say.
/**
 * @param {Repo} repo
 * @param {string} path
 * @param {string} text
 */
export function untouched(repo, path, text) {
  const plain = (/** @type {string} */ s) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  try {
    return repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').filter(Boolean)
      .some((root) => plain(repo.gitLocal('show', `${root}:./${path}`)) === plain(text));
  } catch {
    return false;
  }
}

// Words that mark a claim as not yet settled: for someone to confirm or
// check, to be confirmed, or a question. "Confirmed" and "checked" alone
// say it is settled, so they mark nothing.
export const OPEN = /\b(?:confirm(?:s|ing)?|check(?:s|ing)?|verify|tbc|tbd|to be (?:confirmed|checked)|not (?:yet )?(?:confirmed|checked|sure|known|certain)|unconfirmed|unchecked|unsure|unknown|ask (?:priya|dee|the library|maya)|being (?:confirmed|checked))\b|\?/i;
