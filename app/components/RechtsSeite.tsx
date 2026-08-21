import Link from "next/link";

/**
 * Gemeinsames Gerüst für Impressum, Datenschutz, AGB und Widerruf.
 *
 * Bewusst schlicht und ohne das Report-Designsystem: Rechtstexte sollen
 * lesbar und druckbar sein, nicht gestaltet. Die Querverweise unten stehen
 * auf jeder der vier Seiten, damit man von jeder zu jeder kommt.
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
    <main className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold">{titel}</h1>
      {stand && <p className="mt-1 text-xs opacity-60">Stand: {stand}</p>}
      <div className="rechtstext mt-8">{children}</div>
      <nav className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-current/10 pt-6 text-sm">
        <Link href="/impressum" className="underline">
          Impressum
        </Link>
        <Link href="/datenschutz" className="underline">
          Datenschutz
        </Link>
        <Link href="/agb" className="underline">
          AGB
        </Link>
        <Link href="/widerruf" className="underline">
          Widerruf
        </Link>
        <Link href="/" className="underline opacity-70">
          Zur Startseite
        </Link>
      </nav>
    </main>
  );
}
