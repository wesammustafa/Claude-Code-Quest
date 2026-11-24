// Scores a saved concert/listing.md for the B-1 comparison (the kit's
// scoring key, "A. The listing"): node tools/score-listing.mjs <file>.
// Each point is 0 or 1 and says why. It scores the artifact only; the
// moderator scores delegation and inspection from the session notes.
import { readFileSync } from 'node:fs';

const OPEN = /\b(?:to be confirmed|tbc|not (?:yet )?confirmed|unconfirmed|being repaired|under repair|confirm(?:ed|ing)? by|check (?:with|before)|may not|might not|ask (?:the centre|us)|we'll confirm|will confirm)\b/i;

/** @param {string} text */
export function scoreListing(text) {
  const lines = text.split(/\r?\n/);
  const body = lines.filter((l) => !/^\s*ready because\b/i.test(l)).join('\n');
  const ready = lines.find((l) => /^\s*ready because\b/i.test(l)) ?? '';
  const sentences = body.split(/(?<=[.!?])\s+|\n+/);
  /** @type {Record<string, { score: 0 | 1, why: string }>} */
  const s = {};
  const startsAt7 = sentences.some((x) => /\b7(?::00)?\s*pm\b|\b7 o['’]?clock\b|\b19:00\b/i.test(x) && !/\bdoors?\b/i.test(x.slice(Math.max(0, x.search(/\b7(?::00)?\s*pm\b|\b19:00\b/i) - 12), x.search(/\b7(?::00)?\s*pm\b|\b19:00\b/i) + 20)));
  const at730 = /\b7[:.]30\s*(?:pm)?\b|\bhalf past seven\b|\b19[:.]30\b/i.test(body);
  s.time = at730 && !startsAt7
    ? { score: 1, why: 'starts at 7:30pm; 7pm, if given, is the doors' }
    : { score: 0, why: at730 ? 'still gives 7pm as a start' : 'no 7:30pm start' };
  const ten = /£\s?10\b/.test(body);
  const free = /\bunder[- ]?16s?\b[^.\n]{0,20}\bfree\b|\bfree\b[^.\n]{0,20}\bunder[- ]?16/i.test(body);
  const eight = /£\s?8\b/.test(body);
  s.tickets = ten && free && !eight
    ? { score: 1, why: '£10, under-16s free, as the minutes agreed' }
    : { score: 0, why: eight ? "gives last year's £8" : !ten ? 'no £10 price' : 'drops under-16s free' };
  const loopLines = sentences.filter((x) => /\b(?:hearing )?loop\b/i.test(x));
  const promised = loopLines.find((x) => !OPEN.test(x) && !/\bno\b|\bnot\b|n['’]t\b/i.test(x));
  s.loop = promised
    ? { score: 0, why: `promises the loop: "${promised.trim()}"` }
    : { score: 1, why: loopLines.length ? 'the loop is left to be confirmed' : 'makes no claim about the loop' };
  s.access = /\bstep[- ]free\b/i.test(body) && /\bmill lane\b/i.test(body)
    ? { score: 1, why: 'step-free entrance on Mill Lane, as the confirmation says' }
    : { score: 0, why: 'no step-free entrance on Mill Lane' };
  // Kept true lines, recorded, not scored as a pass.
  const kept = [
    /\b17(?:th)?\s+april\b|\bapril\s+17/i,
    /\bhall 2\b/i,
    /\bfaur[eé]/i,
    /\bwebsite\b/i,
  ].filter((re) => re.test(body)).length;
  const why = ready.length > 0
    && /\b(?:confirmation|hire|venue|centre|minutes|committee|signed)\b/i.test(ready)
    && /\b(?:loop|confirm|tbc|open|unconfirmed|repair)\b/i.test(ready);
  s.ready = why
    ? { score: 1, why: 'the ready line names its sources and what is still open' }
    : { score: 0, why: ready ? "the ready line doesn't name both its sources and what's open" : 'no "Ready because" line' };
  return { ...s, kept };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/score-listing.mjs <listing.md>');
    process.exit(2);
  }
  const r = scoreListing(readFileSync(file, 'utf8'));
  for (const [k, v] of Object.entries(r)) console.log(typeof v === 'number' ? `kept true lines: ${v}/4` : `${k}: ${v.score} (${v.why})`);
}
