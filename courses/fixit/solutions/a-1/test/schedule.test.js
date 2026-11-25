import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../pages/schedule.md', import.meta.url), 'utf8');

for (const date of ['Sat 12 June', 'Sat 10 July', 'Sat 14 August']) {
  test(`the schedule page shows ${date}`, () => {
    assert.match(page, new RegExp(`^\\| ${date} \\|`, 'm'));
  });
}
