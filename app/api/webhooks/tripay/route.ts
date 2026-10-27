import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createTripaySignature, getTripayConfig, isRecord, signaturesMatch } from "@/lib/tripay";

const maxCallbackBytes = 16 * 1024;

function callbackResponse(success: boolean, status: number, message?: string) {
  return NextResponse.json(
    success ? { success: true } : { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const config = getTripayConfig();
  if (!config) {
    console.error("Tripay callback rejected because gateway credentials are not configured.");
    return callbackResponse(false, 503, "Payment gateway is not configured.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxCallbackBytes) {
    return callbackResponse(false, 413, "Callback body is too large.");
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxCallbackBytes) {
    return callbackResponse(false, 413, "Callback body is too large.");
  }
  const receivedSignature = request.headers.get("x-callback-signature") ?? "";
  const expectedSignature = await createTripaySignature(rawBody, config.privateKey);
  if (!signaturesMatch(expectedSignature, receivedSignature)) {
    return callbackResponse(false, 403, "Invalid callback signature.");
  }
  if (request.headers.get("x-callback-event") !== "payment_status") {
    return callbackResponse(false, 400, "Unrecognized callback event.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return callbackResponse(false, 400, "Invalid callback payload.");
  }
  if (!isRecord(body)
    || body.is_closed_payment !== 1
    || typeof body.merchant_ref !== "string"
    || typeof body.reference !== "string"
    || typeof body.status !== "string"
    || typeof body.total_amount !== "number"
    || !Number.isSafeInteger(body.total_amount)
    || !["PAID", "EXPIRED", "FAILED", "REFUND"].includes(body.status)) {
    return callbackResponse(false, 400, "Invalid membership payment callback.");
  }
  const paidAt = typeof body.paid_at === "number" && Number.isSafeInteger(body.paid_at)
    ? new Date(body.paid_at * 1000).toISOString()
    : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Tripay callback cannot update membership because Supabase server credentials are missing.");
    return callbackResponse(false, 503, "Payment processing is temporarily unavailable.");
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await serviceClient.rpc("complete_tripay_membership_payment", {
    p_merchant_ref: body.merchant_ref,
    p_tripay_reference: body.reference,
    p_status: body.status,
    p_total_amount: body.total_amount,
    p_paid_at: paidAt,
  });
  if (error) {
    console.error("Tripay membership callback could not be applied:", {
      code: error.code,
      message: error.message,
    });
    return callbackResponse(false, 503, "Payment could not be processed.");
  }
  if (data !== true) {
    console.error("Tripay callback did not match a pending membership payment:", {
      merchantRef: body.merchant_ref,
      reference: body.reference,
    });
    return callbackResponse(false, 404, "Membership payment was not found or did not match.");
  }
  return callbackResponse(true, 200);
}
