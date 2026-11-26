import { Fragment, useEffect, useState } from "react";
import type { CompleteLesson, LevelId } from "@quest/contract";
import { NEW_BADGE } from "../components/Badge";
import { Button, ButtonLink } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { InlineText } from "../components/InlineText";
import { Tier } from "../components/Tier";
import { LEVEL_NAMES, lessonLabel } from "../course/labels";
import { cx } from "../lib/cx";
import { useSlots } from "../mount/context";
import { Link } from "../mount/links";
import { githubTree, pageIndex } from "../pages/fetch";
import { ReadLesson } from "../pages/ReadLesson";
import { Pip } from "../pip/Pip";
import { SceneBadge } from "../scene/SceneBadge";
import { PageTitle } from "../shell/PageTitle";
import { LessonGate } from "./LessonGate";
import {
  BOX,
  CAPTION_ON_SURFACE,
  EYEBROW,
  MOMENT,
  QUIET_LINK,
  SURFACE,
} from "./layout";
import { useActiveLesson, useCourseSnapshot, useOpenLesson } from "./lesson";
import { celebratable, levelPath, useClaimMilestone } from "./milestones";
import { PANEL_SURFACE, PanelMain, useOverScene } from "./OverScene";

/**
 * Whether this tab reveals the Lesson's Badge: only on its first
 * completion, and only when this tab won its pending milestone, so a reload
 * or a second tab shows it earned but never reveals it again.
 */
function useReveal(lesson: CompleteLesson | null): boolean {
  const claim = useClaimMilestone(
    (m) =>
      lesson !== null &&
      lesson.firstTime &&
      m.type === "lesson.completed" &&
      (m.badge ?? null) === lesson.badge,
  );
  return claim.won;
}

/**
 * The Level complete milestone that follows this Lesson's own: the next
 * celebratable one after it, or already the oldest. While it is pending,
 * Next would open a Lesson and lapse it, so the hand-over replaces Next.
 */
function useLevelPending(lesson: CompleteLesson | null): LevelId | null {
  const pending = celebratable(useCourseSnapshot());
  if (lesson === null) return null;
  const at = pending.findIndex(
    (m) => m.type === "level.completed" && m.level === lesson.level,
  );
  if (at < 0) return null;
  const before = pending[at - 1];
  const own =
    before?.type === "lesson.completed" &&
    (before.badge ?? null) === lesson.badge;
  return at === 0 || own ? lesson.level : null;
}

