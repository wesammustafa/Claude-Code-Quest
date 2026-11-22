// The Scene's quality tier (seam S12): which of its three forms this page
// gets, from four probes, each followed as it changes. No 3D code here, so
// the shell reads it without loading the renderer.
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "../lib/page";
import type { SceneTier } from "../mount/types";
import { webgl2Available } from "../pip/runtime";

/**
 * What counts as a phone: a coarse pointer (touch first) in a viewport whose
 * shorter side is under the `md` breakpoint (48 rem, 768 CSS px at the
 * browser's default text size), in either orientation. A tablet held either
 * way is wider than that on both sides, and a desktop window made narrow
 * keeps its fine pointer. `md` is the breakpoint token's value.
 */
export function phoneQuery(md: string): string {
  return `(pointer: coarse) and (width < ${md}), (pointer: coarse) and (height < ${md})`;
}

/**
 * The phone tier's pixel-ratio cap. The phones the Scene is checked on (an
 * iPhone 12 class Safari at 3, a mid-range Android Chrome at about 2.6)
 * draw a quarter to a third of their native pixels at 1.5, about as many as
 * a 1440 by 900 desktop window at 1.
 */
export const PHONE_PIXEL_RATIO = 1.5;

/** The desktop tier's pixel-ratio cap: a display above 2 gains no sharpness a soft scene shows. */
export const DESKTOP_PIXEL_RATIO = 2;

/** What the tier is chosen from. */
export interface TierProbes {
  webgl2: boolean;
  /** The system setting or the app's own motion choice. */
  reducedMotion: boolean;
  /** The browser's Save-Data request (`navigator.connection.saveData`). */
  saveData: boolean;
  phone: boolean;
}

/** The tier for the probes: stills whenever any of the first three says so, then a phone or a desktop. */
export function sceneTier(p: TierProbes): SceneTier {
  if (!p.webgl2 || p.reducedMotion || p.saveData) return "still";
  return p.phone ? "phone" : "desktop";
}

/** The highest pixel ratio a tier draws at; below it the renderer follows the screen's own, from 1. */
export function pixelRatioCap(tier: Exclude<SceneTier, "still">): number {
  return tier === "phone" ? PHONE_PIXEL_RATIO : DESKTOP_PIXEL_RATIO;
}

interface Connection extends EventTarget {
  saveData?: boolean;
}

const connection = (): Connection | undefined =>
  (navigator as Navigator & { connection?: Connection }).connection;

function saveData(): boolean {
  return connection()?.saveData === true;
}

function onSaveData(changed: () => void): () => void {
  const c = connection();
  c?.addEventListener("change", changed);
  return () => {
    c?.removeEventListener("change", changed);
  };
}

let phoneList: MediaQueryList | undefined;

// Built from the breakpoint token on :root, as lib/media.ts builds its
// queries, so no width is written here; before the stylesheet loads, or
// outside a browser, nothing is a phone. Found once, it is kept.
function phoneMedia(): MediaQueryList | undefined {
  if (phoneList !== undefined) return phoneList;
  if (typeof window.matchMedia !== "function") return undefined;
  const md = getComputedStyle(document.documentElement)
    .getPropertyValue("--breakpoint-md")
    .trim();
  if (md === "") return undefined;
  phoneList = window.matchMedia(phoneQuery(md));
  return phoneList;
}

function phone(): boolean {
  return phoneMedia()?.matches ?? false;
}

function onPhone(changed: () => void): () => void {
  const list = phoneMedia();
  list?.addEventListener("change", changed);
  return () => {
    list?.removeEventListener("change", changed);
  };
}

let webgl2: boolean | undefined;

/** Whether the page gets WebGL2, probed once: a browser does not gain or lose it. */
function hasWebgl2(): boolean {
  webgl2 ??= webgl2Available();
  return webgl2;
}

const none = () => () => undefined;

/** The page's tier now, followed as reduced motion, Save-Data and the phone probe change. */
export function useSceneTier(): SceneTier {
  const reducedMotion = useReducedMotion();
  const data = useSyncExternalStore(onSaveData, saveData, () => false);
  const small = useSyncExternalStore(onPhone, phone, () => false);
  const gl = useSyncExternalStore(none, hasWebgl2, () => false);
  return sceneTier({ webgl2: gl, reducedMotion, saveData: data, phone: small });
}

/** For tests: probe WebGL2 and the phone query again on the next read. */
export function resetTierProbes(): void {
  webgl2 = undefined;
  phoneList = undefined;
}
