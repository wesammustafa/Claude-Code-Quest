// @ts-check
// Every lesson and capstone with a check, in course order.

/**
 * What a check returns: true when the item passes, or the hint to show.
 * @typedef {true | string} Result
 */

/**
 * One item of a lesson's check: `local` when it reads the Learner's
 * machine (the installed CLI or files under .practice/).
 * @typedef {{ text: string, local?: boolean, check: (repo: Repo) => Result }} Item
 */

/** @typedef {{ title: string, items: readonly Item[] }} Lesson */

import * as b1 from './b-1.mjs';
/** @import { Repo } from '../repo.mjs' */

/** @type {Record<string, Lesson | undefined>} */
export const lessons = { 'b-1': b1 };
