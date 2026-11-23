// Baking the 3D Pip's clips (seam S13): each channel of clip-tables.ts is
// read on the rig's own eased curves (its CubicEaseInterpolators,
// pip.rml:40-52), sampled on every 60 fps frame, turned into the nodes'
// translations, rotations, scales and the eyes' morph weights, and thinned
// to the fewest LINEAR keys that stay within a hair of the curve. A clip
// keys only what it moves away from rest: three's mixer gives every
// unkeyed property its file (rest) value. No clip ever keys `gaze`.
import { EAR } from "../turn.ts";
import { CLIP_TABLES, type ClipTable } from "./clip-tables.ts";
import type { PipNode, Quat } from "./parts.ts";
import type { Vec3 } from "./palette.ts";

/** The rig's frame rate: every key sits on a frame. */
export const FPS = 60;

/** The rig's CubicEaseInterpolators (pip.rml:40-52), CSS cubic-bezier control points. */
const CURVES: Readonly<
  Record<string, readonly [number, number, number, number]>
> = {
  io: [0.42, 0, 0.58, 1],
  IO: [0.65, 0, 0.35, 1],
  gl: [0.2, 0.8, 0.2, 1],
  sp: [0.15, 0.6, 0.4, 1],
  fa: [0.55, 0, 0.85, 0.6],
  eo: [0, 0, 0.58, 1],
  gio: [0.3, 0, 0.7, 1],
  ea: [0.25, 0.1, 0.25, 1],
  qs: [0.3, 0, 0.2, 1],
  se: [0.42, 0, 0.3, 1],
  fl: [0.5, 0, 0.75, 0.8],
  ei: [0.42, 0, 1, 1],
};

/** A cubic-bezier ease at u: solves its x for u, returns its y. */
export function ease(curve: string, u: number): number {
  if (curve === "L") return u;
  if (curve === "H") return 0;
  const c = CURVES[curve];
  if (c === undefined) throw new Error(`no curve ${curve}`);
  const [x1, y1, x2, y2] = c;
  const bez = (a: number, b: number, s: number) =>
    3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (bez(x1, x2, m) < u) lo = m;
    else hi = m;
  }
  return bez(y1, y2, (lo + hi) / 2);
}

interface Key {
  t: number;
  v: number[];
  curve: string;
}

/** A channel's keys, each time moved onto its frame. */
export function parseChannel(text: string): Key[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [timed = "", curve = "L"] = token.split("/");
      const colon = timed.indexOf(":");
      const t =
        colon < 0 ? 0 : Math.round(Number(timed.slice(0, colon)) * FPS) / FPS;
      const v = (colon < 0 ? timed : timed.slice(colon + 1))
        .split(",")
        .map(Number);
      if (v.some((n) => Number.isNaN(n)) || Number.isNaN(t))
        throw new Error(`bad key ${token}`);
      return { t, v, curve };
    });
}

/** The keys either side of a time and the eased share between them. */
function segment(
  keys: readonly Key[],
  t: number,
): { a: Key; b: Key; e: number } {
  const first = keys[0];
  if (first === undefined) throw new Error("a channel with no keys");
  if (t <= first.t || keys.length === 1) return { a: first, b: first, e: 0 };
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i] ?? first;
    const b = keys[i + 1] ?? first;
    if (t < b.t) return { a, b, e: ease(a.curve, (t - a.t) / (b.t - a.t)) };
  }
  const last = keys[keys.length - 1] ?? first;
  return { a: last, b: last, e: 0 };
}

const valueAt = (keys: readonly Key[], t: number): number => {
  const { a, b, e } = segment(keys, t);
  const va = a.v[0] ?? 0;
  return va + ((b.v[0] ?? 0) - va) * e;
};

