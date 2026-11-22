// The Scene's quality tier (09 9.2): stills for no WebGL2, reduced motion
// or Save-Data, whichever the device; otherwise a phone or a desktop; and
// each tier's pixel-ratio cap.
import { describe, expect, test } from "vitest";
import {
  DESKTOP_PIXEL_RATIO,
  PHONE_PIXEL_RATIO,
  phoneQuery,
  pixelRatioCap,
  sceneTier,
} from "./tier";

const base = { webgl2: true, reducedMotion: false, saveData: false };

describe("sceneTier", () => {
  test("a desktop gets the full Scene and a phone its own tier", () => {
    expect(sceneTier({ ...base, phone: false })).toBe("desktop");
    expect(sceneTier({ ...base, phone: true })).toBe("phone");
  });

  for (const phone of [false, true])
    test(`stills, on a ${phone ? "phone" : "desktop"}, for no WebGL2, reduced motion or Save-Data`, () => {
      expect(sceneTier({ ...base, phone, webgl2: false })).toBe("still");
      expect(sceneTier({ ...base, phone, reducedMotion: true })).toBe("still");
      expect(sceneTier({ ...base, phone, saveData: true })).toBe("still");
    });
});

test("a phone draws at 1.5 at most and a desktop at 2", () => {
  expect(PHONE_PIXEL_RATIO).toBe(1.5);
  expect(DESKTOP_PIXEL_RATIO).toBe(2);
  expect(pixelRatioCap("phone")).toBe(PHONE_PIXEL_RATIO);
  expect(pixelRatioCap("desktop")).toBe(DESKTOP_PIXEL_RATIO);
});

test("a phone is a coarse pointer in a viewport whose shorter side is under the md breakpoint", () => {
  expect(phoneQuery("48rem")).toBe(
    "(pointer: coarse) and (width < 48rem), (pointer: coarse) and (height < 48rem)",
  );
});
