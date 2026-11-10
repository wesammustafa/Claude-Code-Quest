import type { RouteObject } from "react-router";
import { Journey } from "./screens/Journey";
import { LessonComplete } from "./screens/LessonComplete";
import { CourseComplete, LevelComplete } from "./screens/LevelComplete";
import { LessonOverview } from "./screens/LessonOverview";
import { NotFound } from "./screens/NotFound";
import { Progress } from "./screens/Progress";
import { Welcome } from "./screens/Welcome";
import { Workspace } from "./screens/Workspace";
import { Shell } from "./shell/Shell";

/**
 * Development-only routes: the Pip Playground, where Pip is reviewed and
 * approved (`npm run dev`, then /#/playground). The release build replaces
 * `import.meta.env.DEV` with false and drops the route and its code.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "playground",
        lazy: () => import("./playground/route"),
        // Nothing shows for the moment the page's code loads.
        HydrateFallback: () => null,
      },
    ]
  : [];

/**
 * The screens. The browser owns which screen shows; the engine will own the
 * Learner's place. The app uses hash URLs, so the server serves one page by
 * name and never maps a path to a screen. A mount's added screens (`added`)
 * go inside the shell, before the not-found route. The built-in screens
 * carry no handle: their frame follows the exact path, as it always has, and
 * a handle is how an added route asks for the same frame.
 */
export function questRoutes(added: readonly RouteObject[] = []): RouteObject[] {
  return [
    {
      Component: Shell,
      children: [
        { index: true, Component: Welcome },
        { path: "journey", Component: Journey },
        { path: "lesson/:lessonId", Component: LessonOverview },
        { path: "lesson/:lessonId/step", Component: Workspace },
        { path: "lesson/:lessonId/complete", Component: LessonComplete },
        { path: "progress", Component: Progress },
        { path: "level/:levelId/complete", Component: LevelComplete },
        { path: "course/complete", Component: CourseComplete },
        ...added,
        { path: "*", Component: NotFound },
      ],
    },
    ...devRoutes,
  ];
}

export const routes: RouteObject[] = questRoutes();
