import { createPortal } from "react-dom";
import { Button } from "../components/Button";
import { useExternal, useSlots } from "../mount/context";
import type { Notice } from "../mount/types";

const NONE: readonly Notice[] = [];

const STRIP = "animate-drop border-b border-line bg-surface-2 shadow-sm";
const ROW =
  "mx-auto flex max-w-column flex-wrap items-center gap-x-2.5 gap-y-2 px-5 py-2 text-sm";

/**
 * The mount's notices under the top bar, one strip each, as the page holds
 * them: a waiting one with the breathing dot, an action as a small button.
 * Their words reach screen readers through a polite live region in <body>,
 * kept live while a Panel makes the page inert, as the save notices' are.
 */
export function MountNotices() {
  const store = useSlots().notices;
  const notices = useExternal(store, NONE);
  // The region stays while the mount has notices at all, so the first one
  // is announced; without the slot nothing renders.
  if (store === undefined) return null;
  return (
    <div data-mount-notices="">
      {notices.map((notice) => (
        <div
          key={notice.id}
          data-mount-notice={notice.id}
          data-tone={notice.tone}
          className={STRIP}
        >
          <div className={ROW}>
            {notice.tone === "wait" && (
              <span
                className="inline-block size-2 shrink-0 animate-breathe rounded-full bg-wait"
                aria-hidden="true"
              />
            )}
            <span className="min-w-0">{notice.text}</span>
            {notice.action && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  notice.action?.run();
                }}
              >
                {notice.action.label}
              </Button>
            )}
          </div>
        </div>
      ))}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          data-mount-notices-region=""
          data-keep-live=""
          className="sr-only"
        >
          {notices.map((notice) => (
            <p key={notice.id}>{notice.text}</p>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
