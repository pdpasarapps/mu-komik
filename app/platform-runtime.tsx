"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Baby } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PlatformLinks from "@/components/platform-links";
import type { PlatformSettings } from "@/lib/platform-settings";

const PlatformSettingsContext = createContext<{ settings: PlatformSettings; updateSettings: (settings: PlatformSettings) => void } | null>(null);
const KidsModeContext = createContext<{ kidsMode: boolean; setKidsMode: (enabled: boolean) => void } | null>(null);

export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);
  if (!context) throw new Error("usePlatformSettings must be used inside PlatformRuntime.");
  return context;
}

export function useKidsMode() {
  const context = useContext(KidsModeContext);
  if (!context) throw new Error("useKidsMode must be used inside PlatformRuntime.");
  return context;
}

export function KidsModeToggle() {
  const { kidsMode, setKidsMode } = useKidsMode();
  return (
    <button
      className={`kids-mode-toggle${kidsMode ? " kids-mode-toggle-active" : ""}`}
      type="button"
      role="switch"
      aria-checked={kidsMode}
      aria-label={kidsMode ? "Nonaktifkan Kids Mode" : "Aktifkan Kids Mode"}
      onClick={() => setKidsMode(!kidsMode)}
    >
      <span className="kids-mode-toggle-label">Kids Mode</span>
      <span className="kids-mode-switch-track" aria-hidden="true">
        <span className="kids-mode-switch-thumb"><Baby size={16} /></span>
      </span>
    </button>
  );
}

