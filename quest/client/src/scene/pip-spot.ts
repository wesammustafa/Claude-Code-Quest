// Where the Scene's Pip stands (seam S13): in the box the screen gives Pip,
// his own Pip's while it shows and the empty box it leaves once it stands
// down, so every screen keeps its layout and Pip stays where the screen put
// him. A leaving screen's copy (seam S11) holds a box too, and is skipped.
// The Journey's stage (ticket 52) leaves a box on the path, where the 2D Pip
// floats; it comes before any other box the screen leaves, wherever it sits
// on the page, so Pip stands on the path and not beside the Next card.
// No 3D code here, so it is tested on its own.

const SPOTS = "[data-pip-stood-down], [data-pip]:not([data-pip=icon])";

/** The live screen's Pip box, or null on a screen with none. */
export function findPipSpot(root: ParentNode = document): Element | null {
  let found: Element | null = null;
  for (const el of root.querySelectorAll(SPOTS)) {
    if (el.closest("[data-screen-leaving]") !== null) continue;
    if (el.hasAttribute("data-pip-stage")) return el;
    found ??= el;
  }
  return found;
}

/** A box on the page, in CSS px. */
export interface SpotBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Whether any of the box shows in a viewport `width` by `height`. */
export function spotShows(
  box: SpotBox,
  width: number,
  height: number,
): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.x < width &&
    box.y < height &&
    box.x + box.width > 0 &&
    box.y + box.height > 0
  );
}
