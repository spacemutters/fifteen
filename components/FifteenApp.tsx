"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Download, LoaderCircle, RotateCcw } from "lucide-react";
import { Player } from "./Player";
import type { AdSpec, Format, Look } from "@/lib/ad";
import { paletteFrom, onColor, parse, hex, isBrandy, type RGB } from "@/lib/color";
import { recordAd, canSaveVideo } from "@/lib/record";
import { canvasFonts } from "@/app/fonts";
import { EASE } from "@/lib/motion";
import { SITE } from "@/lib/site";

type Scan = {
  url: string; domain: string; brand: string; hook: string; points: string[]; cta: string;
  colors: string[]; logo: string | null; photo: string | null;
};

const SAMPLE: AdSpec = {
  brand: "Fifteen",
  hook: "Paste a website. Get a fifteen-second ad.",
  points: ["It reads your headlines.", "It takes your colors and logo.", "You change any word you like."],
  cta: "Make yours free",
  domain: SITE.domain,
  ...paletteFrom(["#1F5A42"], "dark"),
  look: "bold",
  format: "9:16",
};

const LOOKS: { id: Look; label: string }[] = [
  { id: "bold", label: "Bold" },
  { id: "editorial", label: "Editorial" },
  { id: "clean", label: "Clean" },
];
const FORMATS: { id: Format; label: string; note: string }[] = [
  { id: "9:16", label: "Vertical", note: "Reels, TikTok, Stories" },
  { id: "1:1", label: "Square", note: "Feed posts" },
  { id: "16:9", label: "Wide", note: "YouTube, websites" },
];

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img.naturalWidth > 8 ? img : null);
    img.onerror = () => res(null);
    // Inline logos arrive as data: drawings and need no trip through our server.
    img.src = url.startsWith("data:image/") ? url : `/api/img?url=${encodeURIComponent(url)}`;
  });
}

/** The most common strongly-colored pixel in an image, if it has one. */
function dominant(img: HTMLImageElement | null): string | null {
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = c.height = 40;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, 40, 40);
  const d = x.getImageData(0, 0, 40, 40).data;
  const buckets = new Map<string, { n: number; sum: RGB }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const px: RGB = [d[i], d[i + 1], d[i + 2]];
    if (!isBrandy(px)) continue;
    const k = px.map((v) => v >> 5).join(",");
    const b = buckets.get(k) ?? { n: 0, sum: [0, 0, 0] };
    b.n++;
    b.sum = [b.sum[0] + px[0], b.sum[1] + px[1], b.sum[2] + px[2]];
    buckets.set(k, b);
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < 12) return null;
  return hex([best.sum[0] / best.n, best.sum[1] / best.n, best.sum[2] / best.n]);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ad";

