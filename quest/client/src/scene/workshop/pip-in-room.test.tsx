// The one director and the workshop's Pip, on the mounted client with the
// Scene on: a Pip the camera has left is told off screen, so he rests and
// no Reaction plays to no one; and a returning Learner's page starts him
// asleep, until the first touch wakes him. The renderer is a stand-in that
// holds Pip as WorkshopPip does: jsdom has no WebGL.
import { fireEvent, waitFor } from "@testing-library/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PipModel } from "../../../pip/contract";
import {
  fullCourse,
  overview,
  overviewAt,
  snapshotOf,
} from "../../../e2e/snapshots";
import { held, renderMounted, type Held } from "../../../test/mounted";
import { drawingTier, LOOK } from "../../../test/scene";
import type { SceneMount } from "../../mount/types";
import { usePipModel } from "../../pip/PipStage";
import { useScenePip } from "../context";

/** A renderer holding Pip, told by the test whether the camera sees him, keeping each model the director gives. */
function holding(inView: Held<boolean>, models: PipModel[]): SceneMount {
  function StandIn(): ReactNode {
    const seen = useSyncExternalStore(
      (listener) => inView.subscribe(listener),
      () => inView.get(),
    );
    useScenePip(seen);
    const model = usePipModel();
    useEffect(() => {
      models.push(model);
    }, [model]);
    return null;
  }
  return {
    load: () => Promise.resolve({ default: StandIn }),
    look: LOOK,
    pip: true,
  };
}

const modeNow = (models: PipModel[]) => models.at(-1)?.mode;

beforeEach(drawingTier);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("a Pip the camera has left is off screen to the director, so he rests, and back in view he is idle again", async () => {
  const inView = held(true);
  const models: PipModel[] = [];
  renderMounted("/journey/", snapshotOf(overview), {
    scene: holding(inView, models),
  });
  await waitFor(() => {
    expect(modeNow(models)).toBe("idle");
  });
  inView.set(false);
  await waitFor(() => {
    expect(modeNow(models)).toBe("rest");
  });
  inView.set(true);
  await waitFor(() => {
    expect(modeNow(models)).toBe("idle");
  });
});

test("a returning Learner's page starts Pip asleep where the Scene runs, and the first touch wakes him", async () => {
  const models: PipModel[] = [];
  renderMounted(
    "/journey/",
    snapshotOf(overviewAt("b-4"), { course: fullCourse }),
    {
      scene: holding(held(true), models),
    },
  );
  await waitFor(() => {
    expect(modeNow(models)).toBe("sleep");
  });
  fireEvent.pointerDown(document.body);
  await waitFor(() => {
    expect(modeNow(models)).toBe("idle");
  });
});
