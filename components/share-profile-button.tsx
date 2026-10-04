"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export default function ShareProfileButton({ creatorName }: { creatorName: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const profileTitle = `Profil ${creatorName} — MU Komik`;
  const shareText = `Lihat profil kreator ${creatorName} di MU Komik`;

  const shareProfile = async () => {
    setMessage("");
    try {
      const url = `${window.location.origin}${window.location.pathname}`;
      if (navigator.share) {
        await navigator.share({ title: profileTitle, text: shareText, url });
        setMessage("Profil berhasil dibagikan.");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Tautan profil disalin.");
      }
      setMenuOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Unable to share creator profile:", error);
      setMessage("Profil tidak dapat dibagikan. Coba salin URL dari bilah alamat.");
    }
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setMessage("Tautan profil disalin.");
      setMenuOpen(false);
    } catch (error) {
      console.error("Unable to copy creator profile URL:", error);
      setMessage("Tautan tidak dapat disalin. Salin URL dari bilah alamat.");
    }
  };

  const url = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  return (
    <div className="creator-profile-share">
      <button
        className="creator-profile-share-button"
        type="button"
        onClick={() => {
          setMessage("");
          setMenuOpen((open) => !open);
        }}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-controls="creator-profile-share-menu"
      >
        <Share2 size={16} />
        Bagikan profil
      </button>
      {menuOpen && (
        <div className="creator-profile-share-menu" id="creator-profile-share-menu" role="group" aria-label="Bagikan profil melalui">
          <a href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>WhatsApp</a>
          <a href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Telegram</a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Facebook</a>
          <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>X</a>
          <button type="button" onClick={() => void shareProfile()}>Bagikan lainnya</button>
          <button type="button" onClick={() => void copyProfileLink()}>
            <Copy size={14} /> Salin tautan
          </button>
        </div>
      )}
      {message && <span className="creator-profile-share-status" role="status">{message === "Tautan profil disalin." && <Check size={14} />}{message}</span>}
    </div>
  );
}
