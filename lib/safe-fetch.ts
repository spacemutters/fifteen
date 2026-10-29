import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

// Fetch a public web page or image for someone who pasted a URL.
// Refuses anything that resolves to a private, loopback or link-local address,
// checks every redirect hop, and caps size and time.

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIp(ip: string) {
  if (net.isIPv4(ip)) return privateV4(ip);
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateV4(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

export class FetchRefused extends Error {}

async function check(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new FetchRefused("Only web addresses work here.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new FetchRefused("That address uses an unusual port.");
  if (u.username || u.password) throw new FetchRefused("That address has a login in it.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new FetchRefused("That isn't a public website.");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new FetchRefused("Couldn't find that website. Check the spelling.");
  if (addrs.some((a) => privateIp(a.address))) throw new FetchRefused("That isn't a public website.");
}

export async function safeFetch(
  input: string,
  opts: { maxBytes: number; timeoutMs: number; accept: string },
): Promise<{ url: string; type: string; body: Uint8Array }> {
  let url = new URL(input);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    for (let hop = 0; hop < 5; hop++) {
      await check(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          accept: opts.accept,
          // Many small-business hosts turn away anything that doesn't look like a browser.
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 429)
        throw new FetchRefused("That site doesn't let tools read it.");
      if (!res.ok) throw new FetchRefused(`That site answered with an error (${res.status}).`);
      const len = Number(res.headers.get("content-length") || 0);
      if (len > opts.maxBytes) throw new FetchRefused("That file is too big.");
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > opts.maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      const body = new Uint8Array(Math.min(total, opts.maxBytes));
      let o = 0;
      for (const c of chunks) {
        body.set(c.subarray(0, Math.min(c.byteLength, body.byteLength - o)), o);
        o += c.byteLength;
        if (o >= body.byteLength) break;
      }
      return { url: url.toString(), type: res.headers.get("content-type") || "", body };
    }
    throw new FetchRefused("That site redirects too many times.");
  } catch (e) {
    if (e instanceof FetchRefused) throw e;
    if ((e as Error).name === "AbortError") throw new FetchRefused("That site took too long to answer.");
    throw new FetchRefused("Couldn't reach that website.");
  } finally {
    clearTimeout(timer);
  }
}
