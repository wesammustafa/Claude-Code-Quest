import { useParams } from "react-router";
import type { LevelId, Snapshot } from "@quest/contract";
import { ButtonLink } from "../components/Button";
import { LessonBadge } from "../components/badges";
import { LEVEL_NAMES, levelsComplete } from "../course/labels";
import { useMount, useSlots } from "../mount/context";
import { Link } from "../mount/links";
import { useProductName } from "../mount/copy";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { Waiting } from "./LessonGate";
import { NotFound } from "./NotFound";
import { OpenLessonButton } from "./OpenLessonButton";
import { EYEBROW, QUIET_LINK } from "./layout";
import { MomentMain } from "./OverScene";
import { useCourseSnapshot } from "./lesson";
import {
  COURSE_PATH,
  celebratable,
  levelMoment,
  levelOfKey,
  levelPath,
  useClaimMilestone,
} from "./milestones";

const TITLE = "text-3xl max-sm:text-2xl";

function BackToJourney() {
  return (
    <Link to="/journey" className={QUIET_LINK}>
      Back to the learning journey
    </Link>
  );
}

/** Not complete in the snapshot: a plain line, and the way back. */
function NotYet({ what }: { what: string }) {
  return (
    <MomentMain>
      <PageTitle title={`${what} not complete`} className={TITLE}>
        {`This ${what} is not complete yet`}
      </PageTitle>
      <BackToJourney />
    </MomentMain>
  );
}

/**
 * Level complete: Pip, the Level's Badges together and the next Level. The
 * tab that wins the level.completed milestone plays Pip's Celebration; a
 * reload shows the same moment, still.
 */
export function LevelComplete() {
  const { levelId } = useParams();
  const level = levelOfKey(levelId);
  const snapshot = useCourseSnapshot();
  // The Badges were each revealed on their own Lesson's complete screen, so
  // none says "New badge" here: the moment is Pip's Celebration.
  useClaimMilestone((m) => m.type === "level.completed" && m.level === level);
  if (level === null) return <NotFound />;
  if (!snapshot) return <Waiting />;
  const moment = levelMoment(snapshot, level);
  if (moment === null) return <NotYet what="level" />;
  const name = LEVEL_NAMES[level];
  return (
    <MomentMain>
      <Pip size="hero" className="mb-2" />
      <span className={EYEBROW}>Level complete</span>
      <PageTitle title={`${name} level complete`} className={TITLE} />
      <p className="text-muted">
        Every lesson of the level is done, its capstone too.
      </p>
      <ul
        aria-label={`The ${name} level's badges`}
        className="flex flex-wrap justify-center gap-4"
      >
        {moment.badges.map((badge) => (
          <li key={badge.lesson}>
            <LessonBadge
              lesson={badge.lesson}
              name={badge.name}
              earned
              size="lg"
              caption
            />
          </li>
        ))}
      </ul>
      <LevelNext snapshot={snapshot} next={moment.next?.id ?? null} />
      <BackToJourney />
    </MomentMain>
  );
}

/** The course moment first when it waits, else the next Level, else the journey. */
function LevelNext({
  snapshot,
  next,
}: {
  snapshot: Snapshot;
  next: LevelId | null;
}) {
  const coursePending = celebratable(snapshot).some(
    (m) => m.type === "course.completed",
  );
  if (coursePending)
    return (
      <ButtonLink to={COURSE_PATH} variant="primary" size="lg" iconEnd="arrow">
        See the course complete
      </ButtonLink>
    );
  const first =
    next === null
      ? undefined
      : snapshot.course.levels
          .find((view) => view.id === next)
          ?.lessons.find((lesson) => !lesson.optional);
  if (next === null || first === undefined)
    return (
      <ButtonLink to="/journey" variant="primary" size="lg" iconEnd="arrow">
        See the journey
      </ButtonLink>
    );
  return (
    <OpenLessonButton id={first.id} variant="primary">
      {`Start the ${LEVEL_NAMES[next]} level`}
    </OpenLessonButton>
  );
}

/**
 * Course complete: every Level's Badges, grouped by Level. The tab that
 * wins the course.completed milestone plays Pip's Celebration.
 */
export function CourseComplete() {
  const snapshot = useCourseSnapshot();
  const product = useProductName();
  const { courseCompleteExtra: Extra } = useSlots();
  useClaimMilestone((m) => m.type === "course.completed");
  if (!snapshot) return <Waiting />;
  const { levels } = snapshot.course;
  if (levels.length === 0 || levels.some((view) => !view.complete))
    return <NotYet what="course" />;
  return (
    <MomentMain>
      <Pip size="hero" className="mb-2" />
      <span className={EYEBROW}>Course complete</span>
      <PageTitle title={`You finished ${product}`} className={TITLE} />
      <p className="text-muted">{levelsComplete(levels)}</p>
      {levels.map((view) => (
        <section
          key={view.id}
          aria-labelledby={`course-${view.id}`}
          className="grid w-full max-w-moment justify-items-center gap-2"
        >
          <h2 id={`course-${view.id}`} className="text-sm text-muted">
            {LEVEL_NAMES[view.id]}
          </h2>
          <ul className="flex flex-wrap justify-center gap-3">
            {(levelMoment(snapshot, view.id)?.badges ?? []).map((badge) => (
              <li key={badge.lesson}>
                <LessonBadge
                  lesson={badge.lesson}
                  name={badge.name}
                  earned
                  size="sm"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {Extra && <Extra />}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <ButtonLink to="/progress" variant="primary" iconEnd="arrow">
          See your progress
        </ButtonLink>
        <BackToJourney />
      </div>
    </MomentMain>
  );
}

/**
 * On Welcome and the journey, when the oldest moment waiting is a Level or
 * the course complete (reached with no tab open): a quiet link to it. Only a
 * link: the moment's own screen claims it, and nothing moves the Learner.
 */
export function PendingMoment() {
  const oldest = celebratable(useCourseSnapshot())[0];
  if (oldest?.type === "level.completed")
    return (
      <PendingLink to={levelPath(oldest.level)}>
        {`See the ${LEVEL_NAMES[oldest.level]} level complete`}
      </PendingLink>
    );
  if (oldest?.type === "course.completed")
    return <PendingLink to={COURSE_PATH}>See the course complete</PendingLink>;
  return null;
}

/** QUIET_LINK on a surface over the Scene, with its own padding and corners. */
const ROOM_PENDING_LINK =
  "inline-block rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted underline underline-offset-3 shadow-sm transition-colors duration-(--duration-fast) ease-out hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function PendingLink({ to, children }: { to: string; children: string }) {
  // Over the Scene the link sits on a surface, never on the room.
  const room = useMount().scene !== null;
  return (
    <p className="mx-auto max-w-wide px-6 pt-4 text-center max-sm:px-5">
      <Link
        to={to}
        className={room ? ROOM_PENDING_LINK : QUIET_LINK}
        data-pending-moment=""
      >
        {children}
      </Link>
    </p>
  );
}
