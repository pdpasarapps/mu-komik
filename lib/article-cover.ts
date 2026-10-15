export function getArticleCoverUrl(coverKey: string | null): string | undefined {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
  if (!coverKey || !publicUrl) return undefined;

  const url = new URL(publicUrl);
  url.pathname = `${url.pathname.replace(/\/?$/, "/")}${coverKey.split("/").map(encodeURIComponent).join("/")}`;
  return url.toString();
}
