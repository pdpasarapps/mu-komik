import { ImageResponse } from "next/og";
import { getComicGenreLabel } from "@/lib/comic-genres";
import { createPublicSupabaseClient, siteUrl } from "@/lib/seo";

export const alt = "Komik di mu-komik";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicSupabaseClient();
  let title = "Baca komik Indonesia";
  let genre = "Cerita pilihan kreator Indonesia";
  let coverUrl: string | null = null;

  if (!supabase) {
    console.error("Unable to generate comic share image: Supabase public environment variables are missing.");
  } else {
    const { data, error } = await supabase
      .from("comics")
      .select("title, genre, cover_key")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("Unable to load comic for share image:", { slug, error });
    } else if (data) {
      title = data.title;
      genre = getComicGenreLabel(data.genre);
      const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
      if (data.cover_key && publicUrl) {
        const baseUrl = new URL(publicUrl);
        baseUrl.pathname = `${baseUrl.pathname.replace(/\/?$/, "/")}${data.cover_key.split("/").map(encodeURIComponent).join("/")}`;
        coverUrl = baseUrl.toString();
      }
    }
  }

  const logoUrl = new URL("/logo_mukomik.jpg", siteUrl).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#f7f6f2",
          color: "#202422",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 420,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: "#e7e2d6",
          }}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" width="420" height="630" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 110, fontWeight: 800 }}>{title.slice(0, 2).toUpperCase()}</div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "58px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: 15,
              marginBottom: 45,
              padding: "10px 17px 10px 10px",
              borderRadius: 18,
              backgroundColor: "#ffffff",
            }}
          >
            <img src={logoUrl} alt="Logo mu-komik" width="72" height="72" style={{ borderRadius: 12 }} />
            <span style={{ color: "#56635b", fontSize: 23, fontWeight: 700 }}>KOMIK INDONESIA</span>
          </div>
          <div style={{ marginBottom: 17, color: "#ed6944", fontSize: 22, fontWeight: 700 }}>{genre}</div>
          <div
            style={{
              display: "flex",
              maxHeight: 220,
              overflow: "hidden",
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 32, color: "#667269", fontSize: 25 }}>Baca cerita lengkapnya di mu-komik</div>
          <div style={{ display: "flex", marginTop: 20, color: "#7a857e", fontSize: 16 }}>
            Instagram @mu_komik · TikTok @mukomikz
          </div>
          <div style={{ display: "flex", marginTop: 8, color: "#7a857e", fontSize: 15 }}>
            mu.komiks.apps@gmail.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
