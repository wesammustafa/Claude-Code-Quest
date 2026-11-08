// A folder path as the learner typed or pasted it, in full: quotes around
// it and the shell's `\ ` for a space (a folder dragged onto the terminal)
// come off, `~` is the home folder, and a relative path is from the copy,
// as npm run check reads one. Pure (seam S1): the path functions are given.
import type { PathOps } from "./paths.ts";

export function folderPathWith(
  paths: Pick<PathOps, "join" | "resolve">,
  text: string,
  root: string,
  home: string,
  win32: boolean,
): string {
  let path = text.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!win32) path = path.replace(/\\ /g, " ");
  if (path === "~" || /^~[\\/]/.test(path))
    path = paths.join(home, path.slice(1));
  return paths.resolve(root, path);
}
