import { describe, expect, it } from "vitest";
import { createCreatorHandle, isValidCreatorHandle } from "@/lib/creator-handle";

describe("createCreatorHandle", () => {
  it("lowercases and joins words with a single dash", () => {
    expect(createCreatorHandle("Aiman Senja")).toBe("aiman-senja");
  });

  it("strips diacritics", () => {
    expect(createCreatorHandle("Komik Ünïcode Çà")).toBe("komik-unicode-ca");
  });

  it("collapses repeated separators and trims the edges", () => {
    expect(createCreatorHandle("  !!Radjak -- Studio!!  ")).toBe("radjak-studio");
  });

  it("caps the handle at 40 characters without a trailing dash", () => {
    const handle = createCreatorHandle(`${"a".repeat(39)}-b`);

    expect(handle).toBe("a".repeat(39));
    expect(handle.length).toBe(39);
  });
});

describe("isValidCreatorHandle", () => {
  it("accepts hyphen-separated lowercase handles", () => {
    expect(isValidCreatorHandle("aiman-senja")).toBe(true);
    expect(isValidCreatorHandle("radjak2")).toBe(true);
  });

  it("rejects handles outside the length limits", () => {
    expect(isValidCreatorHandle("ab")).toBe(false);
    expect(isValidCreatorHandle("a".repeat(41))).toBe(false);
  });

  it("rejects characters and separators that are not allowed", () => {
    expect(isValidCreatorHandle("Aiman")).toBe(false);
    expect(isValidCreatorHandle("aiman--senja")).toBe(false);
    expect(isValidCreatorHandle("-aiman")).toBe(false);
    expect(isValidCreatorHandle("aiman senja")).toBe(false);
    expect(isValidCreatorHandle("aiman_senja")).toBe(false);
  });
});
