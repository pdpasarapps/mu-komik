const TRIPAY_API_ROOT = "https://tripay.co.id";

export type TripayConfig = {
  mode: "sandbox" | "production";
  apiKey: string;
  privateKey: string;
  merchantCode: string;
  apiBaseUrl: string;
};

export function getTripayConfig(): TripayConfig | null {
  const apiKey = process.env.TRIPAY_API_KEY;
  const privateKey = process.env.TRIPAY_PRIVATE_KEY;
  const merchantCode = process.env.TRIPAY_MERCHANT_CODE;
  const mode = process.env.TRIPAY_MODE ?? "sandbox";
  if (!apiKey || !privateKey || !merchantCode || (mode !== "sandbox" && mode !== "production")) return null;
  return {
    mode,
    apiKey,
    privateKey,
    merchantCode,
    apiBaseUrl: `${TRIPAY_API_ROOT}/api${mode === "sandbox" ? "-sandbox" : ""}`,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function createTripaySignature(value: string, privateKey: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(privateKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function signaturesMatch(expected: string, received: string) {
  if (!/^[0-9a-f]{64}$/i.test(received) || expected.length !== received.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }
  return difference === 0;
}
