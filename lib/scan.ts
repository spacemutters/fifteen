import "server-only";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";
import { safeFetch } from "./safe-fetch";
import { parse as parseColor, hex, hsl, isBrandy } from "./color";

export type Scan = {
  url: string;
  domain: string;
  brand: string;
  hook: string;
  points: string[];
  cta: string;
  colors: string[]; // ranked, most brand-like first
  logo: string | null;
  photo: string | null;
};

const GENERIC = /^(home|menu|about( us)?|contact( us)?|hours|location(s)?|faq(s)?|gallery|blog|news|reviews?|testimonials?|follow us|services|our services|team|our team|careers|shop|cart|search|sign in|log in|login|subscribe|newsletter|privacy|terms|skip to content|share|close|open|loading|cookies?.*)$/i;

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    // headlines built from separate line elements run together: "website.Get" → "website. Get"
    .replace(/([a-z0-9][.!?])(?=[A-Z])/g, "$1 ")
    .trim();

function meta(root: HTMLElement, ...keys: string[]) {
  for (const k of keys) {
    const el = root.querySelector(`meta[property="${k}"]`) || root.querySelector(`meta[name="${k}"]`);
    const v = el?.getAttribute("content");
    if (v && clean(v)) return clean(v);
  }
  return "";
}

function brandFrom(title: string, site: string, domain: string) {
  if (site && site.length <= 40) return site;
  const parts = title.split(/\s+[|–—·:\-]\s+/).map(clean).filter(Boolean);
  const host = domain.split(".")[0].toLowerCase();
  const byHost = parts.find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(host.replace(/[^a-z0-9]/g, "")));
  if (byHost && byHost.length <= 40) return byHost;
  const short = parts.filter((p) => p.length <= 32);
  if (short.length) return short[short.length > 1 ? short.length - 1 : 0];
  return host.charAt(0).toUpperCase() + host.slice(1);
}

/**
 * Ad-sized lines from running text: whole sentences when they're short enough,
 * otherwise the sentence's own clauses ("Established in 1975 by Joe Pozzuoli").
 */
function sentences(text: string) {
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const c = clean(s);
    if (c.length < 12) continue;
    if (c.length <= 110) {
      out.push(c);
      continue;
    }
    for (const part of c.split(/[,;:–—]\s+/)) {
      const p = clean(part).replace(/[.]$/, "");
      if (p.length < 20 || p.length > 90 || /^(and|but|or|who|which|that|as|so|then|first|also)\b/i.test(p)) continue;
      out.push(p.charAt(0).toUpperCase() + p.slice(1));
    }
  }
  return out;
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw.trim();
}

const COLOR_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;

