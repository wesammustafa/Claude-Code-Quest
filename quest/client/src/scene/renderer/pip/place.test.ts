// Standing the 3D Pip in his box (seam S13): through the camera's own
// projection, so the box's centre is where he stands with the lens centred
// or shifted, as the Journey shifts it (ticket 52).
import { Group, PerspectiveCamera, Vector3 } from "three";
import { expect, test } from "vitest";
import { PIP_DEPTH, PIP_FILL, placeAtSpot } from "./place";

const VIEW = { width: 1440, height: 900 };
const BOX = { x: 1000, y: 600, width: 160, height: 200 };

function camera(shift: { x: number; y: number } | null): PerspectiveCamera {
  const c = new PerspectiveCamera(45, VIEW.width / VIEW.height, 0.1, 160);
  c.position.set(1, 2, 8);
  c.lookAt(0, 0.6, -8);
  if (shift !== null)
    c.setViewOffset(
      VIEW.width,
      VIEW.height,
      shift.x,
      shift.y,
      VIEW.width,
      VIEW.height,
    );
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return c;
}

/** Where a world point falls on the view, in CSS px. */
function onView(c: PerspectiveCamera, p: Vector3): { x: number; y: number } {
  const ndc = p.clone().project(c);
  return {
    x: ((ndc.x + 1) / 2) * VIEW.width,
    y: ((1 - ndc.y) / 2) * VIEW.height,
  };
}

for (const shift of [null, { x: -220, y: 140 }])
  test(`Pip stands at his box's centre, PIP_DEPTH in front, ${shift === null ? "the lens centred" : "the lens shifted"}`, () => {
    const c = camera(shift);
    const group = new Group();
    placeAtSpot(group, c, BOX, VIEW, 2);
    const at = onView(c, group.position);
    expect(at.x).toBeCloseTo(BOX.x + BOX.width / 2, 3);
    expect(at.y).toBeCloseTo(BOX.y + BOX.height / 2, 3);
    const local = c.worldToLocal(group.position.clone());
    expect(local.z).toBeCloseTo(-PIP_DEPTH, 6);
    const halfHeight = PIP_DEPTH * Math.tan((45 * Math.PI) / 360);
    expect(group.scale.x * 2).toBeCloseTo(
      ((BOX.height * 2 * halfHeight) / VIEW.height) * PIP_FILL,
      6,
    );
  });
