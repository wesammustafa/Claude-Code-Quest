// The Scene's camera in the workshop (the warm workshop, D5): the framing
// each screen asks for, where each framing puts the places, their cards and
// today's Journey stage's Pip on the page, and the camera moves between
// screens, with Three.js's own math and no renderer.
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import type { SceneStation, ScreenOnShow } from "../../mount/types";
import type { Band } from "../path";
import { PIP_RADIUS, PIP_START, SPOTS, type SpotId } from "../workshop/layout";
import { workshopPlaces } from "../workshop/places";
import {
  aim,
  createCameraMoves,
  cubicBezier,
  FOV,
  framingFor,
  planMove,
  poseOf,
  sameFraming,
  sameView,
  type Framing,
  type PathState,
  type Pose,
  type Viewport,
} from "./camera";
import { tellPage, toldCards } from "./workshop/anchors";

type Course = readonly (readonly [string, SceneStation["level"], boolean])[];

const level = (
  lessons: readonly string[],
  of: SceneStation["level"],
  optional: boolean,
): Course => lessons.map((l) => [l, of, optional] as const);

/** Fix-It's Lessons in course order: each Level's core Lessons, then its labs. */
const COURSE: Course = [
  ...level(
    ["b-1", "b-2", "b-6", "b-4", "b-5", "b-capstone"],
    "beginner",
    false,
  ),
  ...level(["b-3"], "beginner", true),
  ...level(
    ["i-2", "i-1", "i-4", "i-6", "i-7", "i-capstone"],
    "intermediate",
    false,
  ),
  ...level(["i-3", "i-5", "i-8"], "intermediate", true),
  ...level(
    ["a-2", "a-8", "a-7", "a-9", "a-6", "a-capstone"],
    "advanced",
    false,
  ),
  ...level(["a-1", "a-3", "a-4", "a-5"], "advanced", true),
];

const stationsWith = (done: readonly string[]): SceneStation[] =>
  COURSE.map(([lesson, level, optional]) => ({
    lesson,
    level,
    optional,
    complete: done.includes(lesson),
  }));

const STATIONS = stationsWith(["b-1", "b-2"]);
const PLACES = workshopPlaces(STATIONS);
const DESKTOP: Viewport = { width: 1440, height: 900 };
const PHONE: Viewport = { width: 390, height: 844 };
/** Exactly nine tenths as wide as tall: narrow to the page's CSS (app.css, scene-narrow), so its panel sits below. */
const SQUARISH: Viewport = { width: 900, height: 1000 };

/** The Journey standing at `at`, with no stage on the page unless a band is given. */
const standing = (
  at: string | null,
  band: Band | null = null,
  whole = false,
): PathState => ({ at, whole, band });

/** Today's Journey stage's band, as the Journey lays it out on a desktop and on a phone. */
/** The stage's band as the Journey lays it out at 1440 by 900, and on a phone. */
const DESKTOP_BAND: Band = { left: 224, top: 387, width: 992, height: 320 };
const PHONE_BAND: Band = { left: 16, top: 322, width: 358, height: 256 };

/** Welcome's card, as it lays out at a desktop's foot on the left and across a phone's top. */
const DESKTOP_CARD: Band = { left: 24, top: 510, width: 432, height: 366 };
const PHONE_CARD: Band = { left: 16, top: 56, width: 358, height: 228 };

const at = (path: string, screen: ScreenOnShow["screen"]): ScreenOnShow => ({
  path,
  screen,
});

/** Where the places, cards and Pip's feet fall on a page of `viewport`'s size, through the framing's pose, and where a point of the room falls. */
function drawn(framing: Framing, viewport: Viewport) {
  const camera = new PerspectiveCamera(
    FOV,
    viewport.width / viewport.height,
    0.1,
    80,
  );
  const pose = poseOf(framing, viewport);
  aim(camera, pose, viewport);
  const told = tellPage(
    camera,
    { left: 0, top: 0, ...viewport },
    PLACES.map((p) => p.id),
    toldCards(PLACES),
    pose.pip,
  );
  const onPage = (p: Vector3) => {
    const v = p.clone().project(camera);
    return {
      x: ((v.x + 1) / 2) * viewport.width,
      y: ((1 - v.y) / 2) * viewport.height,
    };
  };
  return { ...told, pose, onPage };
}