// Quaternions, (x, y, z, w) as glTF writes them.
const DEG = Math.PI / 180;
/** three's Euler order XYZ (q = qx qy qz), in degrees. */
export function eulerXYZ(x: number, y: number, z: number): Quat {
  const c1 = Math.cos((x * DEG) / 2);
  const c2 = Math.cos((y * DEG) / 2);
  const c3 = Math.cos((z * DEG) / 2);
  const s1 = Math.sin((x * DEG) / 2);
  const s2 = Math.sin((y * DEG) / 2);
  const s3 = Math.sin((z * DEG) / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}
const qdot = (a: Quat, b: Quat) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
function slerp(a: Quat, b0: Quat, t: number): Quat {
  let b = b0;
  let d = qdot(a, b);
  if (d < 0) {
    b = [-b[0], -b[1], -b[2], -b[3]];
    d = -d;
  }
  if (d > 0.9995) {
    const q: Quat = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t,
    ];
    const n = Math.hypot(...q);
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
  }
  const th = Math.acos(d);
  const sa = Math.sin((1 - t) * th) / Math.sin(th);
  const sb = Math.sin(t * th) / Math.sin(th);
  return [
    a[0] * sa + b[0] * sb,
    a[1] * sa + b[1] * sb,
    a[2] * sa + b[2] * sb,
    a[3] * sa + b[3] * sb,
  ];
}
const angle = (a: Quat, b: Quat) =>
  2 * Math.acos(Math.min(1, Math.abs(qdot(a, b))));

/** A baked track: one node's property, keyed LINEAR. */
export interface Track {
  node: string;
  path: "translation" | "rotation" | "scale" | "weights";
  times: number[];
  /** The values, flat: 3 a key (translation, scale), 4 (rotation) or one per morph target (weights). */
  values: number[];
}

/** A baked clip. */
export interface Clip {
  name: string;
  tracks: Track[];
}

/** Groups the tables show together: a group's show (or uniform scale) multiplies each member's. */
const GROUPS: Readonly<Record<string, readonly string[]>> = {
  ThinkingDots: ["Dot1", "Dot2", "Dot3"],
  Zs: ["ZSmall", "ZBig"],
  Question: ["QuestionPop"],
  Crosses: ["Cross1", "Cross2", "Cross3"],
  Strokes: ["StrokeLeft", "StrokeRight"],
  Cheers: ["Cheer1", "Cheer2", "Cheer3", "Cheer4"],
  Confetti: Array.from({ length: 9 }, (_, i) => `Confetti${String(i + 1)}`),
  Catchlights: ["CatchlightLeft", "CatchlightRight"],
  Cheeks: ["CheekLeft", "CheekRight"],
};

/** The rig's lean pivots: the outer corner of the sole Pip rocks onto (pip.rml:66-67). */
const LEAN_PIVOT = { x: 116 / 725, y: 14 / 725 };
/**
 * A raised arm passes behind the ear, as the board draws it, never through
 * it: from `from` degrees up the shoulder slides back, and by `to` it has
 * cleared the ear's back face (turn.ts's EAR.halfDepth) by the fist's half
 * depth (30) and a hair, in metres.
 */
export const ARM_BEHIND_EAR = {
  from: 40,
  to: 65,
  z: -(EAR.halfDepth + 30 + 4) / 725,
} as const;
const smoothstep = (lo: number, hi: number, v: number) => {
  const u = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return u * u * (3 - 2 * u);
};
/** The hands reach along the arm's rest direction, art (0.8, -0.6). */
const REACH = { x: 0.8, y: -0.6 };
/** The eyes' morph weights from the rig's lid and arch positions (rig units). */
const lidWeight = (lidY: number) => Math.max(0, Math.min(1, (lidY - 17) / 73));
const archWeight = (archY: number) =>
  Math.max(0, Math.min(1, (158 - archY) / 118));

/** The tolerance a thinned track keeps to its curve, by property. */
const TOLERANCE = {
  translation: 0.0003,
  rotation: 0.1 * DEG,
  scale: 0.003,
  weights: 0.003,
} as const;

interface Rest {
  translation: Vec3;
  rotation: Quat;
  scale: Vec3;
  /** Whether it hangs under Effects: its place is keyed absolutely. */
  effect: boolean;
}

