import { Camera, Mail, Music2, Play } from "lucide-react";

export default function PlatformLinks({ includeEmail = true, includeYoutube = false }: { includeEmail?: boolean; includeYoutube?: boolean }) {
  return (
    <nav className="platform-links" aria-label="Media sosial dan kontak mu-komik">
      <a href="https://www.instagram.com/mu_komik/" target="_blank" rel="noreferrer"><Camera size={15} /> Instagram</a>
      <a href="https://www.tiktok.com/@mukomikz" target="_blank" rel="noreferrer"><Music2 size={15} /> TikTok</a>
      {includeYoutube && <a href="https://www.youtube.com/@mu-komik.platform" target="_blank" rel="noreferrer"><Play size={15} /> YouTube</a>}
      {includeEmail && <a href="mailto:mu.komiks.apps@gmail.com"><Mail size={15} /> Email</a>}
    </nav>
  );
}
