// The client mount (`@quest/client/mount`): the Local app's own entry point
// (main.tsx) mounts the client through it with the page's transport and no
// slot; another page passes its own transport, router, screens and slots.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QuestMotion } from "./components/QuestMotion";
import { restoreSettings } from "./lib/settings";
import { MountContext, type MountValue } from "./mount/context";
import type { ClientMount } from "./mount/types";
import { questRoutes } from "./routes";
import "./styles/app.css";

export type {
  BeatOnScreen,
  ClientMount,
  ClientSlots,
  External,
  InsertRequest,
  InsertResult,
  LessonAccess,
  LiveDeps,
  Notice,
  QuestRouteHandle,
  SceneLook,
  SceneMount,
  SceneProps,
  SceneTheme,
  SceneTier,
  ScreenChange,
  ScreenOnShow,
  ScreenTransitions,
  WhereKind,
} from "./mount/types";
export { Journey } from "./screens/Journey";
export { Welcome } from "./screens/Welcome";

/**
 * Renders the client into `root` on the mount's transport, router, added
 * screens and slots; returns the unmount, which closes the stream and does
 * nothing when called again.
 */
export function mountQuest(root: HTMLElement, mount: ClientMount): () => void {
  const kind = mount.router ?? "hash";
  // Hash URLs leave the path to the server's one page, so a screen added
  // there could never be reloaded.
  if (kind === "hash" && mount.routes !== undefined)
    throw new Error("Added routes need the browser router");

  // The stored theme and motion go on <html> before the first render, so Pip
  // and the first screen start from them.
  restoreSettings();

  const router =
    kind === "browser"
      ? createBrowserRouter(questRoutes(mount.routes))
      : createHashRouter(questRoutes());
  const value: MountValue = {
    router: kind,
    live: mount.live,
    slots: mount.slots ?? {},
    transitions: mount.transitions ?? null,
    scene: mount.scene ?? null,
  };
  const reactRoot = createRoot(root);
  reactRoot.render(
    <StrictMode>
      <MountContext value={value}>
        <QuestMotion>
          {/* A route change renders in one task, not in a transition's slices:
              sliced, every frame between them drew Pip's rig and the Scene
              while the new screen waited, and its enter started about 50 ms
              later (09 9.1's headroom, simulator ticket 52). No route suspends. */}
          <RouterProvider router={router} useTransitions={false} />
        </QuestMotion>
      </MountContext>
    </StrictMode>,
  );
  let mounted = true;
  return () => {
    if (!mounted) return;
    mounted = false;
    reactRoot.unmount();
    router.dispose();
  };
}
