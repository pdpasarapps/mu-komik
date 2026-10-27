"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUND";
type PaymentReportItem = {
  merchantRef: string;
  tripayReference: string | null;
  readerName: string;
  paymentMethod: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
};
type PaymentReport = {
  mode: "sandbox" | "production";
  items: PaymentReportItem[];
  totalCount: number;
  paidCount: number;
  paidAmount: number;
};

const supabase = createClient();
const statusLabels: Record<PaymentStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Berhasil",
  EXPIRED: "Kedaluwarsa",
  FAILED: "Gagal",
  REFUND: "Dikembalikan",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePaymentReport(value: unknown): PaymentReport | null {
  if (!isRecord(value) || (value.mode !== "sandbox" && value.mode !== "production")
    || !Array.isArray(value.items)
    || typeof value.totalCount !== "number"
    || typeof value.paidCount !== "number"
    || typeof value.paidAmount !== "number") return null;

  const items = value.items.flatMap((item): PaymentReportItem[] => (
    isRecord(item)
      && typeof item.merchantRef === "string"
      && (item.tripayReference === null || typeof item.tripayReference === "string")
      && typeof item.readerName === "string"
      && typeof item.paymentMethod === "string"
      && typeof item.amount === "number"
      && (item.status === "PENDING" || item.status === "PAID" || item.status === "EXPIRED"
        || item.status === "FAILED" || item.status === "REFUND")
      && typeof item.createdAt === "string"
      && (item.paidAt === null || typeof item.paidAt === "string")
      ? [{
        merchantRef: item.merchantRef,
        tripayReference: item.tripayReference,
        readerName: item.readerName,
        paymentMethod: item.paymentMethod,
        amount: item.amount,
        status: item.status,
        createdAt: item.createdAt,
        paidAt: item.paidAt,
      }]
      : []
  ));

  return {
    mode: value.mode,
    items,
    totalCount: value.totalCount,
    paidCount: value.paidCount,
    paidAmount: value.paidAmount,
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
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function TripayPaymentsPanel() {
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sesi login tidak tersedia. Silakan masuk kembali.");

      const response = await fetch("/api/admin/tripay-payments", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Laporan pembayaran tidak dapat dimuat.");
      }
      const parsed = parsePaymentReport(result);
      if (!parsed) throw new Error("Data laporan pembayaran tidak valid.");
      setReport(parsed);
    } catch (error) {
      console.error("Unable to load Tripay payment report:", error);
      setErrorMessage(error instanceof Error ? error.message : "Laporan pembayaran belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timerId);
  }, [loadReport]);

  return (
    <section className="admin-analytics-section" aria-labelledby="tripay-payments-title">
      <div className="admin-section-heading">
        <div><p className="eyebrow">Membership Premium</p><h2 id="tripay-payments-title">Laporan pembayaran</h2></div>
        <button className="admin-action-link" type="button" onClick={() => void loadReport()} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          {loading ? "Memuat..." : "Muat ulang"}
        </button>
      </div>
      {report?.mode === "sandbox" && <p className="request-status request-pending">TAHAP PENGEMBANGAN — MODE SANDBOX. Transaksi uji, bukan pembayaran produksi.</p>}
      <p className="admin-analytics-note">Menampilkan hingga 100 transaksi terbaru. Ringkasan hanya menghitung transaksi dalam daftar ini.</p>
      {errorMessage
        ? <p className="admin-analytics-message" role="alert">{errorMessage}</p>
        : loading && !report
          ? <div className="admin-analytics-loading"><LoaderCircle className="spin" size={20} /> Memuat laporan pembayaran...</div>
          : report && <>
            <div className="admin-analytics-stats">
              <article className="admin-stat"><span>Transaksi pada laporan</span><strong>{new Intl.NumberFormat("id-ID").format(report.totalCount)}</strong><Wallet size={20} /></article>
              <article className="admin-stat"><span>Pembayaran berhasil</span><strong>{new Intl.NumberFormat("id-ID").format(report.paidCount)}</strong><Wallet size={20} /></article>
              <article className="admin-stat"><span>Total pembayaran berhasil</span><strong>{formatAmount(report.paidAmount)}</strong><Wallet size={20} /></article>
            </div>
            <div className="request-table-wrap" style={{ marginTop: 16 }}>
              <table className="request-table" style={{ minWidth: 920 }}>
                <thead><tr><th>Pembaca</th><th>Referensi transaksi</th><th>Metode</th><th>Nominal</th><th>Status</th><th>Dibuat</th><th>Dibayar</th></tr></thead>
                <tbody>
                  {report.items.map((payment) => (
                    <tr key={payment.merchantRef}>
                      <td><strong>{payment.readerName}</strong></td>
                      <td><strong>{payment.merchantRef}</strong>{payment.tripayReference && <small>Tripay: {payment.tripayReference}</small>}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{formatAmount(payment.amount)}</td>
                      <td><span className={`request-status ${payment.status === "PAID" ? "request-approved" : payment.status === "PENDING" ? "request-pending" : "request-rejected"}`}>{statusLabels[payment.status]}</span></td>
                      <td>{formatDate(payment.createdAt)}</td>
                      <td>{formatDate(payment.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.items.length && <p className="admin-analytics-empty">Belum ada transaksi membership Tripay.</p>}
            </div>
          </>}
    </section>
  );
}
