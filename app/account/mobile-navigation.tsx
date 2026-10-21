"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bookmark, CircleHelp, Home, LayoutDashboard, Library, Menu, Plus, Settings2, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/locale-provider";

type AccountRole = "reader" | "creator" | "admin";

const supabase = createClient();

export default function AccountMobileNavigation() {
  const { t } = useLocale();
  const pathname = usePathname();
  const [role, setRole] = useState<AccountRole | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [creatorMobileNavOpen, setCreatorMobileNavOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadRole = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Could not check session for account navigation:", sessionError);
        return;
      }
      if (!sessionData.session) return;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        if (userError.name === "AuthSessionMissingError") return;
        console.error("Could not identify user for account navigation:", userError);
        return;
      }
      if (!userData.user) return;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_staff")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profileError) {
        console.error("Could not load role for account navigation:", profileError);
        return;
      }
      if (active && (profile?.role === "reader" || profile?.role === "creator" || profile?.role === "admin" || profile?.role === "staff")) {
        setRole(profile.role === "staff" ? "reader" : profile.role);
        setIsStaff(profile.is_staff === true || profile.role === "staff");
      }
    };
    void loadRole();
    return () => {
      active = false;
    };
  }, []);

  if (!role) return null;

  const current = (section: string) => pathname === `/account/${section}` || (section === "overview" && pathname === "/account");
  const isComicEditor = pathname.startsWith("/account/komik/");

  return (
    <>
      <nav
        id="account-mobile-navigation"
        className={`account-mobile-nav${role === "creator" ? ` account-mobile-nav-floating${creatorMobileNavOpen ? "" : " account-mobile-nav-hidden"}` : ""}`}
        aria-label={t("Navigasi akun")}
        aria-hidden={role === "creator" && !creatorMobileNavOpen}
        inert={role === "creator" && !creatorMobileNavOpen}
      >
        {role === "reader" ? <>
          <Link href="/account" className={current("overview") ? "active" : ""} aria-current={current("overview") ? "page" : undefined}><LayoutDashboard size={19} /><span>{t("Ringkasan")}</span></Link>
          <Link href="/"><Home size={19} /><span>{t("Beranda")}</span></Link>
          <Link href="/account/reading" className={current("reading") ? "active" : ""} aria-current={current("reading") ? "page" : undefined}><BookOpen size={19} /><span>{t("Baca")}</span></Link>
          <Link href="/account/favorites" className={current("favorites") ? "active" : ""} aria-current={current("favorites") ? "page" : undefined}><Bookmark size={19} /><span>{t("Favorit")}</span></Link>
          <Link href="/account/account-settings" className={current("account-settings") ? "active" : ""} aria-current={current("account-settings") ? "page" : undefined}><Settings2 size={19} /><span>{t("Akun")}</span></Link>
          {isStaff && <Link href="/admin"><Settings2 size={19} /><span>{t("Staf")}</span></Link>}
        </> : <>
        <Link href="/account" className={current("overview") ? "active" : ""} aria-current={current("overview") ? "page" : undefined}><LayoutDashboard size={19} /><span>{t("Ringkasan")}</span></Link>
        <Link href="/"><Home size={19} /><span>{t("Beranda")}</span></Link>
        <Link href="/account/reading" className={current("reading") ? "active" : ""} aria-current={current("reading") ? "page" : undefined}><BookOpen size={19} /><span>{t("Baca")}</span></Link>
        <Link href="/account/favorites" className={current("favorites") ? "active" : ""} aria-current={current("favorites") ? "page" : undefined}><Bookmark size={19} /><span>{t("Favorit")}</span></Link>
        {role === "creator" && <>
          <Link href="/account/creator" className={current("creator") ? "active" : ""} aria-current={current("creator") ? "page" : undefined}><Sparkles size={19} /><span>{t("Kreator")}</span></Link>
          <Link href="/account/komiku" className={current("komiku") || isComicEditor ? "active" : ""} aria-current={current("komiku") || isComicEditor ? "page" : undefined}><Library size={19} /><span>{t("Komikku")}</span></Link>
          <Link href="/account/terbitkan-komik" className={current("terbitkan-komik") ? "active" : ""} aria-current={current("terbitkan-komik") ? "page" : undefined}><Plus size={19} /><span>{t("Terbitkan")}</span></Link>
          <Link href="/account/analitik-komik" className={current("analitik-komik") ? "active" : ""} aria-current={current("analitik-komik") ? "page" : undefined}><BarChart3 size={19} /><span>{t("Analitik")}</span></Link>
        </>}
        <Link href="/account/account-settings" className={current("account-settings") ? "active" : ""} aria-current={current("account-settings") ? "page" : undefined}><Settings2 size={19} /><span>{t("Akun")}</span></Link>
        {role === "creator" && <>
          <Link href="/account/creator-profile" className={current("creator-profile") ? "active" : ""} aria-current={current("creator-profile") ? "page" : undefined}><UserRound size={19} /><span>{t("Profil")}</span></Link>
          <Link href="/account/creator-guide" className={current("creator-guide") ? "active" : ""} aria-current={current("creator-guide") ? "page" : undefined}><CircleHelp size={19} /><span>{t("Panduan")}</span></Link>
        </>}
        {role === "admin" && <Link href="/admin"><Settings2 size={19} /><span>{t("Admin")}</span></Link>}
        {role !== "admin" && isStaff && <Link href="/admin"><Settings2 size={19} /><span>{t("Staf")}</span></Link>}
        </>}
      </nav>
      {role === "creator" && (
        <button
          type="button"
          className="account-mobile-nav-toggle"
          aria-label={creatorMobileNavOpen ? t("Sembunyikan menu navigasi") : t("Tampilkan menu navigasi")}
          aria-controls="account-mobile-navigation"
          aria-expanded={creatorMobileNavOpen}
          onClick={() => setCreatorMobileNavOpen((isOpen) => !isOpen)}
        >
          {creatorMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}
    </>
  );
}
