"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Share, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaSupport() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIosInstallable, setIsIosInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [installInstructions, setInstallInstructions] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Unable to register the mu-komik service worker:", error);
      });
    }

    const userAgent = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const detectionFrame = window.requestAnimationFrame(() => {
      setIsStandalone(standalone);
      if (isIos && !standalone) setIsIosInstallable(true);
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsIosInstallable(false);
      if (isAndroid) setInstallInstructions("android");
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.cancelAnimationFrame(detectionFrame);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setInstallInstructions("ios");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setInstallInstructions("android");
    }
  };

  if ((isStandalone && !installInstructions) || (!installPrompt && !isIosInstallable && !installInstructions)) return null;

  return (
    <>
      {!installInstructions ? (
        <aside className="pwa-install-card" aria-label="Pasang aplikasi mu-komik">
          <Image className="pwa-install-logo" src="/logo_mukomik.jpg" alt="" width={42} height={42} />
          <div className="pwa-install-copy"><strong>Baca lebih nyaman</strong><span>Pasang mu-komik di perangkatmu.</span></div>
          <button onClick={install}><Download size={16} /> Pasang</button>
          <button className="pwa-install-dismiss" aria-label="Tutup ajakan pemasangan" onClick={() => { setInstallPrompt(null); setIsIosInstallable(false); }}><X size={17} /></button>
        </aside>
      ) : (
        <div className="pwa-install-backdrop" role="presentation" onClick={() => setInstallInstructions(null)}>
          <section className="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" onClick={(event) => event.stopPropagation()}>
            <button className="pwa-install-dialog-close" onClick={() => setInstallInstructions(null)} aria-label="Tutup petunjuk"><X size={19} /></button>
            <Image className="pwa-install-dialog-logo" src="/logo_mukomik.jpg" alt="Logo mu-komik" width={72} height={72} />
            <h2 id="pwa-install-title">{installInstructions === "android" ? "Mu-komik sudah terpasang" : "Pasang mu-komik"}</h2>
            {installInstructions === "android" ? (
              <>
                <p>Jika ikon belum muncul di layar utama, Android mungkin menyimpannya di daftar aplikasi.</p>
                <ol><li>Buka daftar aplikasi dan cari <strong>mu-komik</strong>.</li><li>Tekan lama ikonnya, lalu pilih <strong>Tambahkan ke layar utama</strong> atau seret ikon ke layar utama.</li></ol>
              </>
            ) : (
              <>
                <p>Untuk membaca seperti aplikasi, tambahkan mu-komik ke Layar Utama:</p>
                <ol><li>Ketuk tombol <Share size={15} aria-label="Bagikan" /> <strong>Bagikan</strong> di Safari.</li><li>Pilih <strong>Tambahkan ke Layar Utama</strong>, lalu ketuk <strong>Tambah</strong>.</li></ol>
              </>
            )}
            <button className="pwa-install-dialog-done" onClick={() => setInstallInstructions(null)}>Mengerti</button>
          </section>
        </div>
      )}
    </>
  );
}
