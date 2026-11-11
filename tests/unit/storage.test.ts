import { describe, expect, it } from "vitest";
import { load, save } from "../../src/utils/storage";

describe("storage utilities", () => {
  it("round-trips structured values", () => {
    const value = { skills: ["TypeScript", "React"], complete: false };

    save("test:profile", value);

    expect(load("test:profile", null)).toEqual(value);
  });

  it("returns the fallback for absent or malformed JSON without changing it", () => {
    const fallback = { items: [] as string[] };
    localStorage.setItem("test:malformed", "{broken");

    expect(load("test:missing", fallback)).toBe(fallback);
    expect(load("test:malformed", fallback)).toBe(fallback);
    expect(localStorage.getItem("test:malformed")).toBe("{broken");
  });
});
