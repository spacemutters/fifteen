"use client";
import { draw, DURATION, SIZES, type AdSpec, type Fonts } from "./ad";

const FPS = 30;

/** Best video type the fallback recorder can make: MP4 where it can, WebM otherwise. */
export function recordType(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const tries: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.640028", "mp4"],
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of tries) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

export function canSaveVideo() {
  return typeof VideoEncoder !== "undefined" || !!recordType();
}

function makeCanvas(spec: AdSpec, fonts: Fonts) {
  const [W, H] = SIZES[spec.format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  // Draw every scene once first: the first draw of a logo or photo is the slow one.
  for (const t of [0.5, 1.5, 3.5, 7, 9, 11, 13, 14.5]) draw(ctx, t, spec, fonts);
  draw(ctx, 0, spec, fonts);
  return { canvas, ctx, W, H };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Frame-exact: every frame is drawn at its own moment and handed to the browser's video encoder,
 * so nothing is dropped however busy the computer is, and it finishes faster than real time.
 */
async function encodeAd(spec: AdSpec, fonts: Fonts, onProgress: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const { canvas, ctx, W, H } = makeCanvas(spec, fonts);
  let config: VideoEncoderConfig | null = null;
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42003e"]) {
    const c: VideoEncoderConfig = { codec, width: W, height: H, bitrate: 10_000_000, framerate: FPS };
    if ((await VideoEncoder.isConfigSupported(c)).supported) {
      config = c;
      break;
    }
  }
  if (!config) throw new Error("no H.264 encoder");

  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: FPS }, fastStart: "in-memory" });
  let failed: Error | null = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failed = e as Error) });
  enc.configure(config);

  const n = DURATION * FPS;
  for (let i = 0; i < n; i++) {
    draw(ctx, i / FPS, spec, fonts);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    while (enc.encodeQueueSize > 6 && !failed) await tick();
    if (failed) throw failed;
    if (i % 10 === 0) {
      onProgress(i / n);
      await tick();
    }
  }
  await enc.flush();
  enc.close();
  if (failed) throw failed;
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4" };
}

/** Fallback for browsers without a video encoder: play the ad once in real time and record it. */
async function liveRecord(spec: AdSpec, fonts: Fonts, onProgress: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  const type = recordType();
  if (!type) throw new Error("This browser can't save video. Try Chrome, Edge or Safari.");
  const { canvas, ctx } = makeCanvas(spec, fonts);
  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  let running = false;
  rec.onstart = () => (running = true);
  rec.start(250);
  // The recorder only starts once it has a frame, so keep drawing frame zero until it does.
  const waitUntil = performance.now() + 1500;
  for (let i = 0; i < 4 || (!running && performance.now() < waitUntil); i++) {
    draw(ctx, 0, spec, fonts);
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }
  const start = performance.now();
  await new Promise<void>((resolve) => {
    // A timer, not requestAnimationFrame: it keeps running if the tab loses focus.
    const id = setInterval(() => {
      const t = (performance.now() - start) / 1000;
      draw(ctx, Math.min(t, DURATION), spec, fonts);
      onProgress(Math.min(1, t / DURATION));
      if (t >= DURATION + 0.15) {
        clearInterval(id);
        resolve();
      }
    }, 1000 / FPS);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  return { blob: new Blob(chunks, { type: type.mime.split(";")[0] }), ext: type.ext };
}

export async function recordAd(spec: AdSpec, fonts: Fonts, onProgress: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    try {
      return await encodeAd(spec, fonts, onProgress);
    } catch (e) {
      console.warn("Frame-exact save failed, recording live instead:", e);
    }
  }
  return liveRecord(spec, fonts, onProgress);
}
