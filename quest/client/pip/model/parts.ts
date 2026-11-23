// The 3D Pip's parts (seam S13): every node of his hierarchy, its rest
// place, and the mesh on it, built from the approved board's own box model
// (turn.ts) and front-view art (rig/pip.rml). Lengths are in the rig's
// 800-unit art space, where Pip is 725 units tall from his soles to the big
// antenna's tip; the model is written in metres, so he stands 1 m tall.
// Model space: +x is Pip's own left (the screen's right as he faces the
// Learner), +y up from the soles, +z toward the Learner.
import {
  ANTENNAS,
  ANTENNA_BASE_V,
  ANTENNA_Z,
  CENTRE,
  EAR,
  FACE_V,
  GLOW_V,
  HEAD,
  TORSO,
} from "../turn.ts";
import {
  ALONG_X,
  ALONG_Z,
  MeshBuilder,
  multiply,
  addFadeDisc,
  addPrism,
  addSolid,
  at,
  bop,
  convexCap,
  cubic,
  ellipse,
  ribbon,
  roundedBlock,
  roundedRect,
  turnZ,
  type Face,
  type Paint,
  type Vec2,
} from "./geometry.ts";
import {
  BOTTOM_BEVEL,
  TOP,
  TOP_BEVEL,
  UNDERSIDE,
  bandStops,
  gradient,
  hex,
  mix,
  mixLinear,
  shade,
  shadeRatio,
  type Rgb,
  type Stops,
  type Vec3,
} from "./palette.ts";

/** One rig unit in metres: Pip is 725 units tall (the soles at art y 768, the big tip's top at art y 43). */
export const RIG_UNIT = 1 / 725;
/** Art y of the soles: model y is 768 - art y. */
const SOLES = 768;

export type Quat = readonly [number, number, number, number];

/** A mesh's morph target: where each vertex goes at full weight. */
export interface Morph {
  name: string;
  move: (p: Vec3) => Vec3;
}

/** A node of Pip: its rest transform (metres) and its mesh. */
export interface PipNode {
  name: string;
  translation?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  mesh?: MeshBuilder;
  morphs?: readonly Morph[];
  children?: PipNode[];
}

/** A rig-unit place in metres. */
export const metres = (v: Vec3): Vec3 => [
  v[0] * RIG_UNIT,
  v[1] * RIG_UNIT,
  v[2] * RIG_UNIT,
];
export const quatZ = (a: number): Quat => [
  0,
  0,
  Math.sin(a / 2),
  Math.cos(a / 2),
];
const HIDDEN: Vec3 = [0, 0, 0];

/** Pip's sides: +1 his left (+x), -1 his right. */
type Side = 1 | -1;

// ---------------------------------------------------------------------------
// The head (turn.ts's box model, coloured as turn.ts writes the board).

const HEAD_CENTRE_Y = SOLES - CENTRE.y; // 403
const NECK_Y = SOLES - 578; // the rig's Head node, art y 578
const HEAD_WALL = HEAD.halfHeight - HEAD.bevel;

/** A head wall's colour at head-local height y: turn.ts's band stops (0.12 and 1 down the head's art height), by the wall's facing. */
function headWall(n: Vec3, y: number): Rgb {
  const frontChamfer = n[2] > 0.1 && Math.abs(n[0]) > 0.1;
  const [top, bottom] = bandStops(n[0], n[2], frontChamfer);
  const along = (HEAD.halfHeight - y) / (2 * HEAD.halfHeight);
  return gradient(
    [
      [0.12, top],
      [1, bottom],
    ],
    along,
  );
}

const paintHead: Paint = (p) => {
  if (p.kind === "top bevel") return TOP_BEVEL;
  if (p.kind === "bottom bevel") return BOTTOM_BEVEL;
  if (p.kind === "top") return TOP;
  if (p.kind === "bottom") return UNDERSIDE;
  return headWall(p.normal, p.local[1]);
};

/** The face's own colour at head-local height y, as the front wall's two rows blend on the GPU. */
function faceAt(y: number): Rgb {
  const front: Vec3 = [0, 0, 1];
  const top = headWall(front, HEAD_WALL);
  const bottom = headWall(front, -HEAD_WALL);
  return mixLinear(
    bottom,
    top,
    Math.max(0, Math.min(1, (y + HEAD_WALL) / (2 * HEAD_WALL))),
  );
}

// The face's glow (pip.rml:408-414): FFE6C8 at alpha 0x1F, 17 above the
// head's centre and 30 toward the key, fading out over its feather.
const GLOW = hex("FFE6C8");
const GLOW_AT: Vec2 = [30, -GLOW_V + FACE_V];
const GLOW_RINGS: readonly (readonly [number, number, number])[] = [
  [126, 91, 0.1216],
  [180, 130, 0.06],
  [210, 150, 0],
];

