// Path joining as the host core needs it, with no node: module (seam S1):
// posix join, resolve and isAbsolute over "/"-separated paths. The Node
// entry passes node:path instead, so the Local app keeps its platform's.
export interface PathOps {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  isAbsolute(path: string): boolean;
}

function normalize(path: string): string {
  const absolute = path.startsWith("/");
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
      continue;
    }
    out.push(part);
  }
  const body = out.join("/");
  if (absolute) return `/${body}`;
  return body || ".";
}

export const posixPaths: PathOps = {
  join: (...parts) => normalize(parts.filter((p) => p !== "").join("/") || "."),
  resolve: (...parts) => {
    let path = "";
    for (const part of parts) {
      if (part === "") continue;
      path = part.startsWith("/") ? part : path ? `${path}/${part}` : part;
    }
    return normalize(path.startsWith("/") ? path : `/${path}`);
  },
  isAbsolute: (path) => path.startsWith("/"),
};
