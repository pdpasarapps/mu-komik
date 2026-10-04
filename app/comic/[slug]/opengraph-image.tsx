import { ImageResponse } from "next/og";
import { getComicGenreLabel } from "@/lib/comic-genres";
import { createPublicSupabaseClient, siteUrl } from "@/lib/seo";

export const alt = "Komik di mu-komik";
export const size = { width: 900, height: 1200 };
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
          flexDirection: "column",
          backgroundColor: "#f7f6f2",
          color: "#202422",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: 860,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: "#e7e2d6",
          }}
        >
          {coverImage ? (
            <img src={coverImage} alt="" width={900} height={860} style={{ objectFit: "cover", objectPosition: "top" }} />
          ) : (
            <div style={{ fontSize: 110, fontWeight: 800 }}>{title.slice(0, 2).toUpperCase()}</div>
          )}
        </div>
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 340,
            flexShrink: 0,
            padding: "12px 42px 14px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 42,
              padding: "8px 18px",
              borderRadius: 999,
              backgroundColor: "#fce5dc",
              color: "#c94f2c",
              fontSize: 28,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {genre}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "center",
              gap: 20,
            }}
          >
            <img
              src={logoUrl}
              alt="Logo mu-komik"
              width={150}
              height={150}
              style={{ border: "2px solid #d8d4ca", borderRadius: 18, boxSizing: "border-box" }}
            />
            <span style={{ width: 420, display: "flex", flexDirection: "column", alignItems: "center", color: "#000000", lineHeight: 1.1 }}>
              <span style={{ fontSize: 72, fontWeight: 800, whiteSpace: "nowrap" }}>MU KOMIK</span>
              <span style={{ fontSize: 48, fontWeight: 500, whiteSpace: "nowrap" }}>Komik Indonesia</span>
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