/** Each node's rest transform, by name. */
export function restPoses(root: PipNode): Map<string, Rest> {
  const out = new Map<string, Rest>();
  const walk = (n: PipNode, effect: boolean) => {
    out.set(n.name, {
      translation: n.translation ?? [0, 0, 0],
      rotation: n.rotation ?? [0, 0, 0, 1],
      scale: n.scale ?? [1, 1, 1],
      effect,
    });
    for (const c of n.children ?? []) walk(c, n.name === "Effects");
  };
  walk(root, false);
  return out;
}

type Channels = Map<string, Key[]>;

/** One node's samplers for one property: its value at a source time. */
interface Target {
  node: string;
  path: Track["path"];
  value: (s: number) => number[];
}

function targetsFor(node: string, ch: Channels, rest: Rest): Target[] {
  const has = (p: string) => ch.has(p);
  const get = (p: string, fallback: number) => (s: number) => {
    const keys = ch.get(p);
    return keys === undefined ? fallback : valueAt(keys, s);
  };
  const out: Target[] = [];
  const [rx, ry, rz] = rest.translation;

  if (node === "Lean") {
    const theta = get("r.z", 0);
    out.push({
      node,
      path: "rotation",
      value: (s) => [...eulerXYZ(0, 0, theta(s))],
    });
    out.push({
      node,
      path: "translation",
      value: (s) => {
        const a = theta(s) * DEG;
        const px = a < 0 ? LEAN_PIVOT.x : -LEAN_PIVOT.x;
        const py = LEAN_PIVOT.y;
        return [
          px - (Math.cos(a) * px - Math.sin(a) * py),
          py - (Math.sin(a) * px + Math.cos(a) * py),
          0,
        ];
      },
    });
    return out;
  }

  if (has("t.x") || has("t.y") || has("reach")) {
    if (rest.effect) {
      const x = get("t.x", rx);
      const y = get("t.y", ry);
      out.push({ node, path: "translation", value: (s) => [x(s), y(s), rz] });
    } else if (has("reach")) {
      const reach = get("reach", 0);
      const sign = node.endsWith("Right") ? -1 : 1;
      out.push({
        node,
        path: "translation",
        value: (s) => [
          rx + reach(s) * REACH.x * sign,
          ry + reach(s) * REACH.y,
          rz,
        ],
      });
    } else {
      const x = get("t.x", 0);
      const y = get("t.y", 0);
      out.push({
        node,
        path: "translation",
        value: (s) => [rx + x(s), ry + y(s), rz],
      });
    }
  }

  const triple = ch.get("r");
  if (triple !== undefined) {
    out.push({
      node,
      path: "rotation",
      value: (s) => {
        const { a, b, e } = segment(triple, s);
        const q = (k: Key) => eulerXYZ(k.v[0] ?? 0, k.v[1] ?? 0, k.v[2] ?? 0);
        return [...slerp(q(a), q(b), e)];
      },
    });
  } else if (has("r.x") || has("r.y") || has("r.z")) {
    const x = get("r.x", 0);
    const y = get("r.y", 0);
    const z = get("r.z", 0);
    out.push({
      node,
      path: "rotation",
      value: (s) => [...eulerXYZ(x(s), y(s), z(s))],
    });
  }

  if ((node === "ArmLeft" || node === "ArmRight") && has("r.z")) {
    const raise = get("r.z", 0);
    const { from, to, z } = ARM_BEHIND_EAR;
    out.push({
      node,
      path: "translation",
      value: (s) => [rx, ry, rz + z * smoothstep(from, to, Math.abs(raise(s)))],
    });
  }

  if (node === "Hop" && has("s.y")) {
    const sy = get("s.y", 1);
    out.push({
      node,
      path: "scale",
      value: (s) => {
        const v = sy(s);
        return [1 / Math.sqrt(v), v, 1 / Math.sqrt(v)];
      },
    });
  } else if (
    ["s", "s.x", "s.y", "show", "size", "size.x", "size.y", "groupShow"].some(
      has,
    )
  ) {
    const factors = ["s", "show", "size", "groupShow"].map((p) => get(p, 1));
    const sx = get("s.x", rest.scale[0] === 0 ? 1 : rest.scale[0]);
    const sy = get("s.y", rest.scale[1] === 0 ? 1 : rest.scale[1]);
    const kx = get("size.x", 1);
    const ky = get("size.y", 1);
    out.push({
      node,
      path: "scale",
      value: (s) => {
        const u = factors.reduce((p, f) => p * f(s), 1);
        return [u * sx(s) * kx(s), u * sy(s) * ky(s), u];
      },
    });
  }

  if (has("lidY") || has("archY")) {
    const lidY = get("lidY", 0);
    const archY = get("archY", 190);
    out.push({
      node,
      path: "weights",
      value: (s) => [lidWeight(lidY(s)), archWeight(archY(s))],
    });
  }
  return out;
}

