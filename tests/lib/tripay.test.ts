import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTripaySignature,
  getTripayConfig,
  signaturesMatch,
} from "@/lib/tripay";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createTripaySignature", () => {
  it("returns the lowercase hex HMAC-SHA256 of the payload", async () => {
    const expected = createHmac("sha256", "private-key").update("merchant:order:amount").digest("hex");

    expect(await createTripaySignature("merchant:order:amount", "private-key")).toBe(expected);
  });

  it("handles non-ASCII payloads byte for byte", async () => {
    const payload = "MT-1234:Komik Ünïcode";
    const expected = createHmac("sha256", "kunci-rahasia").update(payload, "utf8").digest("hex");

    expect(await createTripaySignature(payload, "kunci-rahasia")).toBe(expected);
  });
});

describe("signaturesMatch", () => {
  const valid = "a".repeat(64);

  it("accepts an identical signature", () => {
    expect(signaturesMatch(valid, valid)).toBe(true);
  });

  it("rejects a mismatched signature", () => {
    expect(signaturesMatch(valid, `${"a".repeat(63)}b`)).toBe(false);
  });

  it("rejects values that are not 64 hex characters", () => {
    expect(signaturesMatch(valid, "g".repeat(64))).toBe(false);
    expect(signaturesMatch(valid, "a".repeat(63))).toBe(false);
    expect(signaturesMatch(valid, "")).toBe(false);
  });
});

describe("getTripayConfig", () => {
  function stubEnv(overrides: Record<string, string> = {}) {
    const values: Record<string, string> = {
      TRIPAY_API_KEY: "key",
      TRIPAY_PRIVATE_KEY: "secret",
      TRIPAY_MERCHANT_CODE: "T123",
      TRIPAY_MODE: "sandbox",
      ...overrides,
    };
    for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
  }

  it("defaults to the sandbox API root", () => {
    stubEnv();

    expect(getTripayConfig()).toMatchObject({
      mode: "sandbox",
      apiBaseUrl: "https://tripay.co.id/api-sandbox",
      merchantCode: "T123",
    });
  });

  it("uses the production API root when configured", () => {
    stubEnv({ TRIPAY_MODE: "production" });

    expect(getTripayConfig()?.apiBaseUrl).toBe("https://tripay.co.id/api");
  });

  it("returns null when a required variable is missing", () => {
    stubEnv({ TRIPAY_API_KEY: "" });

    expect(getTripayConfig()).toBeNull();
  });

  it("returns null for an unknown mode", () => {
    stubEnv({ TRIPAY_MODE: "staging" });

    expect(getTripayConfig()).toBeNull();
  });
});
