import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="section final" style={{ borderTop: 0, minHeight: "80vh", display: "grid", placeContent: "center" }}>
      <p className="eyebrow">00:00 / 00:15</p>
      <h1 className="display-2">This page got cut.</h1>
      <p className="lead" style={{ margin: "1.5rem auto 2.5rem" }}>There&rsquo;s nothing here. The ad maker is on the front page.</p>
      <Link href="/" className="btn">Make an ad</Link>
    </main>
  );
}
