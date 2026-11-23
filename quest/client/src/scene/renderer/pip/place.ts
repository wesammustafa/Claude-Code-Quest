// Standing the 3D Pip in the Scene where the screen puts Pip (seam S13):
// a short way in front of the camera, through the box's centre, as tall as
// the posters draw him in it, facing the Learner.
import { Vector3, type Object3D, type PerspectiveCamera } from "three";
import type { SpotBox } from "../../pip-spot";

/** How far in front of the camera Pip stands, in scene units: nearer than any ground. */
export const PIP_DEPTH = 1.2;
/** Pip's height as a share of his box, as the posters draw him. */
export const PIP_FILL = 0.8;

const at = new Vector3();

/**
 * Places `group` so a model `height` units tall, centred on the group's
 * origin, fills the box seen through `camera` on a `view` of CSS px.
 */
export function placeAtSpot(
  group: Object3D,
  camera: PerspectiveCamera,
  box: SpotBox,
  view: { width: number; height: number },
  height: number,
): void {
  const halfHeight = PIP_DEPTH * Math.tan((camera.fov * Math.PI) / 360);
  const halfWidth = halfHeight * (view.width / view.height);
  const ndcX = ((box.x + box.width / 2) / view.width) * 2 - 1;
  const ndcY = 1 - ((box.y + box.height / 2) / view.height) * 2;
  camera.updateMatrixWorld();
  at.set(ndcX * halfWidth, ndcY * halfHeight, -PIP_DEPTH);
  camera.localToWorld(at);
  group.position.copy(at);
  group.quaternion.copy(camera.quaternion);
  const tall = ((box.height * 2 * halfHeight) / view.height) * PIP_FILL;
  group.scale.setScalar(height > 0 ? tall / height : 1);
}
