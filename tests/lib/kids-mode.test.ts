import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkKidsModePin,
  createKidsModeState,
  readKidsModeState,
  recordFailedKidsModePin,
  signKidsModeState,
  type KidsModeState,
} from "@/lib/kids-mode";

const SECRET = "test-kids-mode-signing-secret-0123456789";
const OTHER_SECRET = "another-kids-mode-secret-0123456789ab";

function sampleState(overrides: Record<string, unknown> = {}): KidsModeState {
  return {
    enabled: true,
    pinSalt: "a".repeat(32),
    pinHash: "b".repeat(64),
    failedAttempts: 0,
    lockedUntil: 0,
    ...overrides,
  } as KidsModeState;
}

beforeEach(() => {
  vi.stubEnv("KIDS_MODE_COOKIE_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signed state cookie", () => {
  it("round-trips a valid state", () => {
    const state = sampleState({ failedAttempts: 3, lockedUntil: 1234 });
    expect(readKidsModeState(signKidsModeState(state))).toEqual(state);
  });

  it("rejects a payload whose signature does not match", () => {
    const token = signKidsModeState(sampleState());
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from(
      JSON.stringify(sampleState({ enabled: false })),
    ).toString("base64url")}.${signature}`;

    expect(readKidsModeState(forged)).toBeNull();
    expect(readKidsModeState(`${payload}.${signature.slice(0, -2)}xx`)).toBeNull();
    expect(token).not.toBe(forged);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signKidsModeState(sampleState());
    vi.stubEnv("KIDS_MODE_COOKIE_SECRET", OTHER_SECRET);

    expect(readKidsModeState(token)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(readKidsModeState(undefined)).toBeNull();
    expect(readKidsModeState("")).toBeNull();
    expect(readKidsModeState("no-separator")).toBeNull();
    expect(readKidsModeState(`${"a".repeat(2050)}.x`)).toBeNull();
  });

  it("rejects signed payloads that do not match the expected shape", () => {
    const invalidStates = [
      { enabled: "yes" },
      { pinSalt: "zz" },
      { pinHash: "b".repeat(63) },
      { failedAttempts: 6 },
      { failedAttempts: -1 },
      { failedAttempts: 1.5 },
      { lockedUntil: -5 },
    ];

    for (const overrides of invalidStates) {
      const token = signKidsModeState(sampleState(overrides));
      expect(readKidsModeState(token), JSON.stringify(overrides)).toBeNull();
    }
  });

  it("fails closed when the signing secret is missing", () => {
    const token = signKidsModeState(sampleState());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("KIDS_MODE_COOKIE_SECRET", "");

    expect(readKidsModeState(token)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    expect(() => signKidsModeState(sampleState())).toThrow(/KIDS_MODE_COOKIE_SECRET/);
  });

  it("rejects a secret shorter than 32 characters", () => {
    vi.stubEnv("KIDS_MODE_COOKIE_SECRET", "too-short");

    expect(() => signKidsModeState(sampleState())).toThrow(/at least 32 characters/);
  });
});

describe("PIN handling", () => {
  it("creates a hashed state that verifies the chosen PIN", async () => {
    const state = await createKidsModeState("123456");

    expect(state.enabled).toBe(true);
    expect(state.failedAttempts).toBe(0);
    expect(state.lockedUntil).toBe(0);
    expect(state.pinSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(state.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await checkKidsModePin("123456", state)).toBe(true);
    expect(await checkKidsModePin("654321", state)).toBe(false);
  });

  it("salts independently so identical PINs hash differently", async () => {
    const first = await createKidsModeState("123456");
    const second = await createKidsModeState("123456");

    expect(first.pinSalt).not.toBe(second.pinSalt);
    expect(first.pinHash).not.toBe(second.pinHash);
  });

  it("locks after five failed attempts and stays clamped", () => {
    const before = Date.now();
    let state = sampleState();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      state = recordFailedKidsModePin(state);
      expect(state.failedAttempts).toBe(attempt);
      expect(state.lockedUntil).toBe(0);
    }

    state = recordFailedKidsModePin(state);
    expect(state.failedAttempts).toBe(5);
    expect(state.lockedUntil).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(state.lockedUntil).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);

    state = recordFailedKidsModePin(state);
    expect(state.failedAttempts).toBe(5);
    expect(state.enabled).toBe(true);
  });
});
