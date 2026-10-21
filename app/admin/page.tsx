"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Archive, Ban, Baby, BookOpen, ChartNoAxesColumn, Check, ClipboardList, Eye, FileText, Image as ImageIcon, LayoutDashboard, LoaderCircle, List, Mail, Megaphone, Pencil, Search, Settings2, ShieldCheck, Trash2, UserRound, UserRoundCheck, Users, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import AdminAnalyticsPanel from "./analytics-panel";
import AdsManagementPanel from "./ads-management-panel";
import HomepagePromosPanel from "./homepage-promos-panel";
import AdRequestsPanel from "./ad-requests-panel";
import ContactMessagesPanel from "./contact-messages-panel";
import ArticlesPanel from "./articles-panel";
import { createComicSharePreview } from "@/lib/comic-share-preview";
import { defaultPlatformSettings, type PlatformSettings } from "@/lib/platform-settings";
import { usePlatformSettings } from "../platform-runtime";
import { READER_MEMBERSHIP_TIERS, type ReaderMembershipTier } from "@/lib/reader-membership";

type RequestStatus = "pending" | "approved" | "rejected";
type CreatorRequest = { id: string; user_id: string; note: string; portfolio_url: string | null; instagram_url: string | null; other_url: string | null; status: RequestStatus; created_at: string; applicant: string; role: string };
type ComicReview = { id: string; title: string; slug: string; synopsis: string; contributor: string; created_at: string; creator_id: string; creator: string };
type KidsCurationReview = { comic_id: string; age_range: "4_6" | "7_9" | "10_12"; submitted_at: string; review_note: string; title: string; slug: string; creator: string };
type AdminAccountStatus = "active" | "blocked" | "deleted";
type AdminUser = { id: string; display_name: string; email: string | null; role: "reader" | "creator" | "admin"; isStaff: boolean; staffTitle: string; staffPermissions: AdminSection[]; canUploadAudio: boolean; membershipTier: ReaderMembershipTier; accountStatus: AdminAccountStatus; created_at: string };
type AdminComic = { id: string; title: string; slug: string; synopsis: string; contributor: string; genre: string; cover_key: string | null; share_preview_key: string | null; status: "draft" | "pending_review" | "published" | "archived"; created_at: string; creator_id: string; creator: string; kids_curation_status: "pending" | "approved" | "rejected" | null; kids_age_range: "4_6" | "7_9" | "10_12" | null };
type SettingsAuditEntry = { id: number; changed_by: string | null; changed_at: string; previous_values: Record<string, unknown>; new_values: Record<string, unknown> };
type AdminSection = "overview" | "analytics" | "comic-review" | "kids-review" | "creator-requests" | "users" | "admins" | "staf" | "readers" | "kreator" | "comics" | "articles" | "share-previews" | "ad-requests" | "contact-messages" | "ads-management" | "ads-list" | "sponsor-campaigns" | "ad-slots" | "homepage-promos" | "platform-settings";

const supabase = createClient();
const adminSections: Record<AdminSection, { label: string; description: string }> = {
  overview: { label: "Dasbor admin", description: "Kelola akun, komik, kurasi, dan pengajuan kreator mu-komik." },
  analytics: { label: "Analitik", description: "Pantau aktivitas membaca dan komik yang paling banyak dibaca." },
  "comic-review": { label: "Kurasi komik", description: "Tinjau komik yang menunggu persetujuan untuk diterbitkan." },
  "kids-review": { label: "Kurasi Kids Mode", description: "Tinjau komik dan rentang usia yang diajukan untuk library anak." },
  "creator-requests": { label: "Pengajuan kreator", description: "Tinjau permohonan akses kreator." },
  users: { label: "Manajemen pengguna", description: "Kelola akun dan peran pengguna." },
  admins: { label: "Daftar admin", description: "Lihat akun administrator platform." },
  staf: { label: "Daftar staf", description: "Kelola akun staf dengan akses terbatas." },
  readers: { label: "Daftar pembaca", description: "Lihat dan kelola akun dengan peran pembaca." },
  kreator: { label: "Daftar kreator", description: "Lihat dan kelola akun dengan peran kreator." },
  comics: { label: "Katalog komik", description: "Cari komik dan kelola status publikasinya." },
  articles: { label: "Artikel", description: "Tulis, pratinjau, dan terbitkan artikel seputar komik." },
  "share-previews": { label: "Pratinjau berbagi komik", description: "Buat gambar pratinjau statis di R2 agar dapat ditampilkan di WhatsApp dan platform sosial." },
  "ad-requests": { label: "Pengajuan iklan", description: "Tinjau kebutuhan kampanye iklan dari calon pengiklan." },
  "contact-messages": { label: "Pesan kontak", description: "Tinjau pesan dan pertanyaan dari pengunjung MU-Komik." },
  "ads-management": { label: "Kampanye sponsor", description: "Kelola kampanye, materi, target, dan periode tayang sponsor." },
  "ads-list": { label: "Slot iklan", description: "Kelola inventaris penempatan iklan di MU-Komik." },
  "sponsor-campaigns": { label: "Kampanye sponsor", description: "Kelola kampanye, materi, target, dan periode tayang sponsor." },
  "ad-slots": { label: "Slot iklan", description: "Kelola inventaris penempatan iklan di MU-Komik." },
  "homepage-promos": { label: "Hero & promo beranda", description: "Kelola slide hero, gambar responsif, tautan, urutan, dan jadwal promo beranda." },
  "platform-settings": { label: "Pengaturan platform", description: "Atur status operasional dan fitur yang tersedia di MU-Komik." },
};
const roleLabels: Record<AdminUser["role"], string> = { reader: "Pembaca", creator: "Kreator", admin: "Admin" };
const staffPermissionOptions: { value: AdminSection; label: string }[] = [
  { value: "overview", label: "Ringkasan" },
  { value: "analytics", label: "Analitik" },
  { value: "comic-review", label: "Kurasi komik" },
  { value: "kids-review", label: "Kurasi Kids Mode" },
  { value: "creator-requests", label: "Pengajuan kreator" },
  { value: "users", label: "Manajemen pengguna" },
  { value: "admins", label: "Daftar admin" },
  { value: "staf", label: "Daftar staf" },
  { value: "readers", label: "Daftar pembaca" },
  { value: "kreator", label: "Daftar kreator" },
  { value: "comics", label: "Katalog komik" },
  { value: "articles", label: "Artikel" },
  { value: "share-previews", label: "Pratinjau berbagi komik" },
  { value: "ad-requests", label: "Pengajuan iklan" },
  { value: "contact-messages", label: "Pesan kontak" },
  { value: "sponsor-campaigns", label: "Kampanye sponsor" },
  { value: "ad-slots", label: "Slot iklan" },
  { value: "homepage-promos", label: "Hero & promo beranda" },
  { value: "platform-settings", label: "Pengaturan platform" },
];
const defaultStaffPermissions: AdminSection[] = ["overview", "comic-review", "creator-requests", "kreator", "comics", "articles"];
const emptyUuid = "00000000-0000-0000-0000-000000000000";
const staffSectionAliases: Partial<Record<AdminSection, AdminSection>> = {
  "ads-management": "sponsor-campaigns",
  "ads-list": "ad-slots",
};
const comicStatusLabels = { draft: "Draf", pending_review: "Menunggu kurasi", published: "Terbit", archived: "Diarsipkan" };
const requestStatusLabels = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };
const platformSettingLabels: Record<string, string> = {
  maintenance_enabled: "Mode pemeliharaan",
  maintenance_message: "Pesan pemeliharaan",
  announcement_enabled: "Banner pengumuman",
  announcement_message: "Isi pengumuman",
  require_comic_review: "Wajib kurasi sebelum terbit",
  creator_applications_enabled: "Pengajuan kreator",
  max_comics_per_creator: "Batas komik per kreator",
  max_upload_size_mb: "Ukuran file maksimum",
  max_interactive_audio_size_mb: "Ukuran audio interaktif maksimum",
  max_interactive_audio_duration_seconds: "Durasi audio interaktif maksimum",
  max_pages_per_chapter: "Batas halaman per bab",
  allowed_image_types: "Format gambar",
  allowed_interactive_audio_types: "Format audio interaktif",
  feature_flags: "Status fitur",
};

