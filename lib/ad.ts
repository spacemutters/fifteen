// The 15-second ad, drawn frame by frame onto a canvas.
// Pure function of (time, spec): the preview and the recorded file are the same pixels.

export type Look = "bold" | "editorial" | "clean";
export type Format = "9:16" | "1:1" | "16:9";

export type AdSpec = {
  brand: string;
  hook: string;
  points: string[]; // up to 3
  cta: string;
  domain: string;
  ground: string;
  ink: string;
  accent: string;
  onAccent: string;
  look: Look;
  format: Format;
  logo?: HTMLImageElement | null;
  photo?: HTMLImageElement | null;
};

export type Fonts = { display: Record<Look, string>; body: string; mono: string };

export const DURATION = 15;

export const SIZES: Record<Format, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

// Scene boundaries, seconds.
const S1 = 0, S2 = 2.6, S3 = 6.0, S4 = 11.4;
const POINT = (S4 - S3) / 3;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoIn = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
/** progress of t through [a, a+d], eased */
const p = (t: number, a: number, d: number, ease = expoOut) => ease(clamp((t - a) / d));

function displayWeight(look: Look) {
  return look === "editorial" ? 400 : look === "bold" ? 800 : 600;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (<= max) at which text fits in maxLines lines of width maxW. */
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  maxW: number,
  maxLines: number,
  max: number,
  min: number,
  stretch = "",
): { size: number; lines: string[] } {
  for (let size = max; size >= min; size -= 4) {
    ctx.font = `${weight} ${stretch}${size}px ${family}`;
    const lines = wrap(ctx, text, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW) return { size, lines };
  }
  ctx.font = `${weight} ${stretch}${min}px ${family}`;
  return { size: min, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
}

/** Lines that rise out of a mask, one after another. */
function maskedLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lh: number,
  t: number,
  start: number,
  align: CanvasTextAlign,
  exitAt?: number,
) {
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const enter = p(t, start + i * 0.09, 0.85);
    const exit = exitAt === undefined ? 0 : p(t, exitAt + i * 0.04, 0.45, expoIn);
    const top = y + i * lh - lh * 0.86;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-10000, top - lh * 0.12, 20000, lh * 1.12);
    ctx.clip();
    const dy = (1 - enter) * lh - exit * lh;
    ctx.fillText(line, x, y + i * lh + dy);
    ctx.restore();
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, scale: number) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight) * scale;
  const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

// A dark logo on a dark ground disappears. If a transparent logo doesn't stand off the
// color behind it, redraw it as a silhouette in the text color. Cached per image and color.
const logoCache = new WeakMap<HTMLImageElement, Map<string, HTMLImageElement | HTMLCanvasElement>>();
function logoOn(img: HTMLImageElement, bg: string, ink: string): HTMLImageElement | HTMLCanvasElement {
  const key = bg + ink;
  let byColor = logoCache.get(img);
  if (!byColor) logoCache.set(img, (byColor = new Map()));
  const hit = byColor.get(key);
  if (hit) return hit;
  let out: HTMLImageElement | HTMLCanvasElement = img;
  try {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 48;
    const p2 = probe.getContext("2d", { willReadFrequently: true })!;
    p2.drawImage(img, 0, 0, 48, 48);
    const d = p2.getImageData(0, 0, 48, 48).data;
    let clear = 0, n = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 32) { clear++; continue; }
      n++; r += d[i]; g += d[i + 1]; b += d[i + 2];
    }
    const transparent = clear / (d.length / 4) > 0.12;
    if (transparent && n) {
      const avg = [r / n, g / n, b / n];
      const lum = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = (c: number[]) => 0.2126 * lum(c[0]) + 0.7152 * lum(c[1]) + 0.0722 * lum(c[2]);
      const hexTo = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const [hi, lo] = [L(avg), L(hexTo(bg))].sort((x, y) => y - x);
      if ((hi + 0.05) / (lo + 0.05) < 2.2) {
        const s = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * s));
        c.height = Math.max(1, Math.round(img.naturalHeight * s));
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0, c.width, c.height);
        x.globalCompositeOperation = "source-in";
        x.fillStyle = ink;
        x.fillRect(0, 0, c.width, c.height);
        out = c;
      }
    }
  } catch {
    out = img;
  }
  byColor.set(key, out);
  return out;
}

