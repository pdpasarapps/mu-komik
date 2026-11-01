import { describe, expect, it } from "vitest";
import { parseDimensionRows, parseRealtimeRows } from "@/lib/ga4-rows";

describe("parseRealtimeRows", () => {
  it("keeps dimension rows that only report active users", () => {
    expect(parseRealtimeRows([
      { dimension: "/komik/radjak", activeUsers: 3 },
      { dimension: "Indonesia", activeUsers: 2 },
    ])).toEqual([
      { dimension: "/komik/radjak", activeUsers: 3 },
      { dimension: "Indonesia", activeUsers: 2 },
    ]);
  });

  it("returns an empty list when the payload has no usable rows", () => {
    expect(parseRealtimeRows([])).toEqual([]);
    expect(parseRealtimeRows([{ dimension: "/x", sessions: 4 }])).toEqual([]);
    expect(parseRealtimeRows([null, "x", 3])).toEqual([]);
  });

  it("returns null when the payload is not a list", () => {
    expect(parseRealtimeRows(undefined)).toBeNull();
    expect(parseRealtimeRows({ pages: [] })).toBeNull();
  });
});

describe("parseDimensionRows", () => {
  it("requires both active users and sessions", () => {
    expect(parseDimensionRows([
      { dimension: "mobile", activeUsers: 10, sessions: 12 },
      { dimension: "desktop", activeUsers: 4 },
      { activeUsers: 7, sessions: 7 },
      "nope",
    ])).toEqual([{ dimension: "mobile", activeUsers: 10, sessions: 12 }]);
  });

  it("returns an empty list for an empty payload", () => {
    expect(parseDimensionRows([])).toEqual([]);
  });

  it("returns null when the payload is not a list", () => {
    expect(parseDimensionRows(null)).toBeNull();
    expect(parseDimensionRows("rows")).toBeNull();
  });
});
