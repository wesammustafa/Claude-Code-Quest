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
import * as b2 from './b-2.mjs';
import * as b6 from './b-6.mjs';
import * as b4 from './b-4.mjs';
import * as b5 from './b-5.mjs';
import * as bCapstone from './b-capstone.mjs';
import * as i2 from './i-2.mjs';
import * as i1 from './i-1.mjs';
import * as i4 from './i-4.mjs';
import * as i6 from './i-6.mjs';
import * as i7 from './i-7.mjs';
import * as iCapstone from './i-capstone.mjs';
import * as a2 from './a-2.mjs';
import * as a8 from './a-8.mjs';
import * as a7 from './a-7.mjs';
import * as a9 from './a-9.mjs';
import * as a6 from './a-6.mjs';
import * as aCapstone from './a-capstone.mjs';
import * as a1 from './a-1.mjs';
import * as a4 from './a-4.mjs';
/** @import { Repo } from '../repo.mjs' */

/** @type {Record<string, Lesson | undefined>} */
export const lessons = { 'b-1': b1, 'b-2': b2, 'b-6': b6, 'b-4': b4, 'b-5': b5, 'b-capstone': bCapstone, 'i-2': i2, 'i-1': i1, 'i-4': i4, 'i-6': i6, 'i-7': i7, 'i-capstone': iCapstone, 'a-2': a2, 'a-8': a8, 'a-7': a7, 'a-9': a9, 'a-6': a6, 'a-capstone': aCapstone, 'a-1': a1, 'a-4': a4 };
