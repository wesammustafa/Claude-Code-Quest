// The 3D Pip's stand-in model (seam S13): a boxy Pip built from 17 boxes in
// code, with every clip the model contract names, until the owner's artist
// delivers the modelled and rigged Pip. It is no artwork: it shows the
// renderer and the contract working, and it is replaced, file for file, by
// the delivered model. `npm run pip:stand-in` writes pip-stand-in.glb beside
// this file; stand-in.test.ts fails when the committed file is not exactly
// what this writes.
//
// The look follows the brief: soft low-poly with its lighting baked into
// vertex colours (KHR_materials_unlit), so the Scene's lights never light
// him twice, in Pip's own oranges from the posters.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { packGlb } from "./glb.ts";

// The model contract's names (contract.ts), as the contract test holds them:
// written here so this script runs in Node on its own.
const PIP_MODEL_GAZE = "gaze";
const PIP_MODEL_STILL = "still";

/** The committed stand-in, beside this file. */
export const STAND_IN_FILE = "pip-stand-in.glb";

type Vec3 = readonly [number, number, number];
type Quat = readonly [number, number, number, number];

/** Pip's colours, as sRGB hex from the posters. */
const COLOURS = {
  head: "#f3955e",
  body: "#ee8550",
  limb: "#e2602f",
  antenna: "#ee7a45",
  feet: "#8e3b22",
  dark: "#1d1416",
} as const;
type Colour = keyof typeof COLOURS;
const COLOUR_NAMES = Object.keys(COLOURS) as Colour[];

/** The light baked into each face of a box, by its normal: lit from above and in front. */
const FACES: readonly { normal: Vec3; shade: number }[] = [
  { normal: [1, 0, 0], shade: 0.8 },
  { normal: [-1, 0, 0], shade: 0.76 },
  { normal: [0, 1, 0], shade: 1 },
  { normal: [0, -1, 0], shade: 0.55 },
  { normal: [0, 0, 1], shade: 0.92 },
  { normal: [0, 0, -1], shade: 0.7 },
];

/** An sRGB channel, 0 to 1, in the linear space glTF colours are in. */
const linear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

function rgb(hex: string): Vec3 {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
    (v) => v / 255,
  ) as unknown as Vec3;
}

