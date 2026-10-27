import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type PaymentRecord = {
  merchant_ref: string;
  tripay_reference: string | null;
  user_id: string;
  payment_method_name: string;
  amount: number;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUND";
  created_at: string;
  paid_at: string | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return errorResponse("Silakan masuk untuk melihat laporan pembayaran.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Tripay payment report requires Supabase server credentials.");
    return errorResponse("Laporan pembayaran belum dikonfigurasi di server.", 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) return errorResponse("Sesi akun tidak valid.", 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to verify Tripay payment report access:", profileError);
    return errorResponse("Hak akses laporan pembayaran tidak dapat diverifikasi.", 500);
  }
  if (profile?.role !== "admin") return errorResponse("Laporan pembayaran hanya tersedia untuk admin.", 403);

  const { data: payments, error: paymentsError } = await serviceClient
    .from("tripay_membership_payments")
    .select("merchant_ref, tripay_reference, user_id, payment_method_name, amount, status, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (paymentsError) {
    console.error("Unable to load Tripay payment report:", paymentsError);
    return errorResponse("Laporan pembayaran gagal dimuat. Pastikan migrasi Tripay sudah dijalankan.", 503);
  }

  const records = (payments ?? []) as PaymentRecord[];
  const userIds = [...new Set(records.map((payment) => payment.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await serviceClient.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) {
    console.error("Unable to load Tripay payment report reader names:", profilesError);
    return errorResponse("Nama pembaca pada laporan pembayaran gagal dimuat.", 503);
  }

  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const items = records.map((payment) => ({
    merchantRef: payment.merchant_ref,
    tripayReference: payment.tripay_reference,
    readerName: names.get(payment.user_id) || "Pembaca",
    paymentMethod: payment.payment_method_name,
    amount: payment.amount,
    status: payment.status,
    createdAt: payment.created_at,
    paidAt: payment.paid_at,
  }));
  return NextResponse.json({
    mode: process.env.TRIPAY_MODE === "production" ? "production" : "sandbox",
    items,
    totalCount: items.length,
    paidCount: items.filter((payment) => payment.status === "PAID").length,
    paidAmount: items
      .filter((payment) => payment.status === "PAID")
      .reduce((total, payment) => total + payment.amount, 0),
  }, { headers: { "Cache-Control": "no-store" } });
}
