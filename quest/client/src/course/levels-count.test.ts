// The Level count the Welcome, Journey and Course complete words give comes
// from the course, so a course of one Level never says three.
import { describe, expect, test } from "vitest";
import { levelsComplete, levelsIntro, seeLevels } from "./labels";

const three = [
  { id: "beginner" },
  { id: "intermediate" },
  { id: "advanced" },
] as const;
const one = [{ id: "beginner" }] as const;

describe("the Level count in the app's words", () => {
  test("three Levels", () => {
    expect(seeLevels(three)).toBe("See all three levels");
    expect(levelsIntro(three)).toBe("Three levels.");
    expect(levelsComplete(three)).toBe("All three levels are complete.");
  });
  test("a course of one Level names it", () => {
    expect(seeLevels(one)).toBe("See the Beginner level");
    expect(levelsIntro(one)).toBe("The Beginner level.");
    expect(levelsComplete(one)).toBe("The Beginner level is complete.");
  });
});
