import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState, type ReactNode } from "react";
import type { SceneTheme } from "../../../mount/types";
import { useBadgeStage } from "../../badges";
import { BadgeDrawer, layerShown } from "./drawer";

/**
 * The Scene's 3D Badges (09 9.3, ticket 53), in the Scene's canvas: it marks
 * the stage as drawn from when the layer shows its frames in full until it
 * unmounts, so the screens' Badges stand down for it only once it can be
 * seen, takes the theme's colours, and on a phone asks for a frame only
 * while something moves, the stage changes or the page scrolls.
 */
export function SceneBadges({ theme }: { theme: SceneTheme }): ReactNode {
  const stage = useBadgeStage();
  const invalidate = useThree((s) => s.invalidate);
  const [drawer] = useState(() => new BadgeDrawer(stage));

  const canvas = useThree((s) => s.gl.domElement);
  const [visible, setVisible] = useState(false);
  // Checked on the page's own frames, not the Scene's: the layer's fade
  // runs on while a stopped Scene draws nothing.
  useEffect(() => {
    if (visible) return stage.attach();
    let frame = requestAnimationFrame(function check() {
      if (layerShown(canvas)) setVisible(true);
      else frame = requestAnimationFrame(check);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [stage, visible, canvas]);

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
