import "server-only";

import { createHmac, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
export const KIDS_MODE_COOKIE_NAME = "mu-komik-kids-state";
export const KIDS_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PIN_HASH_ITERATIONS = 310_000;
const PIN_HASH_BYTES = 32;
const MAX_FAILED_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000;

export type KidsModeState = {
  enabled: boolean;
  pinSalt: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: number;
};

function getSigningSecret() {
  const secret = process.env.KIDS_MODE_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("Kids Mode signing secret is missing. Configure KIDS_MODE_COOKIE_SECRET with at least 32 characters.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function isKidsModeState(value: unknown): value is KidsModeState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<KidsModeState>;
  return typeof state.enabled === "boolean"
    && typeof state.pinSalt === "string" && /^[0-9a-f]{32}$/i.test(state.pinSalt)
    && typeof state.pinHash === "string" && /^[0-9a-f]{64}$/i.test(state.pinHash)
    && Number.isInteger(state.failedAttempts) && (state.failedAttempts as number) >= 0 && (state.failedAttempts as number) <= MAX_FAILED_ATTEMPTS
    && Number.isSafeInteger(state.lockedUntil) && (state.lockedUntil as number) >= 0;
}

export function readKidsModeState(token: string | undefined): KidsModeState | null {
  if (!token || token.length > 2048) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;

  const payload = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1), "base64url");
  let expectedSignature: Buffer;
  try {
    expectedSignature = Buffer.from(sign(payload), "base64url");
  } catch (error) {
    console.error("Unable to verify Kids Mode state because its signing key is unavailable:", error);
    return null;
  }
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const state: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return isKidsModeState(state) ? state : null;
  } catch {
    return null;
  }
}

export function signKidsModeState(state: KidsModeState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export async function createKidsModeState(pin: string): Promise<KidsModeState> {
  const pinSalt = randomBytes(16).toString("hex");
  const pinHash = await pbkdf2Async(pin, pinSalt, PIN_HASH_ITERATIONS, PIN_HASH_BYTES, "sha256");
  return {
    enabled: true,
    pinSalt,
    pinHash: pinHash.toString("hex"),
    failedAttempts: 0,
    lockedUntil: 0,
  };
}

export async function checkKidsModePin(pin: string, state: KidsModeState) {
  const candidate = await pbkdf2Async(pin, state.pinSalt, PIN_HASH_ITERATIONS, PIN_HASH_BYTES, "sha256");
  const expected = Buffer.from(state.pinHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function recordFailedKidsModePin(state: KidsModeState): KidsModeState {
  const failedAttempts = Math.min(MAX_FAILED_ATTEMPTS, state.failedAttempts + 1);
  return {
    ...state,
    failedAttempts,
    lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + PIN_LOCKOUT_MS : 0,
  };
}