/** The release ref the pages were built at, or null while unknown. */
function useReleaseRef(): string | null {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    pageIndex().then(
      (index) => {
        if (live) setRef(index.ref);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return ref;
}

const HANDOVER = "You did every task without the exact command.";
const INVITATION =
  "Questions about anything in this level? Ask Claude Code, then compare the answer with the lesson pages.";
const NOTCH_HARDER = "A notch harder: it starts with less help.";
// What each skill's Mastery says (ticket 348): the help on its latest step,
// as its tier showed it or as the Learner opened more (a hint, the exact
// command or a bottom rung). Shown only when a skill has one beside it.
const PRACTISED_HELP =
  "Beside each: the help on its latest step, counting any hint or exact command you opened.";

/**
 * Lesson complete: Pip, the Badge, the check result, the skills practised
 * and the next Lesson. Over the Scene it is a panel beside the room: the
 * heading and the rest each on a surface, and the Badge between them on
 * none, so the Scene's 3D Badge drawn behind it shows.
 */
export function LessonComplete() {
  const active = useActiveLesson("complete");
  const reveal = useReveal(active?.lesson ?? null);
  const levelPending = useLevelPending(active?.lesson ?? null);
  const ref = useReleaseRef();
  const { lessonCompleteExtra: Extra, lessonCompleteReference: Reference } =
    useSlots();
  const over = useOverScene();
  if (!active) return <LessonGate />;
  const { lesson, summary } = active;
  const passed = lesson.checkSummary.filter((line) => line.pass).length;
  const total = lesson.checkSummary.length;

  const head = (
    <>
      <Pip size="hero" className="mb-2" />
      <span className={EYEBROW}>
        {`${lessonLabel(summary?.number ?? null, lesson.capstone, summary?.optional ?? false)} complete`}
      </span>
      <PageTitle
        title={`Complete: ${lesson.title}`}
        className="text-3xl max-sm:text-2xl"
      >
        <InlineText text={lesson.title} />
      </PageTitle>
    </>
  );
  const badge = (
    <>
      <SceneBadge
        lesson={lesson.id}
        name={lesson.badge}
        earned
        size="lg"
        reveal={reveal}
        lights={passed}
      />
      <span role="status" className="sr-only">
        {reveal && lesson.badge !== null ? `${NEW_BADGE}: ${lesson.badge}` : ""}
      </span>
    </>
  );
  const rest = (
    <>
      {!lesson.firstTime && lesson.badge !== null && (
        <p className="text-sm text-muted">You already earned this badge.</p>
      )}
      {total > 0 && (
        <section
          aria-label="The check"
          className={`${BOX} w-full max-w-moment text-left`}
        >
          <p className="text-sm text-muted">{`${String(passed)} of ${String(total)} lines pass`}</p>
          <CheckLines
            lines={lesson.checkSummary.map((line) => ({
              text: <InlineText text={line.text} />,
              ok: line.pass,
            }))}
          />
        </section>
      )}
      {lesson.handover && <p className="font-semibold">{HANDOVER}</p>}
      {lesson.invitation && <p className="text-muted">{INVITATION}</p>}
      {lesson.practised.length > 0 && (
        <section
          aria-labelledby="practised"
          className="grid w-full max-w-moment gap-2 text-left"
        >
          <h2 id="practised" className="text-sm text-muted">
            You practised
          </h2>
          {lesson.practised.some((p) => p.mastery) && (
            <p className="text-sm text-muted">{PRACTISED_HELP}</p>
          )}
          <ul className="grid gap-1.5">
            {lesson.practised.map(({ skill, steps, mastery }) => (
              <li key={skill} className="flex flex-wrap items-center gap-3">
                <span className="min-w-20 font-semibold">
                  {steps.map((title, i) => (
                    <Fragment key={title}>
                      {i > 0 && " · "}
                      <InlineText text={title} />
                    </Fragment>
                  ))}
                </span>
                {mastery && <Tier mastery={mastery.used} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ReadLesson size="sm" />
        {Reference ? (
          <Reference lesson={lesson.id} />
        ) : (
          ref !== null && (
            <a
              href={githubTree(ref, `solutions/${lesson.id}`)}
              target="_blank"
              rel="noreferrer"
              className={QUIET_LINK}
            >
              Compare with a reference solution
            </a>
          )
        )}
      </div>
      {Extra && <Extra lesson={lesson.id} />}
    </>
  );
  const onward = (
    <>
      {levelPending !== null ? (
        <ButtonLink
          to={levelPath(levelPending)}
          variant="primary"
          size="lg"
          iconEnd="arrow"
          className={cx("mt-2", over && WRAPS)}
        >
          {`See the ${LEVEL_NAMES[levelPending]} level complete`}
        </ButtonLink>
      ) : (
        lesson.next && <NextLesson next={lesson.next} wraps={over} />
      )}
      <Link to="/journey" className={QUIET_LINK}>
        Back to the learning journey
      </Link>
    </>
  );

  if (!over)
    return (
      <main className={MOMENT}>
        {head}
        {badge}
        {rest}
        {onward}
      </main>
    );
  return (
    <PanelMain column={MOMENT} panel="">
      <div className={cx(PANEL_SURFACE, MOMENT_CARD)}>{head}</div>
      {/* No surface behind the Badge, so the Scene's 3D Badge shows; its name on one of its own. */}
      <div className={cx("grid justify-items-center py-2", CAPTION_ON_SURFACE)}>
        {badge}
      </div>
      <div className={cx(PANEL_SURFACE, MOMENT_CARD)}>{rest}</div>
      {/* The way on stays in view as the panel scrolls, but on a narrow
          page, where it would hide the Badge and the Check, it follows
          them. Set only by variants: the app's stylesheet, after the
          client's, has a plain sticky of its own. */}
      <div
        className={cx(
          SURFACE,
          MOMENT_CARD,
          "z-10 px-6 py-4 not-scene-narrow:sticky not-scene-narrow:bottom-0",
        )}
      >
        {onward}
      </div>
    </PanelMain>
  );
}

/** The way on's button in the panel's foot: a long Lesson title wraps inside it. */
const WRAPS =
  "h-auto! min-h-12 max-w-full py-2.5 text-center whitespace-normal!";

/** A card of Lesson complete's panel: centred, as the moment is. */
const MOMENT_CARD = "grid justify-items-center gap-4 text-center";

/** Opens the next Lesson: it sends lesson.open, as browsing to it would not. */
function NextLesson({
  next,
  wraps,
}: {
  next: NonNullable<CompleteLesson["next"]>;
  /** In the panel's narrower foot, a long title wraps rather than overflows. */
  wraps: boolean;
}) {
  const open = useOpenLesson(next.id);
  return (
    <div className="grid justify-items-center gap-2">
      {next.notchHarder && <p className="text-sm text-muted">{NOTCH_HARDER}</p>}
      <Button
        variant="primary"
        size="lg"
        iconEnd="arrow"
        className={cx("mt-2", wraps && WRAPS)}
        {...open}
      >
        <span>
          Next: <InlineText text={next.title} />
        </span>
      </Button>
    </div>
  );
}
