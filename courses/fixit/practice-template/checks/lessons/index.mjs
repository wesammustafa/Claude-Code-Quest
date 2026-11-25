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
import * as i2 from './i-2.mjs';
import * as i1 from './i-1.mjs';
import * as i4 from './i-4.mjs';
import * as i6 from './i-6.mjs';
/** @import { Repo } from '../repo.mjs' */

/** @type {Record<string, Lesson | undefined>} */
export const lessons = { 'b-1': b1, 'b-6': b6, 'b-capstone': bCapstone, 'i-2': i2, 'i-1': i1, 'i-4': i4, 'i-6': i6 };
