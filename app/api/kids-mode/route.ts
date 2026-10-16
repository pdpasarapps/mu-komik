import { NextRequest, NextResponse } from "next/server";
import {
  checkKidsModePin,
  createKidsModeState,
  KIDS_MODE_COOKIE_MAX_AGE,
  KIDS_MODE_COOKIE_NAME,
  readKidsModeState,
  recordFailedKidsModePin,
  signKidsModeState,
  type KidsModeState,
} from "@/lib/kids-mode";

export const runtime = "nodejs";

type KidsModeRequest =
  | { action: "setup"; pin: string; confirmPin: string }
  | { action: "enable" }
  | { action: "disable"; pin: string };

function isKidsModeRequest(value: unknown): value is KidsModeRequest {
  if (!value || typeof value !== "object" || !("action" in value) || typeof value.action !== "string") return false;
  if (value.action === "setup") {
    return "pin" in value && typeof value.pin === "string"
      && "confirmPin" in value && typeof value.confirmPin === "string";
  }
  if (value.action === "enable") return true;
  return value.action === "disable" && "pin" in value && typeof value.pin === "string";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function attachStateCookie(response: NextResponse, state: KidsModeState, request: NextRequest) {
  response.cookies.set(KIDS_MODE_COOKIE_NAME, signKidsModeState(state), {
    httpOnly: true,
    maxAge: KIDS_MODE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
  });
  response.cookies.set("mu-komik-kids-mode", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError("Cross-site requests are not allowed", 403);
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return jsonError("Cross-origin requests are not allowed", 403);
    }
  } catch {
    return jsonError("Invalid request origin", 403);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 1024) return jsonError("Request body is too large", 413);
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid JSON request body", 400);
  }
  if (!isKidsModeRequest(body)) return jsonError("Invalid Kids Mode request", 400);

  const signingSecret = process.env.KIDS_MODE_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!signingSecret || Buffer.byteLength(signingSecret) < 32) {
    return jsonError("Kids Mode belum dikonfigurasi di server. Atur secret KIDS_MODE_COOKIE_SECRET minimal 32 karakter.", 503);
  }

  let state: KidsModeState | null;
  try {
    state = readKidsModeState(request.cookies.get(KIDS_MODE_COOKIE_NAME)?.value);
    if (body.action === "setup") {
      if (state) return jsonError("A parent PIN has already been configured.", 409);
      if (!/^\d{6}$/.test(body.pin)) return jsonError("PIN harus terdiri dari 6 angka.", 400);
      if (body.pin !== body.confirmPin) return jsonError("Konfirmasi PIN tidak cocok.", 400);
      const newState = await createKidsModeState(body.pin);
      return attachStateCookie(NextResponse.json({ enabled: true }, { headers: { "Cache-Control": "no-store" } }), newState, request);
    }

    if (!state) return jsonError("Parent PIN is not configured. Set it up before changing Kids Mode.", 409);
    if (body.action === "enable") {
      const nextState = { ...state, enabled: true };
      return attachStateCookie(NextResponse.json({ enabled: true }, { headers: { "Cache-Control": "no-store" } }), nextState, request);
    }

    if (!/^\d{6}$/.test(body.pin)) return jsonError("Masukkan PIN 6 angka.", 400);
    if (state.lockedUntil > Date.now()) {
      const remainingSeconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      return jsonError(`Terlalu banyak percobaan. Coba lagi dalam ${remainingSeconds} detik.`, 429);
    }
    if (!await checkKidsModePin(body.pin, state)) {
      const failedState = recordFailedKidsModePin(state);
      const remainingAttempts = Math.max(0, 5 - failedState.failedAttempts);
      const message = remainingAttempts
        ? `PIN salah. Sisa percobaan: ${remainingAttempts}.`
        : "PIN salah. Pengaturan dikunci sementara selama 5 menit.";
      return attachStateCookie(jsonError(message, remainingAttempts ? 401 : 429), failedState, request);
    }

    const disabledState = { ...state, enabled: false, failedAttempts: 0, lockedUntil: 0 };
    return attachStateCookie(NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } }), disabledState, request);
  } catch (error) {
    console.error("Unable to update Kids Mode:", error);
    return jsonError("Kids Mode belum dapat diperbarui. Coba lagi sebentar.", 500);
  }
}
