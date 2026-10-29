import { ImageResponse } from "next/og";

export const alt = "Fifteen: paste a website, get a fifteen-second ad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0e1612", color: "#e6ece7", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
            Fifteen
            <span style={{ fontSize: 20, border: "1px solid rgba(230,236,231,0.25)", borderRadius: 999, padding: "4px 12px", color: "#9aa79f" }}>00:15</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3 }}>
            <span>Paste a website.</span>
            <span style={{ color: "#7dbe9c" }}>Get a 15-second ad.</span>
          </div>
          <div style={{ fontSize: 26, color: "#9aa79f" }}>Free. Made from the site&apos;s own words, colors and logo.</div>
        </div>
        <div style={{ display: "flex", width: 250, marginLeft: 48, borderRadius: 14, background: "#7dbe9c", alignItems: "flex-end", padding: 28, color: "#0e1612", fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
          Your ad, cut to fifteen.
        </div>
      </div>
    ),
    size,
  );
}
