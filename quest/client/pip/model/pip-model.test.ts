// @vitest-environment node
// The 3D Pip's generated model (seam S13): the committed pip.glb is exactly
// what pip-model.ts writes (`npm run pip:model` rewrites it), it meets the
// model contract through the loader the renderer uses, and it is built
// from the approved board: the head is turn.ts's box model to the unit and
// its walls take the colours turn.ts writes into the rig, and every part
// but the face's flat decals is a closed solid wound outward. model.test.ts
// measures the loaded model: one metre tall on his soles.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parsePipModel } from "../../src/scene/renderer/pip/load.ts";
import { HEAD, headFaces } from "../turn.ts";
import { PIP_MODEL_CLIPS, PIP_MODEL_EXTENSIONS } from "./contract.ts";
import { unpackGlb } from "./glb.ts";
import { bandStops, type Vec3 } from "./palette.ts";
import { cross, dot, sub } from "./geometry.ts";
import { nodesByName, type PipNode } from "./parts.ts";
import { CLIP_ORDER, PIP_MODEL_FILE, pipModel, pipTree } from "./pip-model.ts";

const committed = () =>
  new Uint8Array(readFileSync(join(import.meta.dirname, PIP_MODEL_FILE)));
const buffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

interface Gltf {
  asset: { generator?: string; extras?: Record<string, unknown> };
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  materials: { extensions?: Record<string, unknown> }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
}

describe("the committed model", () => {
  test("is exactly what pip-model.ts writes", () => {
    expect(
      Buffer.from(committed()).equals(Buffer.from(pipModel())),
      "run npm run pip:model",
    ).toBe(true);
  });

  test("holds the contract's clips in its order, and names the script that writes it", () => {
    expect([...CLIP_ORDER]).toEqual([...PIP_MODEL_CLIPS]);
    const json = unpackGlb(committed()).json as Gltf;
    expect(json.asset.generator).toContain(
      "quest/client/pip/model/pip-model.ts",
    );
    expect(json.asset.extras?.["standIn"]).toBeUndefined();
  });

  test("is one unlit material over baked vertex colours, needing no decoder", () => {
    const json = unpackGlb(committed()).json as Gltf;
    expect(json.materials).toHaveLength(1);
    expect(json.materials[0]?.extensions).toHaveProperty("KHR_materials_unlit");
    for (const mesh of json.meshes)
      for (const p of mesh.primitives)
        expect(Object.keys(p.attributes).sort()).toEqual([
          "COLOR_0",
          "POSITION",
        ]);
    const allowed: readonly string[] = PIP_MODEL_EXTENSIONS;
    for (const e of [
      ...(json.extensionsUsed ?? []),
      ...(json.extensionsRequired ?? []),
    ])
      expect(allowed).toContain(e);
  });

  test("meets the model contract through the renderer's loader", async () => {
    const model = await parsePipModel(buffer(committed()));
    expect(model.clips.map((c) => c.name)).toEqual([...PIP_MODEL_CLIPS]);
    expect(model.scene.getObjectByName("gaze")).toBeDefined();
  });
});