describe("the framing each screen shows", () => {
  test("Welcome shows the whole room under its card; Progress, the added screens and the Level's and course's ends show the whole room", () => {
    for (const screen of [at("/", "welcome"), at("/resume", "welcome")])
      expect(framingFor(screen, standing("b-4"), PLACES), screen.path).toEqual({
        kind: "welcome",
        to: null,
        card: null,
      });
    for (const screen of [
      at("/progress", "progress"),
      at("/settings", "other"),
      at("/level/beginner/complete", "levelComplete"),
      at("/course/complete", "courseComplete"),
    ])
      expect(framingFor(screen, standing("b-4"), PLACES), screen.path).toEqual({
        kind: "room",
      });
  });

  test("the Journey frames the place of the Lesson it stands at, else the first place with a card to do, else the room", () => {
    const journey = at("/journey", "map");
    expect(framingFor(journey, standing("i-3"), PLACES)).toEqual({
      kind: "place",
      place: "organizer",
      panel: false,
    });
    expect(framingFor(journey, standing(null), PLACES)).toEqual({
      kind: "place",
      place: "noticeboard",
      panel: false,
    });
    const beginnerDone = stationsWith(
      COURSE.filter(([, of]) => of === "beginner").map(([l]) => l),
    );
    expect(
      framingFor(journey, standing(null), workshopPlaces(beginnerDone)),
    ).toMatchObject({
      place: "organizer",
    });
    const allDone = stationsWith(COURSE.map(([l]) => l));
    expect(
      framingFor(journey, standing(null), workshopPlaces(allDone)),
    ).toEqual({ kind: "room" });
  });

  test("a Lesson's overview frames its place beside the panel, its step keeps that, and Lesson complete comes close beside it", () => {
    const none = standing(null);
    expect(framingFor(at("/lesson/a-4", "intro"), none, PLACES)).toEqual({
      kind: "place",
      place: "release-desk",
      panel: true,
    });
    expect(framingFor(at("/lesson/a-4/step", "step"), none, PLACES)).toEqual(
      framingFor(at("/lesson/a-4", "intro"), none, PLACES),
    );
    expect(
      framingFor(at("/lesson/b-6/complete", "complete"), none, PLACES),
    ).toEqual({ kind: "close", place: "noticeboard" });
  });

  test("a Lesson the course does not hold, or no snapshot yet, shows the whole room", () => {
    expect(
      framingFor(at("/lesson/x-9", "intro"), standing(null), PLACES),
    ).toEqual({ kind: "room" });
    expect(framingFor(at("/journey", "map"), standing("b-1"), [])).toEqual({
      kind: "room",
    });
  });

  test("while the Journey's stage shows, it frames the card of the Lesson Pip stands at, or pulled back its whole place, and a band that scrolls frames the same", () => {
    const journey = at("/journey", "map");
    const onB2 = framingFor(journey, standing("b-2", DESKTOP_BAND), PLACES);
    expect(onB2).toMatchObject({
      kind: "stage",
      card: { lesson: "b-2", place: "noticeboard" },
      whole: false,
    });
    // Each Level's stage frames a card at its own place.
    for (const [lesson, place] of [
      ["i-4", "organizer"],
      ["a-9", "release-desk"],
    ] as const)
      expect(
        framingFor(journey, standing(lesson, DESKTOP_BAND), PLACES),
      ).toMatchObject({ kind: "stage", card: { lesson, place } });
    const pulled = framingFor(
      journey,
      standing("b-2", DESKTOP_BAND, true),
      PLACES,
    );
    expect(pulled).toMatchObject({ kind: "stage", whole: true });
    const scrolled = { ...DESKTOP_BAND, top: DESKTOP_BAND.top - 200 };
    expect(
      sameFraming(onB2, framingFor(journey, standing("b-2", scrolled), PLACES)),
    ).toBe(true);
    expect(sameFraming(onB2, pulled)).toBe(false);
    expect(
      sameFraming(
        onB2,
        framingFor(journey, standing("b-4", DESKTOP_BAND), PLACES),
      ),
    ).toBe(false);
    // Before the Journey names a Lesson, its place shows over the page.
    expect(framingFor(journey, standing(null, DESKTOP_BAND), PLACES)).toEqual({
      kind: "place",
      place: "noticeboard",
      panel: false,
    });
  });
});

