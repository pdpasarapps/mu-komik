"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Settings = { internalEnabled: boolean; adsterraEnabled: boolean };

const supabase = createClient();
const defaultSettings: Settings = { internalEnabled: true, adsterraEnabled: true };

export default function ComicAdSettingsEditor({ comicId }: { comicId: string }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("comic_ad_settings")
        .select("internal_enabled, adsterra_enabled")
        .eq("comic_id", comicId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Unable to load comic ad settings:", error);
        setMessage("Pengaturan iklan belum tersedia. Pastikan migrasi supabase/comic-ad-settings.sql sudah dijalankan.");
      } else {
        setSettings({
          internalEnabled: data?.internal_enabled ?? true,
          adsterraEnabled: data?.adsterra_enabled ?? true,
        });
      }
      setLoading(false);
    };
    void loadSettings();
    return () => { active = false; };
  }, [comicId]);

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const nextSettings = { ...settings, [key]: value };
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("comic_ad_settings").upsert({
      comic_id: comicId,
      internal_enabled: nextSettings.internalEnabled,
      adsterra_enabled: nextSettings.adsterraEnabled,
    }, { onConflict: "comic_id" });
    if (error) {
      console.error("Unable to save comic ad settings:", error);
      setMessage("Pengaturan iklan gagal disimpan. Periksa akses admin dan coba lagi.");
    } else {
      setSettings(nextSettings);
      setMessage("Pengaturan iklan berhasil disimpan.");
    }
    setSaving(false);
  };

  return (
    <div className="admin-user-edit-form admin-comic-guest-setting">
      <strong>Iklan pada komik ini</strong>
      <label className="admin-feature-toggle">
        <span>Iklan internal MU Komik</span>
        <input
          type="checkbox"
          checked={settings.internalEnabled}
          disabled={loading || saving}
          onChange={(event) => void updateSetting("internalEnabled", event.target.checked)}
        />
      </label>
      <label className="admin-feature-toggle">
        <span>Iklan Adsterra</span>
        <input
          type="checkbox"
          checked={settings.adsterraEnabled}
          disabled={loading || saving}
          onChange={(event) => void updateSetting("adsterraEnabled", event.target.checked)}
        />
      </label>
      <p role={message.includes("gagal") || message.includes("belum tersedia") ? "alert" : "status"}>
        {loading ? "Memuat pengaturan iklan..." : message || "Pengaturan ini hanya berlaku untuk komik tersebut dan mengikuti pengaturan iklan global."}
      </p>
    </div>
  );
}
