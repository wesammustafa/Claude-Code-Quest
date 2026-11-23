// Where the Scene's Pip stands (seam S13): the live screen's Pip box, the
// screen's own Pip or the box it left standing down, never the icon and
// never a leaving screen's copy.
import { afterEach, describe, expect, test } from "vitest";
import { findPipSpot, spotShows } from "./pip-spot";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findPipSpot", () => {
  test("finds the screen's Pip, or the box it left once it stood down", () => {
    document.body.innerHTML = `<span data-pip="icon"></span><main><span id="pip" data-pip="hero"></span></main>`;
    expect(findPipSpot()?.id).toBe("pip");
    document.body.innerHTML = `<main><span id="box" data-pip-stood-down="beside"></span></main>`;
    expect(findPipSpot()?.id).toBe("box");
  });

  test("skips a leaving screen's copy, which keeps its empty box", () => {
    document.body.innerHTML = `
      <div data-screen-leaving-layer><div data-screen-leaving><span data-pip-stood-down="hero"></span></div></div>
      <main><span id="live" data-pip-stood-down="beside"></span></main>`;
    expect(findPipSpot()?.id).toBe("live");
  });

  test("prefers the Journey stage's box on the path over the screen's other box, wherever each sits", () => {
    document.body.innerHTML = `
      <div data-screen-leaving><span data-pip-stood-down="beside" data-pip-stage=""></span></div>
      <main>
        <span id="next" data-pip-stood-down="beside"></span>
        <div><span id="stage" data-pip-stood-down="beside" data-pip-stage=""></span></div>
      </main>`;
    expect(findPipSpot()?.id).toBe("stage");
    document.querySelector("#stage")?.remove();
    expect(findPipSpot()?.id).toBe("next");
  });

  test("is null on a screen with no Pip", () => {
    document.body.innerHTML = `<span data-pip="icon"></span><main></main>`;
    expect(findPipSpot()).toBeNull();
  });
});

describe("spotShows", () => {
  test("whether any of the box is in the viewport", () => {
    const box = { x: 10, y: 10, width: 76, height: 76 };
    expect(spotShows(box, 400, 800)).toBe(true);
    expect(spotShows({ ...box, y: -80 }, 400, 800)).toBe(false);
    expect(spotShows({ ...box, y: 800 }, 400, 800)).toBe(false);
    expect(spotShows({ ...box, y: -70 }, 400, 800)).toBe(true);
    expect(spotShows({ ...box, width: 0 }, 400, 800)).toBe(false);
  });
});