/** Whether a sample is the node's rest value, within the tolerance. */
function atRest(
  v: readonly number[],
  path: Track["path"],
  rest: Rest,
): boolean {
  const tol = TOLERANCE[path];
  if (path === "rotation")
    return angle(v as unknown as Quat, rest.rotation) <= tol;
  const r: readonly number[] =
    path === "weights"
      ? v.map(() => 0)
      : path === "scale"
        ? rest.scale
        : rest.translation;
  return v.every((x, i) => Math.abs(x - (r[i] ?? 0)) <= tol);
}

/** The fewest samples whose LINEAR keys stay within the tolerance of every sample. */
function thin(
  times: readonly number[],
  values: readonly number[][],
  path: Track["path"],
): number[] {
  const tol = TOLERANCE[path];
  const err = (a: number, b: number, k: number) => {
    const ta = times[a] ?? 0;
    const tb = times[b] ?? 0;
    const u = tb === ta ? 0 : ((times[k] ?? 0) - ta) / (tb - ta);
    const va = values[a] ?? [];
    const vb = values[b] ?? [];
    const vk = values[k] ?? [];
    if (path === "rotation") {
      const q = slerp(va as unknown as Quat, vb as unknown as Quat, u);
      return angle(q, vk as unknown as Quat);
    }
    return Math.max(
      ...va.map((x, i) => Math.abs(x + ((vb[i] ?? 0) - x) * u - (vk[i] ?? 0))),
    );
  };
  const kept = [0];
  let from = 0;
  while (from < times.length - 1) {
    let to = from + 1;
    while (to + 1 < times.length) {
      let ok = true;
      for (let k = from + 1; k <= to; k++)
        if (err(from, to + 1, k) > tol) {
          ok = false;
          break;
        }
      if (!ok) break;
      to++;
    }
    kept.push(to);
    from = to;
  }
  return kept;
}

/** The clip's sample times: every frame, plus the moment before each held key's jump. */
function sampleTimes(table: ClipTable, channels: Channels): number[] {
  const frames = Math.round(table.length * FPS);
  const times = new Set<number>();
  for (let f = 0; f <= frames; f++) times.add(f / FPS);
  const shift = table.shift ?? 0;
  for (const keys of channels.values())
    keys.forEach((k, i) => {
      const next = keys[i + 1];
      if (
        k.curve !== "H" ||
        next === undefined ||
        next.v.every((v, j) => v === k.v[j])
      )
        return;
      const at =
        Math.round(
          ((((next.t - shift) % table.length) + table.length) % table.length) *
            FPS,
        ) / FPS;
      if (at - 0.001 > 0) times.add(at - 0.001);
    });
  return [...times].sort((a, b) => a - b);
}

