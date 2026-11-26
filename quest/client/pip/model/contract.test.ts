// @vitest-environment node
// The 3D Pip's model contract (seam S13): the comparison the renderer and
// the model test run on a loaded model passes the exact contract and names
// every way a model departs from it. The committed model's own test, which
// loads it with three's GLTFLoader, is src/scene/renderer/pip/model.test.ts.
import { describe, expect, test } from "vitest";
import { PIP_MODES, PIP_REACTIONS } from "../contract";
import {
  PIP_MODEL_CLIPS,
  PIP_MODEL_HEAD,
  PIP_MODEL_MAX_BYTES,
  PIP_MODEL_STRIDE,
  modelProblems,
  type ModelShape,
} from "./contract";

/** A model that is exactly the contract. */
function exact(): ModelShape {
  return {
    clips: PIP_MODEL_CLIPS.map((name) => ({
      name,
      duration: name === "still" ? 0 : 1.2,
      tracks: ["body.position", "head.quaternion"],
    })),
    nodes: ["Pip", ...PIP_MODEL_STRIDE, "gaze", "HeadPose", PIP_MODEL_HEAD],
    extensionsRequired: [],
    bytes: 20_000,
  };
}

describe("modelProblems", () => {
  test("passes the exact contract", () => {
    expect(modelProblems(exact())).toEqual([]);
  });

  test("names the clips: the four modes, the six Reactions, the still pose and the walk", () => {
    expect(PIP_MODEL_CLIPS).toEqual([
      ...PIP_MODES,
      ...PIP_REACTIONS,
      "still",
      "walk",
    ]);
  });

  test("names each missing clip with the mode or Reaction it plays", () => {
    for (const name of PIP_MODEL_CLIPS) {
      const shape = exact();
      shape.clips = shape.clips.filter((c) => c.name !== name);
      const role = (PIP_MODES as readonly string[]).includes(name)
        ? `the mode ${name}`
        : (PIP_REACTIONS as readonly string[]).includes(name)
          ? `the Reaction ${name}`
          : name === "walk"
            ? "the walk"
            : "the still pose";
      expect(modelProblems(shape)).toEqual([`no clip ${name} for ${role}`]);
    }
  });

  test("fails on a clip the contract does not name, or one named twice", () => {
    const shape = exact();
    shape.clips.push(
      { name: "wave", duration: 1, tracks: ["arm_r.quaternion"] },
      { name: "idle", duration: 1, tracks: ["body.position"] },
    );
    expect(modelProblems(shape)).toEqual([
      "a clip wave the contract does not name",
      "a clip is named more than once",
    ]);
  });

  test("fails on a clip that keys nothing or has no length", () => {
    const shape = exact();
    shape.clips = shape.clips.map((c) =>
      c.name === "retry"
        ? { ...c, tracks: [] }
        : c.name === "sleep"
          ? { ...c, duration: 0 }
          : c,
    );
    expect(modelProblems(shape)).toEqual([
      "clip sleep has no length",
      "clip retry keys nothing",
    ]);
  });

  test("fails without the gaze control, with two, or when a clip turns it", () => {
    const none = exact();
    none.nodes = none.nodes.filter((n) => n !== "gaze");
    expect(modelProblems(none)).toEqual(["no node gaze for the gaze control"]);

    const two = exact();
    two.nodes.push("gaze");
    expect(modelProblems(two)).toEqual(["more than one node is named gaze"]);

    const keyed = exact();
    keyed.clips = keyed.clips.map((c) =>
      c.name === "curious" || c.name === "walk"
        ? { ...c, tracks: [...c.tracks, "gaze.quaternion"] }
        : c,
    );
    expect(modelProblems(keyed)).toEqual([
      "clip curious keys gaze's rotation, which the gaze drives",
      "clip walk keys gaze's rotation, which the gaze drives",
    ]);
  });

  test("fails without a node the workshop's stride moves or follows, naming it", () => {
    for (const name of ["FootLeft", "AntennaRight", "Head"]) {
      const shape = exact();
      shape.nodes = shape.nodes.filter((n) => n !== name);
      expect(modelProblems(shape)).toEqual([
        `no node ${name} for ${name === "Head" ? "his head's place" : "the stride"}`,
      ]);
    }
    expect(PIP_MODEL_STRIDE).toEqual([
      "Hop",
      "Lean",
      "Body",
      "LegLeft",
      "LegRight",
      "FootLeft",
      "FootRight",
      "ArmLeft",
      "ArmRight",
      "HandLeft",
      "HandRight",
      "Neck",
      "AntennaLeft",
      "AntennaRight",
    ]);
  });

  test("fails on an extension the app cannot decode, and over the size limit", () => {
    const shape = exact();
    shape.extensionsRequired = [
      "KHR_materials_unlit",
      "KHR_draco_mesh_compression",
    ];
    shape.bytes = PIP_MODEL_MAX_BYTES + 1;
    expect(modelProblems(shape)).toEqual([
      "it requires KHR_draco_mesh_compression, which the app cannot decode",
      `it is ${String(PIP_MODEL_MAX_BYTES + 1)} bytes, over the ${String(PIP_MODEL_MAX_BYTES)} the brief allows`,
    ]);
  });
});
