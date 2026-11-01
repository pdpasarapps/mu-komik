import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/kids-mode/route";
import { createKidsModeState, signKidsModeState, type KidsModeState } from "@/lib/kids-mode";

const SECRET = "route-test-kids-mode-secret-0123456789";

type RequestOptions = {
  headers?: Record<string, string | null>;
  body?: unknown;
  raw?: string;
  state?: string;
};

function buildRequest({ headers = {}, body, raw, state }: RequestOptions = {}) {
  const merged: Record<string, string> = {
    origin: "https://mu-komik.com",
    host: "mu-komik.com",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    ...headers,
  };
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(merged)) {
    if (value === null) continue;
    requestHeaders.set(name, value);
  }
  if (state) requestHeaders.set("cookie", `mu-komik-kids-state=${state}`);

  return new NextRequest("https://mu-komik.com/api/kids-mode", {
    method: "POST",
    headers: requestHeaders,
    body: raw ?? JSON.stringify(body),
  });
}

async function post(options: RequestOptions = {}) {
  const response = await POST(buildRequest(options));
  return {
    status: response.status,
    body: await response.json() as { enabled?: boolean; error?: string },
    stateCookie: response.cookies.get("mu-komik-kids-state")?.value,
    setCookie: response.headers.get("set-cookie") ?? "",
  };
}

async function signedState(pin = "123456", overrides: Partial<KidsModeState> = {}) {
  const state = { ...await createKidsModeState(pin), ...overrides };
  return { state, token: signKidsModeState(state) };
}

beforeEach(() => {
  vi.stubEnv("KIDS_MODE_COOKIE_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("origin and transport guards", () => {
  it("rejects requests without an Origin header", async () => {
    const result = await post({ headers: { origin: null }, body: { action: "enable" } });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Cross-site requests are not allowed");
  });

  it("rejects cross-site requests", async () => {
    const result = await post({ headers: { "sec-fetch-site": "cross-site" }, body: { action: "enable" } });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Cross-site requests are not allowed");
  });

  it("rejects an Origin that does not match the host", async () => {
    const result = await post({ headers: { origin: "https://evil.example" }, body: { action: "enable" } });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Cross-origin requests are not allowed");
  });

  it("rejects an unparsable Origin", async () => {
    const result = await post({ headers: { origin: "not-a-url" }, body: { action: "enable" } });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Invalid request origin");
  });

  it("rejects oversized bodies", async () => {
    const result = await post({ raw: `{"action":"enable","pad":"${"x".repeat(1500)}"}` });

    expect(result.status).toBe(413);
    expect(result.body.error).toBe("Request body is too large");
  });

  it("rejects invalid JSON and unknown actions", async () => {
    expect((await post({ raw: "{" })).body.error).toBe("Invalid JSON request body");
    expect((await post({ body: { action: "explode" } })).body.error).toBe("Invalid Kids Mode request");
    expect((await post({ body: { action: "setup", pin: "123456" } })).status).toBe(400);
  });

  it("refuses to run without a configured secret", async () => {
    vi.stubEnv("KIDS_MODE_COOKIE_SECRET", "");

    const result = await post({ body: { action: "enable" } });

    expect(result.status).toBe(503);
    expect(result.body.error).toContain("KIDS_MODE_COOKIE_SECRET");
  });
});

describe("first-time setup", () => {
  it("rejects PINs that are not six digits", async () => {
    expect((await post({ body: { action: "setup", pin: "12345", confirmPin: "12345" } })).body.error)
      .toBe("PIN harus terdiri dari 6 angka.");
    expect((await post({ body: { action: "setup", pin: "abcdef", confirmPin: "abcdef" } })).status)
      .toBe(400);
  });

  it("rejects a mismatched confirmation", async () => {
    const result = await post({ body: { action: "setup", pin: "123456", confirmPin: "654321" } });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Konfirmasi PIN tidak cocok.");
  });

  it("stores the state in a signed httpOnly cookie", async () => {
    const result = await post({ body: { action: "setup", pin: "123456", confirmPin: "123456" } });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ enabled: true });
    expect(result.stateCookie).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(result.setCookie).toContain("HttpOnly");
    expect(result.setCookie).toContain("SameSite=strict");
    expect(result.setCookie).toContain("Path=/");
    expect(result.setCookie).toContain("mu-komik-kids-mode=");
  });

  it("cannot be run a second time", async () => {
    const { token } = await signedState();

    const result = await post({ state: token, body: { action: "setup", pin: "123456", confirmPin: "123456" } });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("A parent PIN has already been configured.");
  });
});

describe("enabling and disabling", () => {
  it("requires a configured PIN before changes", async () => {
    const enable = await post({ body: { action: "enable" } });
    expect(enable.status).toBe(409);
    expect(enable.body.error).toBe("Parent PIN is not configured. Set it up before changing Kids Mode.");

    const disable = await post({ body: { action: "disable", pin: "123456" } });
    expect(disable.status).toBe(409);
  });

  it("enables Kids Mode with the stored state", async () => {
    const { token } = await signedState("123456", { enabled: false });

    const result = await post({ state: token, body: { action: "enable" } });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ enabled: true });
    expect(result.stateCookie).toBeTruthy();
  });

  it("requires a six digit PIN to disable", async () => {
    const { token } = await signedState();

    const result = await post({ state: token, body: { action: "disable", pin: "12" } });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Masukkan PIN 6 angka.");
  });

  it("disables Kids Mode when the PIN matches", async () => {
    const { token } = await signedState("123456");

    const result = await post({ state: token, body: { action: "disable", pin: "123456" } });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ enabled: false });
    expect(result.stateCookie).toBeTruthy();
  });
});

describe("wrong PIN lockout", () => {
  it("counts down the remaining attempts and then locks", async () => {
    const { token } = await signedState("123456");
    let stateCookie = token;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await post({ state: stateCookie, body: { action: "disable", pin: "000000" } });

      expect(result.status).toBe(401);
      expect(result.body.error).toBe(`PIN salah. Sisa percobaan: ${5 - attempt}.`);
      expect(result.stateCookie).toBeTruthy();
      stateCookie = result.stateCookie as string;
    }

    const fifth = await post({ state: stateCookie, body: { action: "disable", pin: "000000" } });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error).toBe("PIN salah. Pengaturan dikunci sementara selama 5 menit.");
    expect(fifth.stateCookie).toBeTruthy();

    const locked = await post({ state: fifth.stateCookie, body: { action: "disable", pin: "123456" } });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/^Terlalu banyak percobaan\. Coba lagi dalam \d+ detik\.$/);
  });

  it("refuses to verify a PIN while the lock is active", async () => {
    const { token } = await signedState("123456", { failedAttempts: 5, lockedUntil: Date.now() + 120_000 });

    const result = await post({ state: token, body: { action: "disable", pin: "123456" } });

    expect(result.status).toBe(429);
    expect(result.body.error).toContain("Terlalu banyak percobaan.");
    expect(result.stateCookie).toBeUndefined();
  });
});
