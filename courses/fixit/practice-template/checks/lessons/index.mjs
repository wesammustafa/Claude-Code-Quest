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
import * as b6 from './b-6.mjs';
import * as bCapstone from './b-capstone.mjs';
import * as b3 from './b-3.mjs';
import * as i3 from './i-3.mjs';
import * as i5 from './i-5.mjs';
import * as a3 from './a-3.mjs';
/** @import { Repo } from '../repo.mjs' */

/** @type {Record<string, Lesson | undefined>} */
export const lessons = { 'b-1': b1, 'b-6': b6, 'b-capstone': bCapstone, 'b-3': b3, 'i-3': i3, 'i-5': i5, 'a-3': a3 };
