export type PlatformFeatureFlags = {
  reading: boolean;
  search: boolean;
  creators: boolean;
  comments: boolean;
  favorites: boolean;
};

export type PlatformSettings = {
  maintenance_enabled: boolean;
  maintenance_message: string;
  announcement_enabled: boolean;
  announcement_message: string;
  feature_flags: PlatformFeatureFlags;
};

export const defaultPlatformSettings: PlatformSettings = {
  maintenance_enabled: false,
  maintenance_message: "MU-Komik sedang dalam pemeliharaan. Silakan kembali lagi nanti.",
  announcement_enabled: false,
  announcement_message: "",
  feature_flags: {
    reading: true,
    search: true,
    creators: true,
    comments: true,
    favorites: true,
  },
};

export async function getPlatformSettings(): Promise<{ settings: PlatformSettings; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { settings: defaultPlatformSettings, error: "Konfigurasi Supabase publik belum tersedia." };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/platform_settings?select=maintenance_enabled,maintenance_message,announcement_enabled,announcement_message,feature_flags&id=eq.true`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }
    const [row] = await response.json() as PlatformSettings[];
    if (!row) return { settings: defaultPlatformSettings, error: null };
    return {
      settings: {
        ...defaultPlatformSettings,
        ...row,
        feature_flags: { ...defaultPlatformSettings.feature_flags, ...row.feature_flags },
      },
      error: null,
    };
  } catch (error) {
    console.error("Unable to load platform settings:", error);
    return { settings: defaultPlatformSettings, error: error instanceof Error ? error.message : "Pengaturan platform gagal dimuat." };
  }
}
