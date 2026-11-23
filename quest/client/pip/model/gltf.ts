// Writing the 3D Pip as binary glTF 2.0 (seam S13): his node tree with its
// meshes (positions in metres, baked colours as COLOR_0 in linear light),
// one unlit material, the eyes' morph targets and the baked clips. Plain
// float32 and uint16 data, no compression, so three's GLTFLoader reads it
// with no decoder.
import type { Clip } from "./clips.ts";
import { packGlb } from "./glb.ts";
import { toLinear, type Vec3 } from "./palette.ts";
import { RIG_UNIT, type PipNode } from "./parts.ts";

const FLOAT = 5126;
const SHORT = 5122;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

type AccessorType = "SCALAR" | "VEC3" | "VEC4";
const WIDTH: Readonly<Record<AccessorType, number>> = {
  SCALAR: 1,
  VEC3: 3,
  VEC4: 4,
};

/**
 * The buffer's views, one for each kind of data: positions and morph
 * offsets (float32, 12 bytes a vertex), colours (normalised uint16, padded
 * to 8 bytes a vertex so each starts on 4 bytes, as glTF asks), indices,
 * and the clips' keys.
 */
type Pool = "vertex" | "colour" | "index" | "key";
const POOLS: readonly Pool[] = ["vertex", "colour", "index", "key"];
const STRIDE: Readonly<Partial<Record<Pool, number>>> = {
  vertex: 12,
  colour: 8,
};
const TARGET: Readonly<Partial<Record<Pool, number>>> = {
  vertex: ARRAY_BUFFER,
  colour: ARRAY_BUFFER,
  index: ELEMENT_ARRAY_BUFFER,
};

/** The glTF's buffer, views and accessors as they are added. */
class Buffers {
  private readonly data = new Map<Pool, Uint8Array[]>(
    POOLS.map((p) => [p, []]),
  );
  private readonly size = new Map<Pool, number>(POOLS.map((p) => [p, 0]));
  private readonly keys = new Map<string, number>();
  readonly accessors: Record<string, unknown>[] = [];

  add(
    values: readonly number[],
    o: { type: AccessorType; pool: Pool; bounds?: boolean; short?: boolean },
  ): number {
    const width = WIDTH[o.type];
    const count = values.length / width;
    let bytes: Uint8Array;
    let component = FLOAT;
    if (o.pool === "colour") {
      component = UNSIGNED_SHORT;
      const padded = new Uint16Array(count * 4);
      for (let i = 0; i < count; i++)
        for (let k = 0; k < 3; k++)
          padded[i * 4 + k] = Math.round(
            Math.max(0, Math.min(1, values[i * 3 + k] ?? 0)) * 65535,
          );
      bytes = new Uint8Array(padded.buffer);
    } else if (o.pool === "index") {
      component = UNSIGNED_SHORT;
      bytes = new Uint8Array(new Uint16Array(values).buffer);
    } else if (o.short === true) {
      component = SHORT;
      bytes = new Uint8Array(
        new Int16Array(
          values.map((v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767)),
        ).buffer,
      );
    } else bytes = new Uint8Array(new Float32Array(values).buffer);
    const at = this.size.get(o.pool) ?? 0;
    const pad = (4 - (bytes.length % 4)) % 4;
    this.data.get(o.pool)?.push(bytes, new Uint8Array(pad));
    this.size.set(o.pool, at + bytes.length + pad);
    const accessor: Record<string, unknown> = {
      bufferView: POOLS.indexOf(o.pool),
      componentType: component,
      count,
      type: o.type,
      ...(at > 0 ? { byteOffset: at } : {}),
      ...(o.pool === "colour" || o.short === true ? { normalized: true } : {}),
    };
    if (o.bounds === true) {
      const min = Array.from({ length: width }, () => Infinity);
      const max = Array.from({ length: width }, () => -Infinity);
      values.forEach((v, i) => {
        const f = Math.fround(v);
        min[i % width] = Math.min(min[i % width] ?? Infinity, f);
        max[i % width] = Math.max(max[i % width] ?? -Infinity, f);
      });
      accessor["min"] = min;
      accessor["max"] = max;
    }
    this.accessors.push(accessor);
    return this.accessors.length - 1;
  }

  /** A clip's key times, shared by every track that keys the same times. */
  times(values: readonly number[]): number {
    const key = values.join(",");
    const known = this.keys.get(key);
    if (known !== undefined) return known;
    const index = this.add(values, {
      type: "SCALAR",
      pool: "key",
      bounds: true,
    });
    this.keys.set(key, index);
    return index;
  }

  /** The views, each pool laid one after the other, and the buffer. */
  finish(): { bufferViews: Record<string, unknown>[]; bin: Uint8Array } {
    const total = POOLS.reduce((s, p) => s + (this.size.get(p) ?? 0), 0);
    const bin = new Uint8Array(total);
    const bufferViews: Record<string, unknown>[] = [];
    let offset = 0;
    for (const pool of POOLS) {
      const length = this.size.get(pool) ?? 0;
      let at = offset;
      for (const chunk of this.data.get(pool) ?? []) {
        bin.set(chunk, at);
        at += chunk.length;
      }
      const stride = STRIDE[pool];
      const target = TARGET[pool];
      bufferViews.push({
        buffer: 0,
        ...(offset > 0 ? { byteOffset: offset } : {}),
        byteLength: length,
        ...(stride === undefined ? {} : { byteStride: stride }),
        ...(target === undefined ? {} : { target }),
      });
      offset += length;
    }
    return { bufferViews, bin };
  }
}

