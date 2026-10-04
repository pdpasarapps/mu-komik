"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export default function ShareProfileButton({ creatorName }: { creatorName: string }) {
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  const shareProfile = async () => {
    setSharing(true);
    setMessage("");
    try {
      const url = `${window.location.origin}${window.location.pathname}`;
      if (navigator.share) {
        await navigator.share({ title: `Profil ${creatorName} — MU Komik`, url });
        setMessage("Profil berhasil dibagikan.");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Tautan profil disalin.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Unable to share creator profile:", error);
      setMessage("Profil tidak dapat dibagikan. Coba salin URL dari bilah alamat.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="creator-profile-share">
      <button className="creator-profile-share-button" type="button" onClick={shareProfile} disabled={sharing}>
        {message === "Tautan profil disalin." ? <Check size={16} /> : <Share2 size={16} />}
        {sharing ? "Menyiapkan..." : "Bagikan profil"}
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
