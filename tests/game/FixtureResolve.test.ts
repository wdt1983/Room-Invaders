import { describe, it, expect } from "vitest";
import { resolveFixture, isBossFixture } from "@/game/fixtures/npc-rooms";

describe("Boss Fixtures Resolution Test", () => {
  it("should check if isBossFixture works", () => {
    console.log("isBossFixture('boss-ironjaw') =", isBossFixture("boss-ironjaw"));
    expect(isBossFixture("boss-ironjaw")).toBe(true);
  });

  it("should resolve boss-ironjaw fixture", () => {
    const fixture = resolveFixture("boss-ironjaw");
    console.log("Resolved boss-ironjaw:", JSON.stringify(fixture, null, 2));
    expect(fixture).toBeDefined();
    expect(fixture.id).toBe("boss-ironjaw");
    expect((fixture as any).boss).toBeDefined();
  });
});