/** Whether a vector is its default (zeros for a move, ones for a scale). */
const isDefault = (v: readonly number[], d: number) => v.every((x) => x === d);

/** Pip as a .glb: his nodes and meshes, and the clips, in order. */
export function writeGlb(
  root: PipNode,
  clips: readonly Clip[],
  generator: string,
): Uint8Array {
  const buffers = new Buffers();
  const nodes: Record<string, unknown>[] = [];
  const meshes: Record<string, unknown>[] = [];
  const indexOf = new Map<string, number>();

  // Nodes with the very same mesh (the three thinking dots, both glints) share one.
  const sameMesh = new Map<string, number>();
  const meshOf = (node: PipNode): number | undefined => {
    const mesh = node.mesh;
    if (mesh === undefined) return undefined;
    const content = JSON.stringify([
      mesh.positions,
      mesh.colours,
      mesh.indices,
      (node.morphs ?? []).map((m) => [m.name, mesh.positions.map(m.move)]),
    ]);
    const shared = sameMesh.get(content);
    if (shared !== undefined) return shared;
    const toMetres = (p: Vec3) => [
      p[0] * RIG_UNIT,
      p[1] * RIG_UNIT,
      p[2] * RIG_UNIT,
    ];
    const attributes = {
      POSITION: buffers.add(mesh.positions.flatMap(toMetres), {
        type: "VEC3",
        pool: "vertex",
        bounds: true,
      }),
      COLOR_0: buffers.add(
        mesh.colours.flatMap((c) => [
          toLinear(c[0]),
          toLinear(c[1]),
          toLinear(c[2]),
        ]),
        { type: "VEC3", pool: "colour" },
      ),
    };
    const indices = buffers.add(mesh.indices, {
      type: "SCALAR",
      pool: "index",
    });
    const morphs = node.morphs ?? [];
    const primitive: Record<string, unknown> = {
      attributes,
      indices,
      material: 0,
    };
    if (morphs.length > 0)
      primitive["targets"] = morphs.map((m) => ({
        POSITION: buffers.add(
          mesh.positions.flatMap((p) => {
            const q = m.move(p);
            return toMetres([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
          }),
          { type: "VEC3", pool: "vertex", bounds: true },
        ),
      }));
    sameMesh.set(content, meshes.length);
    meshes.push({
      name: node.name,
      primitives: [primitive],
      ...(morphs.length > 0
        ? {
            weights: morphs.map(() => 0),
            extras: { targetNames: morphs.map((m) => m.name) },
          }
        : {}),
    });
    return meshes.length - 1;
  };

  const place = (node: PipNode): number => {
    if (indexOf.has(node.name)) throw new Error(`two nodes named ${node.name}`);
    const json: Record<string, unknown> = { name: node.name };
    const index = nodes.length;
    nodes.push(json);
    indexOf.set(node.name, index);
    if (node.translation !== undefined && !isDefault(node.translation, 0))
      json["translation"] = [...node.translation];
    if (node.rotation !== undefined && !isDefault(node.rotation.slice(0, 3), 0))
      json["rotation"] = [...node.rotation];
    if (node.scale !== undefined && !isDefault(node.scale, 1))
      json["scale"] = [...node.scale];
    const mesh = meshOf(node);
    if (mesh !== undefined) json["mesh"] = mesh;
    const children = (node.children ?? []).map(place);
    if (children.length > 0) json["children"] = children;
    return index;
  };
  const rootIndex = place(root);

  const animations = clips.map((clip) => {
    const samplers: object[] = [];
    const channels: object[] = [];
    for (const track of clip.tracks) {
      const node = indexOf.get(track.node);
      if (node === undefined)
        throw new Error(`${clip.name}: no node ${track.node}`);
      const type: AccessorType =
        track.path === "rotation"
          ? "VEC4"
          : track.path === "weights"
            ? "SCALAR"
            : "VEC3";
      samplers.push({
        input: buffers.times(track.times),
        // LINEAR, glTF's default; turns as normalised shorts, as core glTF allows.
        output: buffers.add(track.values, {
          type,
          pool: "key",
          short: track.path === "rotation",
        }),
      });
      channels.push({
        sampler: samplers.length - 1,
        target: { node, path: track.path },
      });
    }
    return { name: clip.name, samplers, channels };
  });

  const views = buffers.finish();
  const json = {
    asset: { version: "2.0", generator },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ name: "Pip", nodes: [rootIndex] }],
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
    accessors: buffers.accessors,
    bufferViews: views.bufferViews,
    buffers: [{ byteLength: views.bin.length }],
  };
  return packGlb(json, views.bin);
}
