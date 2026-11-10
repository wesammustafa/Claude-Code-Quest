import type { PipScreen } from "./director";

/**
 * The screen a route shows, by the director's names. Welcome is the index;
 * a Lesson's overview is its intro, then its step and its complete screen.
 * Journey is the map; Progress is its own. The rest are other screens.
 * A Step-down shows on the step's route, so the snapshot's phase tells it
 * apart: there Pip is on his Level-up moment. An added route's handle names
 * the screen it reuses.
 */
export function screenFor(
  pathname: string,
  phase?: string,
  handleScreen?: "welcome" | "journey",
): PipScreen {
  if (handleScreen === "welcome") return "welcome";
  if (handleScreen === "journey") return "map";
  if (pathname === "/") return "welcome";
  if (pathname === "/journey") return "map";
  if (pathname === "/progress") return "progress";
  if (/^\/lesson\/[^/]+\/?$/.test(pathname)) return "intro";
  if (/^\/lesson\/[^/]+\/step\/?$/.test(pathname))
    return phase === "step-down" ? "levelup" : "step";
  if (/^\/lesson\/[^/]+\/complete\/?$/.test(pathname)) return "complete";
  if (/^\/level\/[^/]+\/complete\/?$/.test(pathname)) return "levelComplete";
  if (/^\/course\/complete\/?$/.test(pathname)) return "courseComplete";
  return "other";
}
