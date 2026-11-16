import type { MouseEvent } from "react";
import type { QuestAction, Snapshot } from "@quest/contract";
import { useAct, useActionsEnabled } from "./LiveProvider";

/** What a Button spreads to send one action. */
export interface ActionProps {
  pending: boolean;
  "aria-disabled"?: true;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Sends an action under its key, unless actions are off or the key is
 * already in flight; `then` receives the snapshot an applied answer returns.
 */
export function useSend(): (
  key: string,
  action: QuestAction,
  then?: (snapshot: Snapshot) => void,
) => void {
  const { act, pending } = useAct();
  const enabled = useActionsEnabled();
  return (key, action, then) => {
    if (!enabled || pending(key)) return;
    void act(action, key).then((outcome) => {
      if (outcome.applied) then?.(outcome.snapshot);
    });
  };
}

/**
 * The props of a button that sends `action` under `key`. While actions are
 * off or the key is in flight it is aria-disabled and a click does nothing,
 * but it keeps its place in the tab order and keeps focus (a disabled button
 * would drop it).
 */
export function useActionProps(
  key: string,
  action: QuestAction,
  then?: (snapshot: Snapshot) => void,
): ActionProps {
  const { pending } = useAct();
  const enabled = useActionsEnabled();
  const send = useSend();
  const busy = pending(key);
  return {
    pending: busy,
    ...(!enabled || busy ? { "aria-disabled": true as const } : {}),
    onClick: () => {
      send(key, action, then);
    },
  };
}