/** One clip of the tables, baked onto Pip's nodes. */
export function bakeClip(
  name: string,
  table: ClipTable,
  rests: ReadonlyMap<string, Rest>,
): Clip {
  const byNode = new Map<string, Channels>();
  const into = (node: string, prop: string, keys: Key[]) => {
    if (!rests.has(node)) throw new Error(`${name}: no node ${node}`);
    const ch = byNode.get(node) ?? new Map<string, Key[]>();
    ch.set(prop, keys);
    byNode.set(node, ch);
  };
  const all: Channels = new Map();
  for (const [channel, text] of Object.entries(table.channels)) {
    const dot = channel.indexOf(".");
    const node = channel.slice(0, dot);
    const prop = channel.slice(dot + 1);
    const keys = parseChannel(text);
    all.set(channel, keys);
    const members = GROUPS[node];
    if (members === undefined) into(node, prop, keys);
    else for (const m of members) into(m, prop, keys);
  }
  if (byNode.has("gaze")) throw new Error(`${name} keys the gaze`);
  const times = sampleTimes(table, all);
  const shift = table.shift ?? 0;
  const source = (t: number) =>
    table.shift === undefined ? t : (t + shift) % table.length;
  const tracks: Track[] = [];
  for (const [node, ch] of byNode) {
    const rest = rests.get(node);
    if (rest === undefined) continue;
    for (const target of targetsFor(node, ch, rest)) {
      const values = times.map((t) => target.value(source(t)));
      if (target.path === "rotation")
        for (let i = 1; i < values.length; i++) {
          const a = values[i - 1] as unknown as Quat;
          const b = values[i] ?? [];
          if (qdot(a, b as unknown as Quat) < 0) values[i] = b.map((v) => -v);
        }
      // A track that only holds the rest value is left to the rest pose.
      if (values.every((v) => atRest(v, target.path, rest))) continue;
      const kept = thin(times, values, target.path);
      tracks.push({
        node,
        path: target.path,
        times: kept.map((i) => times[i] ?? 0),
        values: kept.flatMap((i) => values[i] ?? []),
      });
    }
  }
  return { name, tracks };
}

/** The still pose: the rest pose, keyed once on the parts the modes move. */
export function stillClip(rests: ReadonlyMap<string, Rest>): Clip {
  const keyed: readonly (readonly [string, readonly Track["path"][]])[] = [
    ["Hop", ["translation", "scale"]],
    ["Lean", ["translation", "rotation"]],
    ["Neck", ["translation"]],
    ["HeadPose", ["rotation"]],
    ["ArmLeft", ["rotation"]],
    ["ArmRight", ["rotation"]],
    ["AntennaLeft", ["rotation"]],
    ["AntennaRight", ["rotation"]],
    ["GlanceEyes", ["translation", "scale"]],
    ["Eyes", ["scale"]],
    ["MouthSmile", ["scale"]],
  ];
  const tracks: Track[] = keyed.flatMap(([node, paths]) => {
    const rest = rests.get(node);
    if (rest === undefined) throw new Error(`still: no node ${node}`);
    return paths.map((path) => ({
      node,
      path,
      times: [0],
      values:
        path === "rotation"
          ? [...rest.rotation]
          : path === "scale"
            ? [...rest.scale]
            : [...rest.translation],
    }));
  });
  return { name: "still", tracks };
}

/** Every clip, in the contract's order. */
export function bakeClips(root: PipNode, order: readonly string[]): Clip[] {
  const rests = restPoses(root);
  return order.map((name) => {
    if (name === "still") return stillClip(rests);
    const table = CLIP_TABLES[name];
    if (table === undefined) throw new Error(`no table for ${name}`);
    return bakeClip(name, table, rests);
  });
}

/** Where each effect first shows in the clips (metres, Effects' frame), for its hidden resting place. */
export function firstPlaces(): Map<string, readonly [number, number]> {
  const out = new Map<string, readonly [number, number]>();
  for (const table of Object.values(CLIP_TABLES))
    for (const [channel, text] of Object.entries(table.channels)) {
      const m = /^(\w+)\.t\.([xy])$/.exec(channel);
      if (m === null) continue;
      const node = m[1] ?? "";
      const first = parseChannel(text)[0]?.v[0] ?? 0;
      const was = out.get(node) ?? [0, 0];
      out.set(node, m[2] === "x" ? [first, was[1]] : [was[0], first]);
    }
  return out;
}
