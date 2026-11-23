import type { ReactNode } from "react";
import { IconButton } from "../../components/IconButton";
import { useSoundSwitch } from "./context";

/**
 * The mute control (09 9.5): a toggle button named "Sound", pressed while
 * the sound is on, its icon showing which. Nothing where the page has no
 * sound, as in the Local app. The top bar holds it on every screen with
 * one, and Welcome, which has none, holds it at the same corner
 * (`SoundCorner`).
 */
export function SoundToggle(): ReactNode {
  const sound = useSoundSwitch();
  if (sound === null) return null;
  const { muted, setMuted } = sound;
  return (
    <IconButton
      icon={muted ? "sound-off" : "sound"}
      label="Sound"
      aria-pressed={!muted}
      data-sound-toggle=""
      onClick={() => {
        setMuted(!muted);
      }}
    />
  );
}

/**
 * The mute control where there is no top bar: under the notices, at the
 * top bar's end, on the top bar's own backdrop, since the page scrolls
 * under it.
 */
export function SoundCorner(): ReactNode {
  const sound = useSoundSwitch();
  if (sound === null) return null;
  return (
    <div className="absolute top-full right-4 mt-2.5 rounded-md bg-bg/82 backdrop-blur-md backdrop-saturate-140 max-sm:right-2">
      <SoundToggle />
    </div>
  );
}
