import { useSyncExternalStore } from "react";

export type Breakpoint = "sm" | "md" | "lg";

// The media query Tailwind's max-<breakpoint> variant uses, built from the
// breakpoint token the stylesheet declares on :root, so no width is written
// here. Before the stylesheet loads, or outside a browser, there is none.
// A token found once is kept, so a render reads no style.
const queries = new Map<Breakpoint, MediaQueryList>();

function belowQuery(breakpoint: Breakpoint): MediaQueryList | undefined {
  const known = queries.get(breakpoint);
  if (known) return known;
  if (typeof window.matchMedia !== "function") return undefined;
  const width = getComputedStyle(document.documentElement)
    .getPropertyValue(`--breakpoint-${breakpoint}`)
    .trim();
  if (width === "") return undefined;
  const list = window.matchMedia(`(width < ${width})`);
  queries.set(breakpoint, list);
  return list;
}

/**
 * Whether the window is narrower than a breakpoint, where the max-<breakpoint>
 * styles apply, following it as the window changes.
 */
export function useBelow(breakpoint: Breakpoint): boolean {
  return useSyncExternalStore(
    (changed) => {
      const list = belowQuery(breakpoint);
      if (list === undefined) return () => undefined;
      list.addEventListener("change", changed);
      return () => {
        list.removeEventListener("change", changed);
      };
    },
    () => belowQuery(breakpoint)?.matches ?? false,
    () => false,
  );
}

// app.css's scene-narrow variant: a page at most nine tenths as wide as it
// is tall, where a Scene screen's panel sits under the room.
const SCENE_NARROW = "(max-aspect-ratio: 9/10)";
let sceneNarrow: MediaQueryList | undefined;

function sceneNarrowQuery(): MediaQueryList | undefined {
  if (sceneNarrow === undefined && typeof window.matchMedia === "function")
    sceneNarrow = window.matchMedia(SCENE_NARROW);
  return sceneNarrow;
}

/** Whether the scene-narrow styles apply, following the window as it changes. */
export function useSceneNarrow(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const list = sceneNarrowQuery();
      if (list === undefined) return () => undefined;
      list.addEventListener("change", changed);
      return () => {
        list.removeEventListener("change", changed);
      };
    },
    () => sceneNarrowQuery()?.matches ?? false,
    () => false,
  );
}
