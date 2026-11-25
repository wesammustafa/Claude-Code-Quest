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
import * as a2 from './a-2.mjs';
import * as a8 from './a-8.mjs';
import * as a7 from './a-7.mjs';
import * as a9 from './a-9.mjs';
/** @import { Repo } from '../repo.mjs' */

/** @type {Record<string, Lesson | undefined>} */
export const lessons = { 'b-1': b1, 'b-6': b6, 'b-capstone': bCapstone, 'a-2': a2, 'a-8': a8, 'a-7': a7, 'a-9': a9 };
