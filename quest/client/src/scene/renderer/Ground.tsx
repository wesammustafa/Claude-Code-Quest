import { useMemo, type ReactNode } from "react";
import { PlaneGeometry } from "three";

/** The ground's size, its facets across, and how high its slopes rise, in scene units. */
const SIZE = 120;
const FACETS = 60;
const RISE = 0.9;

/**
 * Soft rolling slopes: a sum of slow waves, flat near the camera and rising
 * toward the distance, so the screens' text sits over open ground.
 */
export function heightAt(x: number, z: number): number {
  const far = Math.min(1, Math.max(0, -z / 30));
  const waves =
    Math.sin(x * 0.21 + z * 0.13) * 0.6 +
    Math.sin(x * 0.07 - z * 0.19 + 1.3) * 0.9 +
    Math.sin(x * 0.43 + 2.1) * Math.cos(z * 0.37) * 0.25;
  return waves * RISE * (0.25 + far);
}

/** The placeholder ground: low-poly, flat-shaded facets in the look's ground colour. */
export function Ground({
  color,
  shadows,
}: {
  color: string;
  shadows: boolean;
}): ReactNode {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(SIZE, SIZE, FACETS, FACETS);
    plane.rotateX(-Math.PI / 2);
    const at = plane.attributes.position;
    if (at !== undefined)
      for (let i = 0; i < at.count; i++)
        at.setY(i, heightAt(at.getX(i), at.getZ(i)));
    plane.computeVertexNormals();
    return plane;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow={shadows} castShadow={shadows}>
      <meshLambertMaterial color={color} flatShading />
    </mesh>
  );
}
