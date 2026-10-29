// Small color toolkit: parse, measure contrast, and turn a site's colors into an ad palette.

export type RGB = [number, number, number];

export function parse(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
    if (h.length < 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]].map((v) => Math.min(255, v)) as RGB;
  return null;
}

export const hex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

function lin(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
export function luminance([r, g, b]: RGB) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a: RGB, b: RGB) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export function hsl([r, g, b]: RGB): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Is this a color with real hue, not a gray, not near-white or near-black? */
export function isBrandy(c: RGB) {
  const [, s, l] = hsl(c);
  return s > 0.28 && l > 0.14 && l < 0.82;
}

export type Palette = { ground: string; ink: string; accent: string; onAccent: string };

/**
 * Build the ad palette from the site's colors.
 * accent = the site's brand color; ground = a deep tint of it (or the site's own dark/light ground);
 * ink and onAccent are chosen for contrast, never pure black or white.
 */
export function paletteFrom(candidates: string[], prefer: "dark" | "light" = "dark"): Palette {
  const parsed = candidates.map(parse).filter(Boolean) as RGB[];
  const brand = parsed.find(isBrandy) ?? ([46, 92, 69] as RGB);
  const [h, s] = hsl(brand);

  const deep = fromHsl(h, Math.min(s, 0.35), 0.075);
  const pale = fromHsl(h, Math.min(s, 0.25), 0.955);
  const ground = prefer === "dark" ? deep : pale;
  const inkCandidates: RGB[] = [fromHsl(h, 0.18, 0.95), fromHsl(h, 0.3, 0.08)];
  const ink = inkCandidates.sort((a, b) => contrast(b, ground) - contrast(a, ground))[0];

  // Accent must stand off the ground; nudge lightness until it clears 3:1.
  let accent = brand;
  for (let i = 0; i < 12 && contrast(accent, ground) < 3; i++) {
    const [ah, as, al] = hsl(accent);
    accent = fromHsl(ah, as, prefer === "dark" ? Math.min(0.9, al + 0.05) : Math.max(0.1, al - 0.05));
  }
  const onAccent = [fromHsl(h, 0.2, 0.96), fromHsl(h, 0.35, 0.07)].sort((a, b) => contrast(b, accent) - contrast(a, accent))[0];
  return { ground: hex(ground), ink: hex(ink), accent: hex(accent), onAccent: hex(onAccent) };
}

export function onColor(bg: string): string {
  const b = parse(bg) ?? [20, 20, 20];
  const [h] = hsl(b);
  const light = fromHsl(h, 0.2, 0.96), dark = fromHsl(h, 0.35, 0.07);
  return hex(contrast(light, b) >= contrast(dark, b) ? light : dark);
}

export { mix };
