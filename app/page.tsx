import { FifteenApp } from "@/components/FifteenApp";
import { Reveal, RevealGroup } from "@/components/Reveal";
import { SITE } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    title: "Paste the address",
    body: "Any public website: a café, a barber, a roofer, a church, your own. No login, no upload.",
  },
  {
    n: "02",
    title: "Fifteen cuts it",
    body: "It reads the page's main headline, its section headings, its colors, its logo and its share photo, then lays them into four scenes.",
  },
  {
    n: "03",
    title: "Change it, save it",
    body: "Edit any word, pick a look and a size, and save the video. It's made on your own computer, so nothing waits in a queue.",
  },
];

const SCENES = [
  { at: "00:00", name: "The name", note: "Logo and name, set big.", w: 2.6 },
  { at: "00:03", name: "The opening line", note: "Their own headline, on their color.", w: 3.4 },
  { at: "00:06", name: "Three points", note: "What they do, one at a time.", w: 5.4 },
  { at: "00:11", name: "The ask", note: "Call, book, or visit, with the address.", w: 3.6 },
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. There's no account, no watermark and no limit on how many you make.",
  },
  {
    q: "Where does my ad go?",
    a: "Nowhere. Fifteen only fetches the website to read it. The video is drawn and saved in your own browser, and nothing you make is stored on our side.",
  },
  {
    q: "What if the site's headline is weak?",
    a: "Type your own. Every line in the ad can be changed, and the preview updates as you type.",
  },
  {
    q: "What file do I get?",
    a: "A full-size MP4 (1080 pixels on its short side) in any up-to-date browser. Choose Vertical for Reels, TikTok and Stories, Square for feed posts, or Wide for YouTube and websites.",
  },
  {
    q: "Can I make ads for my clients?",
    a: "Yes. If you build websites for local businesses, paste the site you built and send the owner a finished ad along with it.",
  },
  {
    q: "Is there sound?",
    a: "Not yet. Ads are silent, so add a track in Instagram or TikTok when you post.",
  },
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (web browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="nav">
        <a href="#top" className="wordmark" aria-label="Fifteen, back to top">
          Fifteen<span className="tc-chip">00:15</span>
        </a>
        <nav aria-label="Page">
          <a href="#how">How it works</a>
          <a href="#questions">Questions</a>
          <a href="#site" className="btn btn-small">Make an ad</a>
        </nav>
      </header>

      <main id="main">
        <div id="top" />
        <FifteenApp />

        <section id="how" className="section" aria-labelledby="how-title">
          <Reveal as="header" className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="h1">Your site already wrote the ad.</h2>
          </Reveal>
          <RevealGroup as="ol" className="steps">
            {STEPS.map((s) => (
              <Reveal as="li" key={s.n} className="step">
                <span className="step-n">{s.n}</span>
                <h3 className="h2">{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </RevealGroup>
        </section>

        <section className="section cut" aria-labelledby="cut-title">
          <Reveal as="header" className="section-head">
            <p className="eyebrow">The cut</p>
            <h2 id="cut-title" className="h1">Four scenes. Fifteen seconds. No filler.</h2>
            <p className="lead narrow">
              Every ad follows the same cut, because it works on a phone held at arm&rsquo;s length: who you are, why it matters,
              what you do, and what to do next.
            </p>
          </Reveal>
          <Reveal className="timeline">
            <ol>
              {SCENES.map((s) => (
                <li key={s.name} style={{ flexGrow: s.w }}>
                  <span className="tl-at">{s.at}</span>
                  <span className="tl-bar" aria-hidden />
                  <strong>{s.name}</strong>
                  <span className="tl-note">{s.note}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <section id="questions" className="section" aria-labelledby="faq-title">
          <div className="faq-grid">
            <Reveal as="header" className="section-head">
              <p className="eyebrow">Questions</p>
              <h2 id="faq-title" className="h1">Plain answers.</h2>
            </Reveal>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section final" aria-labelledby="final-title">
          <Reveal>
            <h2 id="final-title" className="display-2">Paste a site. Post tonight.</h2>
            <a href="#site" className="btn">Make the ad</a>
          </Reveal>
        </section>
      </main>

      <footer className="footer">
        <span className="wordmark">Fifteen</span>
        <span>A free tool. Nothing you make is stored.</span>
        <a href="#top">Back to top</a>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
