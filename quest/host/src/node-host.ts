// The host on Node (seam S1): the host core with this platform's defaults,
// node:path and the home folder from the environment or the OS, as the
// Local app has always had them.
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { createHost as createCore } from "./host.ts";
import type { Host, HostOptions } from "./types.ts";

export function createHost(options: HostOptions): Host {
  const env = options.env ?? {};
  return createCore({
    ...options,
    home: options.home ?? (env.HOME || env.USERPROFILE || homedir()),
    paths: options.paths ?? { join, resolve, isAbsolute },
  });
}
