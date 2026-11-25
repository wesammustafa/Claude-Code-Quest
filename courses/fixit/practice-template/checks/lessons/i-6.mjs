// @ts-check
// Bring in a second reviewer (Fix-It, Intermediate lesson 4). The check
// reads the guide-reviewer subagent the Learner keeps in
// fixit/.claude/agents/: its name, its description, its tools (read-only
// ones only, since a missing tools line gives it every tool) and its model;
// and its instructions, for the source order. It reads the February guide,
// for the reviewer's right finding and not its wrong one; the March review
// log, for a line on each of the reviewer's March findings, each with the
// decision and the source file that decided it; and the attendee-guide
// skill, for a step that hands the guide to the reviewer and treats what
// it reports as leads. Which subagent runs the session made is the host's
// to record (a record no Check reads yet), so the log's lines on the March
// findings are all this check reads of the March review.
import { flag, frontmatter } from '../frontmatter.mjs';
import { claims, quote } from './fixit-claims.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Bring in a second reviewer';

export const AGENT = 'fixit/.claude/agents/guide-reviewer.md';
export const FEB = 'fixit/feb/attendee-guide.md';
export const MARCH = 'fixit/march/attendee-guide.md';
export const LOG = 'fixit/march/review-log.md';
export const SKILL = 'fixit/.claude/skills/attendee-guide/SKILL.md';
const NAME = 'guide-reviewer';
const READ_ONLY = ['Read', 'Grep', 'Glob'];

/** @param {string | string[] | undefined} v */
const one = (v) => (Array.isArray(v) ? v.join(' ') : (v ?? '')).trim();

// A `tools:` value as Claude Code reads it: a comma list or a YAML list,
// each name without its `(...)` specifier.
/** @param {string | string[] | undefined} v */
const toolsOf = (v) =>
  (Array.isArray(v) ? v : (v ?? '').split(','))
    .map((t) => t.replace(/\(.*\)$/s, '').trim())
    .filter(Boolean);

const CHECKS_WHAT = /\b(?:guides?|documents?|pages?)\b/i;
const WHEN = /\b(?:after|when|whenever|before|once)\b/i;

/** @type {Item} */
export const reviewer = {
  text: '`fixit/.claude/agents/guide-reviewer.md` is named guide-reviewer, says what it checks and when to use it, may only read (Read, Grep, Glob), and has a model',
  check(repo) {
    const text = repo.read(AGENT);
    if (text === null) return `There's no \`${AGENT}\` yet. Ask Claude to create the guide-reviewer subagent in this project.`;
    const fm = frontmatter(text);
    if (!fm) return `\`${AGENT}\` must start with its frontmatter between two lines of dashes: \`name:\`, \`description:\` and \`tools:\`.`;
    const name = one(fm.fields.name);
    if (name !== NAME) return name ? `\`${AGENT}\` names the agent \`${name}\`, so a request for guide-reviewer won't find it. Write \`name: ${NAME}\`.` : `\`${AGENT}\` has no \`name:\`. Write \`name: ${NAME}\` in its frontmatter.`;
    const description = one(fm.fields.description);
    if (!description) return `\`${AGENT}\` has no \`description:\`, and Claude Code loads no agent without one. Say what it checks and when to use it.`;
    if (!CHECKS_WHAT.test(description)) return `The reviewer's description, "${quote(description)}", doesn't say what it checks. Name it: a finished attendee guide.`;
    if (!WHEN.test(description)) return `The reviewer's description, "${quote(description)}", doesn't say when to use it. Add when: after a guide is written or changed.`;
    const tools = fm.fields.tools === undefined || flag(fm.fields.tools) !== undefined ? [] : toolsOf(fm.fields.tools);
    if (tools.length === 0 || tools.includes('*')) return "With no `tools:` line the reviewer gets every tool the main session has, Edit and Bash included, so it could change what it reviews. Give it `tools: Read, Grep, Glob`.";
    const extra = tools.find((t) => !READ_ONLY.includes(t));
    if (extra) return `\`tools:\` gives the reviewer \`${extra}\`, so it could ${extra.startsWith('mcp__') ? 'reach outside the folder' : 'change what it reviews, or run commands'}. Keep it to Read, Grep and Glob.`;
    if (!one(fm.fields.model)) return "The reviewer has no `model:` yet. Choose one for the job, as in Your turn step 2, and ask Claude to set it.";
    return true;
  },
};

