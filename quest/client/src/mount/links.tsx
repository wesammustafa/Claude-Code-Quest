// The client's links and navigation: under the browser router every path is
// written with its trailing `/`, so an href opened in a new tab, copied or
// loaded without the script names the page the server holds. Screens import
// Link, NavLink and useQuestNavigate from here, never from react-router.
import { type ComponentProps, useCallback } from "react";
import {
  type NavigateOptions,
  Link as RouterLink,
  NavLink as RouterNavLink,
  type To,
  useNavigate,
} from "react-router";
import { useMount } from "./context";

/** `path` with a `/` before its search and hash, unless it already ends in one. */
export function slashPath(path: string): string {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const rest = cut === -1 ? "" : path.slice(cut);
  if (pathname === "" || pathname.endsWith("/")) return path;
  return `${pathname}/${rest}`;
}

/** A `to` written as the router writes paths. */
export function useRouterTo(): (to: To) => To {
  const { router } = useMount();
  return useCallback(
    (to: To) => {
      if (router !== "browser") return to;
      if (typeof to === "string") return slashPath(to);
      return to.pathname === undefined
        ? to
        : { ...to, pathname: slashPath(to.pathname) };
    },
    [router],
  );
}

export function Link({ to, ...rest }: ComponentProps<typeof RouterLink>) {
  const routerTo = useRouterTo();
  return <RouterLink to={routerTo(to)} {...rest} />;
}

export function NavLink({ to, ...rest }: ComponentProps<typeof RouterNavLink>) {
  const routerTo = useRouterTo();
  return <RouterNavLink to={routerTo(to)} {...rest} />;
}

/** useNavigate, writing paths as the router writes them. */
export function useQuestNavigate(): (
  to: To,
  options?: NavigateOptions,
) => void | Promise<void> {
  const navigate = useNavigate();
  const routerTo = useRouterTo();
  return useCallback(
    (to: To, options?: NavigateOptions) => navigate(routerTo(to), options),
    [navigate, routerTo],
  );
}
