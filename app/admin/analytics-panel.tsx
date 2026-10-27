"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle, Users, Eye, UserRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type DailyViews = { date: string; views: number };
type TopComic = { comicId: string; slug: string; title: string; views: number };
type TopChapter = { chapterId: string; comicSlug: string; comicTitle: string; chapterNumber: number; title: string; views: number };
type AnalyticsData = {
  views: number;
  uniqueVisitors: number;
  registeredReaders: number;
  daily: DailyViews[];
  topComics: TopComic[];
  topChapters: TopChapter[];
};
type Ga4AnalyticsData = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  engagementRate: number;
  averageSessionDuration: number;
  daily: DailyViews[];
  topPages: { path: string; views: number }[];
  readingJourney: ReadingJourneyItem[];
  devices: Ga4DimensionRow[];
  countries: Ga4DimensionRow[];
  sources: Ga4DimensionRow[];
};
type Ga4DimensionRow = { dimension: string; activeUsers: number; sessions: number };
type ReadingJourneyEventName = "comic_view" | "episode_start" | "episode_next";
type ReadingJourneyItem = { eventName: ReadingJourneyEventName; users: number; events: number };
type Ga4RealtimeData = {
  activeUsers: number;
  pages: Ga4DimensionRow[];
  countries: Ga4DimensionRow[];
  devices: Ga4DimensionRow[];
};
const readingJourneySteps: { eventName: ReadingJourneyEventName; label: string }[] = [
  { eventName: "comic_view", label: "Halaman komik dibuka" },
  { eventName: "episode_start", label: "Episode mulai dibaca" },
  { eventName: "episode_next", label: "Lanjut ke episode berikutnya" },
];

