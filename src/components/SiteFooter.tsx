import Link from "next/link";
import { waMe, type ShopPublic, SHOP } from "@/lib/shop";

export function SiteFooter({ shop = SHOP }: { shop?: ShopPublic }) {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="cols">
          <div>
            <Link className="logo" href="/">
              <span className="icn i-sign" aria-hidden="true" />
              {shop.name}
            </Link>
            <p style={{ color: "var(--muted)", maxInlineSize: "38ch", marginBlockStart: "0.8rem" }}>
              מספרה באשדוד — תספורות מדויקות, זקן, וילדים. קובעים תור אונליין, מגיעים בשעה.
            </p>
          </div>
          <nav aria-label="ניווט תחתון">
            <Link href="/#services">מחירון</Link>
            <Link href="/#our-shop">המספרה</Link>
            <Link href="/#gallery">עבודות</Link>
            <Link href="/#faq">שאלות נפוצות</Link>
            <Link href="/#location">איפה אנחנו</Link>
            <Link href="/booking">קביעת תור</Link>
          </nav>
          <div className="footer-aside">
            <a className="phone-ltr footer-phone" href={`tel:${shop.phoneE164}`}>
              <bdi>{shop.phoneDisplay}</bdi>
            </a>
            <p style={{ color: "var(--muted)", marginBlock: "0.5rem 0" }}>{shop.addressShort}</p>
            <div className="footer-social">
              <h3>רשתות חברתיות</h3>
              <div className="social-row">
                <a
                  className="social-btn social-wa"
                  href={waMe("היי, רציתי לשאול לגבי תור", shop)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="וואטסאפ"
                >
                  <span className="icn i-whatsapp" aria-hidden="true" />
                </a>
              </div>
            </div>
            <nav className="footer-legal" aria-label="ניהול">
              <Link href="/admin">כניסת מנהל</Link>
            </nav>
          </div>
        </div>
        <p className="fine">
          © <bdi>{new Date().getFullYear()}</bdi> {shop.name}. כל הזכויות שמורות.
        </p>
      </div>
    </footer>
  );
}