export default function AdminPage() {
  const router = useRouter();
  const { updateSettings } = usePlatformSettings();
  const params = useParams<{ section?: string }>();
  const requestedSection = params.section;
  const section = requestedSection && requestedSection in adminSections
    ? requestedSection as AdminSection
    : "overview";
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [comicReviews, setComicReviews] = useState<ComicReview[]>([]);
  const [kidsCurationReviews, setKidsCurationReviews] = useState<KidsCurationReview[]>([]);
  const [kidsCurationSetupError, setKidsCurationSetupError] = useState("");
  const [kidsReviewNotes, setKidsReviewNotes] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [staffPermissions, setStaffPermissions] = useState<AdminSection[]>([]);
  const [adminStaffTitle, setAdminStaffTitle] = useState("");
  const [userEmailSetupError, setUserEmailSetupError] = useState("");
  const [audioPermissionSetupError, setAudioPermissionSetupError] = useState("");
  const [comics, setComics] = useState<AdminComic[]>([]);
  const [adminUserId, setAdminUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comicActionId, setComicActionId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [comicSearch, setComicSearch] = useState("");
  const [comicStatusFilter, setComicStatusFilter] = useState("all");
  const [kidsCurationFilter, setKidsCurationFilter] = useState("all");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | AdminUser["role"]>("all");
  const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequest | null>(null);
  const [selectedComicDetail, setSelectedComicDetail] = useState<AdminComic | null>(null);
  const sidebarNavigationRef = useRef<HTMLElement>(null);
  const [userEditRole, setUserEditRole] = useState<"reader" | "creator">("reader");
  const [userEditIsStaff, setUserEditIsStaff] = useState(false);
  const [userEditStaffTitle, setUserEditStaffTitle] = useState("Staf");
  const [userEditStaffPermissions, setUserEditStaffPermissions] = useState<AdminSection[]>(defaultStaffPermissions);
  const [generatingSharePreviews, setGeneratingSharePreviews] = useState(false);
  const [sharePreviewProgress, setSharePreviewProgress] = useState("");
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(defaultPlatformSettings);
  const [platformSettingsError, setPlatformSettingsError] = useState("");
  const [savingPlatformSettings, setSavingPlatformSettings] = useState(false);
  const [platformSettingsMessage, setPlatformSettingsMessage] = useState("");
  const [settingsAudit, setSettingsAudit] = useState<SettingsAuditEntry[]>([]);
  const [selectedUserDialog, setSelectedUserDialog] = useState<{ user: AdminUser; mode: "view" | "edit" } | null>(null);
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const loadRequests = useEffectEvent(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const { data: roleProfile, error: roleProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (roleProfileError) {
      console.error("Unable to load admin role:", roleProfileError);
      setMessage("Peran akun gagal diverifikasi. Pastikan sesi masih aktif dan coba muat ulang.");
      setLoading(false);
      return;
    }
    if (roleProfile?.role !== "admin" && roleProfile?.role !== "staff"
      && roleProfile?.role !== "reader" && roleProfile?.role !== "creator") {
      router.replace("/account");
      return;
    }
    let staffTitle = "";
    let staffPermissionData: unknown[] = [];
    let staffAssigned = roleProfile.role === "staff";
    if (roleProfile.role !== "admin") {
      const { data: staffProfile, error: staffProfileError } = await supabase
        .from("profiles")
        .select("is_staff, staff_title, staff_permissions")
        .eq("id", userData.user.id)
        .single();
      if (staffProfileError) {
        console.error("Unable to load staff access settings:", staffProfileError);
        setMessage("Hak akses Staf belum tersedia. Jalankan supabase/staff-access.sql di Supabase SQL Editor, lalu muat ulang.");
        setLoading(false);
        return;
      }
      staffAssigned = staffAssigned || staffProfile.is_staff === true;
      staffTitle = staffProfile.staff_title || "";
      staffPermissionData = Array.isArray(staffProfile.staff_permissions) ? staffProfile.staff_permissions : [];
    }
    const profile = { ...roleProfile, is_staff: staffAssigned, staff_title: staffTitle, staff_permissions: staffPermissionData };
    if (profile.role !== "admin" && !profile.is_staff) {
      router.replace("/account");
      return;
    }
    const userIsStaff = profile.role !== "admin" && profile.is_staff;
    const userStaffPermissions = userIsStaff && Array.isArray(profile.staff_permissions)
      ? profile.staff_permissions.filter((permission): permission is AdminSection =>
        typeof permission === "string" && permission in adminSections)
      : [];
    const staffCanSeeProfiles = !userIsStaff || ["users", "admins", "staf", "readers", "kreator", "creator-requests"]
      .some((permission) => userStaffPermissions.includes(permission as AdminSection));
    const resolvedSection = staffSectionAliases[section] ?? section;
    if (userIsStaff && !userStaffPermissions.includes(resolvedSection)) {
      setLoading(false);
      const firstAllowed = staffPermissionOptions.find((option) => userStaffPermissions.includes(option.value));
      router.replace(firstAllowed ? `/admin/${firstAllowed.value}` : "/account");
      return;
    }
    setIsStaff(userIsStaff);
    setStaffPermissions(userStaffPermissions);
    setAdminStaffTitle(userIsStaff ? profile.staff_title || "Staf" : "");
    setAdminUserId(userData.user.id);
    const staffHasAccess = (permission: AdminSection) => !userIsStaff || userStaffPermissions.includes(permission);
    const [requestResult, audioPermissionResult, membershipResult, comicResult, kidsCurationResult] = await Promise.all([
      supabase.from("creator_requests").select("id, user_id, note, portfolio_url, instagram_url, other_url, status, created_at")
        .eq("status", "pending").order("created_at", { ascending: false })
        .or(staffHasAccess("creator-requests") ? "id.not.is.null" : `id.eq.${emptyUuid}`),
      supabase.from("profiles").select("id, can_upload_audio")
        .or(userIsStaff ? `id.eq.${userData.user.id}` : "id.not.is.null"),
      userIsStaff
        ? supabase.from("reader_memberships").select("user_id, tier").eq("user_id", userData.user.id)
        : supabase.from("reader_memberships").select("user_id, tier"),
      supabase.from("comics").select("id, title, slug, synopsis, contributor, genre, cover_key, share_preview_key, status, created_at, creator_id")
        .order("created_at", { ascending: false })
        .or(userIsStaff && !staffHasAccess("comic-review") && !staffHasAccess("comics")
          && !staffHasAccess("kids-review") && !staffHasAccess("share-previews") ? `id.eq.${emptyUuid}` : "id.not.is.null"),
      userIsStaff && !staffHasAccess("kids-review")
        ? supabase.from("comic_kids_curation").select("comic_id, age_range, review_status, submitted_at, review_note").eq("comic_id", emptyUuid)
        : supabase.from("comic_kids_curation").select("comic_id, age_range, review_status, submitted_at, review_note").order("submitted_at", { ascending: true }),
    ]);
    const staffProfilesQuery = supabase.from("profiles")
      .select("id, display_name, role, is_staff, staff_title, staff_permissions, created_at")
      .order("created_at", { ascending: false })
      .or(staffCanSeeProfiles ? "id.not.is.null" : `id.eq.${emptyUuid}`);
    const { data: staffProfileRows, error: staffProfilesError } = await staffProfilesQuery;
    let profileRows: {
      id: string;
      display_name: string;
      role: AdminUser["role"] | "staff";
      is_staff?: boolean;
      staff_title?: string;
      staff_permissions?: string[];
      created_at: string;
    }[] | null = staffProfileRows;
    let profileRowsError = staffProfilesError;
    if (staffProfilesError && (staffProfilesError.code === "42703" || staffProfilesError.code === "PGRST204")) {
      const legacyProfilesResult = await supabase.from("profiles")
        .select("id, display_name, role, created_at")
        .order("created_at", { ascending: false })
        .or(staffCanSeeProfiles ? "id.not.is.null" : `id.eq.${emptyUuid}`);
      profileRowsError = legacyProfilesResult.error;
      profileRows = legacyProfilesResult.data;
      if (!legacyProfilesResult.error) {
        setMessage("Kolom hak akses Staf belum tersedia. Jalankan supabase/staff-access.sql untuk mengaktifkan pengaturan Staf.");
      }
    }
    const loadErrors = [requestResult.error, profileRowsError, membershipResult.error, comicResult.error].filter(Boolean);
    if (loadErrors.length) {
      const missingMembershipTable = membershipResult.error?.code === "42P01" || membershipResult.error?.code === "PGRST205";
      setMessage(missingMembershipTable
        ? "Jalankan supabase/reader-memberships.sql setelah supabase/creator-request.sql untuk mengaktifkan paket reader."
        : loadErrors.map((error) => error?.message).join(" · "));
      setLoading(false);
      return;
    }
    const membershipByUser = new Map((membershipResult.data ?? []).map((membership) => [
      membership.user_id,
      membership.tier === "premium" || membership.tier === "vip" ? membership.tier : "free",
    ]));
    if (audioPermissionResult.error) {
      console.error("Unable to load creator audio permissions:", audioPermissionResult.error);
      setAudioPermissionSetupError("Jalankan supabase/chapter-audio-permissions.sql untuk mengaktifkan akses kreator audio.");
    } else {
      setAudioPermissionSetupError("");
    }
    const audioPermissionByUser = new Map((audioPermissionResult.data ?? []).map((profile) => [
      profile.id,
      profile.can_upload_audio === true,
    ]));
    const loadedProfiles = profileRows ?? [];
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    let emailsByUser = new Map<string, string | null>();
    let accountStatusByUser = new Map<string, AdminAccountStatus>();
    if (!sessionError && sessionData.session?.access_token) {
      try {
        const emailResponse = await fetch("/api/admin/users/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userIds: loadedProfiles.map((profile) => profile.id) }),
        });
        if (!emailResponse.ok) throw new Error(`Email lookup failed with status ${emailResponse.status}`);
        const emailData: unknown = await emailResponse.json();
        if (!emailData || typeof emailData !== "object" || !("emails" in emailData)
          || !emailData.emails || typeof emailData.emails !== "object"
          || !("accountStatuses" in emailData) || !emailData.accountStatuses || typeof emailData.accountStatuses !== "object") {
          throw new Error("Email lookup returned an invalid response");
        }
        emailsByUser = new Map(Object.entries(emailData.emails as Record<string, string | null>));
        accountStatusByUser = new Map(Object.entries(emailData.accountStatuses as Record<string, AdminAccountStatus>));
        setUserEmailSetupError("");
      } catch (error) {
        console.error("Unable to load user emails:", error);
        setUserEmailSetupError("Email pengguna gagal dimuat. Muat ulang halaman untuk mencoba kembali.");
      }
    } else {
      console.error("Unable to load user emails: authenticated session is unavailable.", sessionError);
      setUserEmailSetupError("Email pengguna gagal dimuat. Muat ulang halaman untuk mencoba kembali.");
    }
    const profiles = loadedProfiles.map((profile) => ({
      ...profile,
      role: profile.role === "staff" ? "reader" : profile.role,
      email: emailsByUser.get(profile.id) ?? null,
      staffTitle: profile.staff_title || "",
      isStaff: profile.role !== "admin" && (profile.role === "staff" || profile.is_staff === true),
      staffPermissions: Array.isArray(profile.staff_permissions)
        ? profile.staff_permissions.filter((permission): permission is AdminSection => typeof permission === "string" && permission in adminSections)
        : [],
      accountStatus: accountStatusByUser.get(profile.id) ?? "active",
      canUploadAudio: audioPermissionByUser.get(profile.id) ?? false,
      membershipTier: membershipByUser.get(profile.id) || "free",
    })) as AdminUser[];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    setUsers(profiles);
    setRequests((requestResult.data ?? []).map((request) => ({
      ...request,
      applicant: profileMap.get(request.user_id)?.display_name || "Pengguna tanpa nama",
      role: profileMap.get(request.user_id)?.role || "reader",
    })));
    const comicData = (comicResult.data ?? []) as Omit<AdminComic, "creator">[];
    const kidsCurationByComic = new Map((kidsCurationResult.data ?? []).map((request) => [
      request.comic_id,
      {
        status: request.review_status as AdminComic["kids_curation_status"],
        ageRange: request.age_range as AdminComic["kids_age_range"],
      },
    ]));
    setComics(comicData.map((comic) => ({
      ...comic,
      creator: profileMap.get(comic.creator_id)?.display_name || `Akun ${comic.creator_id.slice(0, 8)}`,
      kids_curation_status: kidsCurationByComic.get(comic.id)?.status ?? null,
      kids_age_range: kidsCurationByComic.get(comic.id)?.ageRange ?? null,
    })));
    if (kidsCurationResult.error) {
      const missingKidsTable = kidsCurationResult.error.code === "42P01" || kidsCurationResult.error.code === "PGRST205";
      if (missingKidsTable) {
        setKidsCurationSetupError("Jalankan supabase/comic-kids-curation.sql untuk mengaktifkan kurasi Kids Mode.");
      } else {
        console.error("Unable to load Kids Mode curation queue:", kidsCurationResult.error);
        setKidsCurationSetupError("Antrean Kids Mode gagal dimuat. Periksa koneksi dan coba lagi.");
      }
    } else {
      const comicMap = new Map(comicData.map((comic) => [comic.id, comic]));
      setKidsCurationReviews((kidsCurationResult.data ?? []).filter((request) => request.review_status === "pending").flatMap((request) => {
        const comic = comicMap.get(request.comic_id);
        if (!comic) return [];
        return [{
          ...request,
          age_range: request.age_range as KidsCurationReview["age_range"],
          title: comic.title,
          slug: comic.slug,
          creator: profileMap.get(comic.creator_id)?.display_name || `Akun ${comic.creator_id.slice(0, 8)}`,
        }];
      }));
    }
    const { data: pendingComics, error: comicError } = await supabase
      .from("comics")
      .select("id, title, slug, synopsis, contributor, created_at, creator_id")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    if (comicError) {
      console.error("Unable to load comics pending review:", comicError);
      setMessage("Daftar komik yang menunggu kurasi gagal dimuat. Coba muat ulang halaman.");
    } else {
      setComicReviews((pendingComics ?? []).map((comic) => ({
        ...comic,
        creator: profileMap.get(comic.creator_id)?.display_name || `Akun ${comic.creator_id.slice(0, 8)}`,
      })));
    }
    setLoading(false);
  });

  const loadPlatformSettings = useEffectEvent(async () => {
    const { data: settingsData, error: settingsError } = await supabase
      .from("platform_settings")
      .select("maintenance_enabled, maintenance_message, announcement_enabled, announcement_message, feature_flags, require_comic_review, creator_applications_enabled, max_comics_per_creator, max_upload_size_mb, max_pages_per_chapter, allowed_image_types, max_interactive_audio_size_mb, max_interactive_audio_duration_seconds, allowed_interactive_audio_types")
      .eq("id", true)
      .maybeSingle();
    const { data: auditData, error: auditError } = await supabase
      .from("platform_settings_audit")
      .select("id, changed_by, changed_at, previous_values, new_values")
      .order("changed_at", { ascending: false })
      .limit(10);
    if (auditError && auditError.code !== "42P01" && auditError.code !== "PGRST205") {
      console.error("Unable to load platform settings audit:", auditError);
    } else {
      setSettingsAudit((auditData ?? []) as SettingsAuditEntry[]);
    }
    if (settingsError) {
      console.error("Unable to load platform settings:", settingsError);
      setPlatformSettingsError("Pengaturan belum dapat dimuat. Jalankan supabase/platform-settings.sql di Supabase SQL Editor, lalu muat ulang halaman.");
    } else if (settingsData) {
      setPlatformSettings({
        ...defaultPlatformSettings,
        ...settingsData,
        feature_flags: { ...defaultPlatformSettings.feature_flags, ...settingsData.feature_flags },
        allowed_image_types: Array.isArray(settingsData.allowed_image_types) ? settingsData.allowed_image_types : defaultPlatformSettings.allowed_image_types,
        allowed_interactive_audio_types: Array.isArray(settingsData.allowed_interactive_audio_types)
          ? settingsData.allowed_interactive_audio_types
          : defaultPlatformSettings.allowed_interactive_audio_types,
      });
      setPlatformSettingsError("");
    } else {
      setPlatformSettings(defaultPlatformSettings);
      setPlatformSettingsError("");
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => loadRequests(), 0);
    return () => window.clearTimeout(timer);
  }, [section]);

  useEffect(() => {
    const navigation = sidebarNavigationRef.current;
    const activeLink = navigation?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!navigation || !activeLink || window.innerWidth > 900) return;
    const navigationBounds = navigation.getBoundingClientRect();
    const linkBounds = activeLink.getBoundingClientRect();
    const nextScrollLeft = navigation.scrollLeft + linkBounds.left - navigationBounds.left
      - (navigation.clientWidth - activeLink.clientWidth) / 2;
    navigation.scrollLeft = nextScrollLeft;
  }, [section, loading]);

  useEffect(() => {
    if (section !== "platform-settings") return;
    const timer = window.setTimeout(() => loadPlatformSettings(), 0);
    return () => window.clearTimeout(timer);
  }, [section]);

  const generateSharePreviews = async () => {
    if (generatingSharePreviews) return;
    if (!publicUrl) {
      setMessage("NEXT_PUBLIC_R2_PUBLIC_URL belum dikonfigurasi.");
      return;
    }
    const comicsToProcess = comics.filter((comic) => comic.status === "published" && comic.cover_key && !comic.share_preview_key);
    if (!comicsToProcess.length) {
      setMessage("Tidak ada komik terbit dengan cover untuk diproses.");
      return;
    }

    setGeneratingSharePreviews(true);
    setMessage("");
    setSharePreviewProgress(`0 dari ${comicsToProcess.length} komik`);
    let generated = 0;
    const failures: string[] = [];
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sesi admin berakhir. Silakan masuk kembali.");

      for (const [index, comic] of comicsToProcess.entries()) {
        try {
          const coverResponse = await fetch(`/api/share-cover?key=${encodeURIComponent(comic.cover_key!)}`);
          if (!coverResponse.ok) throw new Error(`Cover gagal diunduh (${coverResponse.status}).`);
          const preview = await createComicSharePreview(await coverResponse.blob(), comic.title);
          const previewForm = new FormData();
          previewForm.set("comicId", comic.id);
          previewForm.set("coverKey", comic.cover_key!);
          previewForm.set("file", preview, "share-preview.jpg");
          const signResponse = await fetch("/api/r2/share-preview", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: previewForm,
          });
          const signResult = await signResponse.json() as { objectKey?: string; linked?: boolean; error?: string };
          if (!signResponse.ok || !signResult.objectKey) {
            throw new Error(signResult.error || "Pratinjau berbagi gagal diunggah.");
          }
          if (isStaff && !signResult.linked) {
            throw new Error("Pratinjau berhasil diunggah, tetapi belum tertaut ke komik.");
          }
          if (!isStaff) {
            const { error: savePreviewError } = await supabase
              .from("comics")
              .update({ share_preview_key: signResult.objectKey })
              .eq("id", comic.id)
              .eq("status", "published");
            if (savePreviewError) throw new Error("Pratinjau berhasil diunggah, tetapi belum tertaut ke komik.");
          }
          setComics((current) => current.map((item) => item.id === comic.id
            ? { ...item, share_preview_key: signResult.objectKey! }
            : item));
          generated += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          console.error("Unable to generate comic share preview:", { comicId: comic.id, error: errorMessage });
          failures.push(`${comic.title}: Pratinjau berbagi gagal dibuat.`);
        }
        setSharePreviewProgress(`${index + 1} dari ${comicsToProcess.length} komik`);
      }
      setMessage(failures.length
        ? `${generated} pratinjau berhasil dibuat; ${failures.length} gagal. ${failures.slice(0, 3).join(" · ")}`
        : `${generated} pratinjau berbagi komik berhasil dibuat dan disimpan di R2.`);
    } catch (error) {
      console.error("Comic share preview generation failed:", error);
      setMessage("Pratinjau berbagi komik gagal dibuat. Periksa koneksi dan coba lagi.");
    } finally {
      setGeneratingSharePreviews(false);
    }
  };

  const savePlatformSettings = async () => {
    if (savingPlatformSettings) return;
    if (!Number.isInteger(platformSettings.max_comics_per_creator) || platformSettings.max_comics_per_creator < 1 || platformSettings.max_comics_per_creator > 100) {
      setPlatformSettingsMessage("Batas komik harus berupa bilangan bulat antara 1 dan 100.");
      return;
    }
    if (!Number.isInteger(platformSettings.max_upload_size_mb) || platformSettings.max_upload_size_mb < 1 || platformSettings.max_upload_size_mb > 50) {
      setPlatformSettingsMessage("Ukuran file harus berupa bilangan bulat antara 1 dan 50 MB.");
      return;
    }
    if (!Number.isInteger(platformSettings.max_interactive_audio_size_mb)
      || platformSettings.max_interactive_audio_size_mb < 1 || platformSettings.max_interactive_audio_size_mb > 50) {
      setPlatformSettingsMessage("Ukuran audio interaktif harus berupa bilangan bulat antara 1 dan 50 MB.");
      return;
    }
    if (!Number.isInteger(platformSettings.max_interactive_audio_duration_seconds)
      || platformSettings.max_interactive_audio_duration_seconds < 1 || platformSettings.max_interactive_audio_duration_seconds > 60) {
      setPlatformSettingsMessage("Durasi audio interaktif harus berupa bilangan bulat antara 1 dan 60 detik.");
      return;
    }
    if (!Number.isInteger(platformSettings.max_pages_per_chapter) || platformSettings.max_pages_per_chapter < 1 || platformSettings.max_pages_per_chapter > 500) {
      setPlatformSettingsMessage("Batas halaman harus berupa bilangan bulat antara 1 dan 500.");
      return;
    }
    if (platformSettings.announcement_enabled && !platformSettings.announcement_message.trim()) {
      setPlatformSettingsMessage("Isi banner pengumuman sebelum mengaktifkannya.");
      return;
    }
    if (platformSettings.maintenance_enabled && !platformSettings.maintenance_message.trim()) {
      setPlatformSettingsMessage("Isi pesan pemeliharaan sebelum mengaktifkannya.");
      return;
    }
    if (!platformSettings.allowed_image_types.length) {
      setPlatformSettingsMessage("Pilih minimal satu format gambar yang diizinkan.");
      return;
    }
    if (!platformSettings.allowed_interactive_audio_types.length) {
      setPlatformSettingsMessage("Pilih minimal satu format audio yang diizinkan.");
      return;
    }
    setSavingPlatformSettings(true);
    setPlatformSettingsMessage("");
    const { error } = await supabase.from("platform_settings").upsert({
      id: true,
      ...platformSettings,
      updated_by: adminUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) {
      console.error("Unable to save platform settings:", error);
      setPlatformSettingsMessage(error.code === "42P01" || error.code === "PGRST205"
        ? "Tabel pengaturan belum tersedia. Jalankan supabase/platform-settings.sql di Supabase SQL Editor."
        : "Pengaturan gagal disimpan. Periksa koneksi dan coba lagi.");
    } else {
      updateSettings(platformSettings);
      setPlatformSettingsMessage("Pengaturan platform berhasil disimpan.");
      const { data: auditData } = await supabase.from("platform_settings_audit").select("id, changed_by, changed_at, previous_values, new_values").order("changed_at", { ascending: false }).limit(10);
      setSettingsAudit((auditData ?? []) as SettingsAuditEntry[]);
    }
    setSavingPlatformSettings(false);
  };

  const reviewRequest = async (request: CreatorRequest, status: "approved" | "rejected") => {
    setActionId(request.id);
    setMessage("");
    const { error } = await supabase.rpc("review_creator_request", { p_request_id: request.id, p_decision: status });
    if (error) {
      console.error("Unable to review creator request:", error);
      setMessage("Pengajuan kreator gagal diperbarui. Periksa koneksi dan coba lagi.");
      setActionId(null);
      return;
    }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, role: status === "approved" ? "creator" : item.role } : item));
    if (status === "approved") {
      setUsers((current) => current.map((user) => user.id === request.user_id ? { ...user, role: "creator" } : user));
    }
    setMessage(status === "approved" ? "Akses kreator disetujui." : "Pengajuan akses kreator ditolak.");
    setActionId(null);
  };

  const performAdminUserAction = async (
    user: AdminUser,
    action: "edit" | "block" | "unblock" | "deactivate",
    values?: { displayName: string; role: "reader" | "creator"; isStaff: boolean; staffTitle: string; staffPermissions: AdminSection[] },
  ) => {
    setActionId(user.id);
    setMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sesi admin berakhir. Silakan masuk kembali.");
      const response = await fetch("/api/admin/users/actions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, userId: user.id, ...values }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : `Permintaan gagal (${response.status}).`;
        throw new Error(errorMessage);
      }
      if (action === "edit" && values) {
        const updatedUser = {
          ...user,
          display_name: values.displayName,
          role: values.role,
          isStaff: values.isStaff,
          staffTitle: values.isStaff ? values.staffTitle : "",
          staffPermissions: values.isStaff ? values.staffPermissions : [],
          canUploadAudio: values.role === "reader" ? false : user.canUploadAudio,
        };
        setUsers((current) => current.map((item) => item.id === user.id ? updatedUser : item));
        setSelectedUserDialog({ user: updatedUser, mode: "view" });
        setMessage("Data pengguna berhasil diperbarui.");
      } else {
        const accountStatus: AdminAccountStatus = action === "block"
          ? "blocked"
          : action === "deactivate"
            ? "deleted"
            : "active";
        const updatedUser = { ...user, accountStatus };
        setUsers((current) => current.map((item) => item.id === user.id ? updatedUser : item));
        setSelectedUserDialog((current) => current?.user.id === user.id ? { ...current, user: updatedUser } : current);
        setMessage(action === "block"
          ? `Akun ${user.display_name} berhasil diblokir.`
          : action === "deactivate"
            ? `Akun ${user.display_name} dinonaktifkan. Data dan kontennya tetap tersimpan.`
            : `Akun ${user.display_name} berhasil diaktifkan kembali.`);
      }
    } catch (error) {
      console.error("Unable to manage admin user:", error);
      setMessage(error instanceof Error ? error.message : "Tindakan pada pengguna gagal. Periksa koneksi dan coba lagi.");
    } finally {
      setActionId(null);
    }
  };

  const updateReaderMembership = async (user: AdminUser, tier: ReaderMembershipTier) => {
    setActionId(user.id);
    setMessage("");
    const { error } = await supabase.from("reader_memberships").upsert({
      user_id: user.id,
      tier,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Unable to update reader membership:", error);
      setMessage("Paket keanggotaan tidak dapat diperbarui. Periksa koneksi dan coba lagi.");
    } else {
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, membershipTier: tier } : item));
      setMessage(`Paket ${user.display_name} diubah menjadi ${tier.toUpperCase()}.`);
    }
    setActionId(null);
  };

  const updateCreatorAudioAccess = async (user: AdminUser, canUploadAudio: boolean) => {
    setActionId(user.id);
    setMessage("");
    const { error } = await supabase.from("profiles").update({ can_upload_audio: canUploadAudio }).eq("id", user.id);
    if (error) {
      console.error("Unable to update creator audio permission:", error);
      setMessage("Hak unggah audio gagal diperbarui. Pastikan migrasi izin audio sudah dijalankan.");
    } else {
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, canUploadAudio } : item));
      setMessage(`Akses kreator audio ${user.display_name} ${canUploadAudio ? "diaktifkan" : "dinonaktifkan"}.`);
    }
    setActionId(null);
  };

  const openUserEdit = (user: AdminUser) => {
    setUserEditRole(user.role === "admin" ? "reader" : user.role);
    setUserEditIsStaff(user.isStaff);
    setUserEditStaffTitle(user.staffTitle || "Staf");
    setUserEditStaffPermissions(user.staffPermissions.length ? user.staffPermissions : defaultStaffPermissions);
    setSelectedUserDialog({ user, mode: "edit" });
  };

  const canAccessSection = (target: AdminSection) => {
    const resolvedSection = staffSectionAliases[target] ?? target;
    return !isStaff || staffPermissions.includes(resolvedSection);
  };

  const updateComicStatus = async (comic: AdminComic, status: "pending_review" | "archived" | "draft") => {
    setComicActionId(comic.id);
    setMessage("");
    const { data, error } = await supabase
      .from("comics")
      .update({ status })
      .eq("id", comic.id)
      .eq("status", comic.status)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("Unable to update comic status:", error);
      setMessage(error
        ? "Status komik gagal diperbarui. Periksa koneksi dan coba lagi."
        : "Status komik sudah berubah. Muat ulang halaman.");
    } else {
      setComics((current) => current.map((item) => item.id === comic.id ? { ...item, status } : item));
      if (status === "pending_review") {
        const reviewItem: ComicReview = { ...comic };
        setComicReviews((current) => [reviewItem, ...current]);
      } else {
        setComicReviews((current) => current.filter((item) => item.id !== comic.id));
      }
      setMessage(`${comic.title}: status diubah menjadi ${comicStatusLabels[status]}.`);
    }
    setComicActionId(null);
  };

  const reviewComic = async (comic: ComicReview, decision: "published" | "draft") => {
    setComicActionId(comic.id);
    setMessage("");
    const { error } = await supabase.rpc("review_comic_submission", {
      p_comic_id: comic.id,
      p_decision: decision,
    });
    if (error) {
      console.error("Unable to review comic:", error);
      setMessage(error.message.includes("no longer pending")
        ? "Komik ini sudah dikurasi admin atau staf lain. Muat ulang halaman."
        : "Kurasi komik gagal diperbarui. Periksa koneksi dan pastikan supabase/staff-access.sql sudah dijalankan.");
      setComicActionId(null);
      return;
    }
    setComicReviews((current) => current.filter((item) => item.id !== comic.id));
    setComics((current) => current.map((item) => item.id === comic.id ? { ...item, status: decision } : item));
    setMessage(decision === "published" ? `${comic.title} berhasil diterbitkan.` : `${comic.title} ditolak dan dikembalikan ke draft.`);
    setComicActionId(null);
  };

  const reviewKidsCuration = async (request: KidsCurationReview, decision: "approved" | "rejected") => {
    const reviewNote = kidsReviewNotes[request.comic_id]?.trim() ?? "";
    if (decision === "rejected" && !reviewNote) {
      setMessage("Tambahkan alasan sebelum menolak pengajuan Kids Mode.");
      return;
    }
    setComicActionId(request.comic_id);
    setMessage("");
    const { data, error } = await supabase
      .from("comic_kids_curation")
      .update({
        review_status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
        review_note: decision === "rejected" ? reviewNote : "",
      })
      .eq("comic_id", request.comic_id)
      .eq("review_status", "pending")
      .select("comic_id")
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("Unable to review Kids Mode request:", error);
      setMessage(error
        ? "Kurasi Kids Mode gagal diperbarui. Periksa koneksi dan coba lagi."
        : "Pengajuan ini sudah ditinjau admin lain. Muat ulang halaman.");
    } else {
      setKidsCurationReviews((current) => current.filter((item) => item.comic_id !== request.comic_id));
      setComics((current) => current.map((comic) => comic.id === request.comic_id
        ? { ...comic, kids_curation_status: decision }
        : comic));
      setKidsReviewNotes((current) => {
        const next = { ...current };
        delete next[request.comic_id];
        return next;
      });
      setMessage(decision === "approved"
        ? `${request.title} disetujui untuk Kids Mode.`
        : `${request.title} ditolak dari Kids Mode.`);
    }
    setComicActionId(null);
  };

  const filteredUsers = users
    .filter((user) => section === "readers" ? user.role === "reader"
      : section === "kreator" ? user.role === "creator"
        : section === "admins" ? user.role === "admin"
          : section === "staf" ? user.isStaff
            : true)
    .filter((user) => `${user.display_name} ${user.email ?? ""} ${user.id}`.toLowerCase().includes(userSearch.toLowerCase()))
    .filter((user) => section !== "users" || userRoleFilter === "all" || user.role === userRoleFilter)
    .sort((first, second) => Number(second.role === "admin") - Number(first.role === "admin"));
  const filteredComics = comics.filter((comic) => {
    const matchesSearch = `${comic.title} ${comic.creator} ${comic.genre}`.toLowerCase().includes(comicSearch.toLowerCase());
    const matchesPublicationStatus = comicStatusFilter === "all" || comic.status === comicStatusFilter;
    const matchesKidsStatus = kidsCurationFilter === "all"
      || (kidsCurationFilter === "not_submitted" ? comic.kids_curation_status === null : comic.kids_curation_status === kidsCurationFilter);
    return matchesSearch && matchesPublicationStatus && matchesKidsStatus;
  });
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const publishedComics = comics.filter((comic) => comic.status === "published").length;
  const generatedSharePreviews = comics.filter((comic) => comic.status === "published" && comic.share_preview_key);

  if (loading) return <main className="admin-shell"><LoaderCircle className="spin" size={24} /></main>;
  if (isStaff && !canAccessSection(section)) {
    return <main className="admin-shell"><LoaderCircle className="spin" size={24} /></main>;
  }

  return (
    <main className="admin-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <BrandLogo className="admin-brand" showName />
          <nav ref={sidebarNavigationRef} className="admin-sidebar-links" aria-label="Navigasi dashboard admin">
            <p className="admin-sidebar-label">Administrasi</p>
            {(["overview", "analytics"] as AdminSection[]).some(canAccessSection) && <div className="admin-sidebar-group" aria-label="Dasbor">
              <p className="admin-sidebar-group-label">Dasbor</p>
              {canAccessSection("overview") && <Link href="/admin/overview" aria-current={section === "overview" ? "page" : undefined}><LayoutDashboard size={18} /><span>Ringkasan</span></Link>}
              {canAccessSection("analytics") && <Link href="/admin/analytics" aria-current={section === "analytics" ? "page" : undefined}><ChartNoAxesColumn size={18} /><span>Analitik</span></Link>}
            </div>}
            {(["comic-review", "kids-review", "creator-requests"] as AdminSection[]).some(canAccessSection) && <div className="admin-sidebar-group" aria-label="Moderasi">
              <p className="admin-sidebar-group-label">Moderasi</p>
              {canAccessSection("comic-review") && <Link href="/admin/comic-review" aria-current={section === "comic-review" ? "page" : undefined}><BookOpen size={18} /><span>Kurasi komik</span>{comicReviews.length > 0 && <small>{comicReviews.length}</small>}</Link>}
              {canAccessSection("kids-review") && <Link href="/admin/kids-review" aria-current={section === "kids-review" ? "page" : undefined}><ShieldCheck size={18} /><span>Kurasi Kids Mode</span>{kidsCurationReviews.length > 0 && <small>{kidsCurationReviews.length}</small>}</Link>}
              {canAccessSection("creator-requests") && <Link href="/admin/creator-requests" aria-current={section === "creator-requests" ? "page" : undefined}><ClipboardList size={18} /><span>Pengajuan kreator</span>{requests.length > 0 && <small>{requests.length}</small>}</Link>}
            </div>}
            {(["users", "admins", "staf", "readers", "kreator"] as AdminSection[]).some(canAccessSection) && <div className="admin-sidebar-group" aria-label="Pengguna">
              <p className="admin-sidebar-group-label">Pengguna</p>
              {canAccessSection("users") && <Link href="/admin/users" aria-current={section === "users" ? "page" : undefined}><Users size={18} /><span>Semua pengguna</span></Link>}
              {canAccessSection("admins") && <Link href="/admin/admins" aria-current={section === "admins" ? "page" : undefined}><ShieldCheck size={18} /><span>Admin</span></Link>}
              {canAccessSection("staf") && <Link href="/admin/staf" aria-current={section === "staf" ? "page" : undefined}><UserRound size={18} /><span>Staf</span></Link>}
              {canAccessSection("readers") && <Link href="/admin/readers" aria-current={section === "readers" ? "page" : undefined}><UserRound size={18} /><span>Pembaca</span></Link>}
              {canAccessSection("kreator") && <Link href="/admin/kreator" aria-current={section === "kreator" ? "page" : undefined}><Users size={18} /><span>Kreator</span></Link>}
            </div>}
            {(["comics", "articles", "share-previews", "homepage-promos"] as AdminSection[]).some(canAccessSection) && <div className="admin-sidebar-group" aria-label="Kelola konten">
              <p className="admin-sidebar-group-label">Kelola konten</p>
              {canAccessSection("comics") && <Link href="/admin/comics" aria-current={section === "comics" ? "page" : undefined}><BookOpen size={18} /><span>Katalog komik</span></Link>}
              {canAccessSection("articles") && <Link href="/admin/articles" aria-current={section === "articles" ? "page" : undefined}><FileText size={18} /><span>Artikel</span></Link>}
              {canAccessSection("share-previews") && <Link href="/admin/share-previews" aria-current={section === "share-previews" ? "page" : undefined}><ImageIcon size={18} /><span>Pratinjau berbagi</span></Link>}
              {canAccessSection("homepage-promos") && <Link href="/admin/homepage-promos" aria-current={section === "homepage-promos" ? "page" : undefined}><ImageIcon size={18} /><span>Hero & promo beranda</span></Link>}
            </div>}
            {(["sponsor-campaigns", "ad-requests", "ad-slots"] as AdminSection[]).some(canAccessSection) && <div className="admin-sidebar-group" aria-label="Manajemen iklan">
              <p className="admin-sidebar-group-label">Manajemen iklan</p>
              {canAccessSection("sponsor-campaigns") && <Link href="/admin/sponsor-campaigns" aria-current={section === "sponsor-campaigns" || section === "ads-management" ? "page" : undefined}><Megaphone size={18} /><span>Kampanye sponsor</span></Link>}
              {canAccessSection("ad-requests") && <Link href="/admin/ad-requests" aria-current={section === "ad-requests" ? "page" : undefined}><ClipboardList size={18} /><span>Pengajuan iklan</span></Link>}
              {canAccessSection("ad-slots") && <Link href="/admin/ad-slots" aria-current={section === "ad-slots" || section === "ads-list" ? "page" : undefined}><List size={18} /><span>Slot iklan</span></Link>}
            </div>}
            {canAccessSection("contact-messages") && <div className="admin-sidebar-group" aria-label="Komunikasi">
              <p className="admin-sidebar-group-label">Komunikasi</p>
              <Link href="/admin/contact-messages" aria-current={section === "contact-messages" ? "page" : undefined}><Mail size={18} /><span>Pesan kontak</span></Link>
            </div>}
            {canAccessSection("platform-settings") && <div className="admin-sidebar-group" aria-label="Pengaturan">
              <p className="admin-sidebar-group-label">Pengaturan</p>
              <Link href="/admin/platform-settings" aria-current={section === "platform-settings" ? "page" : undefined}><Settings2 size={18} /><span>Pengaturan platform</span></Link>
            </div>}
          </nav>
          <div className="admin-sidebar-user">
            <span className="admin-user-avatar"><ShieldCheck size={18} /></span>
            <span><strong>{isStaff ? adminStaffTitle : "Administrator"}</strong><small>{isStaff ? "Akses staf" : "Akses penuh"}</small></span>
            <Link href="/account" aria-label="Kembali ke Akun"><ArrowLeft size={17} /></Link>
          </div>
        </aside>
        <div className="admin-main">
          <div className="admin-mobile-header"><BrandLogo showName /><Link className="admin-account-link" href="/account"><ArrowLeft size={16} /> Akun</Link></div>
          <header className="admin-header">
            <p className="eyebrow">Panel administrasi</p>
            <div className="admin-title">
              <div><h1>{adminSections[section].label}</h1><p>{adminSections[section].description}</p></div>
            </div>
          </header>
          <section className="admin-content">
        {message && <p className="admin-message" role="status">{message}</p>}
        {section === "overview" && <section className="admin-dashboard" id="overview" aria-label="Ringkasan">
          <article className="admin-stat"><span>{isStaff ? "Kreator" : "Total pengguna"}</span><strong>{isStaff ? users.filter((user) => user.role === "creator").length : users.length}</strong><UserRound size={20} /></article>
          <article className="admin-stat"><span>Total komik</span><strong>{comics.length}</strong><BookOpen size={20} /></article>
          <article className="admin-stat"><span>Komik terbit</span><strong>{publishedComics}</strong><Eye size={20} /></article>
          <article className="admin-stat"><span>Perlu ditinjau</span><strong>{comicReviews.length + pendingRequests}</strong><ShieldCheck size={20} /></article>
        </section>}
        {(section === "ads-management" || section === "sponsor-campaigns") && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Monetisasi platform</p><h2>Kampanye sponsor</h2><p>Kelola kampanye, materi, target komik, dan periode tayang. Kampanye aktif ditayangkan pada slot selama periode kampanye.</p></div>
          </div>
          <AdsManagementPanel key="campaigns" mode="campaigns" />
        </section>}
        {(section === "ads-list" || section === "ad-slots") && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Monetisasi platform</p><h2>Slot iklan</h2><p>Kelola lokasi penayangan, format, kode, serta status aktif setiap slot.</p></div>
          </div>
          <AdsManagementPanel key="slots" mode="slots" />
        </section>}
        {section === "homepage-promos" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Konten beranda</p><h2>Hero & promo beranda</h2><p>Buat carousel promo dengan gambar dan konten bebas, tanpa mengambil data dari katalog komik.</p></div>
          </div>
          <HomepagePromosPanel />
        </section>}
        {section === "articles" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Konten editorial</p><h2>Kelola artikel</h2><p>Tulis Markdown, cek pratinjau, atur metadata pencarian, dan terbitkan artikel seputar komik.</p></div>
          </div>
          <ArticlesPanel />
        </section>}
        {section === "ad-requests" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Monetisasi platform</p><h2>Pengajuan iklan</h2><p>Persetujuan mengaktifkan kampanye di sistem iklan publik untuk setiap slot yang dipilih. Pastikan materi, jadwal, dan ketersediaan slot sudah dikonfirmasi.</p></div>
          </div>
          <AdRequestsPanel />
        </section>}
        {section === "contact-messages" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Komunikasi pengunjung</p><h2>Pesan kontak</h2><p>Baca pertanyaan dari pengunjung, hubungi mereka melalui email, dan perbarui status tindak lanjut.</p></div>
          </div>
          <ContactMessagesPanel />
        </section>}
        {section === "platform-settings" && <section className="admin-management-section admin-platform-settings">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Operasional</p><h2>Situs web dan platform</h2></div>
          </div>
          {platformSettingsError ? <p className="admin-settings-error" role="alert">{platformSettingsError}</p> : <>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Mode pemeliharaan</h3><p>Pengunjung akan melihat halaman pemeliharaan. Panel admin dan halaman masuk tetap bisa digunakan.</p></div><label className="admin-switch"><input type="checkbox" checked={platformSettings.maintenance_enabled} onChange={(event) => setPlatformSettings((current) => ({ ...current, maintenance_enabled: event.target.checked }))} /><span /></label></div>
              <label className="admin-setting-field">Pesan pemeliharaan<textarea value={platformSettings.maintenance_message} onChange={(event) => setPlatformSettings((current) => ({ ...current, maintenance_message: event.target.value }))} maxLength={500} rows={3} /></label>
            </article>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Banner pengumuman</h3><p>Tampilkan pengumuman di bagian atas halaman untuk semua pengunjung.</p></div><label className="admin-switch"><input type="checkbox" checked={platformSettings.announcement_enabled} onChange={(event) => setPlatformSettings((current) => ({ ...current, announcement_enabled: event.target.checked }))} /><span /></label></div>
              <label className="admin-setting-field">Isi pengumuman<textarea value={platformSettings.announcement_message} onChange={(event) => setPlatformSettings((current) => ({ ...current, announcement_message: event.target.value }))} maxLength={300} rows={3} placeholder="Tulis pengumuman untuk pembaca dan kreator..." /></label>
            </article>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Status fitur</h3><p>Fitur yang dimatikan akan menampilkan pemberitahuan dan tidak bisa dibuka pengunjung. Komentar belum tersedia; statusnya disimpan untuk aktivasi di masa mendatang.</p></div></div>
              <div className="admin-feature-toggles">
                {([
                  ["reading", "Membaca komik"],
                  ["search", "Pencarian komik"],
                  ["creators", "Area kreator"],
                  ["comments", "Komentar (siap untuk fitur mendatang)"],
                  ["favorites", "Favorit komik"],
                ] as const).map(([feature, label]) => (
                  <label className="admin-feature-toggle" key={feature}><span>{label}</span><input type="checkbox" checked={platformSettings.feature_flags[feature]} onChange={(event) => setPlatformSettings((current) => ({ ...current, feature_flags: { ...current.feature_flags, [feature]: event.target.checked } }))} /></label>
                ))}
              </div>
            </article>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Moderasi & publikasi</h3><p>Atur proses peninjauan komik dan penerimaan kreator baru.</p></div></div>
              <div className="admin-setting-checks">
                <label className="admin-feature-toggle"><span>Wajib kurasi admin sebelum komik tayang</span><input type="checkbox" checked={platformSettings.require_comic_review} onChange={(event) => setPlatformSettings((current) => ({ ...current, require_comic_review: event.target.checked }))} /></label>
                <label className="admin-feature-toggle"><span>Terima pengajuan kreator baru</span><input type="checkbox" checked={platformSettings.creator_applications_enabled} onChange={(event) => setPlatformSettings((current) => ({ ...current, creator_applications_enabled: event.target.checked }))} /></label>
              </div>
              <p className="admin-setting-note">{platformSettings.require_comic_review ? "Kreator mengajukan komik untuk ditinjau admin sebelum tayang." : "Kreator dapat menerbitkan komik secara langsung."}</p>
            </article>
            <article className="admin-setting-card">
              <div className="admin-setting-heading"><div><h3>Batas unggahan</h3><p>Batasi jumlah karya dan ukuran konten untuk mengendalikan kapasitas serta biaya penyimpanan.</p></div></div>
              <div className="admin-setting-number-grid">
                <label>Komik maksimum per kreator<input type="number" min={1} max={100} value={platformSettings.max_comics_per_creator} onChange={(event) => setPlatformSettings((current) => ({ ...current, max_comics_per_creator: Number(event.target.value) }))} /></label>
                <label>Ukuran maksimum per gambar (MB)<input type="number" min={1} max={50} value={platformSettings.max_upload_size_mb} onChange={(event) => setPlatformSettings((current) => ({ ...current, max_upload_size_mb: Number(event.target.value) }))} /></label>
                <label>Halaman maksimum per bab<input type="number" min={1} max={500} value={platformSettings.max_pages_per_chapter} onChange={(event) => setPlatformSettings((current) => ({ ...current, max_pages_per_chapter: Number(event.target.value) }))} /></label>
              </div>
              <fieldset className="admin-image-types"><legend>Format gambar yang diizinkan</legend>
                {([["image/jpeg", "JPG / JPEG"], ["image/png", "PNG"], ["image/webp", "WebP"]] as const).map(([type, label]) => (
                  <label key={type}><input type="checkbox" checked={platformSettings.allowed_image_types.includes(type)} onChange={(event) => setPlatformSettings((current) => ({ ...current, allowed_image_types: event.target.checked ? [...current.allowed_image_types, type] : current.allowed_image_types.filter((item) => item !== type) }))} /> {label}</label>
                ))}
              </fieldset>
              <div className="admin-setting-number-grid">
                <label>Ukuran maksimum audio interaktif (MB)<input type="number" min={1} max={50} value={platformSettings.max_interactive_audio_size_mb} onChange={(event) => setPlatformSettings((current) => ({ ...current, max_interactive_audio_size_mb: Number(event.target.value) }))} /></label>
                <label>Durasi maksimum audio interaktif (detik)<input type="number" min={1} max={60} value={platformSettings.max_interactive_audio_duration_seconds} onChange={(event) => setPlatformSettings((current) => ({ ...current, max_interactive_audio_duration_seconds: Number(event.target.value) }))} /></label>
              </div>
              <fieldset className="admin-image-types"><legend>Format audio interaktif yang diizinkan</legend>
                {([["audio/mpeg", "MP3"], ["audio/ogg", "OGG / Opus"]] as const).map(([type, label]) => (
                  <label key={type}><input type="checkbox" checked={platformSettings.allowed_interactive_audio_types.includes(type)} onChange={(event) => setPlatformSettings((current) => ({ ...current, allowed_interactive_audio_types: event.target.checked ? [...current.allowed_interactive_audio_types, type] : current.allowed_interactive_audio_types.filter((item) => item !== type) }))} /> {label}</label>
                ))}
              </fieldset>
              <p className="admin-setting-note">Batas komik dan halaman hanya mencegah penambahan baru, tanpa menghapus konten lama. Batas ukuran dan durasi suara berlaku untuk unggahan marker baru.</p>
            </article>
            <div className="admin-settings-actions">
              <button className="approve-button" type="button" onClick={() => void savePlatformSettings()} disabled={savingPlatformSettings}>{savingPlatformSettings ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{savingPlatformSettings ? "Menyimpan..." : "Simpan pengaturan"}</button>
              {platformSettingsMessage && <p role={platformSettingsMessage.startsWith("Pengaturan platform berhasil") ? "status" : "alert"}>{platformSettingsMessage}</p>}
            </div>
            <article className="admin-setting-card admin-settings-audit">
              <div className="admin-setting-heading"><div><h3>Riwayat perubahan</h3><p>Perubahan pengaturan platform terbaru.</p></div></div>
              {settingsAudit.length ? <ol>{settingsAudit.map((entry) => {
                const changed = Object.keys(platformSettingLabels).filter((key) =>
                  JSON.stringify(entry.previous_values[key]) !== JSON.stringify(entry.new_values[key]));
                const actor = users.find((user) => user.id === entry.changed_by)?.display_name || "Admin";
                return <li key={entry.id}><span><strong>{changed.map((key) => platformSettingLabels[key]).join(", ") || "Pengaturan platform"}</strong><small>Oleh {actor}</small></span><time dateTime={entry.changed_at}>{new Date(entry.changed_at).toLocaleString("id-ID")}</time></li>;
              })}</ol> : <p className="admin-setting-note">Belum ada perubahan yang tercatat.</p>}
            </article>
          </>}
        </section>}
        {section === "analytics" && <AdminAnalyticsPanel />}
        {section === "share-previews" && <section className="admin-management-section">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Gambar sosial</p><h2>Pratinjau berbagi komik</h2></div>
            <span>{comics.filter((comic) => comic.status === "published" && comic.cover_key && !comic.share_preview_key).length} komik belum memiliki pratinjau</span>
          </div>
          <p>Sampul diolah di peramban menjadi JPG lanskap, lalu disimpan sebagai berkas statis di R2. Layanan penyimpanan hanya menyediakan alamat unggah dan tidak mengolah gambar. Tombol ini membuat pratinjau untuk komik terbit yang belum memilikinya.</p>
          {sharePreviewProgress && <p role="status">{sharePreviewProgress}</p>}
          <button className="approve-button" type="button" onClick={() => void generateSharePreviews()} disabled={generatingSharePreviews}>
            {generatingSharePreviews ? <LoaderCircle className="spin" size={16} /> : <ImageIcon size={16} />}
            {generatingSharePreviews ? "Membuat pratinjau..." : "Buat pratinjau untuk semua komik terbit"}
          </button>
          <div className="admin-section-heading">
            <div><p className="eyebrow">Tersimpan di R2</p><h2>Pratinjau yang sudah dibuat</h2></div>
            <span>{generatedSharePreviews.length} komik</span>
          </div>
          {generatedSharePreviews.length ? (
            <div className="request-table-wrap">
              <table className="request-table">
                <thead>
                  <tr><th>Pratinjau</th><th>Komik</th><th>Status</th><th>Berkas R2</th></tr>
                </thead>
                <tbody>
                  {generatedSharePreviews.map((comic) => {
                    const previewUrl = publicUrl
                      ? `${publicUrl.replace(/\/$/, "")}/${comic.share_preview_key!.split("/").map(encodeURIComponent).join("/")}`
                      : "";
                    return (
                      <tr key={comic.id}>
                        <td>
                          {previewUrl && (
                            <a href={previewUrl} target="_blank" rel="noreferrer" aria-label={`Buka pratinjau berbagi ${comic.title}`}>
                              <Image
                                src={previewUrl}
                                alt={`Pratinjau berbagi ${comic.title}`}
                                width={120}
                                height={63}
                                unoptimized
                                style={{ width: 120, height: 63, objectFit: "cover", borderRadius: 6 }}
                              />
                            </a>
                          )}
                        </td>
                        <td><strong>{comic.title}</strong><code>{comic.slug}</code></td>
                        <td><span className="request-status request-approved">Sudah dibuat</span></td>
                        <td>{previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Lihat berkas JPG</a>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty"><ImageIcon size={26} /><h2>Belum ada pratinjau yang dibuat.</h2><p>Pratinjau komik akan tercatat di tabel ini setelah proses berhasil.</p></div>
          )}
        </section>}
        {section === "comic-review" && <section className="comic-review-section" id="comic-review">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Antrean publikasi</p><h2>Kurasi komik</h2></div>
            <span>{comicReviews.length} menunggu kurasi</span>
          </div>
          {comicReviews.length === 0 ? (
            <div className="admin-empty comic-review-empty"><ShieldCheck size={26} /><h2>Tidak ada komik untuk ditinjau.</h2><p>Pengajuan komik dari kreator akan tampil di sini.</p></div>
          ) : (
            <div className="comic-review-list">
              {comicReviews.map((comic) => (
                <article className="comic-review-card" key={comic.id}>
                  <div className="comic-review-copy">
                    <span className="request-status request-pending">Menunggu kurasi</span>
                    <h3>{comic.title}</h3>
                    <p className="comic-review-creator">Oleh {comic.creator} · {new Date(comic.created_at).toLocaleDateString("id-ID")}</p>
                    <p className="comic-review-synopsis">{comic.synopsis}</p>
                    {comic.contributor && <p className="comic-review-contributor">Kontributor: {comic.contributor}</p>}
                  </div>
                  <div className="comic-review-actions">
                    <Link className="button button-light" href={`/account/komik/${comic.id}`}><Eye size={15} /> Tinjau komik</Link>
                    <button className="approve-button" onClick={() => reviewComic(comic, "published")} disabled={comicActionId === comic.id}><Check size={16} /> Terbitkan</button>
                    <button className="reject-button" onClick={() => reviewComic(comic, "draft")} disabled={comicActionId === comic.id}><X size={16} /> Kembalikan ke draf</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>}
        {section === "kids-review" && <section className="comic-review-section" id="kids-review">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Library anak</p><h2>Kurasi Kids Mode</h2></div>
            <span>{kidsCurationReviews.length} pengajuan menunggu</span>
          </div>
          {kidsCurationSetupError ? (
            <div className="admin-empty"><ShieldCheck size={26} /><h2>Kurasi Kids Mode belum siap.</h2><p>{kidsCurationSetupError}</p></div>
          ) : kidsCurationReviews.length === 0 ? (
            <div className="admin-empty"><ShieldCheck size={26} /><h2>Tidak ada pengajuan Kids Mode.</h2><p>Pengajuan kreator akan muncul di sini. Status terbit komik tidak terpengaruh oleh keputusan kurasi anak.</p></div>
          ) : (
            <div className="comic-review-list">
              {kidsCurationReviews.map((request) => (
                <article className="comic-review-card" key={request.comic_id}>
                  <div className="comic-review-copy">
                    <span className="request-status request-pending">Menunggu kurasi anak</span>
                    <h3>{request.title}</h3>
                    <p className="comic-review-creator">Oleh {request.creator} · diajukan {new Date(request.submitted_at).toLocaleDateString("id-ID")}</p>
                    <p>Rentang usia: {request.age_range === "4_6" ? "4–6 tahun" : request.age_range === "7_9" ? "7–9 tahun" : "10–12 tahun"}</p>
                    <Link className="admin-manage-link" href={`/comic/${request.slug}`} target="_blank">Pratinjau komik</Link>
                    <label className="admin-kids-review-note">Catatan penolakan
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={kidsReviewNotes[request.comic_id] ?? ""}
                        onChange={(event) => setKidsReviewNotes((current) => ({ ...current, [request.comic_id]: event.target.value }))}
                        placeholder="Wajib diisi jika pengajuan ditolak"
                      />
                    </label>
                  </div>
                  <div className="comic-review-actions">
                    <button className="approve-button" onClick={() => void reviewKidsCuration(request, "approved")} disabled={comicActionId === request.comic_id}>
                      {comicActionId === request.comic_id ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Setujui untuk anak
                    </button>
                    <button className="reject-button" onClick={() => void reviewKidsCuration(request, "rejected")} disabled={comicActionId === request.comic_id}>
                      <X size={16} /> Tolak
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>}
        {section === "creator-requests" && <section className="creator-requests-section" id="creator-requests">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Akses kreator</p><h2>Pengajuan kreator</h2></div>
            <span>{requests.length} menunggu</span>
          </div>
          {requests.length === 0 ? (
            <div className="admin-empty"><ShieldCheck size={28} /><h2>Tidak ada pengajuan yang menunggu.</h2><p>Pengajuan lama yang sudah disetujui atau ditolak tidak ditampilkan di antrean ini.</p></div>
          ) : (
            <div className="request-table-wrap">
              <table className="request-table">
                <thead><tr><th>Pengaju</th><th>Catatan</th><th>Portofolio & media sosial</th><th>Tanggal</th><th>Status</th><th>Tindakan</th></tr></thead>
                <tbody>{requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.applicant}</strong><code>{request.user_id.slice(0, 8)}...</code></td>
                    <td><p className="request-preview">{request.note || "Tidak ada catatan."}</p><button className="view-button" onClick={() => setSelectedRequest(request)}>Lihat</button></td>
                    <td><div className="request-links compact-links">{request.portfolio_url && <a href={request.portfolio_url} target="_blank" rel="noreferrer">Portofolio</a>}{request.instagram_url && <a href={request.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}{request.other_url && <a href={request.other_url} target="_blank" rel="noreferrer">Lainnya</a>}{!request.portfolio_url && !request.instagram_url && !request.other_url && <span>Tidak ada</span>}</div></td>
                    <td>{new Date(request.created_at).toLocaleDateString("id-ID")}</td>
                    <td><span className={`request-status request-${request.status}`}>{request.status === "pending" ? "Menunggu" : request.status === "approved" ? "Disetujui" : "Ditolak"}</span>{request.status === "approved" && <small>Peran: {roleLabels[request.role as keyof typeof roleLabels] || "Pembaca"}</small>}</td>
                    <td>{request.status === "pending" ? <div className="request-actions"><button className="approve-button" onClick={() => reviewRequest(request, "approved")} disabled={actionId === request.id}><Check size={16} /> Setujui</button><button className="reject-button" onClick={() => reviewRequest(request, "rejected")} disabled={actionId === request.id}><X size={16} /> Tolak</button></div> : <span className="reviewed-label">Sudah ditinjau</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}
        {(section === "users" || section === "admins" || section === "staf" || section === "readers" || section === "kreator") && <section className="admin-management-section" id="user-management">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Akun dan akses</p><h2>{adminSections[section].label}</h2></div>
            <span>{filteredUsers.length} {section === "readers" ? "pembaca" : section === "kreator" ? "kreator" : section === "admins" ? "admin" : section === "staf" ? "staf" : "pengguna"}</span>
          </div>
          <div className="admin-user-filters">
            <label className="admin-search"><Search size={17} /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Cari nama, email, atau ID pengguna" /></label>
            {section === "users" && <label className="admin-user-role-filter">Peran
              <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as typeof userRoleFilter)}>
                <option value="all">Semua peran</option>
                <option value="admin">Admin</option>
                <option value="creator">Kreator</option>
                <option value="reader">Pembaca</option>
              </select>
            </label>}
          </div>
          <p className="admin-setting-note">Hanya kreator dengan akses khusus ini yang dapat mengelola audio episode. Admin dapat memberikan atau mencabut akses kapan saja.</p>
          {audioPermissionSetupError && <p className="admin-settings-error" role="alert">{audioPermissionSetupError}</p>}
          {userEmailSetupError && <p className="admin-settings-error" role="alert">{userEmailSetupError}</p>}
          {filteredUsers.length === 0 ? (
            <div className="admin-empty"><Users size={26} /><h2>Pengguna tidak ditemukan.</h2><p>Coba kata kunci lain.</p></div>
          ) : (
            <div className="request-table-wrap">
              <table className="request-table admin-user-table">
                <thead><tr><th>Pengguna</th><th>Email</th><th>Bergabung</th><th>Peran</th>{section === "staf" && <th>Nama jabatan</th>}<th>Status akun</th>{!isStaff && <><th>Akses kreator audio</th><th>Paket reader</th></>}<th className="admin-user-actions-column">Tindakan</th></tr></thead>
                <tbody>{filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.display_name || "Tanpa nama"}</strong><code>{user.id.slice(0, 12)}...</code></td>
                    <td>{user.email || "Tidak tersedia"}</td>
                    <td>{new Date(user.created_at).toLocaleDateString("id-ID")}</td>
                    <td>
                      <span className={`request-status request-${user.role === "admin" ? "approved" : user.role === "creator" ? "pending" : "draft"}`}>{roleLabels[user.role]}</span>
                      {user.isStaff && <span className="request-status request-pending">{user.staffTitle || "Staf"}</span>}
                    </td>
                    {section === "staf" && <td className="admin-staff-title-cell">{user.staffTitle || "Belum diatur"}</td>}
                    <td><span className={`request-status request-${user.accountStatus === "active" ? "approved" : "rejected"}`}>
                      {user.accountStatus === "active" ? "Aktif" : user.accountStatus === "blocked" ? "Diblokir" : "Dinonaktifkan"}
                    </span></td>
                    {!isStaff && <td>{user.role === "creator"
                      ? <label className="admin-switch" aria-label={`Akses kreator audio ${user.display_name}`}>
                        <input
                          type="checkbox"
                          checked={user.canUploadAudio}
                          onChange={(event) => void updateCreatorAudioAccess(user, event.target.checked)}
                          disabled={actionId === user.id || Boolean(audioPermissionSetupError)}
                        />
                        <span />
                      </label>
                      : <span className="reviewed-label">Khusus kreator</span>}</td>}
                    {!isStaff && <td><select className="admin-role-select" aria-label={`Ubah paket reader ${user.display_name}`} value={user.membershipTier} onChange={(event) => {
                      const selectedTier = READER_MEMBERSHIP_TIERS.find((tier) => tier.value === event.target.value)?.value;
                      if (selectedTier) void updateReaderMembership(user, selectedTier);
                    }} disabled={actionId === user.id}>
                      {READER_MEMBERSHIP_TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
                    </select></td>}
                    <td className="admin-user-actions admin-user-actions-column">
                      <button className="admin-action-link admin-user-icon-action" onClick={() => setSelectedUserDialog({ user, mode: "view" })} aria-label={`Lihat detail ${user.display_name}`} title="Lihat detail"><Eye size={16} aria-hidden="true" /></button>
                      {!isStaff && user.role !== "admin" && <>
                        <button className="admin-action-link admin-user-icon-action" onClick={() => openUserEdit(user)} disabled={actionId === user.id} aria-label={`Edit ${user.display_name}`} title="Edit"><Pencil size={16} aria-hidden="true" /></button>
                        {user.accountStatus === "active" ? (
                          <button onClick={() => {
                            if (window.confirm(`Blokir akun ${user.display_name}? Pengguna tidak dapat masuk sampai admin mengaktifkannya kembali.`)) {
                              void performAdminUserAction(user, "block");
                            }
                          }} disabled={actionId === user.id} className="admin-action-link admin-action-danger admin-user-icon-action" aria-label={`Blokir ${user.display_name}`} title="Blokir"><Ban size={16} aria-hidden="true" /></button>
                        ) : (
                          <button className="admin-action-link admin-user-icon-action" onClick={() => void performAdminUserAction(user, "unblock")} disabled={actionId === user.id} aria-label={`Aktifkan ${user.display_name}`} title="Aktifkan"><UserRoundCheck size={16} aria-hidden="true" /></button>
                        )}
                        {user.accountStatus !== "deleted" && (
                          <button onClick={() => {
                            if (window.confirm(`Nonaktifkan akun ${user.display_name}? Akun tidak dapat masuk, tetapi profil, komik, dan riwayat tetap disimpan.`)) {
                              void performAdminUserAction(user, "deactivate");
                            }
                          }} disabled={actionId === user.id} className="admin-action-link admin-action-danger admin-user-icon-action" aria-label={`Nonaktifkan ${user.display_name}`} title="Nonaktifkan"><Trash2 size={16} aria-hidden="true" /></button>
                        )}
                      </>}
                      {!isStaff && user.role === "admin" && <span className="reviewed-label">Akun admin dilindungi</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}
        {section === "comics" && <section className="admin-management-section" id="comic-management">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Katalog</p><h2>Manajemen komik</h2></div>
            <span>{filteredComics.length} dari {comics.length} komik</span>
          </div>
          <div className="admin-comic-filters">
            <label className="admin-search"><Search size={17} /><input value={comicSearch} onChange={(event) => setComicSearch(event.target.value)} placeholder="Cari judul, kreator, atau genre" /></label>
            <select aria-label="Saring berdasarkan status" value={comicStatusFilter} onChange={(event) => setComicStatusFilter(event.target.value)}>
              <option value="all">Semua status</option>
              <option value="draft">Draf</option>
              <option value="pending_review">Menunggu kurasi</option>
              <option value="published">Terbit</option>
              <option value="archived">Diarsipkan</option>
            </select>
            <select aria-label="Saring berdasarkan status Kids Mode" value={kidsCurationFilter} onChange={(event) => setKidsCurationFilter(event.target.value)} disabled={Boolean(kidsCurationSetupError)}>
              <option value="all">Semua status Kids Mode</option>
              <option value="approved">Disetujui untuk anak</option>
              <option value="pending">Menunggu kurasi anak</option>
              <option value="rejected">Ditolak dari Kids Mode</option>
              <option value="not_submitted">Belum diajukan ke Kids Mode</option>
            </select>
          </div>
          {kidsCurationSetupError && <p className="admin-kids-filter-note" role="status">{kidsCurationSetupError}</p>}
          {filteredComics.length === 0 ? (
            <div className="admin-empty"><BookOpen size={26} /><h2>Komik tidak ditemukan.</h2><p>Coba kata kunci atau status lain.</p></div>
          ) : (
            <div className="request-table-wrap">
              <table className="request-table admin-comic-table">
                <thead><tr><th>Komik</th><th>Kreator</th><th>Genre</th><th>Status</th><th>Tindakan</th></tr></thead>
                <tbody>{filteredComics.map((comic) => (
                  <tr key={comic.id}>
                    <td>
                      <strong>{comic.title}</strong>
                      {comic.kids_curation_status === "approved" && (
                        <span
                          className="admin-kids-comic-badge"
                          title={`Disetujui untuk Kids Mode · ${comic.kids_age_range === "4_6" ? "4–6" : comic.kids_age_range === "7_9" ? "7–9" : "10–12"} tahun`}
                          aria-label={`Kids Mode, usia ${comic.kids_age_range === "4_6" ? "4 sampai 6" : comic.kids_age_range === "7_9" ? "7 sampai 9" : "10 sampai 12"} tahun`}
                        >
                          <Baby size={14} aria-hidden="true" />
                          <span>Kids Mode · {comic.kids_age_range === "4_6" ? "4–6" : comic.kids_age_range === "7_9" ? "7–9" : "10–12"} th</span>
                        </span>
                      )}
                      <code>{comic.slug}</code>
                    </td>
                    <td>{comic.creator}</td>
                    <td>{comic.genre}</td>
                    <td><span className={`request-status request-${comic.status === "published" ? "approved" : comic.status === "pending_review" ? "pending" : comic.status}`}>{comicStatusLabels[comic.status]}</span></td>
                    <td className="admin-comic-actions">
                      <button className="admin-action-link" onClick={() => setSelectedComicDetail(comic)}>Detail</button>
                      {!isStaff && <>
                        <Link className="admin-manage-link" href={`/account/komik/${comic.id}`}>Kelola</Link>
                        {comic.status === "draft" && <button className="admin-action-link" onClick={() => updateComicStatus(comic, "pending_review")} disabled={comicActionId === comic.id}>Ajukan kurasi</button>}
                        {comic.status === "published" && <button className="admin-action-link admin-action-danger" onClick={() => updateComicStatus(comic, "archived")} disabled={comicActionId === comic.id}><Archive size={14} /> Arsipkan</button>}
                        {comic.status === "archived" && <button className="admin-action-link" onClick={() => updateComicStatus(comic, "draft")} disabled={comicActionId === comic.id}>Pulihkan ke draf</button>}
                        {comic.status === "pending_review" && <a className="admin-action-link" href="#comic-review">Lihat antrean</a>}
                      </>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}
          </section>
        </div>
      </div>
      {selectedRequest && (
        <div className="request-modal-backdrop" role="presentation" onClick={() => setSelectedRequest(null)}>
          <section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="request-modal-header">
              <div><p className="eyebrow">Pengajuan kreator</p><h2 id="request-modal-title">{selectedRequest.applicant}</h2></div>
              <button className="modal-close" onClick={() => setSelectedRequest(null)} aria-label="Tutup pengajuan">×</button>
            </div>
            <div className="modal-meta"><span>{requestStatusLabels[selectedRequest.status]}</span><span>{new Date(selectedRequest.created_at).toLocaleDateString("id-ID")}</span></div>
            <p className="modal-note">{selectedRequest.note || "Tidak ada catatan."}</p>
            <div className="modal-links">{selectedRequest.portfolio_url && <a href={selectedRequest.portfolio_url} target="_blank" rel="noreferrer">Portofolio ↗</a>}{selectedRequest.instagram_url && <a href={selectedRequest.instagram_url} target="_blank" rel="noreferrer">Instagram ↗</a>}{selectedRequest.other_url && <a href={selectedRequest.other_url} target="_blank" rel="noreferrer">Tautan lain ↗</a>}</div>
            {selectedRequest.status === "pending" && <div className="request-actions modal-actions"><button className="approve-button" onClick={() => { reviewRequest(selectedRequest, "approved"); setSelectedRequest(null); }} disabled={actionId === selectedRequest.id}><Check size={16} /> Setujui</button><button className="reject-button" onClick={() => { reviewRequest(selectedRequest, "rejected"); setSelectedRequest(null); }} disabled={actionId === selectedRequest.id}><X size={16} /> Tolak</button></div>}
          </section>
        </div>
      )}
      {selectedComicDetail && (
        <div className="request-modal-backdrop" role="presentation" onClick={() => setSelectedComicDetail(null)}>
          <section className="request-modal admin-comic-detail-modal" role="dialog" aria-modal="true" aria-labelledby="admin-comic-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="request-modal-header">
              <div><p className="eyebrow">Detail komik</p><h2 id="admin-comic-detail-title">{selectedComicDetail.title}</h2></div>
              <button className="modal-close" onClick={() => setSelectedComicDetail(null)} aria-label="Tutup detail komik">×</button>
            </div>
            {selectedComicDetail.cover_key && publicUrl && <Image
              className="admin-comic-detail-cover"
              src={`${publicUrl.replace(/\/$/, "")}/${selectedComicDetail.cover_key}`}
              alt={`Sampul ${selectedComicDetail.title}`}
              width={240}
              height={320}
              unoptimized
            />}
            <dl className="admin-user-details">
              <div><dt>Slug</dt><dd><code>{selectedComicDetail.slug}</code></dd></div>
              <div><dt>Kreator</dt><dd>{selectedComicDetail.creator}</dd></div>
              <div><dt>Genre</dt><dd>{selectedComicDetail.genre || "Belum diatur"}</dd></div>
              <div><dt>Kontributor</dt><dd>{selectedComicDetail.contributor || "Belum diatur"}</dd></div>
              <div><dt>Status</dt><dd>{comicStatusLabels[selectedComicDetail.status]}</dd></div>
              <div><dt>Dibuat</dt><dd>{new Date(selectedComicDetail.created_at).toLocaleDateString("id-ID")}</dd></div>
            </dl>
            <div className="admin-comic-detail-synopsis">
              <strong>Sinopsis</strong>
              <p>{selectedComicDetail.synopsis || "Belum ada sinopsis."}</p>
            </div>
            <div className="request-actions modal-actions">
              {selectedComicDetail.status === "published" && <Link className="approve-button" href={`/comic/${encodeURIComponent(selectedComicDetail.slug)}`} target="_blank" rel="noreferrer">Lihat komik <ArrowUpRight size={15} /></Link>}
              <button className="reject-button" onClick={() => setSelectedComicDetail(null)}>Tutup</button>
            </div>
          </section>
        </div>
      )}
      {selectedUserDialog && (
        <div className="request-modal-backdrop" role="presentation" onClick={() => setSelectedUserDialog(null)}>
          <section className="request-modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="request-modal-header">
              <div>
                <p className="eyebrow">{selectedUserDialog.mode === "edit" ? "Ubah akun" : "Detail akun"}</p>
                <h2 id="admin-user-modal-title">{selectedUserDialog.user.display_name || "Tanpa nama"}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedUserDialog(null)} aria-label="Tutup detail pengguna">×</button>
            </div>
            {selectedUserDialog.mode === "edit" ? (
              <form className="admin-user-edit-form" onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const displayName = String(formData.get("displayName") ?? "").trim();
                if (userEditIsStaff && (!userEditStaffTitle.trim() || !userEditStaffPermissions.length)) {
                  setMessage("Isi nama jabatan staf dan pilih minimal satu menu akses.");
                  return;
                }
                void performAdminUserAction(selectedUserDialog.user, "edit", {
                  displayName,
                  role: userEditRole,
                  isStaff: userEditIsStaff,
                  staffTitle: userEditIsStaff ? userEditStaffTitle.trim() : "",
                  staffPermissions: userEditIsStaff ? userEditStaffPermissions : [],
                });
              }}>
                <label>Nama tampilan<input name="displayName" required maxLength={80} defaultValue={selectedUserDialog.user.display_name} /></label>
                <label>Peran<select value={userEditRole} onChange={(event) => {
                  if (event.target.value === "reader" || event.target.value === "creator") {
                    setUserEditRole(event.target.value);
                  }
                }}>
                  <option value="reader">Pembaca</option>
                  <option value="creator">Kreator</option>
                </select></label>
                <label className="admin-staff-assignment-toggle">
                  <input type="checkbox" checked={userEditIsStaff} onChange={(event) => setUserEditIsStaff(event.target.checked)} />
                  <span>Tugaskan sebagai Staf tanpa mengubah peran utama</span>
                </label>
                {userEditIsStaff && <>
                  <label>Nama jabatan<input value={userEditStaffTitle} onChange={(event) => setUserEditStaffTitle(event.target.value)} required maxLength={60} placeholder="Contoh: Ads Manager, Editor, Customer Service" /></label>
                  <fieldset className="admin-staff-permissions">
                    <legend>Menu yang dapat diakses staf</legend>
                    <div>{staffPermissionOptions.map((option) => (
                      <label key={option.value}>
                        <input
                          type="checkbox"
                          checked={userEditStaffPermissions.includes(option.value)}
                          onChange={(event) => setUserEditStaffPermissions((current) => event.target.checked
                            ? [...current, option.value]
                            : current.filter((permission) => permission !== option.value))}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}</div>
                  </fieldset>
                </>}
                <p>Email tidak dapat diubah dari panel ini.</p>
                <div className="request-actions modal-actions">
                  <button className="approve-button" type="submit" disabled={actionId === selectedUserDialog.user.id}><Check size={16} /> Simpan</button>
                  <button className="reject-button" type="button" onClick={() => setSelectedUserDialog({ ...selectedUserDialog, mode: "view" })}>Batal</button>
                </div>
              </form>
            ) : (
              <>
                <dl className="admin-user-details">
                  <div><dt>Email</dt><dd>{selectedUserDialog.user.email || "Tidak tersedia"}</dd></div>
                  <div><dt>ID pengguna</dt><dd><code>{selectedUserDialog.user.id}</code></dd></div>
                  <div><dt>Peran</dt><dd>{roleLabels[selectedUserDialog.user.role]}</dd></div>
                  {selectedUserDialog.user.isStaff && <>
                    <div><dt>Nama jabatan</dt><dd>{selectedUserDialog.user.staffTitle || "Staf"}</dd></div>
                    <div><dt>Menu akses</dt><dd>{selectedUserDialog.user.staffPermissions.map((permission) => staffPermissionOptions.find((option) => option.value === permission)?.label ?? permission).join(", ") || "Tidak ada akses khusus"}</dd></div>
                  </>}
                  <div><dt>Status akun</dt><dd>{selectedUserDialog.user.accountStatus === "active" ? "Aktif" : selectedUserDialog.user.accountStatus === "blocked" ? "Diblokir" : "Dinonaktifkan"}</dd></div>
                  <div><dt>Bergabung</dt><dd>{new Date(selectedUserDialog.user.created_at).toLocaleDateString("id-ID")}</dd></div>
                  <div><dt>Paket reader</dt><dd>{READER_MEMBERSHIP_TIERS.find((tier) => tier.value === selectedUserDialog.user.membershipTier)?.label ?? "Free"}</dd></div>
                  <div><dt>Akses kreator audio</dt><dd>{selectedUserDialog.user.canUploadAudio ? "Diizinkan" : "Tidak diizinkan"}</dd></div>
                </dl>
                <div className="request-actions modal-actions">
                  {!isStaff && selectedUserDialog.user.role !== "admin" && <button className="approve-button" onClick={() => openUserEdit(selectedUserDialog.user)}><Pencil size={16} /> Edit</button>}
                  <button className="reject-button" onClick={() => setSelectedUserDialog(null)}>Tutup</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
