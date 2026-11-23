// @quest/client/scene: the Scene's renderer (seam S12), the only module
// that brings Three.js and React Three Fiber. A page that turns the Scene
// on loads it itself, as `ClientMount.scene.load`, so no other page's
// bundle holds it. The hooks it offers are the shell's own.
import { SceneView } from "./SceneView";

export default SceneView;
export { useSceneMove, useScenePip } from "../context";
export { useSceneSound } from "../sound/context";