describe("where the framings put the places", () => {
  test("the whole room on a desktop shows all three places and every card", () => {
    const { anchors, view } = drawn({ kind: "room" }, DESKTOP);
    for (const place of ["noticeboard", "organizer", "release-desk"] as const)
      expect(anchors[place]?.visible, place).toBe(true);
    expect(view.points).toHaveLength(COURSE.length);
    expect(view.pip).toBeNull();
  });

  test("Welcome shows Pip at his start clear on the floor, above Pip's toolbar at the page's foot; on a phone below the card's top third, with the board in view and the other places ahead, off to the side, where their tags wait at the page's edge", () => {
    const PIP_TALL = 1.1;
    for (const viewport of [DESKTOP, PHONE]) {
      const { onPage, anchors } = drawn(
        { kind: "welcome", to: null, card: null },
        viewport,
      );
      const feet = onPage(new Vector3(PIP_START.x, 0, PIP_START.z));
      const head = onPage(new Vector3(PIP_START.x, PIP_TALL, PIP_START.z));
      const what = String(viewport.width);
      // The toolbar takes about 120 px at a phone's foot (two rows), 70 px at a desktop's.
      expect(feet.y, what).toBeLessThan(
        viewport.height - (viewport === PHONE ? 120 : 70) - 40,
      );
      if (viewport === PHONE)
        expect(head.y, what).toBeGreaterThan(viewport.height / 3);
      expect(feet.x, what).toBeGreaterThan(viewport.width * 0.3);
      expect(feet.x, what).toBeLessThan(viewport.width * 0.7);
      expect(anchors.noticeboard?.visible, what).toBe(true);
      for (const place of ["organizer", "release-desk"] as const)
        expect(anchors[place]?.ahead, `${what} ${place}`).toBe(true);
    }
  });

  // The owner's tour sent Pip to the tea table on Welcome and lost him
  // under its card on a desktop, and off the page on a phone.
  test("Pip sent to any spot of the room on Welcome stands whole on the page, over his toolbar and clear of the card, on a desktop and a phone", () => {
    const PIP_TALL = 1.1;
    for (const [viewport, card, toolbar] of [
      [DESKTOP, DESKTOP_CARD, 70],
      [PHONE, PHONE_CARD, 120],
    ] as const)
      for (const spot of Object.keys(SPOTS) as SpotId[]) {
        const to = SPOTS[spot].stand;
        const { onPage } = drawn({ kind: "welcome", to, card }, viewport);
        const what = `${String(viewport.width)} ${spot}`;
        const feet = onPage(new Vector3(to.x, 0, to.z));
        const head = onPage(new Vector3(to.x, PIP_TALL, to.z));
        for (const p of [feet, head]) {
          expect(p.x, what).toBeGreaterThan(0);
          expect(p.x, what).toBeLessThan(viewport.width);
          expect(p.y, what).toBeGreaterThan(0);
          expect(p.y, what).toBeLessThan(viewport.height - toolbar);
          const under =
            p.x > card.left &&
            p.x < card.left + card.width &&
            p.y > card.top &&
            p.y < card.top + card.height;
          expect(under, what).toBe(false);
        }
      }
  });

  test("a spot the room already shows clear keeps the room's own view, and no card measured yet still keeps him on the page", () => {
    const room = drawn({ kind: "welcome", to: null, card: null }, DESKTOP);
    const bench = drawn(
      { kind: "welcome", to: SPOTS.bench.stand, card: DESKTOP_CARD },
      DESKTOP,
    );
    expect(bench.pose.position.toArray()).toEqual(room.pose.position.toArray());
    const { x, z } = SPOTS.organizer.stand;
    const phone = drawn(
      { kind: "welcome", to: { x, z }, card: null },
      PHONE,
    ).onPage(new Vector3(x, 0, z));
    expect(phone.x).toBeGreaterThan(0);
    expect(phone.x).toBeLessThan(PHONE.width);
  });

  // U4 left Pip where he stood on Progress and the Level and course
  // moments, behind their panels over the room's middle.
  test("the whole room draws Pip aside at the armchair whole beside a 720 px column, at every wide size", () => {
    const PIP_TALL = 1.1;
    const COLUMN = 720;
    const { x, z } = SPOTS.armchair.stand;
    for (const viewport of [
      DESKTOP,
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
    ]) {
      const { onPage } = drawn({ kind: "room" }, viewport);
      const feet = onPage(new Vector3(x, 0, z));
      const head = onPage(new Vector3(x, PIP_TALL, z));
      const half = ((feet.y - head.y) * 0.8) / 2;
      const what = String(viewport.width);
      expect(feet.x - half, what).toBeGreaterThan(0);
      expect(feet.x + half, what).toBeLessThan((viewport.width - COLUMN) / 2);
      expect(head.y, what).toBeGreaterThan(0);
      expect(feet.y, what).toBeLessThan(viewport.height);
    }
  });

  test("a Lesson's overview on a desktop keeps its place's cards in the left 60%, leaving the panel's side free", () => {
    for (const place of ["noticeboard", "organizer", "release-desk"] as const) {
      const { view } = drawn({ kind: "place", place, panel: true }, DESKTOP);
      const own = new Set(
        workshopPlaces(STATIONS)
          .find((p) => p.id === place)
          ?.cards.map((c) => c.lesson),
      );
      const cards = view.points.filter((p) => own.has(p.lesson));
      expect(cards, place).toHaveLength(own.size);
      for (const card of cards)
        expect(card.x + card.r, `${place} ${card.lesson}`).toBeLessThan(
          DESKTOP.width * 0.6,
        );
    }
  });

  test("on a phone the overview keeps its place's cards in the top three eighths, over the panel", () => {
    const { view } = drawn(
      { kind: "place", place: "noticeboard", panel: true },
      PHONE,
    );
    const beginner = view.points.filter((p) => p.lesson.startsWith("b-"));
    expect(beginner).toHaveLength(7);
    for (const card of beginner) {
      expect(card.y + card.r, card.lesson).toBeLessThan((PHONE.height * 3) / 8);
      expect(card.x - card.r, card.lesson).toBeGreaterThanOrEqual(0);
      expect(card.x + card.r, card.lesson).toBeLessThanOrEqual(PHONE.width);
    }
  });

  test("Lesson complete comes closer on its place than the overview, beside the same panel, every card in view", () => {
    const reach = (framing: Framing) =>
      drawn(framing, DESKTOP).view.points.filter((p) =>
        p.lesson.startsWith("a-"),
      );
    const overview = reach({
      kind: "place",
      place: "release-desk",
      panel: true,
    });
    const close = reach({ kind: "close", place: "release-desk" });
    expect(close).toHaveLength(10);
    // Its cards spread wider on the page: a card's 44 px target floors r.
    const spread = (cards: typeof close) =>
      Math.max(...cards.map((c) => c.x)) - Math.min(...cards.map((c) => c.x));
    expect(spread(close)).toBeGreaterThan(spread(overview));
    for (const card of close)
      expect(card.x + card.r, card.lesson).toBeLessThan(DESKTOP.width * 0.6);
  });

  // U3 drew him a fifth of the page tall on the overview and up to 44% on
  // Lesson complete, his feet at the page's foot.
  test("Pip at his Lesson's place stands clear of the panel and modest: in the left 60% on a desktop, above the sheet on a phone and on a page exactly nine tenths as wide as tall", () => {
    const PIP_TALL = 1.1;
    for (const place of ["noticeboard", "organizer", "release-desk"] as const)
      for (const [framing, most] of [
        [{ kind: "place", place, panel: true }, 1 / 6],
        [{ kind: "close", place }, 1 / 5],
      ] as const)
        for (const viewport of [DESKTOP, PHONE, SQUARISH]) {
          const { onPage } = drawn(framing, viewport);
          const { x, z } = SPOTS[place].stand;
          const feet = onPage(new Vector3(x, 0, z));
          const head = onPage(new Vector3(x, PIP_TALL, z));
          const what = `${framing.kind} ${place} ${String(viewport.width)}`;
          const free =
            viewport === DESKTOP
              ? { width: viewport.width * 0.6, height: viewport.height }
              : { width: viewport.width, height: (viewport.height * 3) / 8 };
          for (const p of [feet, head]) {
            expect(p.x, what).toBeGreaterThan(0);
            expect(p.x, what).toBeLessThan(free.width);
            expect(p.y, what).toBeGreaterThan(0);
            expect(p.y, what).toBeLessThan(free.height);
          }
          expect((feet.y - head.y) / viewport.height, what).toBeLessThan(most);
        }
  });

  test("an anchor off the page is told, but not as in view; a card is a 44 px target at the least", () => {
    const { anchors, view } = drawn(
      { kind: "close", place: "noticeboard" },
      PHONE,
    );
    expect(anchors["release-desk"]?.visible).toBe(false);
    expect(anchors["card:a-5"]?.visible).toBe(false);
    expect(view.points.some((p) => p.lesson === "a-5")).toBe(false);
    for (const p of view.points) expect(p.r).toBeGreaterThanOrEqual(22);
  });

  // Every Level's tab frames its own place: U4 drew a stage for Beginner
  // alone, and the other tabs left the camera on the noticeboard under the
  // Journey's panels, with Pip behind them.
  test("on every Level's stage, Pip's Station's card and his feet under it fall in the band, in one column, with the 3D Pip at his place's spot whole on it too; pulled back, every card of the Level is wholly on the band", () => {
    for (const place of PLACES) stageOf(place.cards.map((c) => c.lesson));
  });

  function stageOf(lessons: readonly string[]): void {
    const journey = at("/journey", "map");
    expect(lessons.length).toBeGreaterThan(0);
    for (const [viewport, band] of [
      [DESKTOP, DESKTOP_BAND],
      [PHONE, PHONE_BAND],
    ] as const) {
      const onBand = (p: { x: number; y: number }, r = 0) =>
        p.x - r >= band.left &&
        p.x + r <= band.left + band.width &&
        p.y - r >= band.top &&
        p.y + r <= band.top + band.height;
      for (const lesson of lessons) {
        const framing = framingFor(journey, standing(lesson, band), PLACES);
        expect(framing, lesson).toMatchObject({ kind: "stage" });
        const shown = drawn(framing, viewport);
        const card = shown.view.points.find((p) => p.lesson === lesson);
        const feet = shown.view.pip;
        const where = `${String(viewport.width)} ${lesson}`;
        expect(card && onBand(card, card.r), where).toBe(true);
        expect(feet && onBand(feet), where).toBe(true);
        expect(
          Math.abs((feet?.x ?? 0) - (card?.x ?? Infinity)),
          where,
        ).toBeLessThan(1);
        // Pip, about a unit tall, stands under the card with his head on the band too.
        const head = shown.onPage(
          (shown.pose.pip ?? new Vector3()).clone().setY(1.1),
        );
        expect(head.y, where).toBeGreaterThan(card?.y ?? Infinity);
        expect(onBand(head), where).toBe(true);
        // The 3D Pip walks to his place's spot, not under the card: he
        // stands whole on the band at every card of the place.
        if (framing.kind !== "stage") continue;
        // His feet's edges too, his radius round his spot: from the desk's
        // steep view their front fell under the panel below the band.
        const { x, z } = SPOTS[framing.card.place].stand;
        const r = PIP_RADIUS;
        for (const [dx, y, dz] of [
          [0, 1.1, 0],
          [r, 0, 0],
          [-r, 0, 0],
          [0, 0, r],
          [0, 0, -r],
        ] as const)
          expect(
            onBand(shown.onPage(new Vector3(x + dx, y, z + dz))),
            `${where} 3D Pip ${String(dx)} ${String(y)} ${String(dz)}`,
          ).toBe(true);
      }
      const whole = drawn(
        framingFor(journey, standing(lessons[0] ?? null, band, true), PLACES),
        viewport,
      ).view;
      for (const lesson of lessons) {
        const card = whole.points.find((p) => p.lesson === lesson);
        expect(
          card && onBand(card, card.r),
          `${String(viewport.width)} whole ${lesson}`,
        ).toBe(true);
      }
      expect(whole.pip && onBand(whole.pip)).toBe(true);
    }
  }

  test("no screen but the Journey's stage tells the page where Pip's feet are", () => {
    for (const framing of [
      { kind: "room" },
      { kind: "place", place: "noticeboard", panel: false },
      { kind: "close", place: "organizer" },
    ] as const)
      expect(drawn(framing, DESKTOP).view.pip).toBeNull();
  });

  test("a view the same to within a quarter pixel is not told again", () => {
    const a = drawn({ kind: "room" }, DESKTOP).view;
    const b = drawn({ kind: "room" }, DESKTOP).view;
    expect(sameView(a, b)).toBe(true);
    expect(sameView(null, b)).toBe(false);
    expect(sameView(a, drawn({ kind: "room" }, PHONE).view)).toBe(false);
  });
});

