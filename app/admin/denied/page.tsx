export const metadata = { robots: { index: false, follow: false } };

export default function Denied() {
  return (
    <main className="adm adm--center">
      <div className="adm__card">
        <h1 className="adm__title">הקישור אינו תקף</h1>
        <p className="adm__muted">
          קישורי הכניסה תקפים ל־15 דקות בלבד. אפשר להיכנס מחדש דרך מסלחתק בלחיצה אחת.
        </p>
        <p style={{ marginTop: 16 }}>
          {/* A plain link, not next/link: /admin/login is a redirect hop, not a page to prefetch. */}
          <a className="adm__btn adm__btn--primary" href="/admin/login">
            כניסה מחדש
          </a>
        </p>
      </div>
    </main>
  );
}
