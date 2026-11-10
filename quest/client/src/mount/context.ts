import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useLocation, useMatches, useNavigate } from "react-router";
import type { WhereKind } from "../components/Where";
import type { LiveDeps } from "../live/store";
import type { ClientSlots, External, QuestRouteHandle } from "./types";

export interface MountValue {
  router: "hash" | "browser";
  /** Null where the client was rendered without a mount (a test's own router): the page's globals then. */
  live: LiveDeps | null;
  slots: ClientSlots;
}

/** Without a mount the client is the Local app: the hash router, the page's transport, no slot. */
export const MountContext = createContext<MountValue>({
  router: "hash",
  live: null,
  slots: {},
});

export function useMount(): MountValue {
  return useContext(MountContext);
}

export function useSlots(): ClientSlots {
  return useContext(MountContext).slots;
}

const NO_SUBSCRIPTION = () => () => undefined;

/** A page-held value, read as it changes; `fallback` where the page holds none. */
export function useExternal<T>(store: External<T> | undefined, fallback: T): T {
  const subscribe = useCallback(
    (fn: () => void) => (store ? store.subscribe(fn) : NO_SUBSCRIPTION()),
    [store],
  );
  return useSyncExternalStore(subscribe, () =>
    store ? store.get() : fallback,
  );
}

/**
 * The path that names the screen: under the browser router every path ends
 * in `/`, which is dropped here, so a screen compares `/journey` either way.
 */
export function useScreenPath(): string {
  const { pathname } = useLocation();
  const { router } = useMount();
  if (router !== "browser" || pathname === "/" || !pathname.endsWith("/"))
    return pathname;
  return pathname.slice(0, -1);
}

/** The path a screen navigates to, written as the router writes paths. */
export function useRouterPath(): (path: string) => string {
  const { router } = useMount();
  return useCallback(
    (path: string) =>
      router === "browser" && !path.endsWith("/") ? `${path}/` : path,
    [router],
  );
}

/**
 * Under the browser router a path without its trailing `/` is replaced
 * with it before paint, so every screen has one URL and a reload of it is
 * served the same page.
 */
export function useTrailingSlash(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { router } = useMount();
  const { pathname, search, hash } = location;
  const state: unknown = location.state;
  useLayoutEffect(() => {
    if (router !== "browser" || pathname.endsWith("/")) return;
    void navigate(
      { pathname: `${pathname}/`, search, hash },
      { replace: true, state, preventScrollReset: true },
    );
  }, [router, pathname, search, hash, state, navigate]);
}

/**
 * The handles of every matched route, merged, the deepest route's winning:
 * read once by the shell, inside the data router, and passed down through
 * RouteHandleContext, so a part rendered without one reads `{}`.
 */
export function useMatchedHandle(): QuestRouteHandle {
  const matches = useMatches();
  let merged: QuestRouteHandle = {};
  for (const match of matches)
    if (match.handle !== null && typeof match.handle === "object")
      merged = { ...merged, ...(match.handle as QuestRouteHandle) };
  const { screen, settings } = merged;
  return useMemo(
    () => ({
      ...(screen !== undefined ? { screen } : {}),
      ...(settings !== undefined ? { settings } : {}),
    }),
    [screen, settings],
  );
}

export const RouteHandleContext = createContext<QuestRouteHandle>({});

export function useRouteHandle(): QuestRouteHandle {
  return useContext(RouteHandleContext);
}

/** The Where a Step's commands are typed at: set around the Lesson column, null elsewhere (Insert is offered only inside it). */
export const CommandTargetContext = createContext<{
  where: WhereKind | null;
  terminal: number | null;
} | null>(null);

/**
 * Whether Lesson `lesson` may start, as a plain value so the hook sees the
 * same one until the mount's store says it changed: `"open"` without the slot.
 */
export function useLessonAccess(
  lesson: string,
): "open" | "keep-going" | "needs-connection" {
  const store = useSlots().lessonAccess;
  const subscribe = useCallback(
    (fn: () => void) => (store ? store.subscribe(fn) : NO_SUBSCRIPTION()),
    [store],
  );
  return useSyncExternalStore(subscribe, () => {
    const access = store?.get(lesson);
    return access === undefined || access.open ? "open" : access.offer;
  });
}
