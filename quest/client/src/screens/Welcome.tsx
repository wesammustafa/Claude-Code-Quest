import type { PlayingLesson, Snapshot, StepDownLesson } from "@quest/contract";
import { Button, ButtonLink } from "../components/Button";
import { Icon } from "../components/Icon";
import { InlineText } from "../components/InlineText";
import { ProgressBar } from "../components/ProgressBar";
import { lessonEyebrow, seeLevels } from "../course/labels";
import { useConnection } from "../live/LiveProvider";
import { useActionProps } from "../live/useAction";
import { useMount, useSlots } from "../mount/context";
import { Link, useQuestNavigate } from "../mount/links";
import { Pip } from "../pip/Pip";
import { usePipInput } from "../pip/PipStage";
import { usePipStandsDown } from "../scene/context";
import { useDeckHost, useWorkshop } from "../scene/workshop/store";
import { PageTitle } from "../shell/PageTitle";
import { BOX, EYEBROW, QUIET_LINK } from "./layout";
import {
  hasProgress,
  lastFinished,
  summaryOf,
  useCourseSnapshot,
} from "./lesson";

/** The words while the first snapshot is awaited: the host asks git first. */
export const WAITING_LINE = "Asking git about this folder…";

const HERO =
  "mx-auto grid min-h-dvh max-w-hero content-center justify-items-center gap-4.5 px-5 pt-12 pb-24 text-center";

/**
 * Welcome on a first run, Resume on a return: Pip large and centred, one
 * action. A welcomed copy not mid-Lesson offers Continue to the course's
 * next Lesson instead of Start. The words state no Claude Code fact; the
 * resume card's and the Continue title are the snapshot's. With the Scene
 * on, the same words and actions sit on one card over the workshop room,
 * clear of Pip (RoomWelcome).
 */
export function Welcome() {
  const room = useMount().scene !== null;
  return room ? <RoomWelcome /> : <HeroWelcome />;
}

function HeroWelcome() {
  const snapshot = useCourseSnapshot();
  const waiting = useConnection() === "waiting";
  const resuming = resumingOf(snapshot);
  const name = snapshot?.learner.name ?? null;
  const waitingLine = useSlots().copy?.waitingLine ?? WAITING_LINE;

  return (
    <main className={HERO}>
      <Pip size="hero" className="mb-2" />
      {name !== null && (
        <p className="text-lg font-semibold text-accent-text">{`Hi ${name}!`}</p>
      )}
      {snapshot && resuming ? (
        <Resume snapshot={snapshot} lesson={resuming} />
      ) : (
        <FirstRun snapshot={snapshot} />
      )}
      {/* Shown only once the shell marks the wait as noticeable, so a
          snapshot that comes at once shows no flash of it. */}
      {waiting && (
        <p
          className="hidden text-sm text-muted [[data-connection=waiting]_&]:block"
          data-waiting-line=""
        >
          {waitingLine}
        </p>
      )}
    </main>
  );
}

/**
 * The course's next Lesson and the action that opens it: Start on a first
 * run, which finishes the welcome; Continue for a welcomed Learner.
 */
function useFirstLesson(snapshot: Snapshot | null) {
  const navigate = useQuestNavigate();
  const first = snapshot?.course.next ?? null;
  const welcomed = snapshot?.learner.welcomed === true;
  // The course's own count, once the snapshot says.
  const see = snapshot ? seeLevels(snapshot.course.levels) : "See all levels";
  const title = first !== null ? summaryOf(snapshot, first)?.title : undefined;
  // course.next is the active Lesson only on a first run, so its route shows
  // it without a lesson.open. A welcomed Learner may have another active
  // (a new copy's pin, or a complete Lesson), so Continue opens course.next.
  const open = () => {
    if (first !== null) void navigate(`/lesson/${first}`);
  };
  const finish = useActionProps(
    "welcome.finish",
    { type: "welcome.finish" },
    open,
  );
  const reopen = useActionProps(
    "lesson.open",
    { type: "lesson.open", lesson: first ?? "" },
    open,
  );
  return { first, welcomed, see, title, finish, reopen };
}

/** The action that opens the course's next Lesson: Start the first lesson, or Continue with its title. */
function FirstLessonButton({
  lesson,
}: {
  lesson: ReturnType<typeof useFirstLesson>;
}) {
  const { first, welcomed, title, finish, reopen } = lesson;
  if (first === null) return null;
  return welcomed ? (
    <Button variant="primary" size="lg" iconEnd="arrow" {...reopen}>
      {title === undefined ? (
        "Continue"
      ) : (
        <>
          {"Continue: "}
          <InlineText text={title} />
        </>
      )}
    </Button>
  ) : (
    <Button variant="primary" size="lg" iconEnd="arrow" {...finish}>
      Start the first lesson
    </Button>
  );
}