describe("the camera moves between screens", () => {
  const change = (from: ScreenOnShow, to: ScreenOnShow, reduced = false) => ({
    from,
    to,
    reduced,
  });
  const journey = at("/journey", "map");

  test("a screen that frames anew travels, and coming back to the Journey stands it at the Lesson left", () => {
    expect(
      planMove(change(at("/", "welcome"), journey), standing(null), PLACES),
    ).toEqual({ at: null, travel: true });
    expect(
      planMove(
        change(at("/lesson/i-4/complete", "complete"), journey),
        standing("b-1"),
        PLACES,
      ),
    ).toEqual({ at: "i-4", travel: true });
    expect(
      planMove(
        change(journey, at("/lesson/b-4", "intro")),
        standing("b-4", DESKTOP_BAND),
        PLACES,
      ),
    ).toEqual({ at: null, travel: true });
  });

  test("into the Workspace the Scene stops, reduced motion never travels, and between two screens of the whole room nothing moves", () => {
    expect(
      planMove(
        change(at("/lesson/b-1", "intro"), at("/lesson/b-1/step", "step")),
        standing(null),
        PLACES,
      ).travel,
    ).toBe(false);
    expect(
      planMove(
        change(at("/", "welcome"), journey, true),
        standing(null),
        PLACES,
      ).travel,
    ).toBe(false);
    expect(
      planMove(
        change(at("/progress", "progress"), at("/settings", "other")),
        standing(null),
        PLACES,
      ).travel,
    ).toBe(false);
  });

  const room = poseOf({ kind: "room" }, DESKTOP);
  const board = poseOf({ kind: "close", place: "noticeboard" }, DESKTOP);
  const linear = (t: number) => t;

  test("a move eases from where the camera stood to the framing, and ends on it", () => {
    const moves = createCameraMoves();
    moves.frame(0, room);
    moves.start(0, 200, linear, true);
    const half = moves.frame(100, board);
    expect(half.between).toBe(true);
    expect(half.moving).toBe(true);
    expect(half.pose.position.distanceTo(room.position)).toBeCloseTo(
      half.pose.position.distanceTo(board.position),
      5,
    );
    const done = moves.frame(200, board);
    expect(done.moving).toBe(false);
    expect(done.between).toBe(false);
    expect(done.pose.position.distanceTo(board.position)).toBe(0);
  });

  test("a new navigation starts the next move from where the last one stood; none starts before a first frame", () => {
    const moves = createCameraMoves();
    moves.start(0, 200, linear, true);
    expect(moves.frame(10, room).moving).toBe(false);
    moves.start(10, 200, linear, true);
    const mid: Pose = moves.frame(60, board).pose;
    moves.end(60, board);
    moves.start(60, 200, linear, true);
    expect(
      moves.frame(60, room).pose.position.distanceTo(mid.position),
    ).toBeCloseTo(0, 5);
  });

  test("on the Journey's stage, Pip walks from one Station's card to the next as the camera glides", () => {
    const journey = at("/journey", "map");
    const stage = (lesson: string) =>
      poseOf(
        framingFor(journey, standing(lesson, DESKTOP_BAND), PLACES),
        DESKTOP,
      );
    const [b1, b2] = [stage("b-1"), stage("b-2")];
    const moves = createCameraMoves();
    moves.frame(0, b1);
    moves.start(0, 200, linear, false);
    const half = moves.frame(100, b2).pose.pip;
    expect(half?.x).toBeCloseTo(((b1.pip?.x ?? 0) + (b2.pip?.x ?? 0)) / 2, 5);
    expect(moves.frame(200, b2).pose.pip?.equals(b2.pip ?? new Vector3())).toBe(
      true,
    );
  });

  test("the easing is the token's cubic Bézier", () => {
    const inOut = cubicBezier(0.65, 0, 0.35, 1);
    expect(inOut(0)).toBe(0);
    expect(inOut(1)).toBe(1);
    expect(inOut(0.5)).toBeCloseTo(0.5, 3);
    expect(inOut(0.25)).toBeLessThan(0.25);
    expect(inOut(0.75)).toBeGreaterThan(0.75);
  });
});
