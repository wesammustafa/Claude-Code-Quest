// @vitest-environment node
// The 3D Pip's model test (seam S13): the committed model, loaded with the
// same GLTFLoader the renderer uses, holds every clip, the gaze control and
// the still pose the model contract names; a model with any one clip
// removed is refused, naming the mode or Reaction that clip plays.
import { AnimationMixer, Box3, Quaternion, type Object3D } from "three";
import { describe, expect, test } from "vitest";
import {
  PIP_MODEL_CLIPS,
  PIP_MODEL_GAZE,
  PIP_MODEL_STILL,
} from "../../../../pip/model/contract";
import { packGlb, unpackGlb } from "../../../../pip/model/glb";
import inline from "../../../../pip/model/pip.glb?inline";
import { parsePipModel } from "./load";

/** The committed model's bytes. */
function committed(): Uint8Array {
  const base64 = inline.slice(inline.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const buffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

/** The committed model with one clip taken out. */
function without(clip: string): ArrayBuffer {
  const { json, bin } = unpackGlb(committed());
  const gltf = json as { animations: { name: string }[] };
  gltf.animations = gltf.animations.filter((a) => a.name !== clip);
  return buffer(packGlb(gltf, bin));
}

/** Every node's pose, to tell whether a clip moved anything. */
function pose(root: Object3D): string {
  const parts: string[] = [];
  root.traverse((o) => {
    parts.push(
      `${o.name} ${o.position
        .toArray()
        .map((v) => v.toFixed(4))
        .join(",")} ${o.quaternion
        .toArray()
        .map((v) => v.toFixed(4))
        .join(",")} ${o.scale
        .toArray()
        .map((v) => v.toFixed(4))
        .join(",")}`,
    );
  });
  return parts.join("\n");
}

describe("the committed model", () => {
  test("meets the model contract when loaded", async () => {
    const model = await parsePipModel(buffer(committed()));
    expect(model.clips.map((c) => c.name).sort()).toEqual(
      [...PIP_MODEL_CLIPS].sort(),
    );
    expect(model.scene.getObjectByName(PIP_MODEL_GAZE)).toBeDefined();
  });

  test("stands 1 m tall on his soles at rest, facing +z, as the renderer measures him", async () => {
    const { scene } = await parsePipModel(buffer(committed()));
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene);
    // The ears' outer faces at +-370 rig units, the head's back at -196 and
    // the eyes' fronts at 199, in metres at 725 units to Pip's 1 m height.
    const unit = 1 / 725;
    expect(bounds.min.toArray().map((v) => v / unit)).toEqual([
      expect.closeTo(-370, 1),
      expect.closeTo(0, 1),
      expect.closeTo(-196, 1),
    ]);
    expect(bounds.max.toArray().map((v) => v / unit)).toEqual([
      expect.closeTo(370, 1),
      expect.closeTo(725, 1),
      expect.closeTo(199, 1),
    ]);
  });

  test("each mode and Reaction clip moves Pip, and none turns the gaze node", async () => {
    for (const name of PIP_MODEL_CLIPS) {
      if (name === PIP_MODEL_STILL) continue;
      const { scene, clips } = await parsePipModel(buffer(committed()));
      const clip = clips.find((c) => c.name === name);
      if (clip === undefined) throw new Error(name);
      const gaze = scene.getObjectByName(PIP_MODEL_GAZE);
      const turn = gaze?.quaternion.clone() ?? new Quaternion();
      const rest = pose(scene);
      const mixer = new AnimationMixer(scene);
      mixer.clipAction(clip).play();
      // A mode starts on its own pose; a Reaction moves away from it mid-clip.
      mixer.update(clip.duration / 2);
      expect(pose(scene), name).not.toBe(rest);
      expect(gaze?.quaternion.equals(turn), name).toBe(true);
    }
  });

  test("the still pose is one pose: it never moves", async () => {
    const { scene, clips } = await parsePipModel(buffer(committed()));
    const still = clips.find((c) => c.name === PIP_MODEL_STILL);
    if (still === undefined) throw new Error("no still");
    const mixer = new AnimationMixer(scene);
    mixer.clipAction(still).play();
    mixer.update(0);
    const held = pose(scene);
    for (let i = 0; i < 4; i++) {
      mixer.update(0.4);
      expect(pose(scene)).toBe(held);
    }
  });

  test("a model with a clip removed is refused, naming the clip and what it plays", async () => {
    for (const name of PIP_MODEL_CLIPS) {
      const role =
        name === PIP_MODEL_STILL
          ? "the still pose"
          : (["idle", "thinking", "rest", "sleep"] as string[]).includes(name)
            ? `the mode ${name}`
            : `the Reaction ${name}`;
      await expect(parsePipModel(without(name))).rejects.toThrow(
        `Pip's model departs from its contract: no clip ${name} for ${role}`,
      );
    }
  });
});
