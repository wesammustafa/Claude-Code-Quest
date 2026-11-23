// The leaving copy's canvases (09 9.1, ticket 52's headroom): a canvas's
// last frame reaches its copy as an image bitmap where the page offers one,
// so nothing reads a WebGL canvas's pixels back while the new screen
// renders; elsewhere it is drawn at once, as before.
import { afterEach, expect, test, vi } from "vitest";
import { copyLeaving, showLeaving } from "./leaving";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** A screen holding one canvas with a size and a box, as Pip's rig is. */
function screenWithCanvas(): { screen: HTMLElement; from: HTMLCanvasElement } {
  const screen = document.createElement("div");
  const from = document.createElement("canvas");
  from.width = 152;
  from.height = 152;
  vi.spyOn(from, "getBoundingClientRect").mockReturnValue({
    width: 76,
    height: 76,
  } as DOMRect);
  screen.append(from);
  document.body.append(screen);
  return { screen, from };
}

test("a canvas's frame reaches its copy as an image bitmap, with no pixel read", async () => {
  const { screen, from } = screenWithCanvas();
  const copy = copyLeaving(screen);
  const to = copy.canvases[0]?.to;
  if (!to) throw new Error("the canvas was not copied");
  const frame = { width: 152, height: 152, close: () => undefined };
  const bitmap = vi.fn(() => Promise.resolve(frame));
  vi.stubGlobal("createImageBitmap", bitmap);
  const transfer = vi.fn();
  const drawImage = vi.fn();
  vi.spyOn(to, "getContext").mockImplementation(((kind: string) =>
    kind === "bitmaprenderer"
      ? { transferFromImageBitmap: transfer }
      : { drawImage }) as unknown as HTMLCanvasElement["getContext"]);
  const layer = document.createElement("div");
  document.body.append(layer);
  showLeaving(layer, copy, 360, () => undefined);
  expect(bitmap).toHaveBeenCalledWith(from);
  expect(drawImage).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    expect(transfer).toHaveBeenCalledWith(frame);
  });
});

test("where the page has no image bitmaps, the frame is drawn at once", () => {
  const { screen, from } = screenWithCanvas();
  const copy = copyLeaving(screen);
  const to = copy.canvases[0]?.to;
  if (!to) throw new Error("the canvas was not copied");
  vi.stubGlobal("createImageBitmap", undefined);
  const drawImage = vi.fn();
  vi.spyOn(to, "getContext").mockReturnValue({
    drawImage,
  } as unknown as RenderingContext);
  const layer = document.createElement("div");
  document.body.append(layer);
  showLeaving(layer, copy, 360, () => undefined);
  expect(drawImage).toHaveBeenCalledWith(from, 0, 0);
});