function contain(ctx: CanvasRenderingContext2D, src: HTMLImageElement, cx: number, cy: number, box: number, alpha: number, scale: number, bg: string, ink: string) {
  const img = logoOn(src, bg, ink);
  const nw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const nh = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const r = Math.min(box / nw, box / nh) * scale;
  const iw = nw * r, ih = nh * r;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
  ctx.globalAlpha = 1;
}

/** A panel that wipes up from the bottom, then keeps going off the top. */
function wipe(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, at: number, color: string) {
  const inP = p(t, at, 0.42, expoOut);
  if (inP <= 0) return false;
  const top = H * (1 - inP);
  ctx.fillStyle = color;
  ctx.fillRect(0, top, W, H - top);
  return inP >= 1;
}

export function draw(ctx: CanvasRenderingContext2D, t: number, s: AdSpec, f: Fonts) {
  const [W, H] = SIZES[s.format];
  const tall = s.format === "9:16";
  const wide = s.format === "16:9";
  const M = Math.round(Math.min(W, H) * 0.09); // margin
  const disp = f.display[s.look];
  const dw = displayWeight(s.look);
  const unit = Math.min(W, H) / 1080;
  const ST = s.look === "bold" ? "condensed " : "";

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  // ---------- Scene 1: the name ----------
  if (t < S2 + 0.5) {
    ctx.fillStyle = s.ground;
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 - (s.logo ? 70 * unit : 0);
    const logoIn = p(t, S1 + 0.1, 1.1);
    if (s.logo) {
      contain(ctx, s.logo, cx, cy - 40 * unit, 260 * unit, logoIn, 0.86 + 0.14 * logoIn, s.ground, s.ink);
    }
    ctx.fillStyle = s.ink;
    const { size, lines } = fit(ctx, s.brand, disp, dw, W - M * 2, 2, Math.round(150 * unit), Math.round(60 * unit), ST);
    ctx.font = `${dw} ${ST}${size}px ${disp}`;
    const lh = size * 1.0;
    const y0 = s.logo ? cy + 200 * unit : cy - ((lines.length - 1) * lh) / 2 + size * 0.35;
    maskedLines(ctx, lines, cx, y0, lh, t, S1 + 0.35, "center");
    // domain under the name
    const dIn = p(t, S1 + 0.9, 0.8);
    ctx.globalAlpha = dIn;
    ctx.font = `500 ${Math.round(30 * unit)}px ${f.mono}`;
    ctx.fillStyle = s.ink;
    ctx.textAlign = "center";
    ctx.fillText(s.domain, cx, y0 + (lines.length - 1) * lh + 90 * unit + (1 - dIn) * 16);
    ctx.globalAlpha = 1;
    wipe(ctx, W, H, t, S2 - 0.42, s.accent);
  }

  // ---------- Scene 2: the hook ----------
  if (t >= S2 - 0.01 && t < S3 + 0.5) {
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = s.onAccent;
    const maxW = W - M * 2;
    const { size, lines } = fit(ctx, s.hook, disp, dw, maxW, tall ? 6 : 4, Math.round((tall ? 132 : 112) * unit), Math.round(54 * unit), ST);
    ctx.font = `${dw} ${ST}${size}px ${disp}`;
    const lh = size * (s.look === "editorial" ? 1.02 : 0.98);
    const block = lines.length * lh;
    const y0 = H / 2 - block / 2 + size * 0.8;
    ctx.save();
    ctx.letterSpacing = s.look === "editorial" ? "0px" : `${-size * 0.025}px`;
    maskedLines(ctx, lines, M, y0, lh, t, S2 + 0.25, "left", S3 - 0.55);
    ctx.restore();
    // small brand tag, top left
    const tagIn = p(t, S2 + 0.5, 0.6) * (1 - p(t, S3 - 0.5, 0.3));
    ctx.globalAlpha = tagIn;
    ctx.font = `500 ${Math.round(28 * unit)}px ${f.mono}`;
    ctx.textAlign = "left";
    ctx.fillText(s.brand.toUpperCase(), M, M + 20 * unit);
    ctx.globalAlpha = 1;
    wipe(ctx, W, H, t, S3 - 0.42, s.ground);
  }

  // ---------- Scene 3: three points ----------
  if (t >= S3 - 0.01 && t < S4 + 0.5) {
    ctx.fillStyle = s.ground;
    ctx.fillRect(0, 0, W, H);
    const pts = s.points.length ? s.points.slice(0, 3) : [s.hook];

    // Photo frame (if the site gave us one): top half on tall, right half on wide.
    let textTop = M, textLeft = M, textW = W - M * 2, textBottom = H - M;
    if (s.photo) {
      const local = clamp((t - S3) / (S4 - S3));
      const reveal = p(t, S3 + 0.05, 1.1);
      let fx: number, fy: number, fw: number, fh: number;
      if (tall) { fx = M; fy = M; fw = W - M * 2; fh = H * 0.42; textTop = fy + fh + 60 * unit; }
      else if (wide) { fw = W * 0.42; fh = H - M * 2; fx = W - M - fw; fy = M; textW = fx - M * 2; }
      else { fx = M; fy = M; fw = W - M * 2; fh = H * 0.36; textTop = fy + fh + 40 * unit; }
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy + fh * (1 - reveal), fw, fh * reveal);
      ctx.clip();
      cover(ctx, s.photo, fx, fy, fw, fh, 1.14 - 0.08 * local - 0.06 * reveal);
      ctx.restore();
    }

    pts.forEach((pt, i) => {
      const a = S3 + i * POINT;
      if (t < a - 0.01 || t > a + POINT + 0.5) return;
      const isLast = i === pts.length - 1;
      const exitAt = isLast ? S4 - 0.5 : a + POINT - 0.45;
      const avail = textBottom - textTop;
      const { size, lines } = fit(ctx, pt, disp, dw, textW, tall ? 4 : 3, Math.round((tall ? 104 : 88) * unit), Math.round(46 * unit), ST);
      const lh = size * 1.02;
      const numSize = Math.round(34 * unit);
      const block = numSize + 40 * unit + lines.length * lh;
      const y = textTop + Math.max(0, (avail - block) / 2);
      // number
      const nIn = p(t, a + 0.05, 0.6) * (1 - p(t, exitAt, 0.35, expoIn));
      ctx.globalAlpha = nIn;
      ctx.fillStyle = s.accent;
      ctx.font = `600 ${numSize}px ${f.mono}`;
      ctx.textAlign = "left";
      ctx.fillText(`0${i + 1} / 0${pts.length}`, textLeft, y + numSize);
      ctx.globalAlpha = 1;
      // text
      ctx.fillStyle = s.ink;
      ctx.font = `${dw} ${ST}${size}px ${disp}`;
      ctx.save();
      ctx.letterSpacing = s.look === "editorial" ? "0px" : `${-size * 0.02}px`;
      maskedLines(ctx, lines, textLeft, y + numSize + 40 * unit + size * 0.85, lh, t, a + 0.12, "left", exitAt);
      ctx.restore();
    });

    // progress hairline
    const prog = clamp((t - S3) / (S4 - S3));
    ctx.fillStyle = s.accent;
    ctx.fillRect(M, H - M * 0.55, (W - M * 2) * p(t, S3, 0.6) * prog, Math.max(2, 4 * unit));

    wipe(ctx, W, H, t, S4 - 0.42, s.accent);
  }

  // ---------- Scene 4: the ask ----------
  if (t >= S4 - 0.01) {
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    let y = H / 2;
    if (s.logo) {
      const lIn = p(t, S4 + 0.15, 0.9);
      contain(ctx, s.logo, cx, H / 2 - 260 * unit, 170 * unit, lIn, 0.9 + 0.1 * lIn, s.accent, s.onAccent);
    }
    ctx.fillStyle = s.onAccent;
    const { size, lines } = fit(ctx, s.cta, disp, dw, W - M * 2, 3, Math.round(128 * unit), Math.round(56 * unit), ST);
    ctx.font = `${dw} ${ST}${size}px ${disp}`;
    const lh = size * 1.0;
    y = H / 2 - ((lines.length - 1) * lh) / 2 + size * 0.3;
    maskedLines(ctx, lines, cx, y, lh, t, S4 + 0.3, "center");
    // domain pill
    const pIn = p(t, S4 + 0.85, 0.8);
    const label = s.domain;
    const fs = Math.round(36 * unit);
    ctx.font = `500 ${fs}px ${f.mono}`;
    const tw = ctx.measureText(label).width;
    const pw = tw + 72 * unit, ph = fs + 44 * unit;
    const py = y + (lines.length - 1) * lh + 110 * unit + (1 - pIn) * 24 * unit;
    ctx.globalAlpha = pIn;
    ctx.fillStyle = s.onAccent;
    roundRect(ctx, cx - pw / 2, py - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = s.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, py + 2 * unit);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
