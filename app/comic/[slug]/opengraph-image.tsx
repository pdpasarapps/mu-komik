import { ImageResponse } from "next/og";
import { getComicGenreLabel } from "@/lib/comic-genres";
import { createPublicSupabaseClient, siteUrl } from "@/lib/seo";

export const alt = "Komik di mu-komik";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicSupabaseClient();
  let title = "Baca komik Indonesia";
  let genre = "Cerita pilihan kreator Indonesia";
  let coverImage: string | null = null;

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
        try {
          const coverResponse = await fetch(baseUrl, { cache: "no-store" });
          if (!coverResponse.ok) {
            throw new Error(`Cover request failed with status ${coverResponse.status}.`);
          }
          const coverType = coverResponse.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
          if (!coverType || !["image/avif", "image/jpeg", "image/png", "image/webp"].includes(coverType)) {
            throw new Error(`Unsupported comic cover content type: ${coverType || "missing"}.`);
          }
          coverImage = `data:${coverType};base64,${toBase64(await coverResponse.arrayBuffer())}`;
        } catch (error) {
          console.error("Unable to load comic cover for share image:", { slug, error });
        }
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
          {coverImage ? (
            <img src={coverImage} alt="" width={420} height={630} style={{ objectFit: "cover" }} />
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
            <img src={logoUrl} alt="Logo mu-komik" width={72} height={72} style={{ borderRadius: 12 }} />
            <span style={{ display: "flex", flexDirection: "column", color: "#56635b", fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>
              <span>MU KOMIK</span>
              <span style={{ fontSize: 16, fontWeight: 500 }}>Komik Indonesia</span>
            </span>
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
          <div style={{ marginTop: 32, color: "#667269", fontSize: 25 }}>Baca di MU Komik</div>
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
