// @ts-check
// The B-1 comparison's transfer task: the concert listing for Sam. This
// check reads only that the sources are as they arrived and that the
// listing says why it's ready. It says nothing about whether the listing is
// right: the comparison scores that afterwards (the kit's scoring key), so
// the check gives the Learner no hint about which claims were wrong.
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

// Whether `path` reads as it did in the copy's first commit, line ends and
// trailing space aside (as the Fix-It pilot's checks read their sources).
/**
 * @param {Repo} repo
 * @param {string} path
 * @param {string} text
 */
function untouched(repo, path, text) {
  const plain = (/** @type {string} */ s) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  try {
    return repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').filter(Boolean)
      .some((root) => plain(repo.gitLocal('show', `${root}:./${path}`)) === plain(text));
  } catch {
    return false;
  }
}

export const title = 'The concert listing, ready to send';

export const LISTING = 'concert/listing.md';
export const SOURCES = [
  'concert/REQUEST.md',
  'concert/venue-confirmation.md',
  'concert/committee-minutes-2027-02-24.md',
  'concert/programme-2026.md',
];

/** @type {Item} */
export const sourcesKept = {
  text: 'the sources are as they arrived',
  check(repo) {
    for (const path of SOURCES) {
      const text = repo.read(path);
      if (text === null) return `\`${path}\` is missing. Reset this step to bring it back.`;
      if (!untouched(repo, path, text)) return `\`${path}\` has changed. Sources stay as they arrived: undo the change, or reset this step.`;
    }
    return true;
  },
};

/** @type {Item} */
export const listingReady = {
  text: '`concert/listing.md` exists and says why it\'s ready',
  check(repo) {
    const text = repo.read(LISTING);
    if (text === null) return `There's no \`${LISTING}\` yet.`;
    if (!/\bready\b/i.test(text)) return `\`${LISTING}\` doesn't say why it's ready. Add a line that starts "Ready because".`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [sourcesKept, listingReady];
