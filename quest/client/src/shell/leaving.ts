// The leaving screen of a screen transition (seam S11): a still copy of the
// screen as it last stood, laid over the page where it stood, fading out
// while the new screen is already the page's own. The copy is plain DOM with
// no React behind it, `inert` and hidden from assistive technology, so no
// key, click, tap or screen reader reaches it, and nothing on it can act.

/** What a copy loses that the page must not find twice, or that would act. */
const DROPPED = [
  "id",
  "name",
  "for",
  "autofocus",
  "autoplay",
  "data-testid",
  "data-pip",
  "data-pip-target",
  "data-page-title",
];

/** Elements that would load or play again as a copy: they stay empty. */
const LOADS = new Set(["IFRAME", "VIDEO", "AUDIO", "EMBED", "OBJECT"]);

/** The leaving screen, copied before the route change reaches the page. */
export interface LeavingCopy {
  node: HTMLElement;
  /** Where the screen stood in the viewport. */
  top: number;
  left: number;
  width: number;
  /** Scrolled boxes inside it, to scroll the copy's to the same place. */
  scrolled: readonly { el: Element; top: number; left: number }[];
  /** Canvases inside it and their copies, to paint each copy's last frame. */
  canvases: readonly { from: HTMLCanvasElement; to: HTMLCanvasElement }[];
}

/** The elements of `root` and of its deep copy, in the same order. */
function pairs(root: Element, copy: Element): [Element, Element][] {
  const a = [root, ...root.querySelectorAll("*")];
  const b = [copy, ...copy.querySelectorAll("*")];
  return a.flatMap((el, i) => {
    const twin = b[i];
    return twin === undefined ? [] : [[el, twin] as [Element, Element]];
  });
}

/** How far a computed transform moves its box; none where the page cannot say. */
function translation(transform: string): { x: number; y: number } {
  if (
    transform === "" ||
    transform === "none" ||
    typeof DOMMatrixReadOnly !== "function"
  )
    return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(transform);
  return { x: m.m41, y: m.m42 };
}

/**
 * Copies `screen` as it stands now, mid-enter included: its opacity and
 * transform become where the copy's exit starts, so an interrupted
 * transition goes on from there.
 */
export function copyLeaving(screen: HTMLElement): LeavingCopy {
  const node = screen.cloneNode(true) as HTMLElement;
  const scrolled: { el: Element; top: number; left: number }[] = [];
  const canvases: { from: HTMLCanvasElement; to: HTMLCanvasElement }[] = [];
  for (const [el, twin] of pairs(screen, node)) {
    if (el.scrollTop !== 0 || el.scrollLeft !== 0)
      scrolled.push({ el: twin, top: el.scrollTop, left: el.scrollLeft });
    if (
      el instanceof HTMLCanvasElement &&
      twin instanceof HTMLCanvasElement &&
      el.width > 0 &&
      el.height > 0 &&
      el.getBoundingClientRect().width > 0
    )
      canvases.push({ from: el, to: twin });
    for (const name of DROPPED) twin.removeAttribute(name);
    if (LOADS.has(twin.tagName))
      for (const name of ["src", "srcdoc", "data"]) twin.removeAttribute(name);
  }
  const style = getComputedStyle(screen);
  for (const name of [...node.attributes].map((a) => a.name))
    if (name !== "style") node.removeAttribute(name);
  node.dataset.screenLeaving = "";
  node.setAttribute("aria-hidden", "true");
  node.inert = true;
  // Nothing inside the copy starts its own entrance again.
  node.className = "animate-screen-out [&_*]:animate-none!";
  if (style.opacity !== "")
    node.style.setProperty("--screen-from-opacity", style.opacity);
  if (style.transform !== "" && style.transform !== "none")
    node.style.setProperty("--screen-from-transform", style.transform);
  // The box includes the screen's transform, which the copy's exit starts
  // from too, so it is taken out of the place once.
  const box = screen.getBoundingClientRect();
  const shift = translation(style.transform);
  return {
    node,
    top: box.top - shift.y,
    left: box.left - shift.x,
    width: box.width,
    scrolled,
    canvases,
  };
}

/**
 * Lays `copy` into `layer` (fixed over the viewport) where its screen
 * stood, and removes it when its exit ends, or at `capMs` at the latest
 * (a hidden page runs no animation), then calls `gone`. Returns the
 * removal, for an unmount.
 */
export function showLeaving(
  layer: HTMLElement,
  copy: LeavingCopy,
  capMs: number,
  gone: () => void,
): () => void {
  const { node } = copy;
  node.style.position = "absolute";
  node.style.margin = "0";
  node.style.top = `${String(copy.top)}px`;
  node.style.left = `${String(copy.left)}px`;
  node.style.width = `${String(copy.width)}px`;
  layer.append(node);
  for (const { el, top, left } of copy.scrolled) {
    el.scrollTop = top;
    el.scrollLeft = left;
  }
  for (const { from, to } of copy.canvases) {
    try {
      to.getContext("2d")?.drawImage(from, 0, 0);
    } catch {
      // A canvas that cannot be read leaves its copy blank.
    }
  }
  const remove = () => {
    clearTimeout(timer);
    node.removeEventListener("animationend", ended);
    node.removeEventListener("animationcancel", ended);
    if (!node.isConnected) return;
    node.remove();
    gone();
  };
  const ended = (e: Event) => {
    if (e.target === node) remove();
  };
  node.addEventListener("animationend", ended);
  node.addEventListener("animationcancel", ended);
  const timer = setTimeout(remove, capMs);
  return remove;
}
