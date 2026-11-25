import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExternal } from '../src/links.js';

test('treats protocol-relative links as external', () => {
  assert.equal(isExternal('//cdn.example.com/app.js'), true);
});

test('a link with one leading slash is still checked', () => {
  assert.equal(isExternal('/events/fixit-booking.md'), false);
});
