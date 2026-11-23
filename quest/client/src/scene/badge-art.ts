// The Scene's 3D Badges as data (09 9.3, ticket 53): each Lesson's Badge as
// Badge.tsx draws it, read from the same art (badges.tsx's badgeArt, the
// shapes and their numbers in Badge.tsx), so a change to an SVG Badge
// changes its 3D Badge. No 3D code here: the renderer turns it into meshes
// (renderer/badges/geometry.ts), and a test holds the two to the SVG.
import { Fragment, isValidElement, type ReactNode } from "react";
import {
  BADGE_DASH,
  BADGE_RING_SCALE,
  BADGE_SHAPES,
  BADGE_SYMBOL_AT,
  BADGE_SYMBOL_STROKE,
  type BadgeShape,
  type BadgeSize,
} from "../components/Badge";
import { badgeArt } from "../components/badges";

/** One SVG element of a Badge's art, its attributes as the SVG writes them. */
export interface ArtElement {
  tag: string;
  attrs: Readonly<Record<string, string>>;
}

/** A Lesson's Badge, as the 3D Badge is made from it. */
export interface BadgeModel {
  lesson: string;
  shape: BadgeShape;
  capstone: boolean;
  /** The Level's shape on the 64 grid, stroked at `outlineStroke`. */
  outline: readonly ArtElement[];
  outlineStroke: number;
  /** A capstone's inner ring: the outline again at this scale about the centre; null otherwise. */
  ring: number | null;
  /** The Lesson's symbol (a capstone's star) on its 24 grid, at `symbolAt` on the 64 grid. */
  symbol: readonly ArtElement[];
  symbolAt: number;
  symbolStroke: number;
  /** An unearned Badge's dash and gap, on the outline and the ring. */
  dash: readonly [number, number];
}

/** The Badge's grid and its centre. */
export const BADGE_GRID = 64;
export const BADGE_CENTRE = BADGE_GRID / 2;

/** The outline's stroke, as the SVG sets it on the whole Badge. */
const OUTLINE_STROKE = 2;

// React writes camelCase props as SVG's dashed attributes.
const attrName = (prop: string) =>
  prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The SVG elements a piece of art holds, fragments and arrays flattened, in order. */
export function elementsOf(node: ReactNode): ArtElement[] {
  if (Array.isArray(node)) return node.flatMap((n: ReactNode) => elementsOf(n));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  const { children, ...props } = node.props;
  if (node.type === Fragment) return elementsOf(children as ReactNode);
  if (typeof node.type !== "string") return [];
  const attrs: Record<string, string> = {};
  for (const [prop, value] of Object.entries(props))
    if (typeof value === "string" || typeof value === "number")
      attrs[attrName(prop)] = String(value);
  return [{ tag: node.type, attrs }, ...elementsOf(children as ReactNode)];
}

const dashOf = (dash: string): [number, number] => {
  const [on = 0, off = 0] = dash.split(/\s+/).map(Number);
  return [on, off];
};

/**
 * A Lesson's 3D Badge model, from its SVG art at `size` (the symbol's stroke
 * follows the size, as the SVG's does), or undefined for an id the course
 * does not have.
 */
export function badgeModel(
  lesson: string,
  size: BadgeSize = "lg",
): BadgeModel | undefined {
  const art = badgeArt(lesson);
  if (art === undefined) return undefined;
  return {
    lesson,
    shape: art.shape,
    capstone: art.capstone,
    outline: elementsOf(BADGE_SHAPES[art.shape]),
    outlineStroke: OUTLINE_STROKE,
    ring: art.capstone ? BADGE_RING_SCALE : null,
    symbol: elementsOf(art.symbol),
    symbolAt: BADGE_SYMBOL_AT,
    symbolStroke: Number(BADGE_SYMBOL_STROKE[size]),
    dash: dashOf(BADGE_DASH),
  };
}

/** One element as SVG markup, for the renderer's SVG parser. */
export function markupOf(element: ArtElement): string {
  const attrs = Object.entries(element.attrs)
    .map(([name, value]) => ` ${name}="${value.replace(/"/g, "&quot;")}"`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg"><${element.tag}${attrs}/></svg>`;
}
