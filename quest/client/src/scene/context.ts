// What the Scene shares with the rest of the shell (seam S12): whether it
// holds Pip, so the screen's own Pip stands down, and the Scene's move for
// a screen change, which the shell's screen transitions call (seam S11).
// No 3D code here: the screens read it without loading the renderer.
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import type { ScreenChange } from "../mount/types";
import { usePipInput } from "../pip/PipStage";

/** The Scene's own move for a screen change, as `ScreenTransitions.move` plays one. */
export type SceneMove = (change: ScreenChange) => "under" | "instead";

/** One page's Scene: who holds Pip, and the move registered. */
export interface SceneHub {
  /** Whether the Scene holds Pip now. */
  holdsPip: () => boolean;
  /** Called when holdsPip changes. */
  subscribe: (fn: () => void) => () => void;
  /** Marks the Scene as holding Pip until the returned release is called. */
  holdPip: () => () => void;
  /** The move registered, if any. */
  move: () => SceneMove | null;
  /** Registers the move until the returned release is called. */
  setMove: (move: SceneMove) => () => void;
}

export function createSceneHub(): SceneHub {
  let holds = 0;
  let move: SceneMove | null = null;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const fn of [...listeners]) fn();
  };
  return {
    holdsPip: () => holds > 0,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    holdPip: () => {
      holds += 1;
      if (holds === 1) changed();
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        holds -= 1;
        if (holds === 0) changed();
      };
    },
    move: () => move,
    setMove: (next) => {
      move = next;
      return () => {
        if (move === next) move = null;
      };
    },
  };
}

/** Outside a Scene (the Local app, a component on its own) nothing holds Pip. */
const noScene: SceneHub = {
  holdsPip: () => false,
  subscribe: () => () => undefined,
  holdPip: () => () => undefined,
  move: () => null,
  setMove: () => () => undefined,
};

export const SceneContext = createContext<SceneHub>(noScene);

/**
 * Has the Scene hold Pip while the calling component is mounted: the
 * screen's own Pip stands down, so only one Pip is ever on screen. The one
 * director is unchanged: the Scene's Pip reads the same model, and tells it
 * Pip is on screen as the screen's Pip would, and gone once it goes.
 */
export function useScenePip(): void {
  const hub = useContext(SceneContext);
  const send = usePipInput();
  useEffect(() => {
    const release = hub.holdPip();
    send({ type: "onScreen", visible: true });
    return () => {
      release();
      send({ type: "onScreen", visible: false });
    };
  }, [hub, send]);
}

/** Whether the Scene holds Pip at this moment, read when asked rather than followed. */
export function useSceneHoldsPipNow(): () => boolean {
  return useContext(SceneContext).holdsPip;
}

/** Whether the screen's own Pip stands down, because the Scene holds Pip. */
export function usePipStandsDown(): boolean {
  const hub = useContext(SceneContext);
  return useSyncExternalStore(hub.subscribe, hub.holdsPip, () => false);
}

/**
 * Registers the Scene's move for each screen change while the calling
 * component is mounted (a camera move, say), which plays when the mount
 * turns screen transitions on.
 */
export function useSceneMove(move: SceneMove): void {
  const hub = useContext(SceneContext);
  useEffect(() => hub.setMove(move), [hub, move]);
}
