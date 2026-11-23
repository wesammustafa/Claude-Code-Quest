// Loading the 3D Pip's model (seam S13): three's own GLTFLoader reads the
// .glb, and the model contract decides whether the Scene may drive it. A
// model that departs from the contract never shows, so a missing clip is
// the screen's own Pip, never a Pip that freezes on a Reaction.
import type { AnimationClip, Object3D } from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { modelProblems, type ModelShape } from "../../../../pip/model/contract";

/** A model the contract accepts: its scene and its clips. */
export interface PipModel3D {
  scene: Object3D;
  clips: AnimationClip[];
}

/** What a parsed glTF says about itself, as the model contract reads it. */
export function shapeOf(gltf: GLTF, bytes: number): ModelShape {
  const nodes: string[] = [];
  gltf.scene.traverse((object) => {
    nodes.push(object.name);
  });
  const json = gltf.parser.json as { extensionsRequired?: unknown };
  return {
    clips: gltf.animations.map((clip) => ({
      name: clip.name,
      duration: clip.duration,
      tracks: clip.tracks.map((track) => track.name),
    })),
    nodes,
    extensionsRequired: Array.isArray(json.extensionsRequired)
      ? json.extensionsRequired.filter((e) => typeof e === "string")
      : [],
    bytes,
  };
}

/** A .glb's bytes parsed, held to the model contract: rejects naming every problem. */
export async function parsePipModel(bytes: ArrayBuffer): Promise<PipModel3D> {
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  const problems = modelProblems(shapeOf(gltf, bytes.byteLength));
  if (problems.length > 0)
    throw new Error(
      `Pip's model departs from its contract: ${problems.join("; ")}`,
    );
  return { scene: gltf.scene, clips: gltf.animations };
}

/** Fetches the model from the page's own origin and parses it. */
export async function loadPipModel(url: string): Promise<PipModel3D> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
  return parsePipModel(await response.arrayBuffer());
}
