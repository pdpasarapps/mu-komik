import { Camera, Mail, MessageCircle, Music2, Play } from "lucide-react";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";

export default function PlatformLinks({ includeEmail = true, includeYoutube = false }: { includeEmail?: boolean; includeYoutube?: boolean }) {
  return (
    <nav className="platform-links" aria-label="Media sosial dan kontak mu-komik">
      <a href="https://www.instagram.com/mu_komik/" target="_blank" rel="noreferrer"><Camera size={15} /> Instagram</a>
      <a href="https://www.tiktok.com/@mukomikz" target="_blank" rel="noreferrer"><Music2 size={15} /> TikTok</a>
      {includeYoutube && <a href="https://www.youtube.com/@mu-komik.platform" target="_blank" rel="noreferrer"><Play size={15} /> YouTube</a>}
      <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
      {includeEmail && <a href="mailto:mu.komiks.apps@gmail.com"><Mail size={15} /> Email</a>}
    </nav>
  );
}
