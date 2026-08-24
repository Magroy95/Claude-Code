import Link from "next/link";

/**
 * Gemeinsames Gerüst für Impressum, Datenschutz, AGB und Widerruf.
 *
 * Zurückhaltend gesetzt, aber in denselben Schriften und Farben wie der
 * Rest: Rechtstexte sollen lesbar und druckbar sein, nicht gestaltet — nur
 * eben nicht so, als gehörten sie zu einer anderen Website. Die
 * Querverweise unten stehen auf jeder der vier Seiten, damit man von jeder
 * zu jeder kommt.
 */
export function RechtsSeite({
  titel,
  stand,
  children,
}: {
  titel: string;
  stand?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lp-bahn mittel lp-seite">
      <p className="lp-augenbraue">Rechtliches</p>
      <h1 className="lp-h2" style={{ marginBottom: stand ? "6px" : "14px" }}>
        {titel}
      </h1>
      {stand && <p className="lp-kennzeile" style={{ marginTop: 0 }}>Stand: {stand}</p>}
      <div className="rechtstext" style={{ marginTop: "30px" }}>
        {children}
      </div>
      <nav className="lp-aktionen">
        <Link href="/impressum" className="lp-textlink">
          Impressum
        </Link>
        <Link href="/datenschutz" className="lp-textlink">
          Datenschutz
        </Link>
        <Link href="/agb" className="lp-textlink">
          AGB
        </Link>
        <Link href="/widerruf" className="lp-textlink">
          Widerruf
        </Link>
        <Link href="/" className="lp-textlink">
          Zur Startseite
        </Link>
      </nav>
    </div>
  );
}
