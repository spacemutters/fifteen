import { NextResponse } from "next/server";
import { scanSite } from "@/lib/scan";
import { FetchRefused } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url")?.trim();
  if (!raw) return NextResponse.json({ error: "Paste a website address first." }, { status: 400 });
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    new URL(withScheme);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a website address." }, { status: 400 });
  }
  try {
    const scan = await scanSite(withScheme);
    return NextResponse.json(scan, { headers: { "cache-control": "public, s-maxage=600" } });
  } catch (e) {
    const msg = e instanceof FetchRefused ? e.message : "Couldn't read that website.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