/** The glow's alpha at a Face-local point: held inside its first ring, then fading ring to ring along the ray from its centre. */
function glowAlpha(x: number, y: number): number {
  const dx = x - GLOW_AT[0];
  const dy = y - GLOW_AT[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return GLOW_RINGS[0]?.[2] ?? 0;
  const c = dx / d;
  const s = dy / d;
  const radius = ([a, b]: readonly [number, number, number]) =>
    1 / Math.hypot(c / a, s / b);
  let inner = GLOW_RINGS[0] ?? [1, 1, 0];
  if (d <= radius(inner)) return inner[2];
  for (const ring of GLOW_RINGS.slice(1)) {
    const r0 = radius(inner);
    const r1 = radius(ring);
    if (d <= r1)
      return inner[2] + ((ring[2] - inner[2]) * (d - r0)) / (r1 - r0);
    inner = ring;
  }
  return 0;
}

/** What the face shows at a Face-local point: the wall under the glow. */
const surface = (x: number, y: number): Rgb =>
  mix(faceAt(y - FACE_V), GLOW, glowAlpha(x, y));

function glow(): PipNode {
  const mesh = new MeshBuilder();
  const rings = GLOW_RINGS.map(([a, b]) => ellipse(a, b, 16));
  const alpha = (ring: number) => GLOW_RINGS[Math.max(0, ring)]?.[2] ?? 0;
  addFadeDisc(mesh, {
    rings,
    centre: [0, 0],
    z: 0,
    paint: (ring, p) =>
      mix(faceAt(p[1] + GLOW_AT[1] - FACE_V), GLOW, alpha(ring)),
  });
  return {
    name: "Glow",
    translation: metres([GLOW_AT[0], GLOW_AT[1], 0.5]),
    mesh,
  };
}

// ---------------------------------------------------------------------------
// The eyes (pip.rml:279-330): dark rounded bars with a soft pale rim, the
// lids and the happy arches as morph targets.

const EYE = { x: 100, w: 60, h: 156, r: 22, z0: -2, z1: 3 };
const EYE_TOP = EYE.h / 2;
const EYE_STOPS: Stops = [
  [EYE_TOP, hex("2C1D21")],
  [EYE_TOP - 0.35 * EYE.h, hex("150C10")],
  [-EYE_TOP, hex("140B0F")],
];
const EYE_DARK = hex("140B0F");
/** The lid's cut at full weight, eye-local: the rig's Lid at 90 uncovers the eye to 5 above its centre. */
const LID_CUT = 5;
/** The arch that rises under a happy eye (the rig's 120 by 160 ellipse at its highest, y 40). */
const arch = (x: number) => 80 * Math.sqrt(Math.max(0, 1 - (x / 60) ** 2)) - 40;

/** The eye's outline height at x: flat across the middle, the corners' quarter circles. */
function eyeTop(x: number): number {
  const flat = EYE.w / 2 - EYE.r;
  const ax = Math.abs(x);
  if (ax <= flat) return EYE_TOP;
  const dx = Math.min(EYE.r, ax - flat);
  return EYE_TOP - EYE.r + Math.sqrt(EYE.r * EYE.r - dx * dx);
}

/** The eye's columns: the corner arcs' points, the flat's ends and its middle, so a lid and an arch read. */
function eyeColumns(): number[] {
  const flat = EYE.w / 2 - EYE.r;
  const right = [
    0,
    flat,
    ...[67.5, 45, 22.5, 0].map(
      (deg) => flat + EYE.r * Math.cos((deg * Math.PI) / 180),
    ),
  ];
  return [
    ...right
      .slice(1)
      .map((x) => -x)
      .reverse(),
    ...right,
  ];
}

/** The lid's morph: what lies above the cut comes down onto it; the rim above the eye comes down with it. */
const lid = (p: Vec3): Vec3 => {
  const y =
    p[1] <= LID_CUT
      ? p[1]
      : p[1] <= EYE_TOP
        ? LID_CUT
        : p[1] - (EYE_TOP - LID_CUT);
  return [p[0], y, p[2]];
};
/** The arch's morph: what lies below the arch rises onto it; the rim below the eye rises with it. */
const archMove = (p: Vec3): Vec3 => {
  const a = arch(p[0]);
  const y = p[1] >= a ? p[1] : p[1] >= -EYE_TOP ? a : p[1] + (a + EYE_TOP);
  return [p[0], y, p[2]];
};

function eye(side: Side): PipNode {
  const mesh = new MeshBuilder();
  const xs = eyeColumns();
  const mid = EYE_TOP - 0.35 * EYE.h;
  const tops = xs.map((x) => [x, eyeTop(x)] as const);
  const bottoms = xs.map((x) => [x, -eyeTop(x)] as const);
  const caps: Vec2[][] = [];
  const backCaps: Vec2[][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i] ?? 0;
    const b = xs[i + 1] ?? 0;
    caps.push([[a, mid], [b, mid], tops[i + 1] ?? [b, 0], tops[i] ?? [a, 0]]);
    caps.push([
      bottoms[i] ?? [a, 0],
      bottoms[i + 1] ?? [b, 0],
      [b, mid],
      [a, mid],
    ]);
    backCaps.push([
      bottoms[i] ?? [a, 0],
      bottoms[i + 1] ?? [b, 0],
      tops[i + 1] ?? [b, 0],
      tops[i] ?? [a, 0],
    ]);
  }
  const last = xs.length - 1;
  const loop: Vec2[] = [
    [xs[last] ?? 0, -eyeTop(xs[last] ?? 0)],
    [xs[last] ?? 0, mid],
    ...[...tops].reverse(),
    [xs[0] ?? 0, mid],
    ...bottoms,
  ];
  const outline = loop.filter((p, i, all) => {
    const q = all[(i + 1) % all.length] ?? p;
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9;
  });
  addPrism(mesh, {
    outline,
    caps,
    backCaps,
    z0: EYE.z0,
    z1: EYE.z1,
    paint: (kind, p) =>
      kind === "front" ? gradient(EYE_STOPS, p[1]) : EYE_DARK,
  });
  // The rim (pip.rml:301-309): FFC79E at alpha 0x80, 2 below the eye's centre, feathered out.
  const rim = hex("FFC79E");
  const rings = (
    [
      [60, 156, 22],
      [72, 168, 28],
      [82, 178, 33],
    ] as const
  ).map(([w, h, r]) =>
    roundedRect(w, h, r, 3).map(([x, y]) => [x, y - 2] as const),
  );
  const ringMesh = { rings, centre: [0, -2] as Vec2, z: 1.25 };
  const ex = side * EYE.x;
  const paintRim = (ring: number, p: Vec2) =>
    ring >= 2
      ? surface(ex + p[0], p[1])
      : mix(surface(ex + p[0], p[1]), rim, 0.502);
  addFadeRing(mesh, { ...ringMesh, paint: paintRim });
  return {
    name: side === 1 ? "EyeLeft" : "EyeRight",
    translation: metres([ex, 0, 0]),
    mesh,
    morphs: [
      { name: "lid", move: lid },
      { name: "arch", move: archMove },
    ],
  };
}