// The reviewer's instructions on which source wins: CLAUDE.md, its source
// order, or the flyer put last. A flyer that wins is the February mistake
// written in as a rule.
const ORDER = /\bCLAUDE\.md\b|\bwhich source wins\b|\bsource order\b|\border of (?:the )?sources\b/i;
const FLYER = /\bflyers?\b/i;
const DEMOTED = /\b(?:never|not|no|don['’]?t|doesn['’]?t|old|older|oldest|least|lowest|last|loses?|lost|out of date|outdated|ignore|ignores|ignored|disagrees?)\b/i;
const FLYER_WINS = /\bflyers?\b[^.;\n]*?\b(?:wins?|beats?|overrides?|comes? first|takes? priority|is (?:the )?(?:most )?(?:authoritative|right|correct))\b|\b(?:trust|prefer|follow|believe) (?:the |an |old |october )*flyers?\b/i;
const NEGATION = /\b(?:never|not|no|don['’]?t|doesn['’]?t|won['’]?t)\b/i;

/** @type {Item} */
export const sourceOrder = {
  text: "the reviewer's instructions tell it which source wins: `CLAUDE.md`'s source order, so an old flyer never beats the venue's confirmation",
  check(repo) {
    const text = repo.read(AGENT);
    if (text === null) return `There's no \`${AGENT}\` yet. Ask Claude to create the guide-reviewer subagent in this project.`;
    const body = frontmatter(text)?.body ?? text;
    const clauses = body.replace(/\r\n/g, '\n').split(/[.;]+(?=\s|$)|\n\s*\n/).map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const wins = clauses.find((c) => {
      const m = FLYER_WINS.exec(c);
      return m !== null && !NEGATION.test(c.slice(0, m.index + m[0].length));
    });
    if (wins) return `The reviewer's instructions now let the flyer win: "${quote(wins)}". The flyer is the oldest source: \`CLAUDE.md\` puts the venue's confirmation first.`;
    if (!clauses.some((c) => ORDER.test(c) || (FLYER.test(c) && DEMOTED.test(c)))) return "The reviewer's instructions don't say which source wins, so it reports a guide fact as wrong whenever an old flyer disagrees, as it did with February's hours. Tell it to read `CLAUDE.md` for which source wins.";
    return true;
  },
};

// The log's lines: one claim per list item or paragraph, headings and the
// template's comment left out.
/** @param {string} text */
const logLines = (text) => claims(text).filter((c) => !/^#/.test(c));
// A log line as a hint quotes it: the finding's number kept, no bullet or
// closing stop, at most 120 characters.
/** @param {string} line */
function said(line) {
  const plain = line.replace(/^[-*+]\s+/, '').replace(/[.\s]+$/, '');
  return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
}

// The reviewer's two March findings, by what each line names or, with
// nothing named, by its number; and February's, which a March log doesn't
// answer.
const PLACES = /(?<![:.\d])\b30\b|\b(?:places?|thirty|sign-?ups?|cap|capped|limit|spaces)\b/i;
const TEA = /\b(?:tea|drinks?|coffee)\b/i;
const FEBRUARY = /\b(?:hours|10:30|10am|10 am|rewir\w*|mains)\b/i;
/** @param {string} line @param {1 | 2} n */
function answers(line, n) {
  const [mine, other] = n === 1 ? [PLACES, TEA] : [TEA, PLACES];
  if (mine.test(line)) return true;
  return new RegExp(`^${n}\\b`).test(line) && !other.test(line) && !FEBRUARY.test(line);
}

/** @type {Item} */
export const reviewed = {
  text: "`fixit/march/review-log.md` answers the reviewer's March findings: a line on the places, and one on the tea",
  check(repo) {
    const text = repo.read(LOG);
    if (text === null) return `There's no \`${LOG}\`. Make it in the files tab: one line for each finding the reviewer reported on March.`;
    const lines = logLines(text);
    if (lines.length === 0) return `\`${LOG}\` has no lines yet. Have the guide-reviewer check the March guide, then write one line for each finding it reports.`;
    const feb = lines.find((l) => FEBRUARY.test(l) && !PLACES.test(l) && !TEA.test(l));
    if (feb) return `"${said(feb)}" is about February's review. This log is for the reviewer's March findings: the places and the tea.`;
    if (!lines.some((l) => answers(l, 1))) return "The log has no line on the reviewer's first March finding, the places. Write what you decided, and the source that decided it.";
    if (!lines.some((l) => answers(l, 2))) return "The log has no line on the reviewer's second March finding, the tea. Write what you decided, and the source that decided it.";
    return true;
  },
};

// A guide's lines, each a claim: the template writes one field to a line.
/** @param {string} text */
const guideLines = (text) => claims(text.replace(/\r?\n/g, '\n\n'));

const REWIRING = /\brewir(?:e|es|ed|ing)\b|\bmains wiring\b/i;
const REFUSED = /\b(?:can['’]?t|cannot|not|never|won['’]?t|don['’]?t|no)\b/i;
const TEN_AM = /\b10(?:[:.]00)?\s?am\b|\b10:00\b/i;
const TEN_THIRTY = /\b10[:.]30(?!\d)/;

/** @type {Item} */
export const february = {
  text: '`fixit/feb/attendee-guide.md` lists the rule the reviewer rightly found missing, items that need mains rewiring, and still gives the public hours from 10:30am',
  check(repo) {
    const text = repo.read(FEB);
    if (text === null) return `There's no \`${FEB}\`. It's the guide the reviewer checked: put it back from your practice copy, then add the missing rule.`;
    const parts = guideLines(text);
    const early = parts.find((c) => TEN_AM.test(c));
    if (early) return `The February guide now says 10am: "${quote(early)}". The January notes say the public comes in from 10:30 (\`feb/meeting-notes-2027-01-28.md\`, line 5), after the library's 10:00 booking; the flyer the reviewer cited is the oldest source.`;
    if (!parts.some((c) => TEN_THIRTY.test(c))) return "The February guide no longer gives the public hours. The January notes say the public comes in from 10:30am, until 1pm.";
    if (!parts.some((c) => REWIRING.test(c) && REFUSED.test(c))) return "The February guide still leaves out a rule on what we can't take: items that need mains rewiring inside the casing, line 15 of `sources/group-notes.md`. That's the reviewer's second finding, and the line it cites says exactly that.";
    return true;
  },
};

// A file a log line names, found as written below fixit/ or, for a bare
// name, in the folders the sources live in. The guide, its fact table and
// the log itself are what the reviewer checked, not sources.
const FILE = /[\w./-]+\.(?:md|pdf|csv|txt|png)\b/gi;
const NOT_SOURCE = /(?:^|\/)(?:facts|attendee-guide|review-log)\.md$/i;
/** @param {Repo} repo @param {string} name */
function found(repo, name) {
  const p = name.replace(/^\.?\//, '').replace(/^fixit\//, '');
  const at = p.includes('/') ? [`fixit/${p}`] : ['', 'sources/', 'march/', 'feb/'].map((d) => `fixit/${d}${p}`);
  return at.some((x) => repo.exists(x));
}
const DECIDED = /\b(?:kept|keep|keeping|changed|change|changing)\b/i;
const CHANGED = /\bchang(?:e|ed|ing)\b/i;
const KEPT = /\bkept\b|\bkeep(?:ing)?\b/i;
const WRONG_LIMIT = /\b(?:40|60|forty|sixty)\s*(?:places|people|persons|seats|spaces|visitors|sign-?ups)\b|\bjust turn up\b/i;
const FREE_TEA = /\btea is free\b|\bfree tea\b|\btea(?: and [\w ]+)? (?:is|are) free\b/i;

/** @type {Item} */
export const decided = {
  text: 'each line of the log says kept or changed, and names the source file that decided it',
  check(repo) {
    const text = repo.read(LOG);
    if (text === null) return `There's no \`${LOG}\`. Make it in the files tab: one line for each finding the reviewer reported on March.`;
    const lines = logLines(text).filter((l) => /^\d/.test(l) || PLACES.test(l) || TEA.test(l) || DECIDED.test(l));
    if (lines.length === 0) return `\`${LOG}\` has no lines yet. Write one line for each finding: kept or changed, and the source that decided it.`;
    for (const line of lines) {
      const names = [...line.matchAll(FILE)].map((m) => m[0]);
      if (names.length === 0) return `Each line needs the source that decided it: "${said(line)}" names no source file.`;
      const real = names.filter((n) => found(repo, n));
      if (real.length === 0) return `"${said(line)}" names \`${names[0]}\`, which isn't a file in the practice copy. Name the file the line came from.`;
      if (real.every((n) => NOT_SOURCE.test(n))) return `"${said(line)}" cites \`${real[0]}\`, which is what the reviewer checked, not a source. Name the source line that decided it.`;
      if (!DECIDED.test(line)) return `"${said(line)}" doesn't say kept or changed. Say what you decided.`;
    }
    const guide = repo.read(MARCH);
    const over = guide === null ? undefined : guideLines(guide).find((c) => WRONG_LIMIT.test(c));
    if (over) return `The March guide now says "${quote(over)}". The booking's 40 includes our ten volunteers, and our notes cap sign-ups at 30: the reviewer's first finding was right to find no problem.`;
    const tea = lines.find((l) => answers(l, 2) && CHANGED.test(l) && !KEPT.test(l));
    const still = tea && guide !== null ? guideLines(guide).find((c) => FREE_TEA.test(c)) : undefined;
    if (tea && still) return `"${said(tea)}" says you changed the tea line, but the March guide still says "${quote(still)}". Change the guide too, or log it as kept.`;
    return true;
  },
};

// The skill's numbered steps, each with its continuation lines.
/** @param {string} body */
function stepsOf(body) {
  /** @type {{ n: number, text: string }[]} */
  const out = [];
  let open = false;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const last = out.at(-1);
    if (m) out.push({ n: Number(m[1]), text: /** @type {string} */ (m[2]) });
    else if (last && open && line.trim() && !/^\s*#/.test(line)) last.text += ` ${line.trim()}`;
    open = Boolean(m) || (open && line.trim() !== '');
  }
  return out;
}
const REVIEWER = /\bguide-reviewer\b/i;
const LEADS = /\bleads?\b|\bopen(?:s|ed|ing)? (?:the |each |every |its )?(?:cited )?(?:lines?|sources?)\b|\bcheck(?:ing)? (?:each|every|the|its) (?:findings?|cited lines?|lines?|sources?)\b|\bverify\b|\bconfirm\b|\bbefore (?:you )?(?:change|changing|act|acting|apply|applying|edit|editing|fix|fixing)\b|\bnot (?:as )?(?:a )?verdicts?\b/i;
const APPLY_ALL = /\b(?:apply|accept|make|take) (?:all|every|each)(?: of)? (?:its |the |their )?(?:findings?|fixes|changes|suggestions|corrections)\b|\bapply (?:its|the reviewer['’]s|the) (?:findings|fixes|changes|suggestions|corrections)\b|\bfix (?:everything|whatever|all) (?:it|the reviewer) (?:finds|reports|flags)\b/i;
const WRITES = /\bwrite\b[^\n]*\battendee-guide\.md\b/i;

/** @type {Item} */
export const procedure = {
  text: "a step of the attendee-guide skill hands the guide to `guide-reviewer` after it's written, and treats what it reports as leads to check",
  check(repo) {
    const text = repo.read(SKILL);
    if (text === null) return `There's no \`${SKILL}\`. It's the kit's skill: put it back from your practice copy, then add the reviewer step.`;
    const steps = stepsOf(frontmatter(text)?.body ?? text);
    const step = steps.find((s) => REVIEWER.test(s.text));
    if (!step) return "None of the skill's steps names `guide-reviewer`, so Sam's sessions make the guide with no second look. Add a step after the guide is written: hand it to guide-reviewer.";
    const write = steps.find((s) => WRITES.test(s.text));
    if (write && step.n < write.n) return `Step ${step.n} hands the guide to guide-reviewer before step ${write.n} writes it. Put the reviewer step after the guide is written.`;
    const all = APPLY_ALL.exec(step.text);
    if (all && !NEGATION.test(step.text.slice(Math.max(0, all.index - 24), all.index))) return `Step ${step.n} applies whatever the reviewer reports: "${quote(step.text)}". Its February report was wrong about the hours. Treat what it reports as leads, and open the cited line before changing anything.`;
    if (!LEADS.test(step.text)) return `Step ${step.n} hands the guide to guide-reviewer but doesn't say what to do with what it reports. Add: treat its findings as leads, and open the cited line before changing anything.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [reviewer, sourceOrder, reviewed, february, decided, procedure];