/** A unit box centred on the origin: 4 corners per face, so each face keeps its own normal and shade. */
function box(): { positions: number[]; normals: number[]; indices: number[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const { normal } of FACES) {
    const [nx, ny, nz] = normal;
    // Two axes across the face, chosen so the corners wind counter-clockwise seen from outside.
    const u: Vec3 = nx !== 0 ? [0, 0, -nx] : ny !== 0 ? [1, 0, 0] : [nz, 0, 0];
    const v: Vec3 = nx !== 0 ? [0, 1, 0] : ny !== 0 ? [0, 0, -ny] : [0, 1, 0];
    const base = positions.length / 3;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      positions.push(
        (nx + a * u[0] + b * v[0]) / 2,
        (ny + a * u[1] + b * v[1]) / 2,
        (nz + a * u[2] + b * v[2]) / 2,
      );
      normals.push(nx, ny, nz);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

/** A box's vertex colours in one colour, each face at its baked shade. */
function shaded(colour: Colour): number[] {
  const [r, g, b] = rgb(COLOURS[colour]);
  return FACES.flatMap(({ shade }) =>
    Array.from({ length: 4 }, () => [
      linear(r * shade),
      linear(g * shade),
      linear(b * shade),
    ]).flat(),
  );
}

/** A part: a pivot, a box, or both, with its children. */
interface Part {
  name: string;
  at?: Vec3;
  /** The box's colour and size, drawn at the part's origin. */
  box?: { colour: Colour; size: Vec3 };
  children?: Part[];
}

const mirror = ([x, y, z]: Vec3): Vec3 => [-x, y, z];

function arm(side: "l" | "r"): Part {
  const at: Vec3 = [0.19, 0.3, 0];
  return {
    name: `arm_${side}`,
    at: side === "r" ? at : mirror(at),
    children: [
      {
        name: `arm_${side}_box`,
        at: [0, -0.08, 0.01],
        box: { colour: "limb", size: [0.09, 0.17, 0.1] },
      },
    ],
  };
}

function antenna(side: "l" | "r", tip: number): Part {
  const at: Vec3 = [0.13, 0.25, 0];
  return {
    name: `antenna_${side}`,
    at: side === "r" ? at : mirror(at),
    children: [
      {
        name: `antenna_${side}_stalk`,
        at: [0, 0.05, 0],
        box: { colour: "antenna", size: [0.025, 0.1, 0.025] },
      },
      {
        name: `antenna_${side}_tip`,
        at: [0, 0.1 + tip / 2, 0],
        box: { colour: "antenna", size: [tip, tip * 0.85, tip * 0.85] },
      },
    ],
  };
}

/**
 * Pip, about one unit tall, his feet on y = 0 and facing +z. The gaze node
 * is his neck; `head` under it is what the clips tilt.
 */
const PIP: Part = {
  name: "Pip",
  children: [
    {
      name: "body",
      children: [
        {
          name: "torso",
          at: [0, 0.2, 0],
          box: { colour: "body", size: [0.3, 0.26, 0.22] },
        },
        {
          name: "foot_l",
          at: [-0.1, 0.035, 0.02],
          box: { colour: "feet", size: [0.13, 0.07, 0.16] },
        },
        {
          name: "foot_r",
          at: [0.1, 0.035, 0.02],
          box: { colour: "feet", size: [0.13, 0.07, 0.16] },
        },
        arm("l"),
        arm("r"),
        {
          name: PIP_MODEL_GAZE,
          at: [0, 0.34, 0],
          children: [
            {
              name: "head",
              at: [0, 0.29, 0],
              children: [
                {
                  name: "head_box",
                  box: { colour: "head", size: [0.62, 0.5, 0.5] },
                },
                {
                  name: "eye_l",
                  at: [-0.1, 0.02, 0.252],
                  box: { colour: "dark", size: [0.07, 0.15, 0.02] },
                },
                {
                  name: "eye_r",
                  at: [0.1, 0.02, 0.252],
                  box: { colour: "dark", size: [0.07, 0.15, 0.02] },
                },
                {
                  name: "mouth",
                  at: [0, -0.1, 0.252],
                  box: { colour: "dark", size: [0.08, 0.022, 0.02] },
                },
                {
                  name: "ear_l",
                  at: [-0.355, -0.03, 0],
                  box: { colour: "limb", size: [0.09, 0.26, 0.24] },
                },
                {
                  name: "ear_r",
                  at: [0.355, -0.03, 0],
                  box: { colour: "limb", size: [0.09, 0.26, 0.24] },
                },
                antenna("l", 0.08),
                antenna("r", 0.11),
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** A turn about one axis, as a glTF quaternion (x, y, z, w). */
function turn(axis: "x" | "y" | "z", angle: number): Quat {
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  const round = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
  return [
    round(axis === "x" ? s : 0),
    round(axis === "y" ? s : 0),
    round(axis === "z" ? s : 0),
    round(c),
  ];
}

/** One keyed property: a node's translation, rotation or scale over time. */
interface Track {
  node: string;
  path: "translation" | "rotation" | "scale";
  keys: readonly (readonly [number, Vec3 | Quat])[];
}

const rest = (name: string): Vec3 => {
  const find = (part: Part): Vec3 | undefined =>
    part.name === name
      ? (part.at ?? [0, 0, 0])
      : (part.children ?? []).map(find).find((at) => at !== undefined);
  const at = find(PIP);
  if (at === undefined) throw new Error(`no part ${name}`);
  return at;
};
const lift = (name: string, dy: number, dz = 0): Vec3 => {
  const [x, y, z] = rest(name);
  return [x, y + dy, z + dz];
};
/** Turns about one axis at each time. */
const turns = (
  node: string,
  axis: "x" | "y" | "z",
  keys: readonly (readonly [number, number])[],
): Track => ({
  node,
  path: "rotation",
  keys: keys.map(([t, a]) => [t, turn(axis, a)] as const),
});
/** The body raised (or lowered) at each time. */
const bob = (keys: readonly (readonly [number, number])[]): Track => ({
  node: "body",
  path: "translation",
  keys: keys.map(([t, dy]) => [t, lift("body", dy)] as const),
});
/** Both arms turned out by the same angle at each time. */
const arms = (keys: readonly (readonly [number, number])[]): Track[] => [
  turns("arm_r", "z", keys),
  turns(
    "arm_l",
    "z",
    keys.map(([t, a]) => [t, -a] as const),
  ),
];
const eyesShut = (keys: readonly (readonly [number, number])[]): Track[] =>
  ["eye_l", "eye_r"].map((node) => ({
    node,
    path: "scale",
    keys: keys.map(([t, y]) => [t, [1, y, 1]] as const),
  }));

/**
 * The clips. A mode loops and starts on its own pose, which the phone tier
 * holds; a Reaction plays once and ends where it started; the still pose is
 * one key. Nothing keys the gaze node's turn.
 */
const CLIPS: Readonly<Record<string, readonly Track[]>> = {
  idle: [
    bob([
      [0, 0],
      [1.2, 0.015],
      [2.4, 0],
    ]),
    turns("antenna_l", "z", [
      [0, 0],
      [1.2, 0.08],
      [2.4, 0],
    ]),
    turns("antenna_r", "z", [
      [0, 0],
      [1.2, -0.08],
      [2.4, 0],
    ]),
  ],
  thinking: [
    turns("head", "z", [
      [0, 0.14],
      [0.8, 0.18],
      [1.6, 0.14],
    ]),
    turns("arm_r", "x", [
      [0, -1.3],
      [0.8, -1.4],
      [1.6, -1.3],
    ]),
    turns("antenna_l", "z", [
      [0, 0.12],
      [0.4, -0.12],
      [0.8, 0.12],
      [1.2, -0.12],
      [1.6, 0.12],
    ]),
  ],
  rest: [
    bob([
      [0, -0.03],
      [1.5, -0.022],
      [3, -0.03],
    ]),
    turns("head", "x", [
      [0, 0.12],
      [1.5, 0.1],
      [3, 0.12],
    ]),
  ],
  sleep: [
    bob([
      [0, -0.045],
      [1.5, -0.035],
      [3, -0.045],
    ]),
    turns("head", "x", [
      [0, 0.32],
      [1.5, 0.28],
      [3, 0.32],
    ]),
    ...eyesShut([
      [0, 0.12],
      [3, 0.12],
    ]),
    turns("antenna_r", "z", [
      [0, -0.35],
      [3, -0.35],
    ]),
  ],
  greeting: [
    turns("arm_r", "z", [
      [0, 0],
      [0.25, 2.5],
      [0.45, 2.85],
      [0.65, 2.45],
      [0.85, 2.85],
      [1.2, 0],
    ]),
    bob([
      [0, 0],
      [0.3, 0.03],
      [1.2, 0],
    ]),
  ],
  curious: [
    turns("head", "z", [
      [0, 0],
      [0.3, 0.28],
      [0.9, 0.28],
      [1.2, 0],
    ]),
    {
      node: "body",
      path: "translation",
      keys: [
        [0, lift("body", 0)],
        [0.3, lift("body", 0, 0.05)],
        [0.9, lift("body", 0, 0.05)],
        [1.2, lift("body", 0)],
      ],
    },
  ],
  explaining: [
    turns("arm_l", "z", [
      [0, 0],
      [0.3, -1.45],
      [0.7, -1.1],
      [1.1, -1.45],
      [1.6, 0],
    ]),
    turns("head", "z", [
      [0, 0],
      [0.4, -0.08],
      [1.2, -0.08],
      [1.6, 0],
    ]),
  ],
  success: [
    bob([
      [0, 0],
      [0.35, 0.12],
      [0.7, 0],
      [1, 0],
    ]),
    ...arms([
      [0, 0],
      [0.3, 2.6],
      [0.75, 2.6],
      [1, 0],
    ]),
  ],
  retry: [
    turns("body", "y", [
      [0, 0],
      [0.15, 0.16],
      [0.35, -0.16],
      [0.55, 0.1],
      [0.9, 0],
    ]),
    turns("head", "x", [
      [0, 0],
      [0.3, 0.16],
      [0.9, 0],
    ]),
  ],
  celebration: [
    bob([
      [0, 0],
      [0.35, 0.2],
      [0.7, 0],
      [1, 0.12],
      [1.3, 0],
      [1.6, 0],
    ]),
    turns("body", "y", [
      [0, 0],
      [0.2, Math.PI / 2],
      [0.4, Math.PI],
      [0.6, (3 * Math.PI) / 2],
      [0.8, 2 * Math.PI],
      [1.6, 2 * Math.PI],
    ]),
    ...arms([
      [0, 0],
      [0.25, 2.7],
      [1.3, 2.7],
      [1.6, 0],
    ]),
  ],
  [PIP_MODEL_STILL]: [bob([[0, 0]]), turns("head", "z", [[0, 0]])],
};

/** glTF's component types and targets. */
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** The stand-in model as a binary glTF (.glb), the same bytes every time. */
export function standInModel(): Uint8Array {
  const chunks: Buffer[] = [];
  let length = 0;
  const bufferViews: object[] = [];
  const accessors: object[] = [];

  /** Appends one array as its own buffer view and accessor; returns the accessor's index. */
  const add = (
    values: readonly number[],
    o: {
      type: "SCALAR" | "VEC3" | "VEC4";
      component?: number;
      target?: number;
      bounds?: boolean;
    },
  ): number => {
    const component = o.component ?? FLOAT;
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[o.type];
    const bytes =
      component === FLOAT
        ? Buffer.from(new Float32Array(values).buffer)
        : Buffer.from(new Uint16Array(values).buffer);
    const pad = (4 - (bytes.length % 4)) % 4;
    bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: bytes.length,
      ...(o.target === undefined ? {} : { target: o.target }),
    });
    chunks.push(bytes, Buffer.alloc(pad));
    length += bytes.length + pad;
    const accessor: Record<string, unknown> = {
      bufferView: bufferViews.length - 1,
      componentType: component,
      count: values.length / width,
      type: o.type,
    };
    if (o.bounds === true) {
      const f = (v: number) => Math.fround(v);
      const min = Array.from({ length: width }, () => Infinity);
      const max = Array.from({ length: width }, () => -Infinity);
      values.forEach((v, i) => {
        const at = i % width;
        min[at] = Math.min(min[at] ?? Infinity, f(v));
        max[at] = Math.max(max[at] ?? -Infinity, f(v));
      });
      accessor["min"] = min;
      accessor["max"] = max;
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };

  const shape = box();
  const position = add(shape.positions, {
    type: "VEC3",
    target: ARRAY_BUFFER,
    bounds: true,
  });
  const normal = add(shape.normals, { type: "VEC3", target: ARRAY_BUFFER });
  const indices = add(shape.indices, {
    type: "SCALAR",
    component: UNSIGNED_SHORT,
    target: ELEMENT_ARRAY_BUFFER,
  });
  const meshOf = new Map<Colour, number>();
  const meshes = COLOUR_NAMES.map((colour, i) => {
    meshOf.set(colour, i);
    return {
      name: `box_${colour}`,
      primitives: [
        {
          attributes: {
            POSITION: position,
            NORMAL: normal,
            COLOR_0: add(shaded(colour), {
              type: "VEC3",
              target: ARRAY_BUFFER,
            }),
          },
          indices,
          material: 0,
        },
      ],
    };
  });

  const nodes: Record<string, unknown>[] = [];
  const indexOf = new Map<string, number>();
  const place = (part: Part): number => {
    const node: Record<string, unknown> = { name: part.name };
    const index = nodes.length;
    nodes.push(node);
    indexOf.set(part.name, index);
    if (part.at !== undefined && part.at.some((v) => v !== 0))
      node["translation"] = [...part.at];
    const children: number[] = [];
    if (part.box !== undefined) {
      if (part.children === undefined) {
        node["mesh"] = meshOf.get(part.box.colour);
        node["scale"] = [...part.box.size];
      } else {
        throw new Error(`${part.name}: a box has no children`);
      }
    }
    for (const child of part.children ?? []) children.push(place(child));
    if (children.length > 0) node["children"] = children;
    return index;
  };
  const root = place(PIP);

  const animations = Object.entries(CLIPS).map(([name, tracks]) => {
    const samplers: object[] = [];
    const channels: object[] = [];
    for (const track of tracks) {
      const node = indexOf.get(track.node);
      if (node === undefined) throw new Error(`${name}: no node ${track.node}`);
      samplers.push({
        input: add(
          track.keys.map(([t]) => t),
          { type: "SCALAR", bounds: true },
        ),
        output: add(
          track.keys.flatMap(([, v]) => [...v]),
          { type: track.path === "rotation" ? "VEC4" : "VEC3" },
        ),
        interpolation: "LINEAR",
      });
      channels.push({
        sampler: samplers.length - 1,
        target: { node, path: track.path },
      });
    }
    return { name, samplers, channels };
  });

  const json = {
    asset: {
      version: "2.0",
      generator: "Pip's 3D stand-in, quest/client/pip/model/stand-in.ts",
      extras: {
        standIn: true,
        note: "A stand-in until the delivered model replaces it.",
      },
    },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ name: "Pip", nodes: [root] }],
    nodes,
    meshes,
    materials: [
      {
        name: "baked",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        extensions: { KHR_materials_unlit: {} },
      },
    ],
    animations,
    accessors,
    bufferViews,
    buffers: [{ byteLength: length }],
  };
  return packGlb(json, new Uint8Array(Buffer.concat(chunks)));
}

if (import.meta.main) {
  const file = join(import.meta.dirname, STAND_IN_FILE);
  const bytes = standInModel();
  writeFileSync(file, bytes);
  console.log(`${file}: ${String(bytes.length)} bytes`);
}
