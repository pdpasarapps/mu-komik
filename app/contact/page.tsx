import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import ContactForm from "@/components/contact-form";
import LocalizedContent from "@/components/localized-content";
import { siteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const english = await getRequestLocale() === "en";
  const title = english ? "Contact Us | MU-Komik" : "Hubungi Kami | MU-Komik";
  const description = english
    ? "Send a message or question to the MU-Komik team."
    : "Kirim pesan atau pertanyaan kepada tim MU-Komik.";
  const canonical = new URL("/contact", siteUrl).toString();
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical } };
}

export default function ContactPage() {
  return (
    <main className="manifesto-page contact-page">
      <nav className="manifesto-nav">
        <BrandLogo linked showName />
        <Link href="/" className="manifesto-back"><ArrowLeft size={16} /> <LocalizedContent>Beranda</LocalizedContent></Link>
      </nav>
      <header className="terms-hero contact-hero">
        <p className="manifesto-eyebrow">MU-KOMIK</p>
        <h1><LocalizedContent>Hubungi</LocalizedContent> <em><LocalizedContent>Kami</LocalizedContent></em></h1>
        <p className="terms-lead"><LocalizedContent>Ada pertanyaan, masukan, atau kendala?</LocalizedContent> <LocalizedContent>Kirim pesan kepada tim MU-Komik.</LocalizedContent></p>
      </header>
      <ContactForm />
    </main>
  );
}