/** Rings joined by quads, with no middle: an outline that fades out. */
function addFadeRing(
  mesh: MeshBuilder,
  o: {
    rings: readonly (readonly Vec2[])[];
    z: number;
    paint: (ring: number, p: Vec2) => Rgb;
  },
): void {
  for (let r = 0; r + 1 < o.rings.length; r++) {
    const inner = o.rings[r] ?? [];
    const outer = o.rings[r + 1] ?? [];
    inner.forEach((p, i) => {
      const q = inner[(i + 1) % inner.length] ?? p;
      const P = outer[i] ?? p;
      const Q = outer[(i + 1) % outer.length] ?? q;
      const p3 = (v: Vec2): Vec3 => [v[0], v[1], o.z];
      mesh.polygon(
        [p3(p), p3(P), p3(Q), p3(q)],
        [o.paint(r, p), o.paint(r + 1, P), o.paint(r + 1, Q), o.paint(r, q)],
        [0, 0, 1],
      );
    });
  }
}

/** Success's bright eyes (pip.rml:271-278): a glint and a spark, both toward the key (+x) on either eye. */
function catchlight(side: Side): PipNode {
  const mesh = new MeshBuilder();
  const colour = hex("F3E8DF");
  const z = 3.5;
  const flatCap = (outline: readonly Vec2[]) => {
    mesh.polygon(
      outline.map(([x, y]) => [x, y, z] as const),
      outline.map(() => colour),
      [0, 0, 1],
    );
  };
  flatCap(roundedRect(15, 26, 7, 3));
  flatCap(ellipse(4, 4, 8, [-20, -32]));
  return {
    name: side === 1 ? "CatchlightLeft" : "CatchlightRight",
    translation: metres([side * EYE.x + 11, 46, 0]),
    scale: HIDDEN,
    mesh,
  };
}

// ---------------------------------------------------------------------------
// The mouths (pip.rml:210-254).

const MOUTH_LINE = hex("6A2618");

function smile(): MeshBuilder {
  const mesh = new MeshBuilder();
  const path: Vec2[] = [];
  for (let i = 0; i <= 5; i++)
    path.push(cubic([24, 6], [24, 6], [12, -6], [0, -6], i / 5));
  for (let i = 1; i <= 5; i++)
    path.push(cubic([0, -6], [-12, -6], [-24, 7], [-24, 7], i / 5));
  const { outline, caps } = ribbon(path, 6);
  addPrism(mesh, { outline, caps, z0: -1, z1: 2, paint: () => MOUTH_LINE });
  return mesh;
}

function hmm(): MeshBuilder {
  const mesh = new MeshBuilder();
  const { outline, caps } = ribbon(
    [
      [15, -1],
      [-15, 1],
    ],
    6,
  );
  addPrism(mesh, { outline, caps, z0: -1, z1: 2, paint: () => MOUTH_LINE });
  return mesh;
}