const supabase = createClient();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAnalytics(value: unknown): AnalyticsData | null {
  if (!isRecord(value)
    || typeof value.views !== "number"
    || typeof value.uniqueVisitors !== "number"
    || typeof value.registeredReaders !== "number"
    || !Array.isArray(value.daily)
    || !Array.isArray(value.topComics)
    || !Array.isArray(value.topChapters)) return null;

  const daily = value.daily.flatMap((row): DailyViews[] => (
    isRecord(row) && typeof row.date === "string" && typeof row.views === "number"
      ? [{ date: row.date, views: row.views }]
      : []
  ));
  const topComics = value.topComics.flatMap((row): TopComic[] => (
    isRecord(row) && typeof row.comicId === "string" && typeof row.slug === "string"
      && typeof row.title === "string" && typeof row.views === "number"
      ? [{ comicId: row.comicId, slug: row.slug, title: row.title, views: row.views }]
      : []
  ));
  const topChapters = value.topChapters.flatMap((row): TopChapter[] => (
    isRecord(row) && typeof row.chapterId === "string" && typeof row.comicSlug === "string"
      && typeof row.comicTitle === "string" && typeof row.chapterNumber === "number"
      && typeof row.title === "string" && typeof row.views === "number"
      ? [{
        chapterId: row.chapterId,
        comicSlug: row.comicSlug,
        comicTitle: row.comicTitle,
        chapterNumber: row.chapterNumber,
        title: row.title,
        views: row.views,
      }]
      : []
  ));

  return {
    views: value.views,
    uniqueVisitors: value.uniqueVisitors,
    registeredReaders: value.registeredReaders,
    daily,
    topComics,
    topChapters,
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function parseDimensionRows(value: unknown): Ga4DimensionRow[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((row): Ga4DimensionRow[] => (
    isRecord(row) && typeof row.dimension === "string"
      && typeof row.activeUsers === "number" && typeof row.sessions === "number"
      ? [{ dimension: row.dimension, activeUsers: row.activeUsers, sessions: row.sessions }]
      : []
  ));
}

function parseReadingJourney(value: unknown): ReadingJourneyItem[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((row): ReadingJourneyItem[] => (
    isRecord(row)
      && (row.eventName === "comic_view" || row.eventName === "episode_start" || row.eventName === "episode_next")
      && typeof row.users === "number"
      && typeof row.events === "number"
      ? [{ eventName: row.eventName, users: row.users, events: row.events }]
      : []
  ));
}

export default function AdminAnalyticsPanel() {
  const [days, setDays] = useState(7);
  const [realtimeResult, setRealtimeResult] = useState<{ analytics: Ga4RealtimeData | null; errorMessage: string }>(
    { analytics: null, errorMessage: "" },
  );
  const [ga4Result, setGa4Result] = useState<{ days: number; analytics: Ga4AnalyticsData | null; errorMessage: string }>(
    { days: 0, analytics: null, errorMessage: "" },
  );
  const [result, setResult] = useState<{ days: number; analytics: AnalyticsData | null; errorMessage: string }>(
    { days: 0, analytics: null, errorMessage: "" },
  );

  useEffect(() => {
    let active = true;
    let requestInProgress = false;
    const loadRealtimeAnalytics = async () => {
      if (requestInProgress) return;
      requestInProgress = true;
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session?.access_token) {
          if (active) setRealtimeResult({ analytics: null, errorMessage: "Sesi login tidak tersedia. Silakan masuk kembali." });
          return;
        }
        const response = await fetch("/api/admin/ga4-analytics?realtime=1", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const data: unknown = await response.json();
        if (!active) return;
        if (!response.ok) {
          const message = isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Laporan Realtime Google Analytics tidak dapat dimuat.";
          setRealtimeResult({ analytics: null, errorMessage: message });
          return;
        }
        if (!isRecord(data) || typeof data.activeUsers !== "number") {
          throw new Error("Google Analytics returned an invalid realtime response.");
        }
        const pages = parseDimensionRows(data.pages);
        const countries = parseDimensionRows(data.countries);
        const devices = parseDimensionRows(data.devices);
        if (!pages || !countries || !devices) throw new Error("Google Analytics returned invalid realtime dimensions.");
        setRealtimeResult({
          analytics: { activeUsers: data.activeUsers, pages, countries, devices },
          errorMessage: "",
        });
      } catch (error) {
        console.error("Unable to load Google Analytics realtime report:", error);
        if (active) {
          setRealtimeResult({ analytics: null, errorMessage: "Laporan Realtime Google Analytics belum dapat dimuat." });
        }
      } finally {
        requestInProgress = false;
      }
    };
    void loadRealtimeAnalytics();
    const intervalId = window.setInterval(() => void loadRealtimeAnalytics(), 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadGa4Analytics = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session?.access_token) {
          if (active) {
            setGa4Result({ days, analytics: null, errorMessage: "Sesi login tidak tersedia. Silakan masuk kembali." });
          }
          return;
        }
        const response = await fetch(`/api/admin/ga4-analytics?days=${days}`, {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const data: unknown = await response.json();
        if (!active) return;
        if (!response.ok) {
          const message = isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Laporan Google Analytics tidak dapat dimuat.";
          setGa4Result({ days, analytics: null, errorMessage: message });
          return;
        }
        if (!isRecord(data)
          || typeof data.activeUsers !== "number"
          || typeof data.newUsers !== "number"
          || typeof data.sessions !== "number"
          || typeof data.pageViews !== "number"
          || typeof data.engagementRate !== "number"
          || typeof data.averageSessionDuration !== "number"
          || !Array.isArray(data.daily)
          || !Array.isArray(data.topPages)) {
          throw new Error("Google Analytics returned an invalid response.");
        }
        const devices = parseDimensionRows(data.devices);
        const countries = parseDimensionRows(data.countries);
        const sources = parseDimensionRows(data.sources);
        const readingJourney = parseReadingJourney(data.readingJourney);
        if (!devices || !countries || !sources || !readingJourney) {
          throw new Error("Google Analytics returned invalid report dimensions.");
        }
        const daily = data.daily.flatMap((row): DailyViews[] => (
          isRecord(row) && typeof row.date === "string" && typeof row.views === "number"
            ? [{ date: row.date, views: row.views }]
            : []
        ));
        const topPages = data.topPages.flatMap((row): { path: string; views: number }[] => (
          isRecord(row) && typeof row.path === "string" && typeof row.views === "number"
            ? [{ path: row.path, views: row.views }]
            : []
        ));
        setGa4Result({
          days,
          analytics: {
            activeUsers: data.activeUsers,
            newUsers: data.newUsers,
            sessions: data.sessions,
            pageViews: data.pageViews,
            engagementRate: data.engagementRate,
            averageSessionDuration: data.averageSessionDuration,
            daily,
            topPages,
            readingJourney,
            devices,
            countries,
            sources,
          },
          errorMessage: "",
        });
      } catch (error) {
        console.error("Unable to load Google Analytics report:", error);
        if (active) {
          setGa4Result({ days, analytics: null, errorMessage: "Laporan Google Analytics belum dapat dimuat. Coba muat ulang halaman." });
        }
      }
    };
    void loadGa4Analytics();
    return () => { active = false; };
  }, [days]);

  useEffect(() => {
    let active = true;
    const loadAnalytics = async () => {
      try {
        const { data, error } = await supabase.rpc("admin_comic_analytics", { p_days: days });
        if (!active) return;
        if (error) {
          console.error("Unable to load admin analytics:", error);
          setResult({
            days,
            analytics: null,
            errorMessage: error.code === "PGRST202"
              ? "Jalankan supabase/comic-analytics.sql di Supabase SQL Editor untuk mengaktifkan analitik."
              : "Data analitik belum dapat dimuat. Coba muat ulang halaman.",
          });
        } else {
          const parsed = parseAnalytics(data);
          if (!parsed) {
            console.error("Admin analytics returned an invalid response.");
            setResult({ days, analytics: null, errorMessage: "Format data analitik tidak valid." });
          } else {
            setResult({ days, analytics: parsed, errorMessage: "" });
          }
        }
      } catch (error) {
        console.error("Unable to load admin analytics:", error);
        if (active) {
          setResult({ days, analytics: null, errorMessage: "Data analitik belum dapat dimuat. Periksa koneksi lalu coba lagi." });
        }
      }
    };
    void loadAnalytics();
    return () => { active = false; };
  }, [days]);

  const loading = result.days !== days;
  const analytics = loading ? null : result.analytics;
  const errorMessage = loading ? "" : result.errorMessage;
  const ga4Loading = ga4Result.days !== days;
  const ga4Analytics = ga4Loading ? null : ga4Result.analytics;
  const ga4ErrorMessage = ga4Loading ? "" : ga4Result.errorMessage;
  const maxDailyViews = Math.max(1, ...(analytics?.daily.map((item) => item.views) ?? [0]));
  const maxGa4DailyViews = Math.max(1, ...(ga4Analytics?.daily.map((item) => item.views) ?? [0]));

  return (
    <section className="admin-analytics-section" id="analytics" aria-labelledby="admin-analytics-title">
      <div className="admin-section-heading">
        <div><p className="eyebrow">Pembacaan komik</p><h2 id="admin-analytics-title">Analitik</h2></div>
        <label className="admin-analytics-range">Rentang
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Rentang analitik">
            <option value={7}>7 hari</option>
            <option value={30}>30 hari</option>
            <option value={90}>90 hari</option>
          </select>
        </label>
      </div>
      <div className="admin-analytics-chart-panel">
        <div className="admin-analytics-subheading"><h3>Google Analytics Realtime</h3><span>Perbarui tiap 60 detik</span></div>
        {realtimeResult.errorMessage
          ? <p className="admin-analytics-message" role="alert">{realtimeResult.errorMessage}</p>
          : !realtimeResult.analytics
            ? <div className="admin-analytics-loading"><LoaderCircle className="spin" size={20} /> Memuat data Realtime...</div>
            : (
              <>
                <div className="admin-analytics-stats">
                  <article className="admin-stat"><span>Pengguna aktif sekarang</span><strong>{formatCount(realtimeResult.analytics.activeUsers)}</strong><Users size={20} /></article>
                </div>
                <div className="admin-analytics-rankings">
                  {([
                    ["Halaman aktif", realtimeResult.analytics.pages],
                    ["Negara", realtimeResult.analytics.countries],
                    ["Perangkat", realtimeResult.analytics.devices],
                  ] as const).map(([title, rows]) => (
                    <section className="admin-analytics-list" key={title}>
                      <h3>{title}</h3>
                      {rows.length === 0
                        ? <p className="admin-analytics-empty">Belum ada pengguna aktif.</p>
                        : <ol>{rows.map((row) => <li key={row.dimension}>
                          <span>{row.dimension}</span><strong>{formatCount(row.activeUsers)} aktif</strong>
                        </li>)}</ol>}
                    </section>
                  ))}
                </div>
                <p className="admin-analytics-note">Realtime menampilkan snapshot aktivitas terbaru GA4, bukan riwayat yang disimpan. Nama halaman mungkin tidak tersedia pada sebagian laporan bergantung pada data yang dikirim GA4.</p>
              </>
            )}
      </div>
      <div className="admin-analytics-chart-panel">
        <div className="admin-analytics-subheading"><h3>Google Analytics 4</h3><span>GA4</span></div>
        {ga4ErrorMessage
          ? <p className="admin-analytics-message" role="alert">{ga4ErrorMessage}</p>
          : ga4Loading || !ga4Analytics
            ? <div className="admin-analytics-loading"><LoaderCircle className="spin" size={20} /> Memuat laporan GA4...</div>
            : (
              <>
                <div className="admin-analytics-stats">
                  <article className="admin-stat"><span>Pengguna aktif</span><strong>{formatCount(ga4Analytics.activeUsers)}</strong><Users size={20} /></article>
                  <article className="admin-stat"><span>Pengguna baru</span><strong>{formatCount(ga4Analytics.newUsers)}</strong><UserRound size={20} /></article>
                  <article className="admin-stat"><span>Sesi</span><strong>{formatCount(ga4Analytics.sessions)}</strong><UserRound size={20} /></article>
                  <article className="admin-stat"><span>Tampilan halaman</span><strong>{formatCount(ga4Analytics.pageViews)}</strong><Eye size={20} /></article>
                  <article className="admin-stat"><span>Rasio engagement</span><strong>{new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 }).format(ga4Analytics.engagementRate)}</strong><BarChart3 size={20} /></article>
                  <article className="admin-stat"><span>Durasi sesi rata-rata</span><strong>{formatDuration(ga4Analytics.averageSessionDuration)}</strong><BarChart3 size={20} /></article>
                </div>
                <div className="admin-analytics-chart-panel">
                  <div className="admin-analytics-subheading"><h3>Tampilan halaman harian</h3><span><BarChart3 size={15} /> GA4</span></div>
                  {ga4Analytics.daily.length === 0
                    ? <p className="admin-analytics-empty">Belum ada data GA4 pada rentang ini.</p>
                    : <div className="admin-analytics-chart" role="img" aria-label={`Grafik ${days} hari tampilan halaman GA4`}>
                      {ga4Analytics.daily.map((item, index) => {
                        const showLabel = days <= 30 || index % 7 === 0 || index === ga4Analytics.daily.length - 1;
                        const date = new Date(`${item.date}T00:00:00Z`);
                        return (
                          <div className="admin-analytics-day" key={item.date} title={`${date.toLocaleDateString("id-ID", { timeZone: "UTC" })}: ${formatCount(item.views)} tampilan`}>
                            <span className="admin-analytics-bar-wrap"><span className="admin-analytics-bar" style={{ height: `${Math.max(3, item.views / maxGa4DailyViews * 100)}%` }} /></span>
                            {showLabel && <span className="admin-analytics-day-label">{date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" })}</span>}
                          </div>
                        );
                      })}
                    </div>}
                </div>
                <div className="admin-analytics-rankings">
                  <section className="admin-analytics-list">
                    <h3>Halaman terpopuler</h3>
                    {ga4Analytics.topPages.length === 0
                      ? <p className="admin-analytics-empty">Belum ada data.</p>
                      : <ol>{ga4Analytics.topPages.map((page) => <li key={page.path}>
                        <span>{page.path}</span><strong>{formatCount(page.views)}</strong>
                      </li>)}</ol>}
                  </section>
                  {([
                    ["Perangkat", ga4Analytics.devices],
                    ["Negara", ga4Analytics.countries],
                    ["Sumber / medium", ga4Analytics.sources],
                  ] as const).map(([title, rows]) => (
                    <section className="admin-analytics-list" key={title}>
                      <h3>{title}</h3>
                      {rows.length === 0
                        ? <p className="admin-analytics-empty">Belum ada data.</p>
                        : <ol>{rows.map((row) => <li key={row.dimension}>
                          <span>{row.dimension}</span><strong>{formatCount(row.sessions)} sesi</strong>
                        </li>)}</ol>}
                    </section>
                  ))}
                </div>
                <div className="admin-analytics-chart-panel">
                  <div className="admin-analytics-subheading"><h3>Perjalanan baca</h3><span>Event GA4</span></div>
                  <div className="admin-analytics-stats">
                    {readingJourneySteps.map((step) => {
                      const data = ga4Analytics.readingJourney.find((item) => item.eventName === step.eventName);
                      return (
                        <article className="admin-stat" key={step.eventName}>
                          <span>{step.label}</span>
                          <strong>{formatCount(data?.users ?? 0)}</strong>
                          <span>{formatCount(data?.events ?? 0)} event</span>
                        </article>
                      );
                    })}
                  </div>
                  <p className="admin-analytics-note">Setiap angka menunjukkan pengguna unik yang memicu event dan jumlah event pada rentang terpilih; laporan ini belum menghubungkan urutan aktivitas tiap pengguna. Data mulai terkumpul setelah event baru aktif dan dapat memerlukan waktu untuk muncul di GA4.</p>
                </div>
              </>
            )}
      </div>
      {errorMessage
        ? <p className="admin-analytics-message" role="alert">{errorMessage}</p>
        : loading || !analytics
          ? <div className="admin-analytics-loading"><LoaderCircle className="spin" size={20} /> Memuat analitik...</div>
          : (
            <>
              <div className="admin-analytics-stats">
                <article className="admin-stat"><span>Kunjungan episode</span><strong>{formatCount(analytics.views)}</strong><Eye size={20} /></article>
                <article className="admin-stat"><span>Pembaca unik*</span><strong>{formatCount(analytics.uniqueVisitors)}</strong><Users size={20} /></article>
                <article className="admin-stat"><span>Pembaca login</span><strong>{formatCount(analytics.registeredReaders)}</strong><UserRound size={20} /></article>
              </div>
              <p className="admin-analytics-note">*Pembaca unik dihitung berdasarkan kuki acak di peramban; dapat terhitung kembali setelah kuki dihapus atau pada peramban/perangkat lain. Satu episode dihitung maksimal sekali per pembaca setiap 30 menit.</p>
              <div className="admin-analytics-chart-panel">
                <div className="admin-analytics-subheading"><h3>Tren kunjungan harian</h3><span><BarChart3 size={15} /> UTC</span></div>
                {analytics.daily.length === 0
                  ? <p className="admin-analytics-empty">Belum ada data kunjungan pada rentang ini.</p>
                  : <div className="admin-analytics-chart" role="img" aria-label={`Grafik ${days} hari kunjungan episode`}>
                    {analytics.daily.map((item, index) => {
                      const showLabel = days <= 30 || index % 7 === 0 || index === analytics.daily.length - 1;
                      const date = new Date(`${item.date}T00:00:00Z`);
                      return (
                        <div className="admin-analytics-day" key={item.date} title={`${date.toLocaleDateString("id-ID", { timeZone: "UTC" })}: ${formatCount(item.views)} kunjungan`}>
                          <span className="admin-analytics-bar-wrap"><span className="admin-analytics-bar" style={{ height: `${Math.max(3, item.views / maxDailyViews * 100)}%` }} /></span>
                          {showLabel && <span className="admin-analytics-day-label">{date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" })}</span>}
                        </div>
                      );
                    })}
                  </div>}
              </div>
              <div className="admin-analytics-rankings">
                <section className="admin-analytics-list">
                  <h3>Komik teratas</h3>
                  {analytics.topComics.length === 0
                    ? <p className="admin-analytics-empty">Belum ada data.</p>
                    : <ol>{analytics.topComics.map((comic) => <li key={comic.comicId}>
                      <Link href={`/comic/${comic.slug}`}>{comic.title}</Link><strong>{formatCount(comic.views)}</strong>
                    </li>)}</ol>}
                </section>
                <section className="admin-analytics-list">
                  <h3>Episode teratas</h3>
                  {analytics.topChapters.length === 0
                    ? <p className="admin-analytics-empty">Belum ada data.</p>
                    : <ol>{analytics.topChapters.map((chapter) => <li key={chapter.chapterId}>
                      <Link href={`/comic/${chapter.comicSlug}/chapter/${chapter.chapterId}`}>
                        <span>{chapter.comicTitle}</span> · Ep. {chapter.chapterNumber}: {chapter.title}
                      </Link><strong>{formatCount(chapter.views)}</strong>
                    </li>)}</ol>}
                </section>
              </div>
            </>
          )}
    </section>
  );
}
