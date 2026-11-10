// Seam S6's types (and the Check item they carry), apart from types.ts so a
// host in any realm imports them through @quest/engine/judged: types only,
// and nothing here needs Node's globals.
import type { BeatKey } from "@quest/contract";

// A Check item as a run reports it.
export interface CheckItem {
  index: number;
  text: string;
  pass: boolean;
  hint: string;
  slow?: boolean;
  local?: boolean;
}

// ---- host-judged beats (seam S6) ---------------------------------------------
// A rung of a host-judged beat's ladder: a hint, a choice of prompts that
// opens after `unlockAfterNotYets` Not yets in a row, or the exact text.
export type HostRung =
  | { kind: "hint"; text: string }
  | {
      kind: "choice";
      legend: string;
      unlockAfterNotYets: number;
      options: ChoiceOption[];
    }
  | { kind: "exact"; text: string };
export interface ChoiceOption {
  text: string;
  kind: "right" | "wrong";
  because: string;
}
// A beat whose verdict comes from the host, not from a verify the engine
// runs: its ladder replaces the beat's own hints, in a fixed order.
export interface HostJudgedBeat {
  judge: "host";
  ladder: HostRung[];
}
// A host's verdict on the beat on the card. `done: false` with `pass` is
// a pass that leaves the beat open.
export interface JudgedInput {
  type: "judged";
  beat: BeatKey;
  pass: boolean;
  items: CheckItem[];
  done: boolean;
  note?: string;
}
