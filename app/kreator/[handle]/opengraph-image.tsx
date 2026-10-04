import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { createPublicSupabaseClient } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Profil kreator MU Komik";

export default async function CreatorOpenGraphImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Supabase public environment variables are required to generate creator profile images.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, bio, banner_key")
    .eq("public_handle", handle)
    .eq("role", "creator")
    .eq("public_profile", true)
    .maybeSingle();
  if (error) {
    console.error("Unable to load creator profile for Open Graph image:", { handle, error });
    throw new Error(`Unable to generate creator profile image: ${error.message}`);
  }
  if (!profile) notFound();

  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  const bannerUrl = profile.banner_key && publicUrl ? `${publicUrl}/${profile.banner_key}` : null;
  const bio = profile.bio?.trim().replace(/\s+/g, " ").slice(0, 180);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "68px",
          position: "relative",
          overflow: "hidden",
          background: "#21120f",
          color: "#fff8ec",
          fontFamily: "Arial",
        }}
      >
        {bannerUrl && <img src={bannerUrl} width={1200} height={630} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(25,12,10,.95) 0%, rgba(25,12,10,.74) 52%, rgba(25,12,10,.16) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "18px", maxWidth: "900px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#ffd16b", fontSize: "24px", fontWeight: 700, letterSpacing: "4px" }}>
            MU KOMIK <span style={{ color: "#fff8ec" }}>·</span> PROFIL KREATOR
          </div>
          <div style={{ fontSize: "72px", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-2px" }}>{profile.display_name}</div>
          {bio && <div style={{ fontSize: "27px", lineHeight: 1.35, color: "#f2e5d2" }}>{bio}</div>}
          <div style={{ display: "flex", color: "#ffd16b", fontSize: "22px", marginTop: "8px" }}>Lihat karya dan komik terbit</div>
        </div>
      </div>
    ),
    size,
  );
}
