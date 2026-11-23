import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SceneTheme } from "../../../mount/types";
import { useBadgeStage } from "../../badges";
import { BadgeDrawer, layerShown } from "./drawer";

/**
 * The Scene's 3D Badges (09 9.3, ticket 53), in the Scene's canvas: it marks
 * the stage as drawn from when the layer shows its frames in full until it
 * unmounts, so the screens' Badges stand down for it only once it can be
 * seen, takes the theme's colours, and on a phone asks for a frame only
 * while something moves, the stage changes, the page scrolls or the layer
 * is still fading in.
 */
export function SceneBadges({ theme }: { theme: SceneTheme }): ReactNode {
  const stage = useBadgeStage();
  const invalidate = useThree((s) => s.invalidate);
  const [drawer] = useState(() => new BadgeDrawer(stage));

  const [visible, setVisible] = useState(false);
  const seen = useRef(false);
  useEffect(() => (visible ? stage.attach() : undefined), [stage, visible]);

  useEffect(() => {
    drawer.recolour();
    invalidate();
  }, [drawer, theme, invalidate]);

  useEffect(() => {
    const again = () => {
      invalidate();
    };
    const off = stage.subscribe(again);
    window.addEventListener("scroll", again, { capture: true, passive: true });
    window.addEventListener("resize", again);
    return () => {
      off();
      window.removeEventListener("scroll", again, { capture: true });
      window.removeEventListener("resize", again);
    };
  }, [stage, invalidate]);

  useEffect(
    () => () => {
      drawer.dispose();
    },
    [drawer],
  );

  useFrame((state, delta) => {
    if (!seen.current) {
      if (layerShown(state.gl.domElement)) {
        seen.current = true;
        setVisible(true);
      } else state.invalidate();
    }
    if (drawer.frame(state, delta)) state.invalidate();
  });

  return <primitive object={drawer.rig} />;
}
