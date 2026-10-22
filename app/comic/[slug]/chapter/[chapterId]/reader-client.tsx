"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3, List, LoaderCircle, LockKeyhole, Maximize2, Minimize2, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SponsoredAd from "@/components/sponsored-ad";
import AdsterraAd from "@/components/adsterra-ad";
import BrandLogo from "@/components/brand-logo";
import DeviceUnavailableNotice from "@/components/device-unavailable-notice";
import PageInteractiveMarkerLayer from "@/components/page-interactive-marker-layer";
import { useCurrentDevice } from "@/components/use-current-device";
import { COMIC_TARGET_DEVICES, isComicAvailableOnDevice, type ComicTargetDevice } from "@/lib/comic-target-device";
import { useReaderMembership } from "@/app/membership-runtime";
import { KidsModeToggle, useKidsMode } from "@/app/platform-runtime";
import { parseChapterSubtitles, type ChapterSubtitleCue } from "@/lib/chapter-subtitles";
import PageTextOverlayLayer from "@/components/page-text-overlay-layer";
import { parsePageTextOverlayDocument, type PageInteractiveMarker, type PageTextImageVerticalAlign, type PageTextOverlay } from "@/lib/page-text-overlays";
import { useLocale } from "@/components/locale-provider";

const supabase = createClient();
const TRANSITION_AD_LOAD_TIMEOUT_MS = 2000;
const READER_LOAD_TIMEOUT_MS = 8000;
const BOOK_TURN_SPREAD_COMMIT_DELAY_MS = 340;
const GUEST_READ_CHAPTERS_STORAGE_KEY = "mu-komik:guest-read-chapters";
const GUEST_READ_CHAPTER_LIMIT = 2;
const PENDING_GUEST_READING_STORAGE_KEY = "mu-komik:pending-guest-reading";

type Page = { id: string; page_number: number; object_key: string; text_overlays: PageTextOverlay[]; interactive_markers: PageInteractiveMarker[]; image_vertical_align: PageTextImageVerticalAlign };
type Chapter = {
  id: string;
  title: string;
  chapter_number: number;
  comic_id: string;
  audio_object_key?: string | null;
  subtitles_srt?: string | null;
  subtitle_page_map?: Record<string, string> | null;
};
type Comic = { id: string; title: string; slug: string; target_device: ComicTargetDevice; kids_mode_approved: boolean; kids_age_range: "4_6" | "7_9" | "10_12" | null };
type ReaderAdKind = "internal" | "adsterra";
type BookLeaf = { kind: "page"; page: Page; pageIndex: number } | { kind: "ad"; afterPageIndex: number; provider: ReaderAdKind } | { kind: "blank" } | { kind: "end" };
type BookTurn = { from: number; to: number; direction: "next" | "previous" };
export type ChapterReaderSeed = { chapter: Chapter; comic: Comic };

function getReaderAdKind(pageNumber: number): ReaderAdKind | null {
  if (pageNumber % 10 === 0) return "adsterra";
  if (pageNumber % 5 === 0) return "internal";
  return null;
}

