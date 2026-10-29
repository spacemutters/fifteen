import { safeFetch, FetchRefused } from "@/lib/safe-fetch";

// Same-origin copy of a site's logo or photo, so the canvas can draw it and still record.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });
  try {
    const img = await safeFetch(raw, { maxBytes: 6_000_000, timeoutMs: 8000, accept: "image/avif,image/webp,image/png,image/svg+xml,image/*" });
    const type = img.type.split(";")[0].trim();
    if (!type.startsWith("image/")) return new Response("Not an image", { status: 415 });
    return new Response(img.body as BodyInit, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    return new Response(e instanceof FetchRefused ? e.message : "Couldn't load image", { status: 422 });
  }
}
