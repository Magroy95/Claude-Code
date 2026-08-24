import Link from "next/link";

export const metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false },
};

/**
 * Die 404-Seite ist keine Randerscheinung: Analysen werden über ihre ID
 * aufgerufen, und ein Tippfehler in „HKC-4821-QX7K" landet genau hier. Ohne
 * eigene Seite fällt Next auf sein weißes Standardlayout zurück — mitten in
 * einer Website, die sonst auf Papier läuft.
 *
 * Deshalb nennt sie beide Wege weiter, die es hier gibt: die Analyse noch
 * einmal über die ID suchen oder ein neues Exposé hochladen.
 */
export default function NichtGefunden() {
  return (
    <div className="lp-bahn schmal lp-seite mittig">
      <p className="lp-augenbraue">Fehler 404</p>
      <h1 className="lp-h2">Diese Seite gibt es nicht</h1>
      <p className="lp-text">
        Möglicherweise stimmt die Analyse-ID nicht ganz, oder die Analyse wurde inzwischen
        gelöscht — Exposés und Ergebnisse werden nach einer Frist automatisch entfernt.
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          justifyContent: "center",
          marginTop: "28px",
        }}
      >
        <Link href="/analyse" className="lp-knopf">
          Analyse-ID eingeben
        </Link>
        <Link href="/#start" className="lp-knopf stumm">
          Neues Exposé hochladen
        </Link>
      </div>
    </div>
  );
}