function getDesktopBookLeaves(pages: Page[], includeAds: boolean): BookLeaf[] {
  const leaves: BookLeaf[] = pages.flatMap((page, pageIndex) => {
    const adKind = includeAds ? getReaderAdKind(pageIndex + 1) : null;
    return [
      { kind: "page" as const, page, pageIndex },
      ...(adKind ? [{ kind: "ad" as const, afterPageIndex: pageIndex, provider: adKind }] : []),
    ];
  });
  if (leaves.length % 2 !== 0) leaves.push({ kind: "blank" });
  if (pages.length) leaves.push({ kind: "end" });
  return leaves;
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function isTouchTabletLandscape() {
  return window.matchMedia("(orientation: landscape)").matches
    && navigator.maxTouchPoints > 0
    && window.innerWidth <= 1366;
}

export default function ChapterReaderPage({ seed }: { seed: ChapterReaderSeed }) {
  const { slug, chapterId } = useParams<{ slug: string; chapterId: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const currentDevice = useCurrentDevice();
  const [tabletLandscape, setTabletLandscape] = useState(false);
  const membership = useReaderMembership();
  const { kidsMode } = useKidsMode();
  const chapterTerm = t(kidsMode ? "Cerita" : "Episode");
  const [chapter, setChapter] = useState<Chapter | null>(seed.chapter);
  const [comic, setComic] = useState<Comic | null>(seed.comic);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [firstIncompleteChapterIndex, setFirstIncompleteChapterIndex] = useState(-1);
  const [allChaptersRead, setAllChaptersRead] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageAspectRatios, setPageAspectRatios] = useState<Record<string, number>>({});
  const [readPageIds, setReadPageIds] = useState<Set<string>>(() => new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [activeSubtitle, setActiveSubtitle] = useState("");
  const [activeSubtitlePageId, setActiveSubtitlePageId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [bookSpreadIndex, setBookSpreadIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [watermarkName, setWatermarkName] = useState("Pembaca");
  const [historyReady, setHistoryReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [guestLoginRequired, setGuestLoginRequired] = useState(false);
  const [pageLoadError, setPageLoadError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [bookTurn, setBookTurn] = useState<BookTurn | null>(null);
  const [bookTurnSpreadChanging, setBookTurnSpreadChanging] = useState(false);
  const [pendingChapterHref, setPendingChapterHref] = useState<string | null>(null);
  const [transitionHouseAdAvailable, setTransitionHouseAdAvailable] = useState<boolean | null>(null);
  const [transitionAdsterraAvailable, setTransitionAdsterraAvailable] = useState<boolean | null>(null);
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const [transitionDeadline, setTransitionDeadline] = useState<number | null>(null);
  const transitionCountdownStartedRef = useRef(false);
  const transitionAdAvailable = transitionHouseAdAvailable === true
    ? true
    : transitionHouseAdAvailable === false
      ? transitionAdsterraAvailable
      : null;
  const lastScrollY = useRef(0);
  const bookTurnInProgressRef = useRef(false);
  const bookTurnSpreadCommitTimeoutRef = useRef<number | null>(null);
  const pagesContainerRef = useRef<HTMLElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const watermarkLabel = `MU-KOMIK.COM · ${watermarkName}`;
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const desktopBookMode = currentDevice === "desktop" || (currentDevice === "tablet" && tabletLandscape);
  const subtitleTrack = useMemo(() => {
    if (!chapter?.subtitles_srt || !chapter.subtitle_page_map) {
      return { cues: [], error: chapter?.audio_object_key ? "Subtitle atau pemetaan halaman episode tidak tersedia." : "" };
    }
    try {
      return { cues: parseChapterSubtitles(chapter.subtitles_srt, chapter.subtitle_page_map), error: "" };
    } catch (error) {
      console.error("Unable to parse episode subtitles:", error);
      return { cues: [], error: "Subtitle episode belum dapat dibaca. Hubungi kreator untuk memperbaikinya." };
    }
  }, [chapter]);
  const subtitleCues = subtitleTrack.cues;
  const bookLeaves = useMemo(
    () => getDesktopBookLeaves(pages, !kidsMode && membership.ready && membership.tier === "free"),
    [kidsMode, membership.ready, membership.tier, pages],
  );
  const currentPageRef = useRef(currentPage);
  const bookLeavesRef = useRef(bookLeaves);
  const previousBookModeRef = useRef(desktopBookMode);

  useEffect(() => {
    currentPageRef.current = currentPage;
    bookLeavesRef.current = bookLeaves;
  }, [bookLeaves, currentPage]);

  useEffect(() => {
    const landscapeQuery = window.matchMedia("(orientation: landscape)");
    const updateOrientation = () => setTabletLandscape(landscapeQuery.matches);
    const initialOrientationFrame = window.requestAnimationFrame(updateOrientation);
    landscapeQuery.addEventListener("change", updateOrientation);
    return () => {
      window.cancelAnimationFrame(initialOrientationFrame);
      landscapeQuery.removeEventListener("change", updateOrientation);
    };
  }, []);

  useEffect(() => {
    if (loading || !pages.length) return;
    const wasBookMode = previousBookModeRef.current;
    previousBookModeRef.current = desktopBookMode;
    if (wasBookMode === desktopBookMode) return;

    const transitionFrame = window.requestAnimationFrame(() => {
      if (bookTurnSpreadCommitTimeoutRef.current !== null) {
        window.clearTimeout(bookTurnSpreadCommitTimeoutRef.current);
        bookTurnSpreadCommitTimeoutRef.current = null;
      }
      setBookTurn(null);
      setBookTurnSpreadChanging(false);
      bookTurnInProgressRef.current = false;

      if (desktopBookMode) {
        window.scrollTo(0, 0);
        const currentPage = currentPageRef.current;
        const bookLeaves = bookLeavesRef.current;
        const currentLeafIndex = bookLeaves.findIndex((leaf) => leaf.kind === "page" && leaf.pageIndex === currentPage);
        const nextSpreadIndex = Math.max(0, Math.floor(currentLeafIndex / 2));
        const visiblePages = bookLeaves.slice(nextSpreadIndex * 2, nextSpreadIndex * 2 + 2)
          .flatMap((leaf) => leaf.kind === "page" ? [leaf] : []);
        setBookSpreadIndex(nextSpreadIndex);
        if (visiblePages.length) {
          setCurrentPage(visiblePages[0].pageIndex);
          setReadPageIds((current) => {
            const next = new Set(current);
            visiblePages.forEach((leaf) => next.add(leaf.page.id));
            return next;
          });
        }
        return;
      }

      const currentPage = currentPageRef.current;
      document.querySelector(`[data-reader-page="${currentPage}"]`)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(transitionFrame);
  }, [desktopBookMode, loading, pages.length]);

  useEffect(() => {
    const blockReaderShortcuts = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "s" || key === "p") || event.key === "PrintScreen") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", blockReaderShortcuts, true);
    return () => window.removeEventListener("keydown", blockReaderShortcuts, true);
  }, []);

  useEffect(() => {
    if (currentDevice === null || !membership.ready) {
      const readinessTimeoutId = window.setTimeout(() => {
        setErrorMessage("Koneksi ke server terlalu lama. Periksa koneksi lalu coba lagi.");
        setLoading(false);
      }, READER_LOAD_TIMEOUT_MS);
      return () => window.clearTimeout(readinessTimeoutId);
    }

    let active = true;
    let timedOut = false;
    const requestController = new AbortController();
    const loadChapter = async () => {
      if (currentDevice === null || !membership.ready) return;
      if (!isComicAvailableOnDevice(seed.comic.target_device, currentDevice)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage("");
      setGuestLoginRequired(false);
      if (bookTurnSpreadCommitTimeoutRef.current !== null) {
        window.clearTimeout(bookTurnSpreadCommitTimeoutRef.current);
        bookTurnSpreadCommitTimeoutRef.current = null;
      }
      setBookTurn(null);
      setBookTurnSpreadChanging(false);
      bookTurnInProgressRef.current = false;
      setHistoryReady(false);
      setReadPageIds(new Set());
      const chapterData = seed.chapter;
      const { data: comicDataResult, error: initialComicError } = await supabase
        .from("comics")
        .select("id, title, slug, target_device")
        .eq("id", chapterData.comic_id)
        .eq("slug", slug)
        .abortSignal(requestController.signal)
        .maybeSingle();
      let comicError = initialComicError;
      let legacyComicData: Pick<Comic, "id" | "title" | "slug"> | null = null;
      if (comicError?.code === "42703") {
        const legacyComic = await supabase
          .from("comics")
          .select("id, title, slug")
          .eq("id", chapterData.comic_id)
          .eq("slug", slug)
          .abortSignal(requestController.signal)
          .maybeSingle();
        legacyComicData = legacyComic.data;
        comicError = legacyComic.error;
      }
      const loadedComicData = comicDataResult ?? legacyComicData;
      if (comicError || !loadedComicData) {
        if (comicError) console.error("Unable to load the reader comic:", comicError);
        if (active) {
          setErrorMessage(comicError ? "Komik belum dapat dimuat. Periksa koneksi lalu coba lagi." : "Episode ini bukan bagian dari komik tersebut.");
          setLoading(false);
        }
        return;
      }
      const comicData: Comic = {
        ...loadedComicData,
        target_device: ("target_device" in loadedComicData ? loadedComicData.target_device : null) || seed.comic.target_device || "all",
        kids_mode_approved: seed.comic.kids_mode_approved,
        kids_age_range: seed.comic.kids_age_range,
      };
      if (!isComicAvailableOnDevice(comicData.target_device, currentDevice)) {
        if (active) {
          setComic(comicData);
          setLoading(false);
        }
        return;
      }

      const [{ data: chapters, error: chaptersError }, { data: sessionData, error: sessionError }] = await Promise.all([
        supabase.from("chapters").select("id, title, chapter_number, comic_id").eq("comic_id", chapterData.comic_id).not("published_at", "is", null).order("chapter_number").abortSignal(requestController.signal),
        supabase.auth.getSession(),
      ]);
      if (!active) return;
      if (chaptersError && !requestController.signal.aborted) {
        console.error("Unable to load comic episode navigation:", {
          message: chaptersError.message ?? "Unknown query error",
          code: chaptersError.code ?? null,
          details: chaptersError.details ?? null,
          hint: chaptersError.hint ?? null,
        });
      }
      if (sessionError && !requestController.signal.aborted) console.error("Unable to check the current auth session:", sessionError);
      if (sessionError) {
        setComic(comicData);
        setErrorMessage("Urutan episode belum dapat diverifikasi. Periksa koneksi lalu coba lagi.");
        setLoading(false);
        return;
      }

      if (chaptersError || !chapters?.length) {
        if (active) {
          setComic(comicData);
          setErrorMessage("Urutan episode belum dapat diverifikasi. Periksa koneksi lalu coba lagi.");
          setLoading(false);
        }
        return;
      }

      const targetChapterIndex = chapters.findIndex((item) => item.id === chapterId);
      if (targetChapterIndex < 0) {
        if (active) {
          setComic(comicData);
          setErrorMessage("Episode ini belum diterbitkan atau bukan bagian dari daftar episode.");
          setLoading(false);
        }
        return;
      }

      const chapterIds = chapters.map((item) => item.id);
      const currentUserId = sessionData.session?.user.id ?? null;
      let guestReadChapterIds: string[] | null = null;
      if (!currentUserId) {
        try {
          const storedChapterIds = localStorage.getItem(GUEST_READ_CHAPTERS_STORAGE_KEY);
          const parsedChapterIds: unknown = storedChapterIds ? JSON.parse(storedChapterIds) : [];
          if (!Array.isArray(parsedChapterIds) || parsedChapterIds.some((id) => typeof id !== "string")) {
            throw new Error("Stored guest episode history has an invalid format.");
          }
          guestReadChapterIds = [...new Set(parsedChapterIds)];
        } catch (storageError) {
          console.error("Unable to read guest episode access history:", storageError);
          setComic(comicData);
          setErrorMessage("Batas baca tamu belum dapat diverifikasi. Aktifkan penyimpanan browser atau masuk untuk melanjutkan.");
          setLoading(false);
          return;
        }
        if (!guestReadChapterIds.includes(chapterId) && guestReadChapterIds.length >= GUEST_READ_CHAPTER_LIMIT) {
          setComic(comicData);
          setGuestLoginRequired(true);
          setLoading(false);
          return;
        }
      }

      const [{ data: allPageData, error: allPagesError }, { data: history, error: historyError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from("pages").select("id, chapter_id, page_number, object_key, text_overlays").in("chapter_id", chapterIds).order("page_number").abortSignal(requestController.signal),
        currentUserId
          ? supabase.from("reading_history").select("chapter_id, last_page").eq("user_id", currentUserId).in("chapter_id", chapterIds).abortSignal(requestController.signal)
          : Promise.resolve({ data: [], error: null }),
        currentUserId
          ? supabase.from("profiles").select("display_name").eq("id", currentUserId).abortSignal(requestController.signal).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (allPagesError) console.error("Unable to verify episode reading order:", allPagesError);
      if (historyError) console.error("Unable to load episode reading progress:", historyError);
      if (profileError) console.error("Unable to load reader watermark name:", profileError);
      if (!active) return;
      setWatermarkName(profile?.display_name?.trim().slice(0, 32) || "Pembaca");
      if (allPagesError || historyError) {
        setComic(comicData);
        setErrorMessage(allPagesError?.code === "42703" || allPagesError?.code === "PGRST204"
          ? "Teks halaman belum dikonfigurasi. Jalankan supabase/page-text-overlays.sql untuk melanjutkan."
          : "Urutan episode belum dapat diverifikasi. Periksa koneksi lalu coba lagi.");
        setLoading(false);
        return;
      }

      const pagesByChapter = new Map<string, Page[]>();
      try {
        for (const page of allPageData ?? []) {
          const chapterPages = pagesByChapter.get(page.chapter_id) ?? [];
          const pageText = parsePageTextOverlayDocument(page.text_overlays);
          chapterPages.push({
            id: page.id,
            page_number: page.page_number,
            object_key: page.object_key,
            text_overlays: pageText.overlays,
            interactive_markers: pageText.interactiveMarkers,
            image_vertical_align: pageText.imageVerticalAlign,
          });
          pagesByChapter.set(page.chapter_id, chapterPages);
        }
      } catch (overlayError) {
        console.error("Unable to load page text overlays:", overlayError);
        if (active) {
          setComic(comicData);
          setErrorMessage("Teks halaman belum dapat dibaca. Hubungi kreator untuk memperbaikinya.");
          setLoading(false);
        }
        return;
      }
      const historyByChapter = new Map<string, number>();
      for (const entry of history ?? []) historyByChapter.set(entry.chapter_id, entry.last_page);

      const savedPagesByChapter = new Map<string, Set<string>>();
      for (const item of chapters) {
        const chapterPages = pagesByChapter.get(item.id) ?? [];
        const pageIds = new Set(chapterPages.map((page) => page.id));
        const savedPages = new Set<string>();
        try {
          const storedPages = localStorage.getItem(`mu-komik:read-pages:${item.id}`);
          const parsedPages: unknown = storedPages ? JSON.parse(storedPages) : [];
          if (Array.isArray(parsedPages)) {
            parsedPages.forEach((pageId) => {
              if (typeof pageId === "string" && pageIds.has(pageId)) savedPages.add(pageId);
            });
          }
        } catch (error) {
          console.error("Unable to restore read page markers:", error);
        }
        chapterPages.slice(0, historyByChapter.get(item.id) ?? 0).forEach((page) => savedPages.add(page.id));
        savedPagesByChapter.set(item.id, savedPages);
      }

      const firstIncompleteIndex = chapters.findIndex((item) => {
        const chapterPages = pagesByChapter.get(item.id) ?? [];
        return chapterPages.length === 0 || (savedPagesByChapter.get(item.id)?.size ?? 0) < chapterPages.length;
      });
      const completedEveryChapter = firstIncompleteIndex < 0;
      if (!kidsMode && membership.tier !== "vip" && !completedEveryChapter && targetChapterIndex > firstIncompleteIndex) {
        const firstIncompleteChapter = chapters[firstIncompleteIndex];
        router.replace(`/comic/${comicData.slug}/chapter/${firstIncompleteChapter.id}`);
        return;
      }

      if (guestReadChapterIds && !guestReadChapterIds.includes(chapterId)) {
        try {
          localStorage.setItem(
            GUEST_READ_CHAPTERS_STORAGE_KEY,
            JSON.stringify([...guestReadChapterIds, chapterId]),
          );
        } catch (storageError) {
          console.error("Unable to save guest episode access history:", storageError);
          setComic(comicData);
          setErrorMessage("Batas baca tamu belum dapat disimpan. Aktifkan penyimpanan browser atau masuk untuk melanjutkan.");
          setLoading(false);
          return;
        }
      }

      const pageData = pagesByChapter.get(chapterId) ?? [];
      const savedReadPages = savedPagesByChapter.get(chapterId) ?? new Set<string>();
      const savedLastPage = historyByChapter.get(chapterId);
      const resumePage = savedLastPage
        ? Math.max(0, Math.min(pageData.length - 1, savedLastPage - 1))
        : -1;
      const useDesktopBook = currentDevice === "desktop";
      const readerResumePage = useDesktopBook ? Math.max(0, resumePage) : resumePage;
      const initialBookLeaves = useDesktopBook
        ? getDesktopBookLeaves(pageData, !kidsMode && membership.tier === "free")
        : [];
      const resumeLeafIndex = useDesktopBook
        ? Math.max(0, initialBookLeaves.findIndex((leaf) => leaf.kind === "page" && leaf.pageIndex === readerResumePage))
        : 0;
      const initialSpreadIndex = Math.floor(resumeLeafIndex / 2);
      if (useDesktopBook) {
        initialBookLeaves.slice(initialSpreadIndex * 2, initialSpreadIndex * 2 + 2)
          .forEach((leaf) => {
            if (leaf.kind === "page") savedReadPages.add(leaf.page.id);
          });
      }
      const initialCurrentPage = useDesktopBook
        ? initialBookLeaves.slice(initialSpreadIndex * 2, initialSpreadIndex * 2 + 2)
          .find((leaf): leaf is Extract<BookLeaf, { kind: "page" }> => leaf.kind === "page")?.pageIndex ?? readerResumePage
        : readerResumePage;

      setChapter(chapterData);
      setComic(comicData);
      setPages(pageData);
      setPageLoadError(false);
      setChapterList(chapters);
      setFirstIncompleteChapterIndex(firstIncompleteIndex);
      setAllChaptersRead(completedEveryChapter);
      setUserId(currentUserId);
      setBookSpreadIndex(initialSpreadIndex);
      if (initialCurrentPage >= 0) {
        setCurrentPage(initialCurrentPage);
        if (!useDesktopBook) {
          window.requestAnimationFrame(() => {
            document.querySelector(`[data-reader-page="${initialCurrentPage}"]`)?.scrollIntoView({ block: "start" });
          });
        }
      } else {
        setCurrentPage(0);
      }
      setReadPageIds(savedReadPages);
      setHistoryReady(true);
      setLoading(false);
    };
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        requestController.abort();
        reject(new DOMException("Reader episode loading timed out.", "TimeoutError"));
      }, READER_LOAD_TIMEOUT_MS);
    });
    void Promise.race([loadChapter(), timeout])
      .catch((error: unknown) => {
        if (!active) return;
        active = false;
        if (timedOut || (error instanceof Error && error.name === "TimeoutError")) {
          console.warn("Reader episode loading timed out.", { slug, chapterId, timeoutMs: READER_LOAD_TIMEOUT_MS });
          setErrorMessage("Koneksi ke server terlalu lama. Periksa koneksi lalu coba lagi.");
        } else {
          console.error("Unable to load reader episode:", error);
          setErrorMessage("Episode belum dapat dimuat. Periksa koneksi lalu coba lagi.");
        }
        setLoading(false);
      })
      .finally(() => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      });
    return () => {
      active = false;
      requestController.abort();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (bookTurnSpreadCommitTimeoutRef.current !== null) {
        window.clearTimeout(bookTurnSpreadCommitTimeoutRef.current);
        bookTurnSpreadCommitTimeoutRef.current = null;
      }
    };
  }, [chapterId, currentDevice, kidsMode, membership.ready, membership.tier, router, seed.chapter, seed.comic.kids_age_range, seed.comic.kids_mode_approved, seed.comic.target_device, slug]);

  useEffect(() => {
    if (loading || !chapter || !pages.length) return;
    let active = true;
    const recordChapterView = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error("Unable to check auth before recording a chapter view:", sessionError);
        if (!active) return;
        const response = await fetch("/api/analytics/chapter-view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
          },
          body: JSON.stringify({ chapterId: chapter.id }),
          cache: "no-store",
        });
        if (!response.ok) {
          const responseBody = await response.json().catch(() => null) as { error?: unknown } | null;
          console.warn("Unable to record chapter view:", {
            status: response.status,
            reason: typeof responseBody?.error === "string" ? responseBody.error : "Analytics endpoint returned an empty error",
          });
        }
      } catch (error) {
        console.error("Unable to record chapter view:", error);
      }
    };
    void recordChapterView();
    return () => { active = false; };
  }, [chapter, loading, pages.length]);

  useEffect(() => {
    if (loading || !pages.length) return;
    if (desktopBookMode) return;
    const visibleRatios = new Map<Element, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleRatios.set(entry.target, entry.intersectionRatio);
        else visibleRatios.delete(entry.target);
      }
      const visiblePage = [...visibleRatios.entries()]
        .sort((left, right) => right[1] - left[1])[0]?.[0];
      const index = Number(visiblePage?.getAttribute("data-reader-page"));
      if (Number.isInteger(index)) {
        setCurrentPage(index);
        const pageId = pages[index]?.id;
        if (pageId) {
          setReadPageIds((current) => {
            if (current.has(pageId)) return current;
            return new Set(current).add(pageId);
          });
        }
      }
    }, { threshold: [0.05, 0.1, 0.25, 0.5, 0.75] });
    document.querySelectorAll("[data-reader-page]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [currentPage, desktopBookMode, loading, pages]);

  useEffect(() => {
    if (!chapter || readPageIds.size === 0) return;
    try {
      localStorage.setItem(`mu-komik:read-pages:${chapter.id}`, JSON.stringify([...readPageIds]));
    } catch (error) {
      console.error("Unable to save read page markers:", error);
    }
  }, [chapter, readPageIds]);

  const scrollToPage = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const requestedIndex = Math.max(0, Math.min(pages.length - 1, index));
    if (desktopBookMode) {
      const spreadCount = Math.ceil(bookLeaves.length / 2);
      const direction = index >= pages.length ? 1 : index < currentPage ? -1 : 1;
      const targetSpread = Math.max(0, Math.min(
        spreadCount - 1,
        bookSpreadIndex + direction,
      ));
      if (targetSpread === bookSpreadIndex || bookTurnInProgressRef.current) return;
      bookTurnInProgressRef.current = true;
      if (!isTouchTabletLandscape()) setControlsVisible(true);
      setBookTurnSpreadChanging(false);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setBookSpreadIndex(targetSpread);
        setBookTurnSpreadChanging(true);
      } else {
        bookTurnSpreadCommitTimeoutRef.current = window.setTimeout(() => {
          setBookSpreadIndex(targetSpread);
          setBookTurnSpreadChanging(true);
          bookTurnSpreadCommitTimeoutRef.current = null;
        }, BOOK_TURN_SPREAD_COMMIT_DELAY_MS);
      }
      setBookTurn({
        from: bookSpreadIndex,
        to: targetSpread,
        direction: targetSpread > bookSpreadIndex ? "next" : "previous",
      });
      return;
    }
    const targetIndex = requestedIndex;
    setCurrentPage(targetIndex);
    const scrollBlock = currentDevice === "mobile" && !controlsVisible ? "center" : "start";
    document.querySelector(`[data-reader-page="${targetIndex}"]`)?.scrollIntoView({ behavior, block: scrollBlock });
  }, [bookLeaves.length, bookSpreadIndex, controlsVisible, currentDevice, currentPage, desktopBookMode, pages.length]);

  const updateAudioSubtitle = useCallback((event: SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    const timeMs = audio.currentTime * 1000;
    setAudioCurrentTime(audio.currentTime);
    let activeCue: ChapterSubtitleCue | undefined;
    for (const cue of subtitleCues) {
      if (timeMs >= cue.startMs && timeMs < cue.endMs) activeCue = cue;
    }
    setActiveSubtitle(activeCue?.text ?? "");
    setActiveSubtitlePageId(activeCue?.pageId ?? null);
    if (!activeCue || (audio.paused && event.type !== "seeked")) return;
    const targetPageIndex = pages.findIndex((page) => page.id === activeCue.pageId);
    if (targetPageIndex < 0 || targetPageIndex === currentPage) return;
    if (!desktopBookMode) {
      scrollToPage(targetPageIndex, "auto");
      return;
    }
    const targetLeafIndex = bookLeaves.findIndex((leaf) => leaf.kind === "page" && leaf.pageIndex === targetPageIndex);
    if (targetLeafIndex < 0) return;
    const targetSpread = Math.floor(targetLeafIndex / 2);
    if (bookTurnSpreadCommitTimeoutRef.current !== null) {
      window.clearTimeout(bookTurnSpreadCommitTimeoutRef.current);
      bookTurnSpreadCommitTimeoutRef.current = null;
    }
    bookTurnInProgressRef.current = false;
    setBookTurn(null);
    setBookSpreadIndex(targetSpread);
    setBookTurnSpreadChanging(true);
    setCurrentPage(targetPageIndex);
  }, [bookLeaves, currentPage, desktopBookMode, pages, scrollToPage, subtitleCues]);

  const finishBookTurn = useCallback(() => {
    if (!bookTurn) return;
    if (bookTurnSpreadCommitTimeoutRef.current !== null) {
      window.clearTimeout(bookTurnSpreadCommitTimeoutRef.current);
      bookTurnSpreadCommitTimeoutRef.current = null;
    }
    setBookSpreadIndex(bookTurn.to);
    setBookTurnSpreadChanging(false);
    const visibleLeaves = bookLeaves.slice(bookTurn.to * 2, bookTurn.to * 2 + 2);
    const visiblePages = visibleLeaves.flatMap((leaf) => leaf.kind === "page" ? [leaf] : []);
    const firstVisiblePage = visiblePages[0]?.pageIndex;
    if (firstVisiblePage !== undefined) setCurrentPage(firstVisiblePage);
    setReadPageIds((current) => {
      const next = new Set(current);
      visiblePages.forEach((leaf) => next.add(leaf.page.id));
      return next.size === current.size ? current : next;
    });
    setBookTurn(null);
    bookTurnInProgressRef.current = false;
  }, [bookLeaves, bookTurn]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setControlsVisible(false);
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      if (currentDevice === "desktop" && !isTouchTabletLandscape()) setControlsVisible(true);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      scrollToPage(currentPage + direction);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [currentDevice, currentPage, loading, pages.length, scrollToPage]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const isTouchTablet = navigator.maxTouchPoints > 0
      && window.matchMedia("(any-pointer: coarse)").matches
      && window.innerWidth <= 1366;
    if (currentDevice !== "desktop" || isTouchTablet) return;
    lastScrollY.current = window.scrollY;
    let animationFrame = 0;
    const handleScroll = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollY.current;
        if (currentScrollY < 90 || scrollDelta < -8) {
          setControlsVisible(true);
        } else if (scrollDelta > 8) {
          setControlsVisible(false);
        }
        lastScrollY.current = currentScrollY;
        animationFrame = 0;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [currentDevice, loading, pages.length]);

  useEffect(() => {
    if (currentDevice !== "mobile" || controlsVisible || desktopBookMode) return;
    const updateFullscreenTopPadding = () => {
      const frame = document.querySelector<HTMLElement>(`[data-reader-page="${currentPage}"]`);
      const reader = pagesContainerRef.current?.closest<HTMLElement>(".reader-experience");
      if (!frame || !reader) return;
      const topPadding = Math.max(0, (window.innerHeight - frame.getBoundingClientRect().height) / 2);
      reader.style.setProperty("--reader-mobile-fullscreen-top-padding", `${topPadding}px`);
    };
    updateFullscreenTopPadding();
    window.addEventListener("resize", updateFullscreenTopPadding);
    return () => window.removeEventListener("resize", updateFullscreenTopPadding);
  }, [controlsVisible, currentDevice, currentPage, desktopBookMode]);

  useEffect(() => {
    if (!userId || !historyReady || !chapter || !pages.length) return;
    const timer = window.setTimeout(async () => {
      const spreadPages = desktopBookMode
        ? bookLeaves.slice(bookSpreadIndex * 2, bookSpreadIndex * 2 + 2)
          .flatMap((leaf) => leaf.kind === "page" ? [leaf.pageIndex] : [])
        : [currentPage];
      const lastReadPage = spreadPages.length ? Math.max(...spreadPages) + 1 : currentPage + 1;
      const { error } = await supabase.from("reading_history").upsert({
        user_id: userId,
        chapter_id: chapter.id,
        last_page: Math.min(pages.length, lastReadPage),
        updated_at: new Date().toISOString(),
      });
      if (error) console.error("Unable to save reading progress:", error);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [bookLeaves, bookSpreadIndex, chapter, currentPage, desktopBookMode, historyReady, pages.length, userId]);

  const startTransitionCountdown = useCallback(() => {
    if (transitionCountdownStartedRef.current) return;
    transitionCountdownStartedRef.current = true;
    setTransitionCountdown(5);
    setTransitionDeadline(Date.now() + 5000);
  }, []);
  const reportTransitionAdAvailability = useCallback((available: boolean) => {
    setTransitionHouseAdAvailable(available);
    if (available) startTransitionCountdown();
  }, [startTransitionCountdown]);
  const reportTransitionAdsterraAvailability = useCallback((available: boolean) => {
    setTransitionAdsterraAvailable(available);
    if (available) startTransitionCountdown();
  }, [startTransitionCountdown]);

  const requestChapterTransition = (href: string) => {
    if (kidsMode) {
      router.push(href);
      return;
    }
    setPendingChapterHref(href);
    transitionCountdownStartedRef.current = false;
    setTransitionHouseAdAvailable(null);
    setTransitionAdsterraAvailable(null);
    setTransitionCountdown(null);
    setTransitionDeadline(null);
  };

  useEffect(() => {
    if (!pendingChapterHref) return;
    if (transitionAdAvailable === false) {
      router.push(pendingChapterHref);
      return;
    }
    if (transitionAdAvailable === null) {
      const target = pendingChapterHref;
      const timer = window.setTimeout(() => {
        console.warn("Episode transition ad did not load in time; continuing without the ad.");
        setPendingChapterHref(null);
        router.push(target);
      }, TRANSITION_AD_LOAD_TIMEOUT_MS);
      return () => window.clearTimeout(timer);
    }
    if (transitionDeadline === null) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((transitionDeadline - Date.now()) / 1000));
      setTransitionCountdown(remaining);
      if (remaining === 0) window.clearInterval(timer);
    };
    const timer = window.setInterval(updateCountdown, 100);
    return () => window.clearInterval(timer);
  }, [pendingChapterHref, router, transitionAdAvailable, transitionDeadline]);

  useEffect(() => {
    if (loading || !pages.length) return;
    const pagesContainer = pagesContainerRef.current;
    if (!pagesContainer) return;
    let start: { x: number; y: number; stopId: string } | null = null;
    const handleTouchStart = (event: globalThis.TouchEvent) => {
      if (event.touches.length !== 1 || !(event.target instanceof Element)) {
        start = null;
        return;
      }
      const stop = event.target.closest<HTMLElement>("[data-reader-stop]");
      const stopId = stop?.dataset.readerStop;
      if (!stopId) {
        start = null;
        return;
      }
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY, stopId };
    };
    const handleTouchMove = (event: globalThis.TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - start.x;
      const deltaY = start.y - event.touches[0].clientY;
      if (Math.abs(deltaY) >= 55 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && event.cancelable) {
        event.preventDefault();
      }
    };
    const handleTouchEnd = (event: globalThis.TouchEvent) => {
      const touchStart = start;
      start = null;
      if (!touchStart || event.changedTouches.length !== 1) return;
      const deltaX = event.changedTouches[0].clientX - touchStart.x;
      const deltaY = touchStart.y - event.changedTouches[0].clientY;
      if (Math.abs(deltaY) < 55 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.2) return;
      const stops = Array.from(pagesContainer.querySelectorAll<HTMLElement>("[data-reader-stop]"));
      const startIndex = stops.findIndex((stop) => stop.dataset.readerStop === touchStart.stopId);
      const targetStop = stops[startIndex + (deltaY > 0 ? 1 : -1)];
      const scrollBlock = currentDevice === "mobile" && !controlsVisible ? "center" : "start";
      targetStop?.scrollIntoView({ behavior: "smooth", block: scrollBlock });
    };
    const handleTouchCancel = () => { start = null; };
    pagesContainer.addEventListener("touchstart", handleTouchStart, { passive: true });
    pagesContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
    pagesContainer.addEventListener("touchend", handleTouchEnd);
    pagesContainer.addEventListener("touchcancel", handleTouchCancel);
    return () => {
      pagesContainer.removeEventListener("touchstart", handleTouchStart);
      pagesContainer.removeEventListener("touchmove", handleTouchMove);
      pagesContainer.removeEventListener("touchend", handleTouchEnd);
      pagesContainer.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [controlsVisible, currentDevice, loading, pages.length]);

  if (currentDevice !== null && !isComicAvailableOnDevice(comic?.target_device ?? seed.comic.target_device, currentDevice)) {
    const targetLabel = COMIC_TARGET_DEVICES.find((device) => device.value === (comic?.target_device ?? seed.comic.target_device))?.label.toLowerCase() || "perangkat tertentu";
    return <DeviceUnavailableNotice deviceName={targetLabel} />;
  }
  if (kidsMode && !(comic?.kids_mode_approved ?? seed.comic.kids_mode_approved)) {
    return (
      <main className="reader-detail-page reader-detail-not-found kids-mode-restricted-page">
        <nav className="reader-subnav"><BrandLogo className="wordmark reader-wordmark" showName /><KidsModeToggle /></nav>
        <p className="reader-section-kicker">{t("KIDS MODE AKTIF")}</p>
        <h1>{t("Komik ini belum tersedia di library anak.")}</h1>
        <p>{t("Kids Mode hanya menampilkan komik yang telah disetujui kurasi untuk anak.")}</p>
        <Link className="reader-primary-button" href="/">{t("Kembali ke cerita anak")}</Link>
      </main>
    );
  }
  if (errorMessage) {
    return (
      <main className="reader-detail-page">
        <nav className="reader-subnav"><BrandLogo className="wordmark reader-wordmark" showName /><Link className="reader-back-link" href="/"><ArrowLeft size={17} /> {t("Jelajahi komik")}</Link></nav>
        <div className="reader-detail-not-found">
          <h1>{t(errorMessage.startsWith("Koneksi ke server") ? "Komik belum bisa dibuka." : "Episode belum bisa dibuka.")}</h1>
          <p>{t(errorMessage)}</p>
          <button className="reader-primary-button" type="button" onClick={() => window.location.reload()}>{t("Coba lagi")} <ArrowRight size={17} /></button>
          <Link className="reader-detail-secondary-link" href="/">{t("Jelajahi komik")}</Link>
        </div>
      </main>
    );
  }
  if (currentDevice === null || loading) return (
    <main className="reader-loading">
      <h1>{comic?.title} {chapterTerm} {chapter?.chapter_number}: {chapter?.title}</h1>
      <LoaderCircle className="spin" size={25} />
      <span>{t("Menyiapkan halaman komik...")}</span>
    </main>
  );
  if (guestLoginRequired) {
    const nextPath = `/comic/${encodeURIComponent(slug)}/chapter/${encodeURIComponent(chapterId)}`;
    return (
      <main className="reader-detail-page">
        <nav className="reader-subnav"><BrandLogo className="wordmark reader-wordmark" showName /><Link className="reader-back-link" href={`/comic/${encodeURIComponent(slug)}`}><ArrowLeft size={17} /> {t("Kembali ke komik")}</Link></nav>
        <div className="reader-detail-not-found">
          <p className="reader-section-kicker">{t("LANJUTKAN MEMBACA")}</p>
          <h1>{t("Batas baca tamu sudah tercapai.")}</h1>
          <p>{t("Kamu sudah membaca 2 episode tanpa masuk. Masuk atau daftar untuk melanjutkan membaca.")}</p>
          <Link
            className="reader-primary-button"
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            onClick={(event) => {
              try {
                localStorage.setItem(PENDING_GUEST_READING_STORAGE_KEY, JSON.stringify({
                  href: nextPath,
                  comicTitle: seed.comic.title,
                  chapterNumber: seed.chapter.chapter_number,
                  chapterTitle: seed.chapter.title,
                }));
              } catch (storageError) {
                console.error("Unable to save the guest reading continuation:", storageError);
                event.preventDefault();
                setGuestLoginRequired(false);
                setErrorMessage("Tujuan melanjutkan bacaan belum dapat disimpan. Aktifkan penyimpanan browser lalu coba lagi.");
              }
            }}
          >{t("Masuk untuk lanjut membaca")} <ArrowRight size={17} /></Link>
          <Link className="reader-detail-secondary-link" href={`/comic/${encodeURIComponent(slug)}`}>{t("Kembali ke komik")}</Link>
        </div>
      </main>
    );
  }
  if (!chapter || !comic) {
    return <main className="reader-loading reader-error"><p>{t(errorMessage || "Episode tidak dapat dibuka.")}</p><Link href={comic ? `/comic/${comic.slug}` : "/"}><ArrowLeft size={16} /> {comic ? t("Kembali ke komik") : t("Ke beranda")}</Link></main>;
  }

  const chapterIndex = chapterList.findIndex((item) => item.id === chapter.id);
  const previousChapter = chapterIndex > 0 ? chapterList[chapterIndex - 1] : null;
  const nextChapterCandidate = chapterIndex >= 0 && chapterIndex < chapterList.length - 1 ? chapterList[chapterIndex + 1] : null;
  const currentChapterRead = pages.length > 0 && readPageIds.size >= pages.length;
  const nextChapterUnlocked = Boolean(
    nextChapterCandidate &&
    (kidsMode ||
      membership.tier === "vip" ||
      allChaptersRead ||
      chapterIndex + 1 <= firstIncompleteChapterIndex ||
      (chapterIndex === firstIncompleteChapterIndex && currentChapterRead)),
  );
  const nextChapter = nextChapterUnlocked ? nextChapterCandidate : null;
  const pageUrl = (page: Page) => publicUrl ? `${publicUrl.replace(/\/$/, "")}/${page.object_key}` : null;
  const audioUrl = chapter.audio_object_key && publicUrl ? `${publicUrl.replace(/\/$/, "")}/${chapter.audio_object_key}` : null;
  const activeBookLeaves = bookLeaves.slice(bookSpreadIndex * 2, bookSpreadIndex * 2 + 2);
  const turningFromLeaf = bookTurn
    ? bookLeaves[bookTurn.direction === "next" ? bookTurn.from * 2 + 1 : bookTurn.from * 2]
    : null;
  const turningToLeaf = bookTurn
    ? bookLeaves[bookTurn.direction === "next" ? bookTurn.to * 2 : bookTurn.to * 2 + 1]
    : null;
  const turningFromPageUrl = turningFromLeaf?.kind === "page" ? pageUrl(turningFromLeaf.page) : null;
  const turningToPageUrl = turningToLeaf?.kind === "page" ? pageUrl(turningToLeaf.page) : null;
  const displayedBookPageIndexes = activeBookLeaves.flatMap((leaf) => leaf.kind === "page" ? [leaf.pageIndex] : []);
  const displayedPageStart = desktopBookMode && displayedBookPageIndexes.length
    ? Math.min(...displayedBookPageIndexes) + 1
    : currentPage + 1;
  const displayedPageEnd = desktopBookMode && displayedBookPageIndexes.length
    ? Math.max(...displayedBookPageIndexes) + 1
    : currentPage + 1;
  const isEpisodeEndSpread = desktopBookMode && activeBookLeaves.some((leaf) => leaf.kind === "end");
  const chapterEndReached = desktopBookMode
    ? isEpisodeEndSpread
    : currentPage === pages.length - 1;
  const progressPage = Math.min(pages.length, displayedPageEnd);
  const canAdvancePage = desktopBookMode
    ? bookSpreadIndex + 1 < Math.ceil(bookLeaves.length / 2)
    : currentPage < pages.length - 1;
  const episodeEndContent = (
    <section className="reader-episode-end" aria-labelledby="reader-episode-end-title">
      <span className="reader-episode-end-kicker">{t(kidsMode ? "CERITA SELESAI" : "EPISODE SELESAI")}</span>
      <h2 id="reader-episode-end-title">{t(kidsMode ? "Sampai di sini untuk cerita ini." : "Sampai di sini untuk episode ini.")}</h2>
      <p>{t(nextChapter
        ? kidsMode ? "Lanjutkan petualangannya di cerita berikutnya." : "Lanjutkan petualangannya di episode berikutnya."
        : nextChapterCandidate
          ? kidsMode ? "Selesaikan semua halaman untuk membuka cerita berikutnya." : "Selesaikan semua halaman untuk membuka episode berikutnya."
          : kidsMode ? "Kamu sudah membaca cerita terbaru dari komik ini." : "Kamu sudah membaca episode terbaru dari komik ini.")}</p>
      <div className="reader-episode-end-actions">
        {previousChapter && <Link className="reader-episode-secondary-action" href={`/comic/${comic.slug}/chapter/${previousChapter.id}`} onClick={(event) => { event.preventDefault(); requestChapterTransition(`/comic/${comic.slug}/chapter/${previousChapter.id}`); }}><ChevronLeft size={17} /> {t(kidsMode ? "Cerita sebelumnya" : "Episode sebelumnya")}</Link>}
        {nextChapter
          ? <Link className="reader-episode-next-action" href={`/comic/${comic.slug}/chapter/${nextChapter.id}`} onClick={(event) => { event.preventDefault(); requestChapterTransition(`/comic/${comic.slug}/chapter/${nextChapter.id}`); }}>{t(kidsMode ? "Baca cerita berikutnya" : "Baca episode berikutnya")} <ArrowRight size={18} /></Link>
          : nextChapterCandidate
            ? <span className="reader-episode-latest-label"><LockKeyhole size={15} /> {t(kidsMode ? "Selesaikan cerita ini untuk lanjut" : "Selesaikan episode ini untuk lanjut")}</span>
            : <span className="reader-episode-latest-label">{t(kidsMode ? "Ini adalah cerita terbaru" : "Ini adalah episode terbaru")}</span>}
        <Link className="reader-episode-secondary-action" href={`/comic/${comic.slug}`}><BookOpen size={17} /> {t("Kembali ke komik")}</Link>
      </div>
    </section>
  );

  return (
    <main
      className={`reader-experience${controlsVisible ? "" : " reader-controls-hidden"}`}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (currentDevice === "desktop" && !controlsVisible && !isTouchTabletLandscape()
          && !(event.target instanceof Element && event.target.closest("a, button, summary"))) {
          setControlsVisible(true);
        }
      }}
    >
      <header className="reader-experience-header">
        <Link className="reader-experience-back" href={`/comic/${comic.slug}`} aria-label={t("Kembali ke detail komik")}><ArrowLeft size={19} /><span>{comic.title}</span></Link>
        <div className="reader-experience-chapter"><span>{chapterTerm} {chapter.chapter_number}</span><strong>{chapter.title}</strong></div>
        <details className="reader-episode-menu">
          <summary aria-label={t(kidsMode ? "Daftar cerita" : "Daftar episode")}><List size={19} /><ChevronDown size={14} /></summary>
          <div className="reader-episode-menu-popover">
            <p>{t(kidsMode ? "Daftar cerita" : "Daftar episode")}</p>
            {chapterList.map((item, index) => {
              const unlocked = kidsMode || membership.tier === "vip" || allChaptersRead || index <= firstIncompleteChapterIndex || (index === firstIncompleteChapterIndex + 1 && chapterIndex === firstIncompleteChapterIndex && currentChapterRead);
              return unlocked
                ? <Link className={item.id === chapter.id ? "reader-menu-current" : ""} key={item.id} href={`/comic/${comic.slug}/chapter/${item.id}`} onClick={(event) => {
                    if (item.id !== chapter.id) {
                      event.preventDefault();
                      requestChapterTransition(`/comic/${comic.slug}/chapter/${item.id}`);
                    }
                  }}>{chapterTerm} {item.chapter_number} · {item.title}</Link>
                : <span className="reader-menu-locked" key={item.id}><LockKeyhole size={13} /> {chapterTerm} {item.chapter_number} · {item.title}</span>;
            })}
          </div>
        </details>
      </header>
      <h1 className="reader-sr-only">{comic.title} {chapterTerm} {chapter.chapter_number}: {chapter.title}</h1>

      {audioUrl && (
        <section className="reader-audio-player" aria-label={t(kidsMode ? "Audio dan subtitle cerita" : "Audio dan subtitle episode")}>
          <audio
            ref={audioElementRef}
            className="reader-audio-element"
            preload="metadata"
            src={audioUrl}
            onTimeUpdate={updateAudioSubtitle}
            onSeeked={updateAudioSubtitle}
            onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration)}
            onPlay={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
            onEnded={() => { setAudioPlaying(false); setActiveSubtitle(""); setActiveSubtitlePageId(null); }}
            onError={() => {
              console.error("Unable to load episode audio:", { chapterId: chapter.id });
              setAudioError("Audio episode belum dapat dimuat. Periksa koneksi lalu coba lagi.");
            }}
            onCanPlay={() => setAudioError("")}
          />
          <div className="reader-audio-controls">
            <span className="reader-audio-player-icon"><AudioLines size={18} /></span>
            <button
              className="reader-audio-play-button"
              type="button"
              aria-label={t(audioPlaying ? "Jeda audio" : "Putar audio")}
              onClick={() => {
                const audio = audioElementRef.current;
                if (!audio) return;
                if (audio.paused) {
                  void audio.play().catch((error: unknown) => {
                    console.error("Unable to start episode audio:", { chapterId: chapter.id, error });
                    setAudioError("Audio episode belum dapat diputar. Coba lagi.");
                  });
                } else {
                  audio.pause();
                }
              }}
            >
              {audioPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <div className="reader-audio-progress">
              <span>{formatAudioTime(audioCurrentTime)}</span>
              <input
                type="range"
                min={0}
                max={audioDuration || 0}
                step={1}
                value={Math.min(audioCurrentTime, audioDuration || 0)}
                aria-label={t("Posisi audio episode")}
                aria-valuetext={`${formatAudioTime(audioCurrentTime)} ${t("dari")} ${formatAudioTime(audioDuration)}`}
                style={{ "--audio-progress": `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` } as CSSProperties & { "--audio-progress": string }}
                onChange={(event) => {
                  const audio = audioElementRef.current;
                  if (!audio || !audioDuration) return;
                  const nextTime = Number(event.currentTarget.value);
                  audio.currentTime = nextTime;
                  setAudioCurrentTime(nextTime);
                }}
              />
              <span>{formatAudioTime(audioDuration)}</span>
            </div>
          </div>
          {(audioError || subtitleTrack.error) && <p className="reader-audio-error" role="alert">{t(audioError || subtitleTrack.error)}</p>}
        </section>
      )}
      {chapter.audio_object_key && !publicUrl && <p className="reader-audio-error" role="alert">{t("Audio episode belum dapat dimuat saat ini.")}</p>}

      <div className="reader-progress-track" role="progressbar" aria-label={t("Progres membaca")} aria-valuemin={0} aria-valuemax={pages.length} aria-valuenow={pages.length ? displayedPageEnd : 0}>
        <span style={{ width: pages.length ? `${(progressPage / pages.length) * 100}%` : "0%" }} />
      </div>

      {pages.length ? (
        <section
          ref={pagesContainerRef}
          className={`reader-vertical-pages${desktopBookMode ? " reader-book-mode" : ""}`}
          aria-label={`${chapter.title}, ${pages.length} ${t("halaman")}`}
        >
          {desktopBookMode ? (
            <>
              <div
                className="reader-book-stage"
                aria-label={isEpisodeEndSpread ? `${t("Penutup")} ${chapterTerm} ${chapter.chapter_number}` : `${t("Buku komik")}, ${t("halaman")} ${displayedPageStart} ${t("sampai")} ${displayedPageEnd} ${t("dari")} ${pages.length}`}
                onClick={(event) => {
                  if (bookTurn || event.target instanceof Element && event.target.closest("a, button")) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  scrollToPage(currentPage + (event.clientX < bounds.left + bounds.width / 2 ? -1 : 1));
                }}
              >
                {bookTurnSpreadChanging && bookTurn && (
                  <div className="reader-book-spread reader-book-spread-fade-out" aria-hidden="true">
                    {bookLeaves.slice(bookTurn.from * 2, bookTurn.from * 2 + 2).map((leaf, offset) => {
                      const page = leaf.kind === "page" ? leaf.page : null;
                      const src = page ? pageUrl(page) : null;
                      const leafKey = leaf.kind === "page" ? leaf.page.id : leaf.kind === "ad" ? `${leaf.provider}-ad-after-${leaf.afterPageIndex}` : leaf.kind;
                      return (
                        <div className={`reader-book-paper${offset === 0 ? " reader-book-paper-left" : " reader-book-paper-right"}${leaf.kind === "ad" ? ` reader-book-paper-ad${leaf.provider === "adsterra" ? " reader-book-paper-adsterra" : ""}` : ""}${leaf.kind === "end" ? " reader-book-paper-end" : ""}`} key={leafKey}>
                          {page && src && <img src={src} alt="" draggable={false} />}
                          {leaf.kind === "page" && <span className="reader-book-page-number">{leaf.page.page_number}</span>}
                          {leaf.kind === "end" && currentChapterRead && episodeEndContent}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className={`reader-book-spread${bookTurnSpreadChanging ? " reader-book-spread-fade-in" : ""}`}>
                  {activeBookLeaves.map((leaf, offset) => {
                    const page = leaf.kind === "page" ? leaf.page : null;
                    const src = page ? pageUrl(page) : null;
                    const leafKey = leaf.kind === "page" ? leaf.page.id : leaf.kind === "ad" ? `${leaf.provider}-ad-after-${leaf.afterPageIndex}` : leaf.kind;
                    return (
                      <div className={`reader-book-paper${offset === 0 ? " reader-book-paper-left" : " reader-book-paper-right"}${leaf.kind === "ad" ? ` reader-book-paper-ad${leaf.provider === "adsterra" ? " reader-book-paper-adsterra" : ""}` : ""}${leaf.kind === "end" ? " reader-book-paper-end" : ""}`} key={leafKey} data-reader-page={leaf.kind === "page" ? leaf.pageIndex : undefined}>
                        {leaf.kind === "ad" && leaf.provider === "adsterra" ? (
                          <AdsterraAd placement="reader" />
                        ) : leaf.kind === "ad" ? (
                          <SponsoredAd
                            slotKey="reader_mid_chapter"
                            placement="reader"
                            comicId={comic.id}
                            matchPageIndex={leaf.afterPageIndex}
                            readerStopId={`mid-chapter-ad-${pages[leaf.afterPageIndex]?.page_number ?? leaf.afterPageIndex + 1}`}
                            ctaOnly
                            fallback={
                              <div className="reader-book-house-ad">
                                <span className="reader-book-house-ad-icon"><BookOpen size={29} /></span>
                                <span className="reader-book-house-ad-kicker">RUANG IKLAN MU-KOMIK</span>
                                <strong>Bagikan ceritamu kepada pembaca.</strong>
                                <span className="reader-book-house-ad-description">Punya komik untuk diterbitkan? Bergabunglah sebagai kreator di MU-Komik.</span>
                                <Link className="reader-book-house-ad-link" href="/account/creator-application">Mulai berkarya <ArrowRight size={15} /></Link>
                              </div>
                            }
                          />
                        ) : leaf.kind === "end" ? (
                          currentChapterRead && <div data-reader-stop="episode-end">{episodeEndContent}</div>
                        ) : page && src ? (
                          <div
                            className={`reader-book-page-art${page.text_overlays.length || page.interactive_markers.length ? " reader-page-art-with-text-overlays" : ""}`}
                            style={{ "--reader-page-aspect-ratio": pageAspectRatios[page.id] ?? 0.75 } as CSSProperties}
                          >
                            <img
                              src={src}
                              alt={`${comic.title}, episode ${chapter.chapter_number}, halaman ${page.page_number}`}
                              draggable={false}
                              style={{ objectPosition: `center ${page.image_vertical_align}` }}
                              onLoad={(event) => {
                                const image = event.currentTarget;
                                const aspectRatio = image.naturalWidth / image.naturalHeight;
                                if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
                                  setPageAspectRatios((current) => current[page.id] === aspectRatio
                                    ? current
                                    : { ...current, [page.id]: aspectRatio });
                                }
                              }}
                            />
                            <PageTextOverlayLayer overlays={page.text_overlays} />
                            <PageInteractiveMarkerLayer markers={page.interactive_markers} />
                            {activeSubtitlePageId === page.id && activeSubtitle && (
                              <p className="reader-page-subtitle reader-book-page-subtitle" aria-live="polite">{activeSubtitle}</p>
                            )}
                          </div>
                        ) : page ? <div className="reader-image-error">{t("Alamat media komik belum dikonfigurasi.")}</div> : null}
                        {leaf.kind === "page" && <span className="reader-book-page-number">{leaf.page.page_number}</span>}
                      </div>
                    );
                  })}
                </div>
                {bookTurn && (
                  <div
                    key={`${bookTurn.from}-${bookTurn.to}`}
                    className={`reader-book-turn reader-book-turn-${bookTurn.direction}`}
                    onAnimationEnd={(event) => {
                      if (event.target === event.currentTarget) finishBookTurn();
                    }}
                    aria-hidden="true"
                  >
                    <div className="reader-book-turn-face reader-book-turn-front">
                      {turningFromPageUrl && <img src={turningFromPageUrl} alt="" draggable={false} />}
                    </div>
                    <div className="reader-book-turn-face reader-book-turn-back">
                      {turningToPageUrl && <img src={turningToPageUrl} alt="" draggable={false} />}
                    </div>
                  </div>
                )}
                <div className="reader-watermark-overlay" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, index) => <span key={index}>{watermarkLabel}</span>)}
                </div>
                <span className="reader-book-spine" aria-hidden="true" />
              </div>
            </>
          ) : (
            <>
              {pages.map((page, index) => {
                const src = pageUrl(page);
                const pageIsRead = readPageIds.has(page.id);
                return (
                  <Fragment key={page.id}>
                    <div
                      className="reader-page-frame"
                      data-reader-page={index}
                      data-reader-stop={`page-${index}`}
                      aria-label={`Halaman ${page.page_number}, ${pageIsRead ? "sudah dibaca" : "belum dibaca"}`}
                    >
                      <span className={`reader-page-read-status${pageIsRead ? " reader-page-read-status-read" : ""}`} role="img" aria-label={pageIsRead ? "Sudah dibaca" : "Belum dibaca"}>
                        {pageIsRead ? <Check size={14} strokeWidth={3} /> : <Circle size={12} />}
                        <span>{pageIsRead ? "Dibaca" : "Belum dibaca"}</span>
                      </span>
                      {src
                        ? (
                          <div
                            className={`reader-page-art${page.text_overlays.length || page.interactive_markers.length ? " reader-page-art-with-text-overlays" : ""}`}
                            style={{ "--reader-page-aspect-ratio": pageAspectRatios[page.id] ?? 0.75 } as CSSProperties}
                          >
                            <img
                              src={src}
                              alt={`${comic.title}, ${chapterTerm} ${chapter.chapter_number}, ${t("halaman")} ${page.page_number}`}
                              loading={index < 2 ? "eager" : "lazy"}
                              draggable={false}
                              style={{ objectPosition: `center ${page.image_vertical_align}` }}
                              onLoad={(event) => {
                                const image = event.currentTarget;
                                const aspectRatio = image.naturalWidth / image.naturalHeight;
                                if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
                                  setPageAspectRatios((current) => current[page.id] === aspectRatio
                                    ? current
                                    : { ...current, [page.id]: aspectRatio });
                                }
                              }}
                            />
                            <PageTextOverlayLayer overlays={page.text_overlays} />
                            <PageInteractiveMarkerLayer markers={page.interactive_markers} />
                            {activeSubtitlePageId === page.id && activeSubtitle && (
                              <p className="reader-page-subtitle" aria-live="polite">{activeSubtitle}</p>
                            )}
                          </div>
                        )
                        : <div className="reader-image-error">Alamat media komik belum dikonfigurasi.</div>}
                      {src && <div className="reader-watermark-overlay reader-page-watermark" aria-hidden="true">{Array.from({ length: 6 }, (_, watermarkIndex) => <span key={watermarkIndex}>{watermarkLabel}</span>)}</div>}
                      </div>
                      {!kidsMode && membership.ready && membership.tier === "free" && getReaderAdKind(index + 1) === "adsterra" && (
                        <AdsterraAd key={`adsterra-after-page-${page.page_number}`} placement="reader" />
                      )}
                      {!kidsMode && membership.ready && membership.tier === "free" && getReaderAdKind(index + 1) === "internal" && (
                        <SponsoredAd
                          key={`mid-chapter-ad-${page.page_number}`}
                          slotKey="reader_mid_chapter"
                          placement="reader"
                          comicId={comic.id}
                          matchPageIndex={index}
                          readerStopId={`mid-chapter-ad-${page.page_number}`}
                        />
                      )}
                  </Fragment>
                );
              })}
              {currentChapterRead && chapterEndReached && (
                <div className="reader-episode-end-page" data-reader-stop="episode-end">
                  {episodeEndContent}
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="reader-no-pages"><BookOpen size={28} /><h2>{t(pageLoadError ? "Halaman komik belum dapat dimuat." : kidsMode ? "Cerita ini belum memiliki halaman." : "Episode ini belum memiliki halaman.")}</h2><p>{t(pageLoadError ? "Periksa koneksi lalu muat ulang halaman ini." : "Kembali lagi nanti untuk membaca cerita ini.")}</p>{pageLoadError ? <button onClick={() => window.location.reload()}>{t("Coba lagi")}</button> : <Link href={`/comic/${comic.slug}`}>{t("Kembali ke komik")}</Link>}</section>
      )}
      <button
        className="reader-controls-toggle"
        onClick={() => {
          const nextControlsVisible = !controlsVisible;
          setControlsVisible(nextControlsVisible);
          if (currentDevice === "mobile" && !desktopBookMode) {
            const reader = pagesContainerRef.current?.closest<HTMLElement>(".reader-experience");
            const frame = document.querySelector<HTMLElement>(`[data-reader-page="${currentPage}"]`);
            if (nextControlsVisible) {
              reader?.style.removeProperty("--reader-mobile-fullscreen-top-padding");
            } else if (reader && frame) {
              const topPadding = Math.max(0, (window.innerHeight - frame.getBoundingClientRect().height) / 2);
              reader.style.setProperty("--reader-mobile-fullscreen-top-padding", `${topPadding}px`);
            }
            window.requestAnimationFrame(() => {
              frame?.scrollIntoView({
                behavior: "smooth",
                block: nextControlsVisible ? "start" : "center",
              });
            });
          }
        }}
        aria-label={t(controlsVisible ? "Aktifkan layar penuh" : "Keluar dari layar penuh")}
        aria-pressed={!controlsVisible}
      >
        {controlsVisible ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      {controlsVisible && pages.length > 0 && (
        <footer className="reader-experience-controls">
          <button onClick={() => scrollToPage(currentPage - 1)} disabled={currentPage <= 0} aria-label={t("Halaman sebelumnya")}><ChevronLeft size={20} /><span>{t("Sebelumnya")}</span></button>
          <span className="reader-page-count">{isEpisodeEndSpread ? `${t("Penutup")} ${chapterTerm.toLowerCase()}` : desktopBookMode && displayedPageEnd > displayedPageStart ? `${displayedPageStart}–${displayedPageEnd}` : displayedPageStart} {!isEpisodeEndSpread && <><i>/</i> {pages.length}</>}</span>
          {canAdvancePage
            ? <button onClick={() => scrollToPage(currentPage + 1)} aria-label={t("Halaman berikutnya")}><span>{t("Berikutnya")}</span><ChevronRight size={20} /></button>
            : nextChapter
              ? <Link href={`/comic/${comic.slug}/chapter/${nextChapter.id}`} onClick={(event) => { event.preventDefault(); requestChapterTransition(`/comic/${comic.slug}/chapter/${nextChapter.id}`); }}><span>{t(kidsMode ? "Cerita selanjutnya" : "Episode selanjutnya")}</span><ArrowRight size={19} /></Link>
              : <Link href={`/comic/${comic.slug}`}><span>{t(kidsMode ? "Daftar cerita" : "Daftar episode")}</span><BookOpen size={18} /></Link>}
        </footer>
      )}

      {(previousChapter || nextChapter) && <nav className="reader-chapter-navigation" aria-label={t(kidsMode ? "Navigasi cerita" : "Navigasi episode")}>
        {previousChapter
          ? <Link href={`/comic/${comic.slug}/chapter/${previousChapter.id}`} onClick={(event) => { event.preventDefault(); requestChapterTransition(`/comic/${comic.slug}/chapter/${previousChapter.id}`); }}><ChevronLeft size={17} /> {t(kidsMode ? "Cerita sebelumnya" : "Episode sebelumnya")}</Link>
          : <span />}
        {nextChapter && <Link href={`/comic/${comic.slug}/chapter/${nextChapter.id}`} onClick={(event) => { event.preventDefault(); requestChapterTransition(`/comic/${comic.slug}/chapter/${nextChapter.id}`); }}>{t(kidsMode ? "Cerita selanjutnya" : "Episode selanjutnya")} <ChevronRight size={17} /></Link>}
      </nav>}

      {pendingChapterHref && <div className="reader-transition-ad-backdrop">
        <section className="reader-transition-ad-dialog" role="dialog" aria-modal="true" aria-labelledby="reader-transition-ad-title">
          <h2 id="reader-transition-ad-title">{t("Sebelum lanjut membaca")}</h2>
          {transitionAdAvailable === null && <div className="reader-transition-ad-loading"><LoaderCircle className="spin" size={20} /> {t("Memuat iklan...")}</div>}
          <SponsoredAd
            slotKey="reader_episode_transition"
            placement="transition"
            comicId={comic.id}
            onCampaignAvailability={reportTransitionAdAvailability}
          />
          <AdsterraAd
            placement="transition"
            onAvailabilityChange={reportTransitionAdsterraAvailability}
          />
          {transitionAdAvailable && transitionCountdown !== null && (
            transitionCountdown > 0
              ? <p className="reader-transition-ad-countdown"><Clock3 size={16} /> {t("Bisa dilewati dalam")} {transitionCountdown} {t("detik")}</p>
              : <button className="reader-episode-next-action" type="button" onClick={() => {
                  const target = pendingChapterHref;
                  setPendingChapterHref(null);
                  if (target) router.push(target);
                }}>{t(kidsMode ? "Lanjut ke cerita" : "Lanjut ke episode")} <ArrowRight size={18} /></button>
          )}
        </section>
      </div>}
    </main>
  );
}
