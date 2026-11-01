import { describe, expect, test } from "bun:test";
import { inferSourceIcon, resolveSourceIcon } from "../apps/dashboard/src/lib/source-icons";

describe("source icon inference", () => {
  test("recognizes platform names without treating ordinary words as platforms", () => {
    for (const [name, icon] of [
      ["Orbit iOS app", "ios"],
      ["Orbit ANDROID", "android"],
      ["AndroidApp", "android"],
      ["Orbit CLI", "terminal"],
      ["orbitCLI", "terminal"],
      ["orbit_ios", "ios"],
      ["orbit_android", "android"],
      ["CLI tools", "terminal"],
      ["Website", "website"],
      ["orbit.example", "website"],
      ["WebApp", "website"],
      ["Payments API", "server"],
      ["macOS app", "desktop"],
      ["Browser extension", "website"],
      ["TypeScript SDK", "package"],
      ["Game app", "game"],
      ["Tablet", "mobile"],
      ["Client", "generic"],
      ["Appetite", "generic"],
      ["Cliff", "generic"],
      ["", "generic"],
    ] as const)
      expect(inferSourceIcon(name)).toBe(icon);
  });
  test("automatic icons follow renames while explicit choices stay pinned", () => {
    expect(resolveSourceIcon({ name: "iOS app", icon: null })).toBe("ios");
    expect(resolveSourceIcon({ name: "Android app", icon: null })).toBe("android");
    expect(resolveSourceIcon({ name: "Android app", icon: "ios" })).toBe("ios");
    expect(resolveSourceIcon({ name: "Website", icon: "generic" })).toBe("generic");
  });
});