function FirstRun({ snapshot }: { snapshot: Snapshot | null }) {
  const welcomeLine = useSlots().copy?.welcomeLine;
  const lesson = useFirstLesson(snapshot);
  const { welcomed, see } = lesson;
  return (
    <>
      <PageTitle
        title={welcomed ? "Welcome back" : "Welcome"}
        className="text-display max-sm:text-3xl"
      >
        Learn Claude Code by using it.
      </PageTitle>
      <p className="max-w-moment text-lg text-muted">
        Every lesson happens in a real project, your Practice copy, with this
        page beside your terminal.
      </p>
      {welcomeLine !== undefined && (
        <p className="max-w-moment text-muted" data-welcome-line="">
          {welcomeLine}
        </p>
      )}
      <ul className="my-2 grid w-full grid-cols-2 gap-3 text-left max-sm:grid-cols-1">
        <li className={`${BOX} gap-1 text-sm`}>
          <Icon name="browser" size="xl" className="mb-1 text-accent-text" />
          <b className="text-control">This page</b>
          <span className="text-muted">
            shows one step at a time and checks your work as you go
          </span>
        </li>
        <li className={`${BOX} gap-1 text-sm`}>
          <Icon name="terminal" size="xl" className="mb-1 text-accent-text" />
          <b className="text-control">Your terminal</b>
          <span className="text-muted">
            is the other window: each step says what to do there
          </span>
        </li>
      </ul>
      <FirstLessonButton lesson={lesson} />
      <Link to="/journey" className={QUIET_LINK}>
        {welcomed ? see : `${see} first`}
      </Link>
    </>
  );
}

/** The step the Learner is on, from 1, and how many there are. */
function placeOf(lesson: PlayingLesson | StepDownLesson): [number, number] {
  if (lesson.phase === "step-down") return [0, 0];
  const at = lesson.steps.findIndex((step) => step.state === "current");
  return [at + 1, lesson.steps.length];
}

/** Continue the Lesson the Learner is in, at its step. */
function useResume(lesson: PlayingLesson | StepDownLesson) {
  const navigate = useQuestNavigate();
  const go = () => void navigate(`/lesson/${lesson.id}/step`);
  return useActionProps(
    "lesson.open",
    { type: "lesson.open", lesson: lesson.id },
    go,
  );
}

function Resume({
  snapshot,
  lesson,
}: {
  snapshot: Snapshot;
  lesson: PlayingLesson | StepDownLesson;
}) {
  const summary = summaryOf(snapshot, lesson.id);
  const [at, of] = placeOf(lesson);
  const resume = useResume(lesson);
  return (
    <>
      <PageTitle title="Welcome back" className="text-display max-sm:text-3xl">
        Welcome back.
      </PageTitle>
      <section
        aria-label="Where you left off"
        className={`${BOX} w-full max-w-moment justify-items-start text-left`}
      >
        <span className={EYEBROW}>
          {lessonEyebrow(
            lesson.level,
            summary?.number ?? null,
            lesson.capstone,
            summary?.optional ?? false,
          )}
        </span>
        <h2 className="text-xl">
          <InlineText text={lesson.title} />
        </h2>
        {of > 0 && (
          <>
            <p className="text-sm text-muted">{`Step ${String(at)} of ${String(of)}`}</p>
            <ProgressBar value={at - 1} max={of} label="Steps done" />
          </>
        )}
        <Button variant="primary" size="lg" iconEnd="arrow" {...resume}>
          Continue
        </Button>
      </section>
    </>
  );
}

/** The Learner mid-Lesson, or null: a welcomed copy in a step or a Step-down. */
function resumingOf(
  snapshot: Snapshot | null,
): PlayingLesson | StepDownLesson | null {
  const lesson = snapshot?.lesson;
  return snapshot?.learner.welcomed === true &&
    (lesson?.phase === "playing" || lesson?.phase === "step-down")
    ? lesson
    : null;
}

/**
 * Welcome over the workshop room (the warm workshop): one card, at the
 * foot of the room's left side on a wide screen, where it hides neither
 * the Levels' places nor Pip, and at the top of a narrower one, a phone's
 * full width, so Pip stands clear in the room below it,
 * with Welcome's own words and actions; Say hello, which turns Pip to the
 * Learner; and, for a Learner who has been here before, Welcome back and a
 * way into the last Lesson they finished, where the host shows their work.
 * Under the card, the place where the renderer draws the room's tags and
 * Pip's toolbar. The card is the page's surface, so no word sits on the
 * room or its still.
 */