export function FifteenApp() {
  const reduce = useReducedMotion();
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [spec, setSpec] = useState<AdSpec | null>(null);
  const [ground, setGround] = useState<"dark" | "light">("dark");
  const [colors, setColors] = useState<string[]>([]);
  const [images, setImages] = useState<{ logo: HTMLImageElement | null; photo: HTMLImageElement | null }>({ logo: null, photo: null });
  const [useLogo, setUseLogo] = useState(true);
  const [usePhoto, setUsePhoto] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const studioRef = useRef<HTMLElement>(null);
  const canSave = useMemo(() => (typeof window === "undefined" ? true : canSaveVideo()), []);

  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) {
      setStatus("error");
      setError("Paste a website address first, like joescoffee.com");
      return;
    }
    setStatus("reading");
    setError("");
    try {
      const res = await fetch(`/api/scan?url=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that website.");
      const scan = data as Scan;
      const [logo, photo] = await Promise.all([loadImage(scan.logo), loadImage(scan.photo)]);
      const fromLogo = dominant(logo);
      const cands = [...(fromLogo ? [fromLogo] : []), ...scan.colors];
      setColors(cands);
      setImages({ logo, photo });
      setUseLogo(!!logo);
      setUsePhoto(!!photo);
      const pal = paletteFrom(cands, ground);
      setSpec({
        brand: scan.brand,
        hook: scan.hook,
        points: scan.points.length ? scan.points : [scan.hook],
        cta: scan.cta,
        domain: scan.domain,
        ...pal,
        look: "bold",
        format: "9:16",
      });
      setStatus("ready");
      requestAnimationFrame(() => studioRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  }

  /** When a site can't be read, start from a blank ad with the words to fill in. */
  function startBlank() {
    const domain = address.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] || "yourwebsite.com";
    const name = domain.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    setColors([]);
    setImages({ logo: null, photo: null });
    setSpec({
      brand: name,
      hook: "Say what you do in one line.",
      points: ["What you're best at.", "Why people come back.", "Where to find you."],
      cta: `Visit ${domain}`,
      domain,
      ...paletteFrom([], ground),
      look: "bold",
      format: "9:16",
    });
    setStatus("ready");
    requestAnimationFrame(() => studioRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }

  const set = <K extends keyof AdSpec>(k: K, v: AdSpec[K]) => setSpec((s) => (s ? { ...s, [k]: v } : s));

  function changeGround(g: "dark" | "light") {
    setGround(g);
    setSpec((s) => {
      if (!s) return s;
      return { ...s, ...paletteFrom([s.accent, ...colors], g) };
    });
  }

  function changeAccent(v: string) {
    setSpec((s) => {
      if (!s) return s;
      const rgb = parse(v);
      // A gray or near-black pick has no hue to build a ground from: keep the ground, just swap the accent.
      if (!rgb || !isBrandy(rgb)) return { ...s, accent: v, onAccent: onColor(v) };
      return { ...s, ...paletteFrom([v], ground) };
    });
  }

  const live: AdSpec | null = spec && { ...spec, logo: useLogo ? images.logo : null, photo: usePhoto ? images.photo : null };

  async function save() {
    if (!live) return;
    setSaveError("");
    setSaving(0);
    try {
      const { blob, ext } = await recordAd(live, canvasFonts, setSaving);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(live.brand)}-15s-${live.format.replace(":", "x")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  const line = (i: number) => ({
    hidden: { y: "105%" },
    show: { y: "0%", transition: { duration: 0.95, ease: EASE, delay: 0.08 + i * 0.09 } },
  });
  const lines = ["Paste a website.", "Get a fifteen-", "second ad."];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Free · no sign-up · runs in your browser</p>
          <h1 id="hero-title" className="display">
            {lines.map((l, i) => (
              <span className="mask" key={l}>
                <motion.span className="mask-line" variants={line(i)} initial={reduce ? false : "hidden"} animate="show">
                  {l}
                </motion.span>
              </span>
            ))}
          </h1>
          <p className="lead">
            Fifteen reads a business&rsquo;s own site (its headlines, colors and logo) and cuts them into a short
            motion ad you can post tonight. Change any word, then save the video.
          </p>
          <form className="site-form" onSubmit={read} noValidate>
            <label htmlFor="site" className="sr-only">Website address</label>
            <input
              id="site"
              name="site"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="joescoffee.com"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-describedby="site-help"
              aria-invalid={status === "error"}
            />
            <button type="submit" className="btn" disabled={status === "reading"}>
              {status === "reading" ? (
                <>
                  <LoaderCircle className="spin" size={18} aria-hidden /> Reading the site
                </>
              ) : (
                <>
                  Make the ad <ArrowRight size={18} aria-hidden />
                </>
              )}
            </button>
          </form>
          <p id="site-help" className={`form-note ${status === "error" ? "is-error" : ""}`} role={status === "error" ? "alert" : undefined}>
            {status === "error" ? error : "Any public website works: a café, a salon, a roofer, your own."}
          </p>
          {status === "error" && address.trim() && (
            <button type="button" className="link-btn" onClick={startBlank}>
              Type the words in yourself instead <ArrowRight size={16} aria-hidden />
            </button>
          )}
        </div>
        <div className="hero-player">
          <Player spec={SAMPLE} label="A sample fifteen-second ad for Fifteen itself, playing on a loop" />
        </div>
      </section>

      {live && (
        <section id="studio" ref={studioRef} className="studio section" aria-labelledby="studio-title">
          <div className="studio-head">
            <p className="eyebrow">Your ad · {live.domain}</p>
            <h2 id="studio-title" className="h1">Here&rsquo;s the cut. Change anything.</h2>
          </div>
          <div className="studio-grid">
            <div className="studio-player">
              <Player spec={live} label={`Fifteen-second ad for ${live.brand}`} />
              <button type="button" className="btn btn-wide" onClick={save} disabled={saving !== null || !canSave}>
                {saving !== null ? (
                  <>
                    <LoaderCircle className="spin" size={18} aria-hidden /> Saving: {Math.round(saving * 100)}%
                  </>
                ) : (
                  <>
                    <Download size={18} aria-hidden /> Save the video
                  </>
                )}
              </button>
              <p className="form-note" role={saveError ? "alert" : undefined}>
                {saveError ||
                  (canSave
                    ? "Saves a full-size video file to your computer. Keep this tab open until it's done."
                    : "This browser can't save video. Open this page in Chrome, Edge or Safari.")}
              </p>
            </div>

            <form className="editor" onSubmit={(e) => e.preventDefault()}>
              <fieldset>
                <legend>Words</legend>
                <Field label="Name" value={live.brand} onChange={(v) => set("brand", v)} max={40} />
                <Field label="Opening line" value={live.hook} onChange={(v) => set("hook", v)} max={110} area />
                {[0, 1, 2].map((i) => (
                  <Field
                    key={i}
                    label={`Point ${i + 1}`}
                    value={live.points[i] ?? ""}
                    onChange={(v) => {
                      const pts = [...live.points];
                      pts[i] = v;
                      set("points", pts.filter((p, j) => p.trim() || j < i));
                    }}
                    max={80}
                    hint={i === 0 ? "Leave a point empty to drop it." : undefined}
                  />
                ))}
                <Field label="Last line" value={live.cta} onChange={(v) => set("cta", v)} max={40} />
                <Field label="Web address shown" value={live.domain} onChange={(v) => set("domain", v)} max={40} />
              </fieldset>

              <fieldset>
                <legend>Look</legend>
                <Choice name="look" value={live.look} options={LOOKS} onChange={(v) => set("look", v as Look)} />
              </fieldset>

              <fieldset>
                <legend>Size</legend>
                <Choice name="format" value={live.format} options={FORMATS} onChange={(v) => set("format", v as Format)} />
              </fieldset>

              <fieldset>
                <legend>Color</legend>
                <div className="swatches">
                  {Array.from(new Set(colors.map((c) => parse(c)).filter((c): c is RGB => !!c && isBrandy(c)).map(hex))).slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="swatch"
                      style={{ background: c }}
                      aria-label={`Use ${c}`}
                      aria-pressed={live.accent.toLowerCase() === c}
                      onClick={() => changeAccent(c)}
                    />
                  ))}
                  <label className="swatch swatch-pick" title="Pick any color">
                    <span className="sr-only">Pick any color</span>
                    <input type="color" value={live.accent} onChange={(e) => changeAccent(e.target.value)} />
                  </label>
                </div>
                <Choice
                  name="ground"
                  value={ground}
                  options={[
                    { id: "dark", label: "Dark background" },
                    { id: "light", label: "Light background" },
                  ]}
                  onChange={(v) => changeGround(v as "dark" | "light")}
                />
              </fieldset>

              <fieldset>
                <legend>Pictures from the site</legend>
                <Toggle label="Use their logo" checked={useLogo} disabled={!images.logo} onChange={setUseLogo} off="No logo found on the site" />
                <Toggle label="Use their main photo" checked={usePhoto} disabled={!images.photo} onChange={setUsePhoto} off="No photo found on the site" />
              </fieldset>

              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setSpec(null);
                  setStatus("idle");
                  document.getElementById("site")?.focus();
                  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
                }}
              >
                <RotateCcw size={16} aria-hidden /> Start over with another site
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}

function Field({ label, value, onChange, max, area, hint }: { label: string; value: string; onChange: (v: string) => void; max: number; area?: boolean; hint?: string }) {
  const id = "f-" + label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {area ? (
        <textarea id={id} value={value} maxLength={max} rows={2} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function Choice({ name, value, options, onChange }: { name: string; value: string; options: { id: string; label: string; note?: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map((o) => (
        <label key={o.id} className={value === o.id ? "is-on" : ""}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span>{o.label}</span>
          {o.note && <small>{o.note}</small>}
        </label>
      ))}
    </div>
  );
}

function Toggle({ label, checked, disabled, onChange, off }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void; off: string }) {
  return (
    <label className={`toggle ${disabled ? "is-disabled" : ""}`}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden />
      <span>{disabled ? off : label}</span>
    </label>
  );
}
