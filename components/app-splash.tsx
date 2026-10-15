"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import BrandLogo from "@/components/brand-logo";

type SplashStage = "brand" | "welcome" | "hidden";

export default function AppSplash() {
  const [stage, setStage] = useState<SplashStage>("brand");
  const hideSplash = useCallback(() => {
    const root = document.documentElement;
    root.setAttribute("data-splash-seen", "true");
    root.removeAttribute("data-splash-first-visit");
    setStage("hidden");
  }, []);

  useEffect(() => {
    if (stage === "hidden") return;
    if (document.documentElement.hasAttribute("data-splash-seen")) return;
    const timer = window.setTimeout(
      () => {
        if (stage === "brand") setStage("welcome");
        else hideSplash();
      },
      stage === "brand" ? 3000 : 6000,
    );
    return () => window.clearTimeout(timer);
  }, [hideSplash, stage]);

  if (stage === "hidden") return null;

  return (
    <div className={`app-splash app-splash-${stage}`}>
      <div className="app-splash-card" aria-live="polite">
        {stage === "brand" ? (
          <>
            <BrandLogo className="wordmark app-splash-logo" linked={false} />
            <p className="app-splash-name">MU-komik</p>
            <span className="app-splash-tagline">Cerita seru, selalu menemani.</span>
          </>
        ) : (
          <>
            <span className="app-splash-book-icon" aria-hidden="true"><BookOpen size={30} /></span>
            <p className="app-splash-eyebrow">HALO, PEMBACA!</p>
            <h1>Selamat datang,<br />para pembaca.</h1>
            <p className="app-splash-message">Selamat membaca dan menikmati cerita di MU-komik!</p>
            <button className="app-splash-button" type="button" onClick={hideSplash}>
              Mulai membaca
            </button>
          </>
        )}
      </div>
    </div>
  );
}