/** Brand-like colors first, scored by how often they're used and how strongly colored they are. */
function rankColors(css: string, boosted: string[]) {
  const counts = new Map<string, number>();
  for (const m of css.match(COLOR_RE) ?? []) {
    const rgb = parseColor(m.startsWith("rgb") ? m + ")" : m);
    if (!rgb) continue;
    const k = hex(rgb);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const score = (c: string, n: number) => {
    const rgb = parseColor(c)!;
    return isBrandy(rgb) ? Math.log2(1 + n) * (0.4 + hsl(rgb)[1]) : -1;
  };
  const ranked = [...counts.entries()].map(([c, n]) => ({ c, s: score(c, n) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
  const declared = boosted.map((b) => parseColor(b)).filter((c): c is NonNullable<typeof c> => !!c && isBrandy(c)).map(hex);
  return [...new Set([...declared, ...ranked])].slice(0, 12);
}

export async function scanSite(input: string): Promise<Scan> {
  const page = await safeFetch(input, { maxBytes: 2_500_000, timeoutMs: 9000, accept: "text/html,application/xhtml+xml" });
  const html = new TextDecoder("utf-8").decode(page.body);
  const root = parseHtml(html, { blockTextElements: { script: false, noscript: false, style: true, pre: true } });
  const base = new URL(page.url);
  const abs = (h?: string | null) => {
    if (!h) return null;
    try {
      const u = new URL(h.trim(), base);
      return u.protocol.startsWith("http") ? u.toString() : null;
    } catch {
      return null;
    }
  };
  const domain = base.hostname.replace(/^www\./, "");

  const title = clean(root.querySelector("title")?.text ?? "");
  const site = meta(root, "og:site_name", "application-name", "apple-mobile-web-app-title");
  const brand = brandFrom(meta(root, "og:title") && !title ? meta(root, "og:title") : title, site, domain);
  const description = meta(root, "description", "og:description", "twitter:description");

  const textOf = (sel: string) =>
    root.querySelectorAll(sel).map((e) => clean(e.text)).filter((t) => t.length >= 6 && t.length <= 110 && !GENERIC.test(t));

  const h1 = textOf("h1").filter((t) => t.toLowerCase() !== brand.toLowerCase());
  const heads = [...textOf("h2"), ...textOf("h3")];
  const uniq = (arr: string[], seen = new Set<string>()) => arr.filter((t) => {
    const k = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!k || seen.has(k) || k === brand.toLowerCase().replace(/[^a-z0-9]/g, "")) return false;
    seen.add(k);
    return true;
  });

  // Builders like Squarespace often set headlines in <p> or <strong>, not <h1>: use those as a fallback.
  // ...and many put their story in plain blocks of any length, so read the page's text block by block.
  const body = root.querySelector("main") ?? root.querySelector("body") ?? root;
  const paras = body.structuredText
    .split("\n")
    .map(clean)
    .filter(
      (t) =>
        t.length >= 14 &&
        t !== t.toUpperCase() &&
        !/[{};]|^[.@#-]|var\(|:\s*\d+px/.test(t) && // stylesheet text that builders inline in the page
        !/©|copyright|cookie|all rights|javascript|privacy/i.test(t) &&
        !GENERIC.test(t),
    );
  const titleBits = title.split(/\s+[|–—·:\-]\s+/).map(clean).filter((t) => t.length >= 14 && t.toLowerCase() !== brand.toLowerCase());

  const hookPool = uniq([...h1, ...sentences(description), ...heads, ...titleBits, ...paras.flatMap(sentences)]);
  // Page titles leak into headlines as "Name Coffee House - Lakeland": keep the longest part.
  const trimTail = (t: string) => t.split(/\s+[|–—\-]\s+/).sort((a, b) => b.length - a.length)[0] ?? t;
  const hook = trimTail(hookPool.find((t) => t.length >= 14 && t.length <= 90) || hookPool[0] || `${brand}, in fifteen seconds.`);
  const points = uniq([...heads, ...sentences(description), ...textOf("h4"), ...paras.flatMap(sentences)])
    .filter((t) => t.toLowerCase() !== hook.toLowerCase() && t.length <= 80 && t.split(" ").length >= 2 && !/^(menu|hours|call|order)\b/i.test(t))
    .slice(0, 3);

  // The ask: a phone number beats a button, a button beats a generic line.
  const tel = root.querySelectorAll('a[href^="tel:"]')[0]?.getAttribute("href")?.slice(4);
  const button = root
    .querySelectorAll("a, button")
    .map((e) => clean(e.text))
    .find((t) => t.length >= 4 && t.length <= 28 && /\b(book|order|reserve|schedule|get (a|your|started|in touch)|start|shop now|call|try|join|request|quote|visit|sign up|download)\b/i.test(t));
  const calm = (s: string) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s); // "ORDER NOW" → "Order now"
  const cta = tel ? `Call ${formatPhone(decodeURIComponent(tel))}` : button ? calm(button.replace(/\s*[→›>]+$/, "")) : `Visit ${domain}`;

  // Colors: declared theme colors first, then whatever the CSS uses most.
  const declared = [meta(root, "theme-color"), meta(root, "msapplication-TileColor"), root.querySelector('link[rel="mask-icon"]')?.getAttribute("color") ?? ""].filter(Boolean);
  let css = root.querySelectorAll("style").map((s) => s.text).join("\n");
  css += "\n" + root.querySelectorAll("[style]").map((e) => e.getAttribute("style")).join("\n");
  const sheets = root
    .querySelectorAll('link[rel="stylesheet"]')
    .map((l) => abs(l.getAttribute("href")))
    .filter((u): u is string => !!u && !/fonts\.googleapis|font-awesome|fontawesome|bootstrap(\.min)?\.css/i.test(u))
    .slice(0, 3);
  const fetched = await Promise.allSettled(sheets.map((u) => safeFetch(u, { maxBytes: 600_000, timeoutMs: 5000, accept: "text/css,*/*" })));
  for (const f of fetched) if (f.status === "fulfilled") css += "\n" + new TextDecoder().decode(f.value.body);
  // Colors a stylesheet names as its brand (--brand, --primary, --accent, --theme...) beat colors
  // that merely appear often or loudly, like a decorative rainbow gradient.
  const named = [...css.matchAll(/--[\w-]*(?:brand|primary|accent|theme|main)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+)/g)].map((m) =>
    m[1].startsWith("rgb") ? m[1] + ")" : m[1],
  );
  const colors = rankColors(css, [...declared, ...named]);

  // Logo: the home link in the header (image or inline drawing), then any image that calls itself
  // a logo, then the big icons.
  const isLogoish = (i: HTMLElement) => /logo/i.test([i.getAttribute("src"), i.getAttribute("alt"), i.getAttribute("class"), i.getAttribute("id")].join(" "));
  const homeHrefs = new Set(["/", "./", base.origin, base.origin + "/", "/" + base.pathname.split("/")[1]]);
  const heads0 = root.querySelectorAll("header, nav, [class*='header' i], [id*='header' i]");
  const homeLink = heads0
    .flatMap((h) => h.querySelectorAll("a"))
    .find((a) => homeHrefs.has((a.getAttribute("href") || "").replace(/\/$/, "") || "/") && (a.querySelector("img") || a.querySelector("svg")));
  let headerLogo: string | null = null;
  const homeImg = homeLink?.querySelector("img");
  const homeSvg = homeLink?.querySelector("svg");
  if (homeImg) headerLogo = abs(homeImg.getAttribute("src") || homeImg.getAttribute("data-src"));
  else if (homeSvg && homeSvg.toString().length < 60_000 && !/<(script|foreignObject)/i.test(homeSvg.toString())) {
    let svg = homeSvg.toString();
    if (!/xmlns=/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const vb = homeSvg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
    if (vb?.length === 4 && !homeSvg.getAttribute("width")) svg = svg.replace("<svg", `<svg width="${vb[2]}" height="${vb[3]}"`);
    headerLogo = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  const logoImg =
    heads0.flatMap((h) => h.querySelectorAll("img")).find(isLogoish) ??
    root.querySelectorAll("img").find((i) => isLogoish(i) && !/data:/.test(i.getAttribute("src") ?? ""));
  const icons = root
    .querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
    .map((l) => ({ href: abs(l.getAttribute("href")), size: parseInt((l.getAttribute("sizes") || "0").split("x")[0]) || (/apple/.test(l.getAttribute("rel") ?? "") ? 180 : 16) }))
    .filter((i) => i.href && !/\.ico(\?|$)/i.test(i.href))
    .sort((a, b) => b.size - a.size);
  const logo = headerLogo ?? abs(logoImg?.getAttribute("src") || logoImg?.getAttribute("data-src")) ?? (icons[0]?.size >= 96 ? icons[0].href : null);

  const photo =
    abs(meta(root, "og:image", "og:image:url", "twitter:image", "twitter:image:src")) ??
    abs(root.querySelectorAll("img").map((i) => i.getAttribute("src") || i.getAttribute("data-src")).find((s) => s && !/logo|icon|sprite|data:|\.svg/i.test(s)));

  return { url: page.url, domain, brand, hook, points, cta, colors, logo, photo: photo !== logo ? photo : null };
}
