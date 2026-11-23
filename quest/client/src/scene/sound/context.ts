// What the Scene's sound shares with the screens and the Scene's renderer:
// the cues to play and the mute choice. No audio here until a page with the
// Scene plays a cue. The renderer imports it from here rather than through
// @quest/client/scene, so the Scene's stills, drawn from the renderer's
// sources, do not depend on it.
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import type { SoundCue } from "./cues";
import type { PlayOptions, SoundEngine, SoundPlay } from "./engine";

export type { SoundCue } from "./cues";
export type { PlayOptions, SoundPlay } from "./engine";

/** Null outside a page with the Scene on, as in the Local app: no sound and no mute control. */
export const SoundContext = createContext<SoundEngine | null>(null);

const SILENT: SoundPlay = { stop: () => undefined };
const NO_SUBSCRIPTION = () => () => undefined;

/**
 * The Scene's named cues, for a moment the screen shows: the Badge reveal
 * and the Level run call it as they play. The returned `stop` cuts the cue
 * short, as a skipped moment does. Outside the Scene it plays nothing.
 */
export function useSceneSound(): (
  cue: SoundCue,
  options?: PlayOptions,
) => SoundPlay {
  const engine = useContext(SoundContext);
  return useCallback(
    (cue, options) => (engine === null ? SILENT : engine.play(cue, options)),
    [engine],
  );
}

/** The mute choice where the page has sound, or null where it has none. */
export function useSoundSwitch(): {
  muted: boolean;
  setMuted: (muted: boolean) => void;
} | null {
  const engine = useContext(SoundContext);
  const muted = useSyncExternalStore(
    engine?.subscribe ?? NO_SUBSCRIPTION,
    () => engine?.muted() ?? false,
    () => false,
  );
  const setMuted = useCallback(
    (next: boolean) => {
      engine?.setMuted(next);
    },
    [engine],
  );
  return engine === null ? null : { muted, setMuted };
}
