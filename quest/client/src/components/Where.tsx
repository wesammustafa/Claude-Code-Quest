import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type WhereKind =
  "terminal" | "claude" | "claude-2" | "shell" | "editor" | "browser";

const ICONS: Record<WhereKind, IconName> = {
  terminal: "terminal",
  claude: "claude",
  "claude-2": "claude",
  shell: "shell",
  editor: "editor",
  browser: "browser",
};

export interface WhereProps {
  kind: WhereKind;
  /** Where, in the caller's words: "Your terminal". */
  label: string;
  /** Which one, where a step uses two of a kind (a second Claude Code session). */
  number?: number;
  /** A quieter line after the label: "in your Practice copy". */
  note?: ReactNode;
  /** Where given, the chip is a button that does this (focuses the place). */
  onPress?: () => void;
}

/** Where a step happens: an icon, the place in bold, and a quieter note. */
export function Where({ kind, label, number, note, onPress }: WhereProps) {
  const body = (
    <>
      <Icon name={ICONS[kind]} size="sm" className="text-accent-text" />
      <b>
        {label}
        {number !== undefined && ` ${String(number)}`}
      </b>
      {note !== undefined && <span className="text-muted">{note}</span>}
    </>
  );
  if (onPress)
    return (
      <button
        type="button"
        data-where={kind}
        onClick={onPress}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {body}
      </button>
    );
  return (
    <span
      data-where={kind}
      className="inline-flex items-center gap-1.5 text-sm"
    >
      {body}
    </span>
  );
}
