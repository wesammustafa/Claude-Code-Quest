import { useEffect, useRef } from "react";
import type { LessonSummary, Snapshot } from "@quest/contract";
import { ButtonLink } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { Tier } from "../components/Tier";
import { LEVEL_NAMES, lessonLabel } from "../course/labels";
import { cx } from "../lib/cx";
import { Pip } from "../pip/Pip";
import { usePipLook } from "../pip/PipStage";
import { useBadgeSurface, useBadgesDrawn } from "../scene/badges";
import { BadgeShelfHint, SceneBadge } from "../scene/SceneBadge";
import { PageTitle } from "../shell/PageTitle";
import { BOX, CAPTION_ON_SURFACE, COLUMN, EYEBROW } from "./layout";
import { useOverScene } from "./OverScene";
import { OpenLessonButton } from "./OpenLessonButton";
import { pathOf, useCourseSnapshot } from "./lesson";
import { courseCounts, journeyPlace, levelOf, splitLabs } from "./place";

/** Once the screen has settled in, Pip glances toward the next goal. */
const GLANCE_AFTER_MS = 600;

/**
 * Progress: counts, skills by the help last needed with Pip beside them (above
 * them below the sm breakpoint, so the box keeps the full width), the next
 * goal, and Badges. Completion and Mastery never share a number or a bar.
 * Over the Scene its heading sits on a surface, as every other part does.
 */
export function Progress() {
  const look = usePipLook();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      look("goal");
    }, GLANCE_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [look]);
  const snapshot = useCourseSnapshot();
  const over = useOverScene();

  return (
    <main className={COLUMN}>
      <header className={cx("grid gap-2", over && BOX)}>
        <PageTitle title="Progress" className="text-3xl max-sm:text-2xl" />
        <p className="text-muted">
          Only what your checks verified counts here.
        </p>
      </header>
      {snapshot && <ProgressBody snapshot={snapshot} />}
    </main>
  );
}

function ProgressBody({ snapshot }: { snapshot: Snapshot }) {
  const counts = courseCounts(snapshot);
  const stats = [
    { count: counts.lessons, label: "lessons done" },
    { count: counts.levels, label: "levels done" },
  ];
  const skills = Object.entries(snapshot.learner.mastery);
  const shelf = useBadgesDrawn();
  const shelfBox = useRef<HTMLElement>(null);
  useBadgeSurface(shelfBox, shelf);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {stats.map(({ count, label }) => (
          <li key={label} className={`${BOX} gap-0`}>
            <b className="text-2xl">{`${String(count.done)} of ${String(count.total)}`}</b>
            <span className="text-sm text-muted">{label}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3.5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <Pip size="beside" />
        <section
          className={`${BOX} min-w-0 flex-1 max-sm:self-stretch`}
          aria-labelledby="progress-skills"
        >
          <h2 id="progress-skills" className="text-lg">
            Skills
          </h2>
          {skills.length === 0 ? (
            <p className="text-sm text-muted">
              The help you used shows here once you finish a step.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {skills.map(([skill, mastery]) => (
                <li
                  key={skill}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2"
                >
                  <span className="min-w-0 font-semibold">{skill}</span>
                  <Tier mastery={mastery.used} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <NextGoal snapshot={snapshot} />
      <section
        ref={shelfBox}
        className={shelf ? SHELF : BOX}
        aria-labelledby="progress-badges"
      >
        <h2 id="progress-badges" className={cx("text-lg", shelf && ON_SHELF)}>
          Badges
        </h2>
        <BadgeShelfHint earned={counts.lessons.done > 0} />
        {snapshot.course.levels.map((level) => {
          const { core, labs } = splitLabs(level.lessons);
          return (
            <div key={level.id} className="grid gap-2">
              <h3 className={cx("text-sm text-muted", shelf && ON_SHELF)}>
                {LEVEL_NAMES[level.id]}
              </h3>
              <Badges lessons={core} shelf={shelf} />
              {labs.length > 0 && (
                <>
                  <h4 className={cx("text-xs text-muted", shelf && ON_SHELF)}>
                    Optional labs
                  </h4>
                  <Badges lessons={labs} shelf={shelf} />
                </>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

/** The Badges of `lessons`, earned or not yet, in course order; on the shelf over the room, each name on a surface of its own. */
function Badges({
  lessons,
  shelf,
}: {
  lessons: readonly LessonSummary[];
  shelf: boolean;
}) {
  return (
    <ul className={cx("flex flex-wrap gap-3", shelf && CAPTION_ON_SURFACE)}>
      {lessons.map(
        (s) =>
          s.badge !== null && (
            <li key={s.id}>
              <SceneBadge
                lesson={s.id}
                name={s.badge}
                earned={s.complete}
                size="sm"
                turns
              />
            </li>
          ),
      )}
    </ul>
  );
}

/**
 * The Badges section as the Badge shelf, while the Scene draws its Badges:
 * the card with no page surface of its own, which would hide the 3D Badges
 * behind it; the Scene draws its surface behind them instead, so the room
 * never shows between the Badges.
 */
const SHELF = "grid gap-3 rounded-lg border border-line p-5";

/** A word on the Badge shelf: on a surface of its own, never on the room. */
const ON_SHELF = "justify-self-start rounded-md bg-surface px-2 py-0.5";

const GOAL =
  "flex items-center justify-between gap-4 rounded-lg border border-accent-edge bg-surface px-5 py-4 shadow-sm max-sm:flex-col max-sm:items-stretch";

/**
 * The next goal: the Journey's current Lesson. The Lesson the engine holds
 * open is a link to its phase's path; any other is opened with lesson.open.
 */
function NextGoal({ snapshot }: { snapshot: Snapshot }) {
  const place = journeyPlace(snapshot);
  const { current, label } = place;
  return (
    <section
      data-pip-target="goal"
      aria-labelledby="progress-goal"
      className={GOAL}
    >
      <div className="grid min-w-0 gap-0.5">
        <h2 id="progress-goal" className={EYEBROW}>
          Next goal
        </h2>
        {current ? (
          <b>
            {`${LEVEL_NAMES[levelOf(snapshot, current)]}, ${lessonLabel(current.number, current.capstone, current.optional)}: `}
            <InlineText text={current.title} />
          </b>
        ) : (
          <b>Every lesson is complete</b>
        )}
      </div>
      {current && label ? (
        snapshot.lesson.id === current.id ? (
          <ButtonLink to={pathOf(snapshot.lesson)} iconEnd="arrow">
            {label}
          </ButtonLink>
        ) : (
          <OpenLessonButton id={current.id}>{label}</OpenLessonButton>
        )
      ) : (
        <ButtonLink to="/journey" iconEnd="arrow">
          See the journey
        </ButtonLink>
      )}
    </section>
  );
}
