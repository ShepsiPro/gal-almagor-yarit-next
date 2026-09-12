export const metadata = { robots: { index: false, follow: false } };

export default function Denied() {
  return (
    <main className="adm adm--center">
      <div className="adm__card">
        <h1 className="adm__title">הקישור אינו תקף</h1>
        <p className="adm__muted">
          קישורי הכניסה תקפים ל־15 דקות בלבד. חזרו למערכת מסלחתק ולחצו שוב על
          פתיחת הניהול.
        </p>
      </div>
    </main>
  );
}