export default function PlatformRuntime({
  children,
  initialSettings,
  initialKidsMode,
  initialKidsModePinConfigured,
}: {
  children: ReactNode;
  initialSettings: PlatformSettings;
  initialKidsMode: boolean;
  initialKidsModePinConfigured: boolean;
}) {
  const pathname = usePathname();
  const [settings, updateSettings] = useState(initialSettings);
  const [kidsMode, setKidsModeState] = useState(initialKidsMode);
  const [kidsModePinConfigured, setKidsModePinConfigured] = useState(initialKidsModePinConfigured);
  const [pinDialog, setPinDialog] = useState<"setup" | "verify" | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const context = useMemo(() => ({ settings, updateSettings }), [settings]);
  const closePinDialog = useCallback(() => {
    if (pinBusy) return;
    setPinDialog(null);
    setPin("");
    setPinConfirmation("");
    setPinError("");
  }, [pinBusy]);
  const submitKidsModeRequest = useCallback(async (body: { action: "setup"; pin: string; confirmPin: string } | { action: "enable" } | { action: "disable"; pin: string }) => {
    setPinBusy(true);
    setPinError("");
    try {
      const response = await fetch("/api/kids-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Kids Mode belum dapat diperbarui. Coba lagi.";
        setPinError(message);
        return false;
      }
      if (!result || typeof result !== "object" || !("enabled" in result) || typeof result.enabled !== "boolean") {
        setPinError("Respons server tidak valid. Coba lagi.");
        return false;
      }
      setKidsModeState(result.enabled);
      setKidsModePinConfigured(true);
      setPinDialog(null);
      setPin("");
      setPinConfirmation("");
      setPinError("");
      return true;
    } catch (error) {
      console.error("Unable to update Kids Mode:", error);
      setPinError("Koneksi bermasalah. Periksa koneksi lalu coba lagi.");
      return false;
    } finally {
      setPinBusy(false);
    }
  }, []);
  const requestKidsModeChange = useCallback((enabled: boolean) => {
    setPinError("");
    setPin("");
    setPinConfirmation("");
    if (!enabled) {
      setPinDialog("verify");
      return;
    }
    if (!kidsModePinConfigured) {
      setPinDialog("setup");
      return;
    }
    void submitKidsModeRequest({ action: "enable" });
  }, [kidsModePinConfigured, submitKidsModeRequest]);
  const kidsModeContext = useMemo(() => ({ kidsMode, setKidsMode: requestKidsModeChange }), [kidsMode, requestKidsModeChange]);
  const adminOrLoginRoute = pathname === "/login" || pathname === "/admin" || pathname.startsWith("/admin/");
  const restrictedInKidsMode = kidsMode && (
    pathname === "/artikel"
    || pathname.startsWith("/artikel/")
    || pathname === "/push-ads"
    || pathname.startsWith("/push-ads/")
    || pathname === "/creator"
    || pathname.startsWith("/creator/")
    || pathname.startsWith("/kreator/")
    || pathname.startsWith("/profile/")
    || pathname === "/login"
    || pathname === "/account"
    || pathname.startsWith("/account/")
    || pathname === "/manifesto"
  );
  const gatedFeature = pathname.startsWith("/comic/")
    ? !settings.feature_flags.reading
    : (pathname.startsWith("/kreator/") || pathname.startsWith("/profile/") || [
        "/account/creator",
        "/account/komiku",
        "/account/terbitkan-komik",
        "/account/analitik-komik",
        "/account/creator-profile",
        "/account/creator-guide",
      ].some((route) => pathname === route || pathname.startsWith(`${route}/`)))
      ? !settings.feature_flags.creators
      : pathname === "/account/favorites"
        ? !settings.feature_flags.favorites
        : false;

  let content = children;
  if (settings.maintenance_enabled && !adminOrLoginRoute) {
    content = (
      <main className="reader-detail-page reader-not-found-page platform-maintenance-page">
        <nav className="reader-subnav">
          <BrandLogo className="wordmark reader-wordmark" showName />
          <span className="platform-maintenance-status">Pemeliharaan</span>
        </nav>
        <section className="reader-detail-not-found">
          <Image
            className="reader-not-found-illustration platform-maintenance-illustration"
            src="/pemelihraan.png"
            alt="Kreator MU-Komik sedang memperbaiki platform"
            width={1536}
            height={1024}
            priority
            unoptimized
          />
          <h1>Kami sedang berbenah.</h1>
          <p>{settings.maintenance_message}</p>
          <Link className="reader-primary-button" href="/">Kembali lagi nanti</Link>
          <PlatformLinks includeEmail={false} />
        </section>
      </main>
    );
  } else if (restrictedInKidsMode) {
    content = (
      <main className="reader-detail-page reader-detail-not-found kids-mode-restricted-page">
        <p className="reader-section-kicker">KIDS MODE AKTIF</p>
        <h1>Halaman ini tidak tersedia di Kids Mode.</h1>
        <p>Kembali ke koleksi cerita anak atau nonaktifkan Kids Mode untuk melanjutkan.</p>
        <Link className="reader-primary-button" href="/">Kembali ke cerita anak</Link>
        <button className="reader-detail-secondary-link" type="button" onClick={() => kidsModeContext.setKidsMode(false)}>Nonaktifkan Kids Mode</button>
      </main>
    );
  } else if (gatedFeature) {
    content = (
      <main className="platform-state-page">
        <p className="eyebrow">Fitur sementara dijeda</p>
        <h1>Fitur ini sedang tidak tersedia.</h1>
        <p>Tim MU-Komik sedang menyiapkan kembali fitur ini. Silakan coba lagi nanti.</p>
      </main>
    );
  } else if (settings.announcement_enabled && settings.announcement_message) {
    content = (
      <>
        <aside className="platform-announcement" role="status">{settings.announcement_message}</aside>
        {children}
      </>
    );
  }

  return (
    <PlatformSettingsContext.Provider value={context}>
      <KidsModeContext.Provider value={kidsModeContext}>
        {content}
        {pinDialog && (
          <div className="kids-pin-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePinDialog();
          }}>
            <section className="kids-pin-dialog" role="dialog" aria-modal="true" aria-labelledby="kids-pin-title">
              <span className="kids-pin-dialog-icon"><Baby size={24} aria-hidden="true" /></span>
              <p className="reader-section-kicker">{pinDialog === "setup" ? "PENGATURAN ORANG TUA" : "KIDS MODE TERKUNCI"}</p>
              <h2 id="kids-pin-title">{pinDialog === "setup" ? "Buat PIN orang tua" : "Masukkan PIN orang tua"}</h2>
              <p>{pinDialog === "setup"
                ? "PIN 6 angka diperlukan untuk keluar dari Kids Mode. Simpan PIN ini agar anak tidak bisa beralih ke library umum."
                : "Masukkan PIN 6 angka untuk menonaktifkan Kids Mode."}</p>
              <form onSubmit={(event) => {
                event.preventDefault();
                if (pinBusy) return;
                void submitKidsModeRequest(pinDialog === "setup"
                  ? { action: "setup", pin, confirmPin: pinConfirmation }
                  : { action: "disable", pin });
              }}>
                <label htmlFor="kids-parent-pin">{pinDialog === "setup" ? "PIN baru" : "PIN orang tua"}</label>
                <input
                  id="kids-parent-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 angka"
                  required
                  autoFocus
                />
                {pinDialog === "setup" && <>
                  <label htmlFor="kids-parent-pin-confirm">Ulangi PIN</label>
                  <input
                    id="kids-parent-pin-confirm"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={pinConfirmation}
                    onChange={(event) => setPinConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Ulangi PIN"
                    required
                  />
                </>}
                {pinError && <p className="kids-pin-error" role="alert">{pinError}</p>}
                <div className="kids-pin-actions">
                  <button type="button" className="kids-pin-cancel" onClick={closePinDialog} disabled={pinBusy}>Batal</button>
                  <button type="submit" className="kids-pin-submit" disabled={pinBusy || pin.length !== 6 || (pinDialog === "setup" && pinConfirmation.length !== 6)}>
                    {pinBusy ? "Memeriksa..." : pinDialog === "setup" ? "Simpan PIN & aktifkan" : "Buka Kids Mode"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </KidsModeContext.Provider>
    </PlatformSettingsContext.Provider>
  );
}
