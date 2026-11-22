/**
 * Whether this browser gives a page WebGL2. Probed on a throwaway canvas,
 * whose context is released at once, so a browser without it never fetches
 * what needs it (Pip's runtime, the Scene's renderer). A browser that refuses
 * a later context still falls back quietly: Pip's openRig makes its own
 * context, not the first Pip, and the Scene's layer catches its renderer's.
 */
export function webgl2Available(): boolean {
  if (typeof WebGL2RenderingContext === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl === null) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
