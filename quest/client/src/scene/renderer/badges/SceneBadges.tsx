import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState, type ReactNode } from "react";
import type { SceneTheme } from "../../../mount/types";
import { useBadgeStage } from "../../badges";
import { BadgeDrawer } from "./drawer";

/**
 * The Scene's 3D Badges (09 9.3, ticket 53), in the Scene's canvas: it marks
 * the stage as drawn while it is mounted, so the screens' Badges stand down
 * for it, takes the theme's colours, and on a phone asks for a frame only
 * while something moves, the stage changes or the page scrolls.
 */
export function SceneBadges({ theme }: { theme: SceneTheme }): ReactNode {
  const stage = useBadgeStage();
  const invalidate = useThree((s) => s.invalidate);
  const [drawer] = useState(() => new BadgeDrawer(stage));

  useEffect(() => stage.attach(), [stage]);

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
    if (drawer.frame(state, delta)) state.invalidate();
  });

  return <primitive object={drawer.rig} />;
}
