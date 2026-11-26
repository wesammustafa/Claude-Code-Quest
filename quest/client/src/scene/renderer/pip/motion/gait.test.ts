// @vitest-environment node
// Pip's steps in the workshop (D6), simulated at 60 frames a second: a
// planted foot never slides or lifts and the feet take turns; a long trip
// runs with moments in the air and a short one only walks; and a new
// destination mid-stride replaces the old, where he settles on both feet.
import { describe, expect, test } from "vitest";
import { Gait, SPEED } from "./gait";
import { Motor } from "./motor";
import { NavGrid } from "./nav";

const room = { x0: -6, z0: -5, x1: 6, z1: 5 };
const bench = { x0: -1.2, z0: -0.6, x1: 1.2, z1: 0.6 };

interface Logged {
  t: number;
  landed: number[];
  airborne: boolean;
  speed: number;
}

function sim(
  seconds: number,
  motor: Motor,
  gait: Gait,
  each?: (t: number) => void,
) {
  const dt = 1 / 60;
  const log: Logged[] = [];
  const planted = new Map<number, { x: number; z: number }>();
  let slide = 0;
  let sink = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * dt;
    each?.(t);
    const root = motor.update(dt);
    const out = gait.update(dt, root);
    for (const f of gait.feet) {
      if (f.planted) {
        sink = Math.max(sink, Math.abs(f.pos.y));
        const was = planted.get(f.side);
        if (was)
          slide = Math.max(slide, Math.hypot(was.x - f.pos.x, was.z - f.pos.z));
        else planted.set(f.side, { x: f.pos.x, z: f.pos.z });
      } else planted.delete(f.side);
    }
    log.push({
      t,
      landed: out.landed,
      airborne: out.airborne,
      speed: motor.currentSpeed,
    });
  }
  return { log, slide, sink };
}

describe("Pip's gait", () => {
  test("a planted foot never slides or leaves the floor, and the feet take turns", () => {
    const nav = new NavGrid(room, [bench], 0.35);
    const motor = new Motor(nav, { x: -4, z: 3 }, 0);
    const gait = new Gait(motor.root);
    motor.goTo({ x: 4, z: -3 });
    const { log, slide, sink } = sim(8, motor, gait);
    expect(slide, "a standing foot moved").toBe(0);
    expect(sink, "a standing foot left the floor").toBe(0);
    const order = log.flatMap((l) => l.landed);
    expect(order.length).toBeGreaterThan(8);
    let repeats = 0;
    for (let i = 1; i < order.length; i++)
      if (order[i] === order[i - 1]) repeats++;
    // Only the last settling steps may repeat a side.
    expect(repeats, order.join(",")).toBeLessThanOrEqual(2);
    expect(motor.arrivedId, "never arrived").not.toBeNull();
  });

  test("a long trip runs, with moments in the air, and a short one only walks", () => {
    const nav = new NavGrid(room, [bench], 0.35);
    const long = new Motor(nav, { x: -5, z: 4 }, 0);
    const a = sim(8, long, new Gait(long.root), (t) => {
      if (t === 0) long.goTo({ x: 5, z: -4 });
    });
    expect(Math.max(...a.log.map((l) => l.speed))).toBeGreaterThan(
      SPEED.run * 0.9,
    );
    expect(a.log.some((l) => l.airborne)).toBe(true);

    const short = new Motor(nav, { x: -4, z: 3 }, 0);
    short.goTo({ x: -2.5, z: 3 });
    const b = sim(4, short, new Gait(short.root));
    expect(Math.max(...b.log.map((l) => l.speed))).toBeLessThanOrEqual(
      SPEED.walk + 1e-6,
    );
    expect(b.log.some((l) => l.airborne)).toBe(false);
  });

  test("a new destination mid-stride replaces the old one, and he settles there on both feet", () => {
    const nav = new NavGrid(room, [bench], 0.35);
    const motor = new Motor(nav, { x: -4, z: 3 }, 0);
    const gait = new Gait(motor.root);
    motor.goTo({ x: 4, z: 3 });
    let last: number | null = null;
    const { slide } = sim(9, motor, gait, (t) => {
      // Destinations in quick succession, then a last one behind him.
      if (t > 0.8 && t < 1.6 && Math.round(t * 60) % 6 === 0)
        motor.goTo({ x: Math.sin(t * 9) * 4, z: -3 });
      if (last === null && t > 1.69) last = motor.goTo({ x: -5, z: -4 }).id;
    });
    expect(slide).toBe(0);
    expect(motor.arrivedId).toBe(last);
    expect(Math.hypot(motor.root.pos.x + 5, motor.root.pos.z + 4)).toBeLessThan(
      0.5,
    );
    for (const f of gait.feet) expect(f.planted).toBe(true);
  });
});
