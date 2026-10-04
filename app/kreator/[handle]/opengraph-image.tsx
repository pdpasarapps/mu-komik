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
    .select("display_name, bio, avatar_key")
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
  const avatarUrl = profile.avatar_key && publicUrl ? `${publicUrl}/${profile.avatar_key}` : null;
  const bio = profile.bio?.trim().replace(/\s+/g, " ").slice(0, 130).replace(/\s+\S*$/, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "68px",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #21120f 0%, #2e4039 100%)",
          color: "#fff8ec",
          fontFamily: "Arial",
        }}
      >
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "14px", width: "700px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#ffd16b", fontSize: "22px", fontWeight: 700, letterSpacing: "3px" }}>
            MU KOMIK <span style={{ color: "#fff8ec" }}>·</span> PROFIL KREATOR
          </div>
          <div style={{ fontSize: "60px", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-2px", maxHeight: "126px", overflow: "hidden" }}>{profile.display_name}</div>
          {bio && <div style={{ fontSize: "23px", lineHeight: 1.35, color: "#f2e5d2", maxHeight: "125px", overflow: "hidden" }}>{bio}</div>}
          <div style={{ display: "flex", color: "#ffd16b", fontSize: "20px", marginTop: "3px" }}>Lihat karya dan komik terbit</div>
        </div>
        {avatarUrl
          ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`Foto profil ${profile.display_name}`} width={232} height={232} style={{ position: "relative", flex: "0 0 232px", width: "232px", height: "232px", objectFit: "cover", borderRadius: "50%", border: "8px solid rgba(255,248,236,.94)" }} />
          )
          : <div style={{ position: "relative", flex: "0 0 232px", width: "232px", height: "232px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "8px solid rgba(255,248,236,.94)", background: "linear-gradient(135deg, #d8b17d, #867456)", color: "#fff8ec", fontSize: "92px", fontWeight: 700 }}>{profile.display_name.trim().charAt(0).toUpperCase()}</div>}
      </div>
    ),
    size,
  );
}