describe("every solid part", () => {
  /** Every mesh by its node, and whether it is one of the Face's flat decals (eyes, mouths, glow, cheeks). */
  const meshes: { name: string; decal: boolean; node: PipNode }[] = [];
  const walk = (n: PipNode, decal: boolean) => {
    if (n.mesh !== undefined) meshes.push({ name: n.name, decal, node: n });
    for (const c of n.children ?? []) walk(c, decal || n.name === "Face");
  };
  walk(pipTree(), false);

  test("is closed, with no zero-area triangle, and wound outward (a positive volume)", () => {
    const solids = meshes.filter((m) => !m.decal);
    expect(solids.length).toBeGreaterThan(30);
    for (const { name, node } of solids) {
      const mesh = node.mesh;
      if (mesh === undefined) continue;
      const key = (p: Vec3) => p.map((v) => v.toFixed(3)).join(",");
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = [0, 1, 2].map(
          (k): Vec3 => mesh.positions[mesh.indices[i + k] ?? 0] ?? [0, 0, 0],
        );
        if (a === undefined || b === undefined || c === undefined)
          throw new Error("a short triangle");
        const area = Math.hypot(...cross(sub(b, a), sub(c, a)));
        expect(area, `${name}: a zero-area triangle`).toBeGreaterThan(1e-6);
        volume += dot(a, cross(b, c)) / 6;
        for (const [p, q] of [
          [a, b],
          [b, c],
          [c, a],
        ] as const) {
          const edge = `${key(p)}>${key(q)}`;
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      // Closed and consistently wound: each edge once each way.
      const open = [...edges].filter(([edge, n]) => {
        const [p = "", q = ""] = edge.split(">");
        return n !== 1 || edges.get(`${q}>${p}`) !== 1;
      });
      expect(open.length, `${name}: open or doubled edges`).toBe(0);
      expect(volume, `${name}: wound inward`).toBeGreaterThan(0);
    }
  });
});

describe("the head, from turn.ts's box model", () => {
  const head = nodesByName(pipTree()).get("Head")?.mesh;

  test("has every corner of turn.ts's head faces, and spans its box", () => {
    if (head === undefined) throw new Error("no head mesh");
    const key = (p: Vec3) => p.map((v) => v.toFixed(3)).join(",");
    const corners = new Set(head.positions.map(key));
    for (const face of headFaces())
      for (const [u, v, z] of face.points)
        expect(
          corners.has(key([u, -v, z])),
          `${face.name} ${key([u, -v, z])}`,
        ).toBe(true);
    const size = [0, 1, 2].map((k) => {
      const along = head.positions.map((p) => p[k] ?? 0);
      return Math.max(...along) - Math.min(...along);
    });
    expect(size).toEqual([
      2 * HEAD.halfWidth,
      2 * HEAD.halfHeight,
      2 * HEAD.halfDepth,
    ]);
  });

  test("is wound outward on every face", () => {
    if (head === undefined) throw new Error("no head mesh");
    for (let i = 0; i < head.indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map(
        (k): Vec3 => head.positions[head.indices[i + k] ?? 0] ?? [0, 0, 0],
      );
      if (a === undefined || b === undefined || c === undefined)
        throw new Error("a short triangle");
      const normal = cross(sub(b, a), sub(c, a));
      // The head is centred on its node, so outward is away from the origin.
      const centre: Vec3 = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3,
      ];
      expect(dot(normal, centre)).toBeGreaterThan(0);
    }
  });

  test("takes the wall colours turn.ts writes into the rig, its key on Pip's left", () => {
    const rml = readFileSync(
      join(import.meta.dirname, "..", "rig", "pip.rml"),
      "utf8",
    );
    const stops = (name: string) => {
      const m = new RegExp(
        `name="${name}"[\\s\\S]*?colorValue="FF(\\w{6})"[\\s\\S]*?colorValue="FF(\\w{6})"`,
      ).exec(rml);
      return [m?.[1], m?.[2]];
    };
    const hex = (c: readonly number[]) =>
      c
        .map((v) => Math.round(v).toString(16).toUpperCase().padStart(2, "0"))
        .join("");
    const D = Math.SQRT1_2;
    // The board lights from the screen's left; the 3D Pip from his left (+x), so each wall takes its mirror's colours.
    const walls: [string, number, number, boolean][] = [
      ["Face Front", 0, 1, false],
      ["Face Front Left", D, D, true],
      ["Face Front Right", -D, D, true],
      ["Face Left", 1, 0, false],
      ["Face Right", -1, 0, false],
    ];
    for (const [mirror, nx, nz, chamfer] of walls)
      expect(bandStops(nx, nz, chamfer).map(hex), mirror).toEqual(
        stops(mirror),
      );
  });
});