/** The open grin with its tongue: a flat top with rounded corners over a round bowl. */
function openMouth(): MeshBuilder {
  const mesh = new MeshBuilder();
  const bowl = (s: number) => cubic([29, 0], [29, 0], [24, -40], [0, -40], s);
  // Where the bowl reaches a height, for the gradient's row at -20.
  const sAt = (y: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (bowl(m)[1] > y) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const corner = sAt(-7);
  const right: Vec2[] = [[22, 0]];
  // The 7-unit corner rounded with a quadratic from the top edge to the bowl.
  const end = bowl(corner);
  for (const t of [1 / 3, 2 / 3]) {
    const u = 1 - t;
    right.push([
      u * u * 22 + 2 * u * t * 29 + t * t * end[0],
      u * u * 0 + 2 * u * t * 0 + t * t * end[1],
    ]);
  }
  const ss = [
    corner,
    sAt(-20),
    ...[0.55, 0.7, 0.82, 0.92].map((k) => corner + (1 - corner) * k),
  ].sort((a, b) => a - b);
  for (const s of ss) right.push(bowl(s));
  right.sort((a, b) => b[1] - a[1]);
  const mirror = (p: Vec2): Vec2 => [-p[0], p[1]];
  const bottom: Vec2 = [0, -40];
  const outline: Vec2[] = [
    ...right,
    bottom,
    ...[...right].reverse().map(mirror),
  ];
  const caps: Vec2[][] = [];
  for (let i = 0; i + 1 < right.length; i++) {
    const a = right[i] ?? bottom;
    const b = right[i + 1] ?? bottom;
    caps.push([mirror(a), a, b, mirror(b)]);
  }
  const lastRight = right[right.length - 1] ?? bottom;
  caps.push([mirror(lastRight), lastRight, bottom]);
  const inside: Stops = [
    [0, hex("541B12")],
    [-20, hex("6E2618")],
  ];
  const edge = hex("3A100C");
  addPrism(mesh, {
    outline,
    caps,
    z0: -1,
    z1: 2,
    paint: (kind, p) => (kind === "front" ? gradient(inside, p[1]) : edge),
  });
  const tongue = ellipse(13, 6, 12, [0, -30]);
  mesh.polygon(
    tongue.map(([x, y]) => [x, y, 2.5] as const),
    tongue.map(() => hex("D8604A")),
    [0, 0, 1],
  );
  return mesh;
}

function oMouth(): MeshBuilder {
  const mesh = new MeshBuilder();
  const outline = ellipse(15, 17, 12);
  const stops: Stops = [
    [17, hex("3A100C")],
    [-17, hex("6E2618")],
  ];
  addPrism(mesh, {
    outline,
    caps: convexCap(outline),
    z0: -1,
    z1: 2,
    paint: (kind, p) =>
      kind === "front" ? gradient(stops, p[1]) : hex("3A100C"),
  });
  return mesh;
}

function mouth(): PipNode {
  return {
    name: "Mouth",
    children: [
      { name: "MouthSmile", translation: metres([0, -108, 0]), mesh: smile() },
      {
        name: "MouthOpen",
        translation: metres([0, -96, 0]),
        scale: HIDDEN,
        mesh: openMouth(),
      },
      {
        name: "MouthO",
        translation: metres([0, -112, 0]),
        scale: HIDDEN,
        mesh: oMouth(),
      },
      {
        name: "MouthHmm",
        translation: metres([0, -108, 0]),
        scale: HIDDEN,
        mesh: hmm(),
      },
    ],
  };
}

/** Celebration's rosy cheeks (pip.rml:257-264): FF6F6A at 0x8C, feathered into the face. */
function cheek(side: Side): PipNode {
  const mesh = new MeshBuilder();
  const at: Vec2 = [side * 114, -96];
  const rings = (
    [
      [28, 10],
      [33, 15],
      [40, 21],
    ] as const
  ).map(([a, b]) => ellipse(a, b, 12));
  const alpha = [0.549, 0.3, 0];
  addFadeDisc(mesh, {
    rings,
    centre: [0, 0],
    z: 0,
    paint: (ring, p) =>
      mix(
        surface(at[0] + p[0], at[1] + p[1]),
        hex("FF6F6A"),
        alpha[Math.max(0, ring)] ?? 0,
      ),
  });
  return {
    name: side === 1 ? "CheekLeft" : "CheekRight",
    // 0.7 units over the glow (at 0.5), so they keep apart on a 16-bit depth buffer too.
    translation: metres([at[0], at[1], 1.2]),
    scale: HIDDEN,
    mesh,
  };
}

// ---------------------------------------------------------------------------
// Ears and antennas (turn.ts's EAR and ANTENNAS).

const EAR_FRONT: Stops = [
  [108, hex("F8683A")],
  [108 - 0.6 * 216, hex("E0522A")],
  [-108, hex("D0461F")],
];
const EAR_OUTER: Stops = [
  [108, hex("E4542A")],
  [-108, hex("C23E1E")],
];
const EAR_LIP = hex("9E3020");
/** The lip: a dark band 15 deep at the ear's foot (pip.rml:333-336). */
const LIP_TOP = -83;
const EAR_LIGHT = mix(hex("F8683A"), hex("FFA070"), 0x8c / 255);

/** How much brighter Pip's lit side (+x) is than his shaded side, by channel. */
function litOverShaded(): Rgb {
  const lit = shadeRatio([1, 0, 0]);
  const dim = shadeRatio([-1, 0, 0]);
  return [lit[0] / dim[0], lit[1] / dim[1], lit[2] / dim[2]];
}

function ear(side: Side): PipNode {
  const mesh = new MeshBuilder();
  const hh = EAR.centre - EAR.top;
  const hw = (EAR.out + EAR.in) / 2;
  const faces = bop({
    hw,
    hd: EAR.halfDepth,
    c: 0,
    hh,
    b: 10,
    rows: [108 - 0.6 * 216, LIP_TOP],
  });
  const lift = litOverShaded();
  const inLip = (p: {
    span: readonly [number, number] | undefined;
    local: Vec3;
  }) =>
    p.span === undefined
      ? p.local[1] < LIP_TOP - 1e-6
      : (p.span[0] + p.span[1]) / 2 < LIP_TOP;
  const front = (p: {
    span: readonly [number, number] | undefined;
    local: Vec3;
  }) => (inLip(p) ? EAR_LIP : gradient(EAR_FRONT, p.local[1]));
  addSolid(mesh, faces, {
    place: at([(side * (EAR.out - EAR.in)) / 2, 0, 0]),
    paint: (p) => {
      if (p.kind === "top bevel" || p.kind === "top") return EAR_LIGHT;
      if (p.kind === "wall" && p.normal[2] > 0.9) return front(p);
      if (p.kind === "wall" && p.normal[0] * side > 0.9) {
        if (inLip(p)) return shade(EAR_LIP, p.normal);
        const c = gradient(EAR_OUTER, p.local[1]);
        return side === 1
          ? [c[0] * lift[0], c[1] * lift[1], c[2] * lift[2]]
          : c;
      }
      return shade(front(p), p.normal);
    },
  });
  return {
    name: side === 1 ? "EarLeft" : "EarRight",
    translation: metres([side * HEAD.halfWidth, -EAR.centre, 0]),
    mesh,
  };
}

const STALK_LIT = hex("EC6B3E");
const STALK_DIM = hex("C9512B");
const TIP_SIDE = hex("CF4E26");
const TIP_TOP = mix(hex("FF8350"), hex("FF9A66"), 0xd9 / 255);

function antenna(side: Side): PipNode {
  const spec = side === 1 ? ANTENNAS.big : ANTENNAS.small;
  // Stalks (pip.rml:642, :674): square posts from the base hidden in the head up into the tip.
  const stalk = side === 1 ? { half: 8, top: 49 } : { half: 7, top: 60 };
  // Tips (pip.rml:637-638, :669-670): their height, centre and corner radius; width and depth from turn.ts.
  const tip =
    side === 1 ? { hh: 41, y: 86, c: 7, b: 7 } : { hh: 28, y: 84, c: 5, b: 5 };
  const mesh = new MeshBuilder();
  addSolid(
    mesh,
    bop({ hw: stalk.half, hd: stalk.half, c: 0, hh: stalk.top / 2, b: 0 }),
    {
      place: at([0, stalk.top / 2, 0]),
      paint: (p) => {
        if (p.kind === "wall" && p.normal[2] > 0.9)
          return p.local[0] > 0 ? STALK_LIT : STALK_DIM;
        if (p.kind === "wall" && p.normal[0] > 0.9) return STALK_LIT;
        return STALK_DIM;
      },
    },
  );
  const tipFront: Stops = [
    [tip.hh, hex("FF8350")],
    [-tip.hh, hex("E25A2C")],
  ];
  const lit: Rgb = (() => {
    const r = litOverShaded();
    return [TIP_SIDE[0] * r[0], TIP_SIDE[1] * r[1], TIP_SIDE[2] * r[2]];
  })();
  addSolid(
    mesh,
    bop({
      hw: spec.width / 2,
      hd: spec.depth / 2,
      c: tip.c,
      hh: tip.hh,
      b: tip.b,
    }),
    {
      place: at([0, tip.y, 0]),
      paint: (p) => {
        if (p.kind === "top bevel" || p.kind === "top") return TIP_TOP;
        if (p.kind === "bottom bevel" || p.kind === "bottom")
          return shade(hex("E25A2C"), p.normal);
        const [nx, , nz] = p.normal;
        const front = gradient(tipFront, p.local[1]);
        const sideColour = nx > 0 ? lit : TIP_SIDE;
        if (nz > 0.9) return front;
        if (Math.abs(nx) > 0.9 || nz < -0.9)
          return nz < -0.9 ? TIP_SIDE : sideColour;
        // A chamfer: the mean of its two neighbours.
        return mix(nz > 0 ? front : TIP_SIDE, sideColour, 0.5);
      },
    },
  );
  return {
    name: side === 1 ? "AntennaLeft" : "AntennaRight",
    translation: metres([spec.u, -ANTENNA_BASE_V, ANTENNA_Z]),
    mesh,
  };
}

function head(): PipNode {
  const mesh = new MeshBuilder();
  addSolid(
    mesh,
    bop({
      hw: HEAD.halfWidth,
      hd: HEAD.halfDepth,
      c: HEAD.chamfer,
      hh: HEAD.halfHeight,
      b: HEAD.bevel,
    }),
    { paint: paintHead },
  );
  return {
    name: "Head",
    translation: metres([0, HEAD_CENTRE_Y - NECK_Y, 0]),
    mesh,
    children: [
      {
        name: "Face",
        translation: metres([0, -FACE_V, HEAD.halfDepth]),
        children: [
          {
            name: "GlanceEyes",
            children: [
              {
                name: "Eyes",
                children: [eye(1), eye(-1), catchlight(1), catchlight(-1)],
              },
            ],
          },
          mouth(),
          glow(),
          cheek(1),
          cheek(-1),
        ],
      },
      ear(1),
      ear(-1),
      antenna(1),
      antenna(-1),
    ],
  };
}

// ---------------------------------------------------------------------------
// The body (pip.rml:1064-1180, and turn.ts's TORSO).

/** The neck's shadow on the torso (pip.rml:1065-1071): 6A2414 at 0x8C, full down to model y 163 and gone by 145. */
function neckShadow(colour: Rgb, y: number): Rgb {
  const full = 163 - 149;
  const gone = 145 - 149;
  const a = (0x8c / 255) * Math.max(0, Math.min(1, (y - gone) / (full - gone)));
  return mix(colour, hex("6A2414"), a);
}

function torso(): MeshBuilder {
  const hh = 71;
  const two = (a: string, b: string): Stops => [
    [hh, hex(a)],
    [-hh, hex(b)],
  ];
  const FRONT: Stops = [
    [hh, hex("E66C3D")],
    [hh - 0.7 * 2 * hh, hex("EB7342")],
    [-hh, hex("C9562F")],
  ];
  const wallStops = (n: Vec3): Stops => {
    if (n[2] > 0.9) return FRONT;
    if (n[2] > 0.1 && n[0] > 0.1) return two("F0844E", "D8603A");
    if (n[2] > 0.1 && n[0] < -0.1) return two("D45A30", "B84A28");
    if (Math.abs(n[2]) < 0.1 && n[0] > 0.9) return two("D8643A", "B44A28");
    if (Math.abs(n[2]) < 0.1 && n[0] < -0.9) return two("C24E2A", "A03E22");
    return [];
  };
  const mesh = new MeshBuilder();
  addSolid(
    mesh,
    bop({
      hw: TORSO.halfWidth,
      hd: TORSO.halfDepth,
      c: TORSO.chamfer,
      hh,
      b: 13,
      rows: [163 - 149, 145 - 149, hh - 0.7 * 2 * hh],
    }),
    {
      place: at([0, 149, 0]),
      paint: (p) => {
        const y = p.local[1];
        const own = p.kind === "wall" ? wallStops(p.normal) : [];
        if (own.length > 0) return neckShadow(gradient(own, y), y);
        return shade(neckShadow(gradient(FRONT, y), y), p.normal);
      },
    },
  );
  return mesh;
}

/** A block shaded all round from its front gradient (legs, feet, fists, arms). */
const lit =
  (stops: Stops, axis: 0 | 1 = 1): Paint =>
  (p) =>
    shade(gradient(stops, p.local[axis]), p.normal);

/**
 * The legs' tone against the art's stops: the board's legs read D15E33 on
 * the front, a step below the art's E06838, so the band between the torso
 * and the feet recedes as it does on the posters. Every stop, and so every
 * face shaded from them, takes the same ratio.
 */
const LEG_TONE: Rgb = [209 / 224, 94 / 104, 51 / 56];
const toned = (c: Rgb): Rgb => [
  c[0] * LEG_TONE[0],
  c[1] * LEG_TONE[1],
  c[2] * LEG_TONE[2],
];

function leg(side: Side): PipNode {
  const mesh = new MeshBuilder();
  const stops: Stops = [
    [27, toned(hex("B24A2A"))],
    [27 - 0.45 * 54, toned(hex("E06838"))],
    [-27, toned(hex("C4532E"))],
  ];
  addSolid(
    mesh,
    bop({ hw: 40, hd: 32, c: 6, hh: 27, b: 6, rows: [27 - 0.45 * 54] }),
    { paint: lit(stops) },
  );
  return {
    name: side === 1 ? "LegLeft" : "LegRight",
    translation: metres([side * 76, 62, 0]),
    mesh,
  };
}

function foot(side: Side): PipNode {
  const mesh = new MeshBuilder();
  // Over art y 718 to 766, model y 50 to 2 above the sole; the block is centred 26 up.
  const stops: Stops = [
    [50 - 26, hex("B4482F")],
    [50 - 0.22 * 48 - 26, hex("9A3826")],
    [2 - 26, hex("6A2417")],
  ];
  addSolid(
    mesh,
    bop({ hw: 52, hd: 60, c: 8, hh: 26, b: 8, rows: [50 - 0.22 * 48 - 26] }),
    {
      place: at([0, 26, 0]),
      paint: lit(stops),
    },
  );
  return {
    name: side === 1 ? "FootLeft" : "FootRight",
    translation: metres([side * 78, 0, 10]),
    mesh,
  };
}

/** The upper arm's slope from the shoulder: art direction (0.8, -0.6) in model space. */
const ARM_SLOPE = Math.atan2(-0.6, 0.8);

function upperArm(side: Side): PipNode {
  const mesh = new MeshBuilder();
  // Along the arm from t -6 (inside the shoulder) to 88.6, 48 square (pip.rml:122-133).
  const centre = 41.3;
  const stops: Stops = [
    [-6 - centre, hex("5C2319")],
    [-6 + 0.45 * 94.6 - centre, hex("A83C1C")],
    [88.6 - centre, hex("E0582E")],
  ];
  const turn = turnZ(side * ARM_SLOPE);
  addSolid(
    mesh,
    bop({
      hw: 24,
      hd: 24,
      c: 11,
      hh: 47.3,
      b: 11,
      rows: [-6 + 0.45 * 94.6 - centre],
    }),
    {
      place: at(
        [side * centre, 0, 0],
        side === 1 ? ALONG_X : turnZ(Math.PI / 2),
      ),
      toModel: turn,
      paint: lit(stops),
    },
  );
  return {
    name: side === 1 ? "UpperArmLeft" : "UpperArmRight",
    rotation: quatZ(side * ARM_SLOPE),
    mesh,
  };
}

/** The fists' size over the art's: the posters' mitts read a little larger than 66 by 62 beside the 3D head. */
const FIST_SCALE = 1.08;

function fist(side: Side): MeshBuilder {
  const mesh = new MeshBuilder();
  const k = FIST_SCALE;
  const stops: Stops = [
    [31 * k, hex("F7743F")],
    [(31 - 0.35 * 62) * k, hex("E85E32")],
    [-31 * k, hex("C94A28")],
  ];
  // Every edge rounded in two segments (radius 13, as the art's 22 corner
  // reads at Pip's size), so the mitt reads soft rather than cut.
  addSolid(
    mesh,
    roundedBlock({
      hw: 33 * k,
      hd: 30 * k,
      hh: 31 * k,
      r: 13 * k,
      rows: [(31 - 0.35 * 62) * k],
    }),
    {
      place: at([0, 0, 0], turnZ(-side * 0.4)),
      paint: lit(stops),
    },
  );
  addSolid(mesh, bop({ hw: 11 * k, hd: 12 * k, c: 6, hh: 15 * k, b: 6 }), {
    place: at([-side * 24 * k, 30 * k, 0], turnZ(-side * 0.55)),
    paint: (p) => shade(hex("EE6536"), p.normal),
  });
  return mesh;
}

/** Explaining's pointer stick (pip.rml:106-117), laid along +x as the clip aims it; hidden at rest. */
function pointer(): PipNode {
  // Lit as he holds it at Explaining's hold: the arm raised 28 degrees and the stick turned -15 under it.
  const held = turnZ(((28 - 15) * Math.PI) / 180);
  const stick = new MeshBuilder();
  const front: Stops = [
    [16, hex("D9803E")],
    [-16, hex("A8521F")],
  ];
  const stroke = hex("7A3415");
  addSolid(stick, bop({ hw: 16, hd: 10, c: 5, hh: 42, b: 7 }), {
    place: at([50, 0, 0], ALONG_X),
    toModel: held,
    // Canonical x runs along -y once laid along x.
    paint: (p) =>
      p.kind === "wall" && p.normal[2] > 0.9
        ? gradient(front, -p.local[0])
        : stroke,
  });
  addSolid(stick, bop({ hw: 17, hd: 17, c: 6, hh: 17, b: 6 }), {
    place: at([96, 0, 0]),
    toModel: held,
    paint: (p) =>
      p.kind === "wall" && p.normal[2] > 0.9 ? hex("FFD23F") : hex("E89A1C"),
  });
  const sparks = new MeshBuilder();
  for (const [x, y, r] of [
    [20, -32, 0.75],
    [20, 0, 0],
    [10, 36, -0.75],
  ] as const)
    addSolid(sparks, slab(42, 20, 10, 8), {
      place: { m: multiply(turnZ(r), ALONG_Z), t: [x, y, 0] },
      toModel: held,
      paint: (p) => shade(hex("F26A1F"), p.normal),
    });
  return {
    name: "Pointer",
    rotation: quatZ((-23.6 * Math.PI) / 180),
    scale: HIDDEN,
    children: [
      {
        name: "PointerReach",
        mesh: stick,
        children: [
          {
            name: "PointerSparks",
            translation: metres([128, 0, 0]),
            rotation: quatZ(-0.3),
            mesh: sparks,
          },
        ],
      },
    ],
  };
}

/** A flat rounded rectangle facing +z (w by h, corner radius r, depth d): built along y, laid along z by its place. */
function slab(w: number, h: number, r: number, d: number): Face[] {
  const c = r >= 6 ? Math.round(0.6 * r) : 0;
  return bop({ hw: w / 2, hd: h / 2, c, hh: d / 2, b: 0 });
}

function arm(side: Side): PipNode {
  const hand: PipNode = {
    name: side === 1 ? "HandLeft" : "HandRight",
    translation: metres([side * 80, -60, 0]),
    mesh: fist(side),
  };
  if (side === 1) hand.children = [pointer()];
  return {
    name: side === 1 ? "ArmLeft" : "ArmRight",
    translation: metres([side * 110, 178, 0]),
    children: [upperArm(side), hand],
  };
}

// ---------------------------------------------------------------------------
// The effects round him (pip.rml:1184-1257): flat pieces behind him, outside
// Hop, hidden at rest; only the Reactions and modes that show them do.

interface Piece {
  /** Centre, size and corner radius in the piece's own model frame (y up), and its turn. */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  turn?: number;
}
const ORANGE = "FF8A4C";
const AMBER = "FFB35C";
const GOLD = "FFD07A";

/** Pieces drawn in a group that un-mirrors the rig's root: model y is minus art y, turns negate. */
const unmirrored = (pieces: readonly Piece[]): Piece[] =>
  pieces.map((p) => ({
    ...p,
    y: -p.y,
    ...(p.turn === undefined ? {} : { turn: -p.turn }),
  }));
/** Pieces drawn under the mirrored root itself (the confetti): a half turn, so x and y negate. */
const halfTurned = (pieces: readonly Piece[]): Piece[] =>
  pieces.map((p) => ({ ...p, x: -p.x, y: -p.y }));
const sq = (x: number, y: number, s: number, r: number): Piece => ({
  x,
  y,
  w: s,
  h: s,
  r,
});
const plus = (s: number, t: number, r: number): Piece[] => [
  { x: 0, y: 0, w: s, h: t, r },
  { x: 0, y: 0, w: t, h: s, r },
];

const EFFECTS: readonly { name: string; colour: string; pieces: Piece[] }[] = [
  ...[1, 2, 3].map((i) => ({
    name: `Dot${String(i)}`,
    colour: ORANGE,
    pieces: [sq(0, 0, 29.5, 6.8)],
  })),
  {
    name: "ZSmall",
    colour: ORANGE,
    pieces: unmirrored([
      { x: 0, y: -16, w: 43.2, h: 11.2, r: 2.8 },
      { x: 0, y: 16, w: 43.2, h: 11.2, r: 2.8 },
      { x: 0, y: 0, w: 43.7, h: 11.2, r: 2.8, turn: -0.575 },
    ]),
  },
  {
    name: "ZBig",
    colour: ORANGE,
    pieces: unmirrored([
      { x: 0, y: -24.4, w: 65.9, h: 17.1, r: 4.3 },
      { x: 0, y: 24.4, w: 65.9, h: 17.1, r: 4.3 },
      { x: 0, y: 0, w: 66.7, h: 17.1, r: 4.3, turn: -0.575 },
    ]),
  },
  {
    name: "QuestionPop",
    colour: ORANGE,
    pieces: unmirrored([
      { x: 0, y: -42, w: 42, h: 14, r: 3 },
      sq(-28, -28, 14, 3),
      { x: 28, y: -21, w: 14, h: 28, r: 3 },
      { x: 7, y: 0, w: 28, h: 14, r: 3 },
      sq(0, 14, 14, 3),
      sq(0, 42, 14, 3),
    ]),
  },
  { name: "Cross1", colour: ORANGE, pieces: plus(36, 12, 2) },
  { name: "Cross2", colour: ORANGE, pieces: plus(30, 10, 2) },
  { name: "Cross3", colour: ORANGE, pieces: plus(45, 15, 2) },
  {
    name: "StrokeLeft",
    colour: ORANGE,
    pieces: unmirrored([
      { x: -29.5, y: -34.1, w: 50, h: 18.2, r: 9.1, turn: 0.85 },
      { x: -38.6, y: 13.6, w: 38.6, h: 17, r: 8.5, turn: 0.12 },
    ]),
  },
  {
    name: "StrokeRight",
    colour: ORANGE,
    pieces: unmirrored([
      { x: 29.5, y: -34.1, w: 50, h: 18.2, r: 9.1, turn: -0.85 },
      { x: 38.6, y: 13.6, w: 34.1, h: 15.9, r: 8, turn: -0.2 },
    ]),
  },
  ...[
    [1, ORANGE, 44.4, 14.8, 2.5, 34.0, -23.7, 13.3],
    [2, AMBER, 30.6, 10.2, 1.7, 23.5, -16.3, 9.2],
    [3, ORANGE, 44.4, 14.8, 2.5, 34.0, -23.7, 13.3],
    [4, AMBER, 30.6, 10.2, 1.7, 23.5, -16.3, 9.2],
  ].map(([i, colour, s, t, r, x, y, d]) => ({
    name: `Cheer${String(i)}`,
    colour: String(colour),
    pieces: unmirrored([
      ...plus(Number(s), Number(t), Number(r)),
      sq(Number(x), Number(y), Number(d), Number(r)),
    ]),
  })),
  ...(
    [
      [ORANGE, [25, 3.8], [15.5, -12.5, 15.5, 3], [-13.8, 15.5, 10.5, 2.5]],
      [AMBER, [20.5, 3.1], [12.7, -10.2, 12.7, 2.5]],
      [GOLD, [18.2, 2.7], [11.3, -9.1, 11.3, 2.2], [-10.0, 11.3, 7.6, 1.8]],
      [ORANGE, [22.7, 3.4], [14.1, -11.3, 14.1, 2.7]],
      [GOLD, [18.2, 2.7], [11.3, -9.1, 11.3, 2.2], [-10.0, 11.3, 7.6, 1.8]],
      [ORANGE, [22.7, 3.4], [14.1, -11.3, 14.1, 2.7]],
      [AMBER, [20.5, 3.1], [12.7, -10.2, 12.7, 2.5], [-11.3, 12.7, 8.6, 2.1]],
      [GOLD, [18.2, 2.7], [11.3, -9.1, 11.3, 2.2]],
      [AMBER, [22.7, 3.4], [14.1, -11.3, 14.1, 2.7], [-12.5, 14.1, 9.5, 2.3]],
    ] as const
  ).map(([colour, main, ...rest], i) => ({
    name: `Confetti${String(i + 1)}`,
    colour,
    pieces: halfTurned([
      sq(0, 0, main[0], main[1]),
      ...rest.map(([x, y, s, r]) => sq(x, y, s, r)),
    ]),
  })),
];

function effects(rest: (name: string) => Vec2): PipNode {
  const DEPTH = 10;
  return {
    name: "Effects",
    // Behind him, inside the back of his head, so their resting places stay inside his bounds.
    translation: [0, 0, -0.25],
    children: EFFECTS.map(({ name, colour, pieces }) => {
      const mesh = new MeshBuilder();
      pieces.forEach((p, k) => {
        // Each piece a little deeper than the one before, so overlapping pieces never share a plane.
        // The face in its colour, its thin edge one shade darker all round.
        const edge = shade(hex(colour), [0.6, 0, 0.8]);
        addSolid(mesh, slab(p.w, p.h, p.r, DEPTH + 0.6 * k), {
          place: { m: multiply(turnZ(p.turn ?? 0), ALONG_Z), t: [p.x, p.y, 0] },
          paint: (q) =>
            Math.abs(q.normal[2]) > 0.9 ? shade(hex(colour), q.normal) : edge,
        });
      });
      const [x, y] = rest(name);
      return { name, translation: [x, y, 0], scale: HIDDEN, mesh };
    }),
  };
}

/** The whole of Pip at rest; `effectRest` gives each effect's resting place (metres, Effects' frame). */
export function pipParts(effectRest: (name: string) => Vec2): PipNode {
  return {
    name: "Pip",
    children: [
      effects(effectRest),
      {
        name: "Hop",
        children: [
          {
            name: "Lean",
            children: [
              {
                name: "Body",
                mesh: torso(),
                children: [
                  leg(1),
                  leg(-1),
                  foot(1),
                  foot(-1),
                  arm(1),
                  arm(-1),
                  {
                    name: "Neck",
                    translation: metres([0, NECK_Y, 0]),
                    children: [
                      {
                        name: "gaze",
                        children: [{ name: "HeadPose", children: [head()] }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Every node, by name. */
export function nodesByName(root: PipNode): Map<string, PipNode> {
  const out = new Map<string, PipNode>();
  const walk = (n: PipNode) => {
    out.set(n.name, n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return out;
}
