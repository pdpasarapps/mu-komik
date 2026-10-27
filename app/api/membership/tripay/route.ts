import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/seo";
import { createTripaySignature, getTripayConfig, isRecord } from "@/lib/tripay";

const membershipAmount = 25_000;
const membershipProduct = {
  sku: "MU-PREMIUM-30D",
  name: "Membership Premium 30 Hari",
};
const requestTimeoutMs = 10_000;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function getAccessToken(request: NextRequest) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
}

function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null;
}

async function getAuthenticatedUser(request: NextRequest) {
  const token = getAccessToken(request);
  if (!token) return { error: errorResponse("Silakan masuk untuk melanjutkan.", 401) } as const;
  const credentials = getSupabaseCredentials();
  if (!credentials) {
    console.error("Tripay membership requires Supabase server credentials.");
    return { error: errorResponse("Pembayaran membership belum dikonfigurasi di server.", 503) } as const;
  }
  const authClient = createClient(credentials.url, credentials.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user?.email) return { error: errorResponse("Sesi akun tidak valid.", 401) } as const;
  return { credentials, user: data.user, email: data.user.email } as const;
}

async function fetchPaymentChannels(apiBaseUrl: string, apiKey: string) {
  const response = await fetch(`${apiBaseUrl}/merchant/payment-channel`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const result: unknown = await response.json();
  if (!response.ok || !isRecord(result) || result.success !== true || !Array.isArray(result.data)) {
    console.error("Tripay payment channel request failed:", { status: response.status });
    throw new Error("Metode pembayaran Tripay belum dapat dimuat.");
  }
  return result.data.flatMap((item) => (
    isRecord(item)
      && item.active === true
      && typeof item.code === "string"
      && typeof item.name === "string"
      && typeof item.minimum_amount === "number"
      && typeof item.maximum_amount === "number"
      && item.minimum_amount <= membershipAmount
      && item.maximum_amount >= membershipAmount
      ? [{ code: item.code, name: item.name, group: typeof item.group === "string" ? item.group : "" }]
      : []
  ));
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) return auth.error;
  const config = getTripayConfig();
  if (!config) return errorResponse("Kredensial Tripay belum dikonfigurasi di server.", 503);

  const supabase = createClient(auth.credentials.url, auth.credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: expiryCleanupError } = await supabase
    .from("tripay_membership_payments")
    .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
    .eq("status", "PENDING")
    .eq("user_id", auth.user.id)
    .lt("expires_at", new Date().toISOString());
  if (expiryCleanupError) {
    console.error("Unable to expire outdated Tripay membership payments:", expiryCleanupError);
    return errorResponse("Status tagihan tidak dapat diperbarui.", 500);
  }
  const noReferenceCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { error: abandonedPaymentError } = await supabase
    .from("tripay_membership_payments")
    .update({ status: "FAILED", updated_at: new Date().toISOString() })
    .eq("status", "PENDING")
    .eq("user_id", auth.user.id)
    .is("tripay_reference", null)
    .lt("created_at", noReferenceCutoff);
  if (abandonedPaymentError) {
    console.error("Unable to close abandoned Tripay membership payments:", abandonedPaymentError);
    return errorResponse("Status tagihan tidak dapat diperbarui.", 500);
  }
  const [{ data: payments, error: paymentsError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase
      .from("tripay_membership_payments")
      .select("merchant_ref, payment_method, payment_method_name, amount, status, checkout_url, pay_code, qr_url, expires_at, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("reader_memberships").select("tier, expires_at").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  if (paymentsError || membershipError) {
    console.error("Unable to load Tripay membership data:", paymentsError ?? membershipError);
    return errorResponse("Data membership atau pembayaran belum tersedia. Pastikan migrasi Tripay sudah dijalankan.", 503);
  }

  try {
    const channels = await fetchPaymentChannels(config.apiBaseUrl, config.apiKey);
    return NextResponse.json({
      mode: config.mode,
      amount: membershipAmount,
      membership: {
        tier: membership?.tier ?? "free",
        expiresAt: membership?.expires_at ?? null,
      },
      channels,
      payments: payments ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load Tripay membership checkout:", error);
    return errorResponse(error instanceof Error ? error.message : "Metode pembayaran belum dapat dimuat.", 502);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("Permintaan lintas situs tidak diizinkan.", 403);
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return errorResponse("Origin permintaan tidak valid.", 403);
    }
  } catch {
    return errorResponse("Origin permintaan tidak valid.", 403);
  }

  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) return auth.error;
  const config = getTripayConfig();
  if (!config) return errorResponse("Kredensial Tripay belum dikonfigurasi di server.", 503);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2048) return errorResponse("Permintaan terlalu besar.", 413);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 2048) return errorResponse("Permintaan terlalu besar.", 413);
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Format permintaan tidak valid.", 400);
  }
  if (!isRecord(body) || typeof body.paymentMethod !== "string"
    || !/^[A-Z0-9_]{2,40}$/.test(body.paymentMethod)
    || typeof body.customerPhone !== "string"
    || !/^\+?[0-9][0-9 -]{7,18}$/.test(body.customerPhone.trim())) {
    return errorResponse("Pilih metode pembayaran yang valid.", 400);
  }

  try {
    const channels = await fetchPaymentChannels(config.apiBaseUrl, config.apiKey);
    const channel = channels.find((item) => item.code === body.paymentMethod);
    if (!channel) return errorResponse("Metode pembayaran tidak aktif pada merchant Tripay.", 400);

    const supabase = createClient(auth.credentials.url, auth.credentials.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const expiredBefore = new Date().toISOString();
    const { error: expiryCleanupError } = await supabase
      .from("tripay_membership_payments")
      .update({ status: "EXPIRED", updated_at: expiredBefore })
      .eq("status", "PENDING")
      .eq("user_id", auth.user.id)
      .lt("expires_at", expiredBefore);
    if (expiryCleanupError) {
      console.error("Unable to expire outdated Tripay membership payments:", expiryCleanupError);
      return errorResponse("Status tagihan tidak dapat diperbarui.", 500);
    }
    const { error: abandonedPaymentError } = await supabase
      .from("tripay_membership_payments")
      .update({ status: "FAILED", updated_at: expiredBefore })
      .eq("status", "PENDING")
      .eq("user_id", auth.user.id)
      .is("tripay_reference", null)
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (abandonedPaymentError) {
      console.error("Unable to close abandoned Tripay membership payments:", abandonedPaymentError);
      return errorResponse("Status tagihan tidak dapat diperbarui.", 500);
    }
    const { data: currentMembership, error: membershipError } = await supabase
      .from("reader_memberships")
      .select("tier, expires_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (membershipError) {
      console.error("Unable to verify membership before Tripay checkout:", membershipError);
      return errorResponse("Status membership tidak dapat diverifikasi.", 500);
    }
    const currentExpiry = typeof currentMembership?.expires_at === "string"
      ? Date.parse(currentMembership.expires_at)
      : null;
    if (currentMembership?.tier === "vip"
      || (currentMembership?.tier === "premium" && currentExpiry === null)) {
      return errorResponse("Membership Premium atau VIP akun Anda sudah aktif.", 409);
    }
    const { data: existingPayment, error: paymentError } = await supabase
      .from("tripay_membership_payments")
      .select("merchant_ref")
      .eq("user_id", auth.user.id)
      .eq("status", "PENDING")
      .limit(1)
      .maybeSingle();
    if (paymentError) {
      console.error("Unable to check pending Tripay renewals:", paymentError);
      return errorResponse("Tagihan yang sedang berjalan tidak dapat diperiksa.", 500);
    }
    if (existingPayment) return errorResponse("Selesaikan tagihan yang masih menunggu sebelum membuat tagihan baru.", 409);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Unable to load Tripay customer profile:", profileError);
      return errorResponse("Profil akun tidak dapat diverifikasi.", 500);
    }
    const customerName = profile?.display_name?.trim().slice(0, 100) || auth.email.split("@")[0].slice(0, 100);
    if (customerName.length < 2) return errorResponse("Nama akun perlu diperbarui sebelum membayar.", 400);
    const customerPhone = body.customerPhone.trim();

    const merchantRef = `MU-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const { error: insertError } = await supabase.from("tripay_membership_payments").insert({
      user_id: auth.user.id,
      merchant_ref: merchantRef,
      payment_method: channel.code,
      payment_method_name: channel.name,
      amount: membershipAmount,
    });
    if (insertError) {
      if (insertError.code === "23505") {
        return errorResponse("Anda sudah memiliki tagihan Tripay yang sedang menunggu.", 409);
      }
      console.error("Unable to create Tripay membership payment record:", insertError);
      return errorResponse("Tagihan tidak dapat dibuat. Coba lagi.", 500);
    }

    const signature = await createTripaySignature(
      `${config.merchantCode}${merchantRef}${membershipAmount}`,
      config.privateKey,
    );
    const callbackUrl = process.env.TRIPAY_CALLBACK_URL
      || new URL("/api/webhooks/tripay", siteUrl).toString();
    const returnUrl = new URL("/account?payment=tripay", siteUrl).toString();
    const tripayResponse = await fetch(`${config.apiBaseUrl}/transaction/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: channel.code,
        merchant_ref: merchantRef,
        amount: membershipAmount,
        customer_name: customerName,
        customer_email: auth.email,
        customer_phone: customerPhone.replace(/[ -]/g, ""),
        order_items: [{
          sku: membershipProduct.sku,
          name: membershipProduct.name,
          price: membershipAmount,
          quantity: 1,
        }],
        callback_url: callbackUrl,
        return_url: returnUrl,
        signature,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const result: unknown = await tripayResponse.json();
    if (!tripayResponse.ok || !isRecord(result) || result.success !== true || !isRecord(result.data)
      || result.data.merchant_ref !== merchantRef || typeof result.data.reference !== "string") {
      const { error: updateError } = await supabase
        .from("tripay_membership_payments")
        .update({ status: "FAILED", updated_at: new Date().toISOString() })
        .eq("merchant_ref", merchantRef)
        .eq("user_id", auth.user.id);
      if (updateError) console.error("Unable to mark rejected Tripay transaction:", updateError);
      console.error("Tripay transaction creation failed:", {
        status: tripayResponse.status,
        message: isRecord(result) && typeof result.message === "string" ? result.message : "Invalid gateway response",
      });
      return errorResponse("Tripay belum dapat membuat transaksi. Coba metode lain atau ulangi nanti.", 502);
    }

    const checkoutUrlCandidate = typeof result.data.checkout_url === "string"
      ? result.data.checkout_url
      : typeof result.data.pay_url === "string" ? result.data.pay_url : null;
    let checkoutUrl: string | null = null;
    if (checkoutUrlCandidate) {
      try {
        const parsedCheckoutUrl = new URL(checkoutUrlCandidate);
        if (parsedCheckoutUrl.protocol !== "https:"
          || !(parsedCheckoutUrl.hostname === "tripay.co.id" || parsedCheckoutUrl.hostname.endsWith(".tripay.co.id"))) {
          throw new Error("Tripay returned an untrusted payment URL.");
        }
        checkoutUrl = parsedCheckoutUrl.toString();
      } catch (error) {
        console.error("Tripay returned an invalid payment URL:", error);
        return errorResponse("Tripay mengembalikan tautan pembayaran yang tidak valid.", 502);
      }
    }
    const payCode = typeof result.data.pay_code === "string" ? result.data.pay_code : null;
    const qrUrl = typeof result.data.qr_url === "string" ? result.data.qr_url : null;
    const expiresAt = typeof result.data.expired_time === "number"
      ? new Date(result.data.expired_time * 1000).toISOString()
      : null;
    const { error: updateError } = await supabase
      .from("tripay_membership_payments")
      .update({
        tripay_reference: result.data.reference,
        checkout_url: checkoutUrl,
        pay_code: payCode,
        qr_url: qrUrl,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_ref", merchantRef)
      .eq("user_id", auth.user.id);
    if (updateError) {
      console.error("Unable to save Tripay transaction details:", updateError);
      return errorResponse("Transaksi dibuat, tetapi detail pembayaran belum dapat disimpan. Hubungi admin.", 500);
    }

    return NextResponse.json({
      merchantRef,
      checkoutUrl,
      payCode,
      qrUrl,
      amount: membershipAmount,
      paymentMethodName: channel.name,
      expiresAt,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to create Tripay membership payment:", error);
    return errorResponse("Transaksi Tripay tidak dapat dibuat. Periksa koneksi lalu coba lagi.", 502);
  }
}
