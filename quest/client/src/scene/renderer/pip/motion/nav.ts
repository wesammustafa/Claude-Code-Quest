// Where Pip can walk in the workshop (D6): the floor as a grid, the
// furniture as boxes grown by his radius, and an A* route pulled taut to
// the fewest straight legs that clear every box.
import {
  FURNITURE,
  PIP_RADIUS,
  ROOM,
  type FloorPoint,
  type FloorRect,
} from "../../../workshop/layout";

/** The grid's cell, in floor units: fine enough to pass between the room's furniture. */
const CELL = 0.18;

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly bounds: FloorRect;
  readonly obstacles: readonly FloorRect[];
  readonly radius: number;
  readonly cell: number;
  private readonly blocked: Uint8Array;

  constructor(
    bounds: FloorRect,
    obstacles: readonly FloorRect[],
    radius: number,
    cell = CELL,
  ) {
    this.bounds = bounds;
    this.obstacles = obstacles;
    this.radius = radius;
    this.cell = cell;
    this.cols = Math.ceil((bounds.x1 - bounds.x0) / cell);
    this.rows = Math.ceil((bounds.z1 - bounds.z0) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (!this.freePoint(this.centre(c, r)))
          this.blocked[r * this.cols + c] = 1;
  }

  /** Whether Pip's centre may stand at p: inside the walls and clear of the furniture by his radius. */
  freePoint(p: FloorPoint): boolean {
    const b = this.bounds;
    const m = this.radius;
    if (p.x < b.x0 + m || p.x > b.x1 - m || p.z < b.z0 + m || p.z > b.z1 - m)
      return false;
    return !this.obstacles.some(
      (o) =>
        p.x > o.x0 - m && p.x < o.x1 + m && p.z > o.z0 - m && p.z < o.z1 + m,
    );
  }

  private centre(c: number, r: number): FloorPoint {
    return {
      x: this.bounds.x0 + (c + 0.5) * this.cell,
      z: this.bounds.z0 + (r + 0.5) * this.cell,
    };
  }

  private isBlocked(i: number): boolean {
    return this.blocked[i] === 1;
  }

  private cellOf(p: FloorPoint): { c: number; r: number } {
    const at = (v: number, from: number, count: number) =>
      Math.min(count - 1, Math.max(0, Math.floor((v - from) / this.cell)));
    return {
      c: at(p.x, this.bounds.x0, this.cols),
      r: at(p.z, this.bounds.z0, this.rows),
    };
  }

  /** The free point nearest p: p itself when it is free, else the centre of the nearest free cell. */
  nearestFree(p: FloorPoint): FloorPoint {
    if (this.freePoint(p)) return { x: p.x, z: p.z };
    let best: FloorPoint | null = null;
    let bestD = Infinity;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        if (this.isBlocked(r * this.cols + c)) continue;
        const q = this.centre(c, r);
        const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
    return best ?? { x: p.x, z: p.z };
  }

  /** Whether the straight line from a to b stays clear, sampled finely. */
  clear(a: FloorPoint, b: FloorPoint): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / (this.cell * 0.35)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (
        !this.freePoint({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      )
        return false;
    }
    return true;
  }

  /** A route from `from` to `to`, each first moved to the nearest free point: its corners, both ends included. */
  route(from: FloorPoint, to: FloorPoint): FloorPoint[] {
    const a = this.nearestFree(from);
    const b = this.nearestFree(to);
    if (this.clear(a, b)) return [a, b];
    const cells = this.search(this.cellOf(a), this.cellOf(b));
    if (cells === null) return [a, b];
    const raw = [a, ...cells.slice(0, -1), b];
    // Pulled taut: keep only the corners a straight line cannot skip.
    const out: FloorPoint[] = [a];
    let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.clear(at(raw, i), at(raw, j))) j--;
      out.push(at(raw, j));
      i = j;
    }
    return out;
  }

  /** A* over the free cells, on eight neighbours, never cutting a blocked corner: the cells after the start, or null. */
  private search(
    start: { c: number; r: number },
    goal: { c: number; r: number },
  ): FloorPoint[] | null {
    const size = this.cols * this.rows;
    const idx = (c: number, r: number) => r * this.cols + c;
    const g = new Float64Array(size).fill(Infinity);
    const f = new Float64Array(size).fill(Infinity);
    const came = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const open = new Set<number>();
    const h = (c: number, r: number) => Math.hypot(c - goal.c, r - goal.r);
    const s = idx(start.c, start.r);
    const goalI = idx(goal.c, goal.r);
    g[s] = 0;
    f[s] = h(start.c, start.r);
    open.add(s);
    while (open.size > 0) {
      let cur = -1;
      for (const i of open)
        if (cur === -1 || (f[i] ?? Infinity) < (f[cur] ?? Infinity)) cur = i;
      open.delete(cur);
      if (cur === goalI) break;
      closed[cur] = 1;
      const cc = cur % this.cols;
      const cr = Math.floor(cur / this.cols);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
          const ni = idx(nc, nr);
          if (closed[ni] === 1 || (this.isBlocked(ni) && ni !== goalI))
            continue;
          const diagonal = dc !== 0 && dr !== 0;
          if (
            diagonal &&
            (this.isBlocked(idx(cc + dc, cr)) ||
              this.isBlocked(idx(cc, cr + dr)))
          )
            continue;
          const ng = (g[cur] ?? Infinity) + (diagonal ? Math.SQRT2 : 1);
          if (ng < (g[ni] ?? Infinity)) {
            g[ni] = ng;
            f[ni] = ng + h(nc, nr);
            came[ni] = cur;
            open.add(ni);
          }
        }
    }
    if (came[goalI] === -1 && goalI !== s) return null;
    const cells: FloorPoint[] = [];
    for (let i = goalI; i !== -1 && i !== s; i = came[i] ?? -1)
      cells.push(this.centre(i % this.cols, Math.floor(i / this.cols)));
    return cells.reverse();
  }
}

const at = (pts: readonly FloorPoint[], i: number): FloorPoint => {
  const p = pts[i];
  if (p === undefined) throw new RangeError(`no point ${String(i)}`);
  return p;
};

/** A route's length along its legs. */
export function pathLength(pts: readonly FloorPoint[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i++)
    sum += Math.hypot(
      at(pts, i).x - at(pts, i - 1).x,
      at(pts, i).z - at(pts, i - 1).z,
    );
  return sum;
}

/** The workshop's floor as Pip walks it: the room, round its furniture, kept his radius off both. */
export function workshopNav(): NavGrid {
  return new NavGrid(ROOM, Object.values(FURNITURE), PIP_RADIUS);
}
