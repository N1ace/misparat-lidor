import Link from "next/link";
import { getSql } from "@/lib/db";
import { SHOP, waMe } from "@/lib/shop";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LandingEffects } from "@/components/LandingEffects";
import { HoursDropdown } from "@/components/HoursDropdown";
import reviewsData from "@/data/reviews.json";

export const dynamic = "force-dynamic";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
  image_path: string | null;
};

const SVC_ICONS = ["i-cut", "i-beard", "i-stylist", "i-comb", "i-brush", "i-razor"] as const;

function priceILS(agorot: number) {
  return `₪${(agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2)}`;
}

async function loadServices(): Promise<Service[]> {
  try {
    const sql = getSql();
    return await sql<Service[]>`
      select id, name, duration_minutes, price_agorot, image_path
      from services where active = true
      order by sort_order, name
    `;
  } catch (e) {
    console.error("[home] loadServices failed:", e);
    return [];
  }
}

export default async function HomePage() {
  const services = await loadServices();
  const bookWa = waMe("היי, רציתי לקבוע תור");

  return (
    <>
      <div className="pole-strip spin" aria-hidden="true" />
      <SiteHeader />
      <LandingEffects />

      <div className="hero">
        <video
          className="bg bg-mobile"
          muted
          loop
          playsInline
          poster="/media/hero-poster-mobile.jpg"
          aria-hidden="true"
          preload="none"
          data-src="/media/hero-bg.mp4"
          width={720}
          height={1280}
        />
        <video
          className="bg bg-desktop"
          muted
          loop
          playsInline
          poster="/media/hero-poster-desktop.jpg"
          aria-hidden="true"
          preload="none"
          data-src="/media/hero-bg-desktop.mp4"
          width={1920}
          height={1080}
        />
        <div className="wrap">
          <span className="chip-open" id="openChip">
            <span className="dot" aria-hidden="true" />
            <span id="openChipText">בודק שעות…</span>
            <noscript>שעות הפתיחה למטה בעמוד</noscript>
          </span>
          <h1 className="words" data-reveal>
            <span style={{ ["--i" as string]: 0 }}>
              <i>נכנסת.</i>
            </span>{" "}
            <span style={{ ["--i" as string]: 1 }}>
              <i>התיישבת.</i>
            </span>
            <br />
            <span style={{ ["--i" as string]: 2 }}>
              <i>יצאת מלך.</i>
            </span>
          </h1>
          <p className="sub">
            תספורת מדויקת אצל לידור באשדוד — בלי לחכות, בלי הפתעות. קבעת שעה? בשעה הזאת אתה בכיסא.
          </p>
          <div className="hero-reviews" aria-label="דירוגים">
            <a
              className="hero-review"
              href={SHOP.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`גוגל ${reviewsData.google.rating} כוכבים, ${reviewsData.google.count} ביקורות`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/icon-google.png" alt="" width={26} height={26} />
              <span className="hero-review-meta">
                <span className="hero-review-score">
                  <bdi>{reviewsData.google.rating}</bdi>
                  <span aria-hidden="true">★</span>
                </span>
                <span className="hero-review-count">
                  <bdi>{reviewsData.google.count.toLocaleString("he-IL")}</bdi> ביקורות
                </span>
              </span>
            </a>
            <a
              className="hero-review easy"
              href={SHOP.easyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`איזי ${reviewsData.easy.rating} מתוך ${reviewsData.easy.bestRating}, ${reviewsData.easy.count} ביקורות`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/icon-easy.png" alt="" width={26} height={26} />
              <span className="hero-review-meta">
                <span className="hero-review-score">
                  <bdi>{reviewsData.easy.rating}</bdi>
                  <span className="hero-review-of">
                    /<bdi>{reviewsData.easy.bestRating}</bdi>
                  </span>
                </span>
                <span className="hero-review-count">
                  <bdi>{reviewsData.easy.count.toLocaleString("he-IL")}</bdi> ביקורות
                </span>
              </span>
            </a>
          </div>
          <div className="hero-place">
            <p className="hero-addr">
              <a href="#location">{SHOP.addressShort}</a>
              <a
                className="hero-nav hero-waze"
                href={SHOP.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="נווט בוויז"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/media/icon-waze.png" alt="" width={48} height={48} />
              </a>
              <a
                className="hero-nav hero-gmaps"
                href={SHOP.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="מפות גוגל"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/media/icon-gmaps.png" alt="" width={128} height={128} />
              </a>
            </p>
            <HoursDropdown className="hero-hours-dd" />
          </div>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/booking">
              קביעת תור
            </Link>
            <a className="btn btn-ghost" href="#services">
              למחירון
            </a>
          </div>
        </div>
      </div>

      <div className="trust">
        <div className="wrap">
          <div className="cell">
            <b>לידור</b>
            <span>ספר אחד — מכיר את הראש שלך</span>
          </div>
          <div className="cell">
            <b>תור = תור</b>
            <span>קובעים אונליין, מגיעים בשעה</span>
          </div>
          <div className="cell">
            <b>אשדוד</b>
            <span>אבנר בן נר 1 — קל להגיע</span>
          </div>
          <div className="cell">
            <b>ילדים?</b>
            <span>ברור. סבלנות ומקצועיות</span>
          </div>
        </div>
      </div>

      <section id="services">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="rail" aria-hidden="true" />
            <div className="blade">
              <div className="kicker">מחירון</div>
              <h2>מה עושים ובכמה</h2>
              <p>המחיר על השולחן. בוחרים שירות, לוחצים, קובעים תור.</p>
            </div>
          </div>
          {services.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>המחירון ייטען ברגע שהמערכת מחוברת למסד הנתונים.</p>
          ) : (
            <div className="svc-grid">
              {services.map((s, i) => (
                <article
                  key={s.id}
                  className="svc rise"
                  data-reveal
                  style={{ ["--i" as string]: i }}
                >
                  {s.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="svc-photo" src={s.image_path} alt="" />
                  ) : null}
                  <div className="top">
                    <span className={`icn ${SVC_ICONS[i % SVC_ICONS.length]}`} aria-hidden="true" />
                    <span className="price">
                      <bdi>{priceILS(s.price_agorot)}</bdi>
                    </span>
                  </div>
                  <h3>{s.name}</h3>
                  <span className="meta">
                    <bdi>{s.duration_minutes}</bdi> דק׳
                  </span>
                  <Link
                    className="book-link"
                    href={`/booking?service=${encodeURIComponent(s.name)}`}
                  >
                    לקבוע {s.name} ←
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="reviews">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="rail" aria-hidden="true" />
            <div className="blade">
              <div className="kicker">מה אומרים</div>
              <h2>ביקורות מלקוחות</h2>
              <p>ציטוטים מגוגל ומאיזי.</p>
            </div>
          </div>

          <div className="reviews-grid">
            {reviewsData.quotes.map((q, i) => (
              <blockquote
                key={`${q.source}-${q.name}-${i}`}
                className="review-card rise"
                data-reveal
                style={{ ["--i" as string]: i }}
              >
                <div className="review-card-top" aria-label={`${q.stars} כוכבים`}>
                  {"★★★★★".slice(0, q.stars)}
                  <span className="review-src">{q.source === "google" ? "גוגל" : "איזי"}</span>
                </div>
                <p>&ldquo;{q.text}&rdquo;</p>
                <footer>
                  <cite>{q.name}</cite>
                  {q.date ? <time>{q.date}</time> : null}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="why">
        <div className="wrap cols">
          <div>
            <div className="sec-head" data-reveal>
              <span className="rail" aria-hidden="true" />
              <div>
                <div className="kicker">למה אצלנו</div>
                <h2>הדברים שבאמת משנים</h2>
              </div>
            </div>
            <ul>
              <li className="rise" data-reveal style={{ ["--i" as string]: 0 }}>
                <span className="n" aria-hidden="true">
                  א
                </span>
                <div>
                  <b>בלי לחכות</b>
                  <span>הכיסא מחכה לך בשעה שקבעת. תור זה תור.</span>
                </div>
              </li>
              <li className="rise" data-reveal style={{ ["--i" as string]: 1 }}>
                <span className="n" aria-hidden="true">
                  ב
                </span>
                <div>
                  <b>תזכורת ב־SMS</b>
                  <span>אישור ותזכורת לפני התור — שלא תשכח.</span>
                </div>
              </li>
              <li className="rise" data-reveal style={{ ["--i" as string]: 2 }}>
                <span className="n" aria-hidden="true">
                  ג
                </span>
                <div>
                  <b>אותו ספר, כל פעם</b>
                  <span>לידור זוכר איך אתה אוהב — בלי להסביר מחדש כל פעם.</span>
                </div>
              </li>
              <li className="rise" data-reveal style={{ ["--i" as string]: 3 }}>
                <span className="n" aria-hidden="true">
                  ד
                </span>
                <div>
                  <b>כלים נקיים</b>
                  <span>חיטוי אחרי כל לקוח. לא מתפשרים על זה.</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="our-shop" id="our-shop">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="rail" aria-hidden="true" />
            <div className="blade">
              <div className="kicker">המספרה שלנו</div>
              <h2>המקום שבו זה קורה</h2>
              <p>אווירה נקייה, תאורה מדויקת, ומקום שמזמין להישאר עוד רגע אחרי שהתספורת מוכנה.</p>
            </div>
          </div>
          <div className="shop-grid">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/gallery-01.jpg"
                alt="מספרת לידור — אווירת העבודה"
                width={819}
                height={1024}
                loading="lazy"
              />
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/gallery-02.jpg"
                alt="מספרת לידור — פרט מהמספרה"
                width={819}
                height={1024}
                loading="lazy"
              />
            </figure>
          </div>
        </div>
      </section>

      <section id="gallery">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="rail" aria-hidden="true" />
            <div className="blade">
              <div className="kicker">עבודות</div>
              <h2 className="gal-title">שופטים אותנו לפי התוצאה</h2>
              <p>מבחר מהעבודה במספרה — תספורות, זקן ואווירה.</p>
            </div>
          </div>
          <div className="gal">
            <a className="tall settle" data-reveal href="/booking" aria-label="לקביעת תור">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/gallery-03.jpg" alt="עבודה מהמספרה" width={576} height={1024} loading="lazy" />
            </a>
            <a className="settle" data-reveal href="/booking" aria-label="לקביעת תור">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/gallery-04.jpg" alt="עבודה מהמספרה" width={576} height={1024} loading="lazy" />
            </a>
            <a className="tall settle" data-reveal href="/booking" aria-label="לקביעת תור">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/gallery-05.jpg" alt="עבודה מהמספרה" width={576} height={1024} loading="lazy" />
            </a>
          </div>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="rail" aria-hidden="true" />
            <div className="blade">
              <div className="kicker">שאלות נפוצות</div>
              <h2>שואלים אותנו כל יום</h2>
            </div>
          </div>
          <details>
            <summary>אפשר להגיע בלי תור?</summary>
            <p>
              אפשר, ואם יש מקום — אתה בפנים. בערבים ובשישי עדיף לקבוע מראש. זה לוקח דקה ב
              <Link href="/booking">עמוד קביעת התור</Link>.
            </p>
          </details>
          <details>
            <summary>קבעתי ואני לא מגיע. מה עושים?</summary>
            <p>
              מבטלים בוואטסאפ או בטלפון כמה שעות מראש, בלי שאלות. ביטול ברגע האחרון או הברזה —
              נבקש לשים לב בפעם הבאה.
            </p>
          </details>
          <details>
            <summary>איך משלמים?</summary>
            <p>ביט, אשראי או מזומן — מה שנוח לך.</p>
          </details>
          <details>
            <summary>מספרים גם ילדים?</summary>
            <p>כן. סבלנות, מקצועיות, ותספורת שגם הילד וגם ההורה מרוצים ממנה.</p>
          </details>
          <details>
            <summary>כמה זמן לפני התור להגיע?</summary>
            <p>חמש דקות זה מושלם. בשעה שקבעת — אתה בכיסא.</p>
          </details>
        </div>
      </section>

      <section className="loc" id="location">
        <div className="wrap">
          <div className="sec-head" data-reveal>
            <span className="rail" aria-hidden="true" />
            <div className="blade">
              <div className="kicker">איפה אנחנו</div>
              <h2>אבנר בן נר 1, אשדוד</h2>
            </div>
          </div>
          <div className="cols">
            <div>
              <address>
                <span className="icn i-store" aria-hidden="true" style={{ marginBlockEnd: "0.6rem" }} />
                <strong>{SHOP.addressShort}</strong>
                <br />
                מספרת לידור
              </address>
              <div className="nav-row">
                <a className="btn btn-primary" href={SHOP.wazeUrl} target="_blank" rel="noopener noreferrer">
                  נווט בוויז
                </a>
                <a className="btn btn-ghost" href={SHOP.mapsUrl} target="_blank" rel="noopener noreferrer">
                  מפות גוגל
                </a>
              </div>
              <HoursDropdown />
            </div>
            <div className="map-box">
              <iframe
                title={`מפה: ${SHOP.name}, ${SHOP.addressShort}`}
                loading="lazy"
                src={SHOP.mapsEmbed}
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <div className="side-fabs" aria-label="פעולות מהירות">
        <a className="fab-wa" href={bookWa} target="_blank" rel="noopener noreferrer" aria-label="וואטסאפ">
          <span className="icn i-whatsapp" aria-hidden="true" />
        </a>
        <Link className="fab-book" href="/booking" aria-label="קביעת תור">
          <span className="icn i-calendar" aria-hidden="true" />
        </Link>
      </div>

      <div className="action-bar" id="actionBar">
        <a className="phone-ltr" href={`tel:${SHOP.phoneE164}`} aria-label="חיוג למספרה">
          📞 <bdi>חיוג</bdi>
        </a>
        <a href={bookWa} target="_blank" rel="noopener noreferrer" aria-label="וואטסאפ">
          <span className="icn i-whatsapp" aria-hidden="true" />
          וואטסאפ
        </a>
        <Link className="book" href="/booking">
          קביעת תור
        </Link>
      </div>
    </>
  );
}
