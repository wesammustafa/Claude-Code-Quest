import { pageLiveDeps } from "./live/LiveProvider";
import { mountQuest } from "./mount";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");

// The default mount: the Local app on the page's own transport, no slot.
mountQuest(root, { live: pageLiveDeps() });
