// The workshop Pip's screen goal: every show sends him to its goal, the
// same goal as the screen before too, so a command that took him elsewhere
// never keeps him from where the next screen wants him; Explore keeps him.
import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { SpotId } from "../../workshop/layout";
import { useScreenGoal } from "./WorkshopPip";

/** The renderer's invalidate: one function for the renderer's life. */
const invalidate = () => undefined;

function walking(explore = false) {
  return { explore, goTo: vi.fn() };
}

test("each show sends him to its goal, a show with the goal the last one had too", () => {
  const walker = walking();
  const first = { screen: "map" };
  const { rerender } = renderHook(
    ({ goal, show }: { goal: SpotId | null; show: unknown }) =>
      useScreenGoal(walker, goal, show, invalidate),
    { initialProps: { goal: "noticeboard", show: first } },
  );
  expect(walker.goTo).toHaveBeenLastCalledWith({ spot: "noticeboard" });
  const sent = walker.goTo.mock.calls.length;
  // The same show again sends nothing: he may be where a command took him.
  rerender({ goal: "noticeboard", show: first });
  expect(walker.goTo).toHaveBeenCalledTimes(sent);
  // Back on a screen with that goal, after a command took him to the bench.
  rerender({ goal: "noticeboard", show: { screen: "map" } });
  expect(walker.goTo).toHaveBeenCalledTimes(sent + 1);
  expect(walker.goTo).toHaveBeenLastCalledWith({ spot: "noticeboard" });
});

test("a show with no goal, or while Explore steers him, sends him nowhere", () => {
  const walker = walking(true);
  const { rerender } = renderHook(
    ({ goal, show }: { goal: SpotId | null; show: unknown }) =>
      useScreenGoal(walker, goal, show, invalidate),
    { initialProps: { goal: "organizer", show: {} } },
  );
  walker.explore = false;
  rerender({ goal: null, show: {} });
  expect(walker.goTo).not.toHaveBeenCalled();
});
