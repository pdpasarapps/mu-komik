import { describe, expect, it } from "vitest";
import { createVisitorId, isVisitorId } from "@/lib/visitor-cookie";

describe("isVisitorId", () => {
  it("accepts UUID v4 values", () => {
    expect(isVisitorId("11e1a413-d704-4809-9d70-305fe4d31793")).toBe(true);
    expect(isVisitorId("11E1A413-D704-4809-9D70-305FE4D31793")).toBe(true);
  });

  it("rejects values that are not UUIDs", () => {
    expect(isVisitorId("abc")).toBe(false);
    expect(isVisitorId("")).toBe(false);
    expect(isVisitorId(null)).toBe(false);
    expect(isVisitorId(undefined)).toBe(false);
    expect(isVisitorId("11e1a413-d704-4809-9d70-305fe4d3179")).toBe(false);
  });

  it("rejects UUIDs with an unknown version or variant", () => {
    expect(isVisitorId("11e1a413-d704-9809-9d70-305fe4d31793")).toBe(false);
    expect(isVisitorId("11e1a413-d704-4809-cd70-305fe4d31793")).toBe(false);
  });
});

describe("createVisitorId", () => {
  it("always produces an acceptable visitor id", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(isVisitorId(createVisitorId())).toBe(true);
    }
  });
});
