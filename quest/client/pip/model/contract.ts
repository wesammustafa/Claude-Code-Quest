// The 3D Pip's model contract (seam S13): what a glTF model of Pip must hold
// for the Scene's renderer to drive him from the same PipModel the Rive rig
// takes. One clip per mode and per Reaction, named as the Rive contract names
// them, a still pose for reduced motion, a walk for travelling the Journey's
// path, one node the renderer turns for the gaze, and the nodes the
// workshop's stride moves and follows. This is the asset brief's technical
// half; the contract tests load the committed model and name every way it
// departs from it.
import { PIP_MODES, PIP_REACTIONS } from "../contract";

/** The clip that holds Pip still under reduced motion: one pose, no travel. */
export const PIP_MODEL_STILL = "still";

/**
 * The clip Pip walks on while he travels between Stations: a seamless loop
 * of the legs, feet, arms and body, model-only like the still pose (the Rive
 * rig has no walk). Like every clip it never keys the gaze; the renderer
 * turns the whole model toward the way he walks.
 */
export const PIP_MODEL_WALK = "walk";

/**
 * The node the renderer turns for the gaze: yaw for gazeX (+x toward the
 * screen's right, where the content sits beside him), pitch for gazeY (+y
 * down), eased over the rig's 150 ms. No clip may key its rotation; clips move the parts under it.
 */
export const PIP_MODEL_GAZE = "gaze";

/**
 * The nodes the workshop's stride moves over the clips' pose (D6): the body
 * that hops, leans and sways, the legs and feet it plants, the arms and
 * hands it swings, the neck that steadies the head, and the antennas that
 * lag. The walk in the room is the renderer's, so no clip is added for it.
 */
export const PIP_MODEL_STRIDE = [
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
] as const;

/** The node at Pip's head, which the workshop's speech and tags follow on the page. */
export const PIP_MODEL_HEAD = "Head";

/** Every clip the model holds, and nothing else: the modes, the Reactions, the still pose and the walk. */
export const PIP_MODEL_CLIPS = [
  ...PIP_MODES,
  ...PIP_REACTIONS,
  PIP_MODEL_STILL,
  PIP_MODEL_WALK,
] as const;
export type PipModelClip = (typeof PIP_MODEL_CLIPS)[number];

/**
 * The model file's size limit, in bytes as committed: it loads after boot
 * beside Pip's rig and counts in the first Lesson's cold download (C27).
 */
export const PIP_MODEL_MAX_BYTES = 256 * 1024;

/**
 * The glTF extensions a model may require: three's GLTFLoader reads these
 * with no decoder. Draco, meshopt and Basis need decoders the app does not
 * ship, so a model that requires them never loads.
 */
export const PIP_MODEL_EXTENSIONS = [
  "KHR_materials_unlit",
  "KHR_mesh_quantization",
  "KHR_texture_transform",
] as const;

/** What a loaded model says about itself. */
export interface ModelShape {
  /** Each animation clip: its name, its length in seconds, and the node properties it keys ("gaze.quaternion"). */
  clips: { name: string; duration: number; tracks: string[] }[];
  /** Every node's name. */
  nodes: string[];
  /** The file's `extensionsRequired`. */
  extensionsRequired: string[];
  /** The file's size in bytes. */
  bytes: number;
}

const MODES: readonly string[] = PIP_MODES;
const REACTIONS: readonly string[] = PIP_REACTIONS;
const CLIPS: readonly string[] = PIP_MODEL_CLIPS;
const EXTENSIONS: readonly string[] = PIP_MODEL_EXTENSIONS;

function clipRole(name: string): string {
  if (MODES.includes(name)) return `the mode ${name}`;
  if (REACTIONS.includes(name)) return `the Reaction ${name}`;
  if (name === PIP_MODEL_WALK) return "the walk";
  return "the still pose";
}

/** Whether a track keys the gaze node's turn: its rotation, by either of three's names for it. */
const turnsGaze = (track: string) =>
  track === `${PIP_MODEL_GAZE}.quaternion` ||
  track === `${PIP_MODEL_GAZE}.rotation`;

/**
 * Every way the shape departs from the contract, in words; empty when it
 * meets it. Each missing clip is named with the mode or Reaction it plays.
 */
export function modelProblems(shape: ModelShape): string[] {
  const problems: string[] = [];
  const names = shape.clips.map((c) => c.name);
  for (const name of CLIPS)
    if (!names.includes(name))
      problems.push(`no clip ${name} for ${clipRole(name)}`);
  for (const name of names)
    if (!CLIPS.includes(name))
      problems.push(`a clip ${name} the contract does not name`);
  if (new Set(names).size !== names.length)
    problems.push("a clip is named more than once");
  for (const clip of shape.clips) {
    if (!CLIPS.includes(clip.name)) continue;
    if (clip.tracks.length === 0)
      problems.push(`clip ${clip.name} keys nothing`);
    else if (clip.name !== PIP_MODEL_STILL && !(clip.duration > 0))
      problems.push(`clip ${clip.name} has no length`);
    if (clip.tracks.some(turnsGaze))
      problems.push(
        `clip ${clip.name} keys ${PIP_MODEL_GAZE}'s rotation, which the gaze drives`,
      );
  }
  const gazes = shape.nodes.filter((n) => n === PIP_MODEL_GAZE).length;
  if (gazes === 0)
    problems.push(`no node ${PIP_MODEL_GAZE} for the gaze control`);
  else if (gazes > 1)
    problems.push(`more than one node is named ${PIP_MODEL_GAZE}`);
  for (const name of [...PIP_MODEL_STRIDE, PIP_MODEL_HEAD])
    if (!shape.nodes.includes(name))
      problems.push(
        `no node ${name} for ${name === PIP_MODEL_HEAD ? "his head's place" : "the stride"}`,
      );
  for (const extension of shape.extensionsRequired)
    if (!EXTENSIONS.includes(extension))
      problems.push(`it requires ${extension}, which the app cannot decode`);
  if (shape.bytes > PIP_MODEL_MAX_BYTES)
    problems.push(
      `it is ${String(shape.bytes)} bytes, over the ${String(PIP_MODEL_MAX_BYTES)} the brief allows`,
    );
  return problems;
}
