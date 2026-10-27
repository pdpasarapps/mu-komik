"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type ComicAdSettings = {
  ready: boolean;
  internalEnabled: boolean;
  adsterraEnabled: boolean;
};

const defaultSettings: ComicAdSettings = {
  ready: true,
  internalEnabled: true,
  adsterraEnabled: true,
};

const ComicAdSettingsContext = createContext<ComicAdSettings>(defaultSettings);
const supabase = createClient();

export function ComicAdSettingsProvider({ comicId, children }: { comicId: string; children: ReactNode }) {
  const [settings, setSettings] = useState<ComicAdSettings>({
    ready: false,
    internalEnabled: false,
    adsterraEnabled: false,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("comic_ad_settings")
        .select("internal_enabled, adsterra_enabled")
        .eq("comic_id", comicId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Unable to load comic ad settings:", {
          comicId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setSettings({ ready: true, internalEnabled: false, adsterraEnabled: false });
        return;
      }
      setSettings({
        ready: true,
        internalEnabled: data?.internal_enabled ?? true,
        adsterraEnabled: data?.adsterra_enabled ?? true,
      });
    };
    void load();
    return () => { cancelled = true; };
  }, [comicId]);

  return <ComicAdSettingsContext.Provider value={settings}>{children}</ComicAdSettingsContext.Provider>;
}

export function useComicAdSettings() {
  return useContext(ComicAdSettingsContext);
}
