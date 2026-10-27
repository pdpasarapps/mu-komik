"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, LoaderCircle, RefreshCw, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useReaderMembership } from "@/app/membership-runtime";

type PaymentChannel = { code: string; name: string; group: string };
type Payment = {
  merchant_ref: string;
  payment_method: string;
  payment_method_name: string;
  amount: number;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUND";
  checkout_url: string | null;
  pay_code: string | null;
  qr_url: string | null;
  expires_at: string | null;
  created_at: string;
};
type CheckoutData = {
  mode: "sandbox" | "production";
  amount: number;
  membership: { tier: string; expiresAt: string | null };
  channels: PaymentChannel[];
  payments: Payment[];
};

const supabase = createClient();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCheckoutData(value: unknown): CheckoutData | null {
  if (!isRecord(value) || (value.mode !== "sandbox" && value.mode !== "production")
    || typeof value.amount !== "number"
    || !isRecord(value.membership) || typeof value.membership.tier !== "string"
    || !(value.membership.expiresAt === null || typeof value.membership.expiresAt === "string")
    || !Array.isArray(value.channels) || !Array.isArray(value.payments)) return null;

  const channels = value.channels.flatMap((item): PaymentChannel[] => (
    isRecord(item) && typeof item.code === "string" && typeof item.name === "string"
      && typeof item.group === "string"
      ? [{ code: item.code, name: item.name, group: item.group }]
      : []
  ));
  const payments = value.payments.flatMap((item): Payment[] => (
    isRecord(item)
      && typeof item.merchant_ref === "string"
      && typeof item.payment_method === "string"
      && typeof item.payment_method_name === "string"
      && typeof item.amount === "number"
      && (item.status === "PENDING" || item.status === "PAID" || item.status === "EXPIRED" || item.status === "FAILED" || item.status === "REFUND")
      && (item.checkout_url === null || typeof item.checkout_url === "string")
      && (item.pay_code === null || typeof item.pay_code === "string")
      && (item.qr_url === null || typeof item.qr_url === "string")
      && (item.expires_at === null || typeof item.expires_at === "string")
      && typeof item.created_at === "string"
      ? [{
        merchant_ref: item.merchant_ref,
        payment_method: item.payment_method,
        payment_method_name: item.payment_method_name,
        amount: item.amount,
        status: item.status,
        checkout_url: item.checkout_url,
        pay_code: item.pay_code,
        qr_url: item.qr_url,
        expires_at: item.expires_at,
        created_at: item.created_at,
      }]
      : []
  ));
  return {
    mode: value.mode,
    amount: value.amount,
    membership: {
      tier: value.membership.tier,
      expiresAt: value.membership.expiresAt,
    },
    channels,
    payments,
  };
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "Tidak tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tidak tersedia"
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const paymentStatusLabels: Record<Payment["status"], string> = {
  PENDING: "Menunggu pembayaran",
  PAID: "Berhasil",
  EXPIRED: "Kedaluwarsa",
  FAILED: "Gagal",
  REFUND: "Dikembalikan",
};

export default function MembershipCheckout() {
  const membership = useReaderMembership();
  const [data, setData] = useState<CheckoutData | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sesi login tidak tersedia. Silakan masuk kembali.");
      const response = await fetch("/api/membership/tripay", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Data pembayaran tidak dapat dimuat.");
      }
      const parsed = parseCheckoutData(result);
      if (!parsed) throw new Error("Data pembayaran Tripay tidak valid.");
      setData(parsed);
      setSelectedMethod((current) => current && parsed.channels.some((channel) => channel.code === current)
        ? current
        : parsed.channels[0]?.code ?? "");
    } catch (error) {
      console.error("Unable to load Tripay membership checkout:", error);
      setErrorMessage(error instanceof Error ? error.message : "Data pembayaran belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timerId);
  }, [loadData]);

  const createPayment = async () => {
    if (!selectedMethod || creating) return;
    setCreating(true);
    setErrorMessage("");
    setMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sesi login tidak tersedia. Silakan masuk kembali.");
      const response = await fetch("/api/membership/tripay", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentMethod: selectedMethod, customerPhone }),
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Transaksi Tripay tidak dapat dibuat.");
      }
      if (!isRecord(result)
        || !(result.checkoutUrl === null || typeof result.checkoutUrl === "string")
        || typeof result.merchantRef !== "string") {
        throw new Error("Respons transaksi Tripay tidak valid.");
      }
      await loadData();
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setMessage(`Tagihan ${result.merchantRef} dibuat. Buka kembali detail tagihan di bawah untuk melanjutkan pembayaran.`);
    } catch (error) {
      console.error("Unable to create Tripay membership payment:", error);
      setErrorMessage(error instanceof Error ? error.message : "Transaksi belum dapat dibuat.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <article className="account-panel account-panel-wide membership-checkout-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Pembayaran aman melalui Tripay</p><h2>Membership Premium</h2></div>
        <Wallet size={22} />
      </div>
      {data?.mode === "sandbox" && <p className="request-status request-pending">TAHAP PENGEMBANGAN — MODE SANDBOX. Transaksi uji, bukan pembayaran produksi.</p>}
      <p>Rp25.000 untuk 30 hari. Pembayaran berikutnya dilakukan manual oleh Anda; Premium aktif setelah pembayaran dikonfirmasi Tripay.</p>
      {membership.tier === "premium" && membership.expiresAt
        && <p className="membership-checkout-expiry">Aktif sampai {formatDate(membership.expiresAt)}.</p>}
      {membership.tier === "vip" && <p className="membership-checkout-expiry">Akun Anda sudah memiliki akses VIP.</p>}
      {errorMessage && <p className="account-reading-message" role="alert">{errorMessage}</p>}
      {message && <p className="account-reading-message" role="status">{message}</p>}
      {loading
        ? <p className="membership-checkout-loading"><LoaderCircle className="spin" size={18} /> Memuat metode pembayaran…</p>
        : data && (
          <>
            {membership.tier !== "vip" && !(membership.tier === "premium" && !membership.expiresAt) && (
              <>
                <label className="membership-checkout-method">
                  Metode pembayaran
                  <select value={selectedMethod} onChange={(event) => setSelectedMethod(event.target.value)} disabled={!data.channels.length || creating}>
                    {data.channels.length
                      ? data.channels.map((channel) => (
                        <option key={channel.code} value={channel.code}>
                          {channel.group ? `${channel.group} · ` : ""}{channel.name}
                        </option>
                      ))
                      : <option value="">Tidak ada metode aktif pada merchant</option>}
                  </select>
                </label>
                <label className="membership-checkout-method">
                  Nomor telepon aktif
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="08xxxxxxxxxx"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={20}
                    required
                    disabled={creating}
                  />
                </label>
                <button className="button button-dark membership-checkout-button" onClick={() => void createPayment()} disabled={!selectedMethod || !customerPhone.trim() || creating}>
                  {creating ? <LoaderCircle className="spin" size={17} /> : <ArrowUpRight size={17} />}
                  {creating ? "Membuat tagihan…" : "Bayar Rp25.000"}
                </button>
              </>
            )}
            {membership.tier === "premium" && !membership.expiresAt
              && <p className="membership-checkout-expiry">Premium aktif untuk akun Anda.</p>}
            <button className="membership-checkout-refresh" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={15} /> Perbarui status
            </button>
            {data.payments.length > 0 && (
              <div className="membership-payment-list">
                <h3>Riwayat pembayaran</h3>
                <ol>
                  {data.payments.map((payment) => (
                    <li key={payment.merchant_ref}>
                      <span>
                        <strong>{payment.payment_method_name} · {formatAmount(payment.amount)}</strong>
                        <small>{paymentStatusLabels[payment.status]} · {formatDate(payment.created_at)}</small>
                        {payment.status === "PENDING" && payment.expires_at
                          && <small>Batas pembayaran: {formatDate(payment.expires_at)}</small>}
                        {payment.status === "PENDING" && payment.pay_code
                          && <small>Kode bayar: <code>{payment.pay_code}</code></small>}
                      </span>
                      {payment.status === "PENDING" && payment.checkout_url
                        ? <a href={payment.checkout_url} target="_blank" rel="noreferrer">Lanjut bayar <ArrowUpRight size={14} /></a>
                        : payment.status === "PENDING" && payment.qr_url
                          ? <a href={payment.qr_url} target="_blank" rel="noreferrer">Lihat QR <ArrowUpRight size={14} /></a>
                          : <small>{paymentStatusLabels[payment.status]}</small>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
    </article>
  );
}