function RoomWelcome() {
  const snapshot = useCourseSnapshot();
  const waiting = useConnection() === "waiting";
  const waitingLine = useSlots().copy?.waitingLine ?? WAITING_LINE;
  const welcomeLine = useSlots().copy?.welcomeLine;
  const name = snapshot?.learner.name ?? null;
  const resuming = resumingOf(snapshot);
  const back = snapshot !== null && hasProgress(snapshot);
  const finished = snapshot === null ? null : lastFinished(snapshot);
  const lesson = useFirstLesson(snapshot);
  const host = useDeckHost("room");
  // The 3D Pip stands in the room once he holds Pip; until then, and on
  // the still image, the card shows the screen's own.
  const inRoom = usePipStandsDown();
  return (
    <main
      data-room=""
      className="min-h-dvh p-4 pt-16 pb-32 md:p-6 md:pb-28 lg:flex lg:flex-col lg:justify-end lg:pb-6"
    >
      <section
        aria-label="Welcome"
        data-welcome-card=""
        className={`${BOX} relative z-10 w-full max-w-sheet gap-3.5 p-5.5 shadow-md lg:max-w-96 xl:max-w-sheet`}
      >
        <div className="flex items-start gap-3">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <span className={EYEBROW}>
              {name === null ? "Welcome" : `Hi ${name}!`}
            </span>
            <PageTitle
              title={back ? "Welcome back" : "Welcome"}
              className="text-3xl max-sm:text-2xl"
            >
              {back ? "Welcome back." : "Learn Claude Code by using it."}
            </PageTitle>
          </div>
          {!inRoom && <Pip size="beside" />}
        </div>
        {resuming !== null && snapshot !== null ? (
          <RoomResume snapshot={snapshot} lesson={resuming} />
        ) : (
          // A phone keeps the card short, so the room shows below it.
          <p className="text-muted max-sm:hidden">
            Every lesson happens in a real project, your Practice copy, with
            this page beside your terminal.
          </p>
        )}
        {welcomeLine !== undefined && (
          <p className="text-sm text-muted" data-welcome-line="">
            {welcomeLine}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {resuming === null && <FirstLessonButton lesson={lesson} />}
          <SayHello />
          {back && finished !== null && (
            <ButtonLink
              to={`/lesson/${finished.id}`}
              className="min-h-11"
              data-your-work=""
            >
              Open your work
            </ButtonLink>
          )}
        </div>
        <Link to="/journey" className={`${QUIET_LINK} justify-self-start`}>
          {lesson.welcomed || back ? lesson.see : `${lesson.see} first`}
        </Link>
        {waiting && (
          <p
            className="hidden text-sm text-muted [[data-connection=waiting]_&]:block"
            data-waiting-line=""
          >
            {waitingLine}
          </p>
        )}
      </section>
      <div ref={host} data-workshop-deck="" />
    </main>
  );
}

/** Where the Learner left off, on the room's card: the Lesson, its step, and Continue. */
function RoomResume({
  snapshot,
  lesson,
}: {
  snapshot: Snapshot;
  lesson: PlayingLesson | StepDownLesson;
}) {
  const summary = summaryOf(snapshot, lesson.id);
  const [at, of] = placeOf(lesson);
  const resume = useResume(lesson);
  return (
    <section
      aria-label="Where you left off"
      className="grid justify-items-start gap-2 rounded-md bg-surface-2 p-4"
    >
      <span className={EYEBROW}>
        {lessonEyebrow(
          lesson.level,
          summary?.number ?? null,
          lesson.capstone,
          summary?.optional ?? false,
        )}
      </span>
      <h2 className="text-lg">
        <InlineText text={lesson.title} />
      </h2>
      {of > 0 && (
        <>
          <p className="text-sm text-muted">{`Step ${String(at)} of ${String(of)}`}</p>
          <ProgressBar value={at - 1} max={of} label="Steps done" />
        </>
      )}
      <Button variant="primary" size="lg" iconEnd="arrow" {...resume}>
        Continue
      </Button>
    </section>
  );
}

/**
 * Say hello: Pip turns to the Learner and greets them, in the room once
 * the 3D Pip stands there, else as the screen's own Pip.
 */
function SayHello() {
  const workshop = useWorkshop();
  const inRoom = usePipStandsDown();
  const send = usePipInput();
  return (
    <Button
      className="min-h-11"
      onClick={() => {
        if (inRoom && workshop.ready()) workshop.send({ type: "greet" });
        else send({ type: "greet" });
      }}
    >
      Say hello
    </Button>
  );
}
