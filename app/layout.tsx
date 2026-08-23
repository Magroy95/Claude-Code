import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.defaultTitle,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="lp-kopf no-print">
          <div className="lp-bahn lp-kopf-reihe">
            <Link href="/" className="lp-marke">
              HauskaufChecker
            </Link>
            <nav className="lp-nav">
              <Link href="/#methode">Methode</Link>
              <Link href="/preise">Preise</Link>
              <Link href="/#fragen">FAQ</Link>
              {/* Ein Link fuer beide Faelle: Wer angemeldet ist, landet im
                  Konto; wer nicht, auf der Anmeldeseite, die nach dem Login
                  dorthin weiterleitet. Spart eine Sitzungspruefung im
                  Layout, das sonst auf jeder Seite dynamisch werden wuerde. */}
              <Link href="/konto">Meine Häuser</Link>
            </nav>
            <Link href="/#start" className="lp-knopf klein" style={{ marginLeft: "auto" }}>
              Kostenlos starten
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="lp-fuss no-print">
          <div className="lp-bahn lp-fuss-reihe">
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/impressum">Impressum</Link>
            <Link href="/agb">AGB</Link>
            <Link href="/widerruf">Widerruf</Link>
            <Link href="/preise">Preise</Link>
            <Link href="/analyse">Analyse abrufen</Link>
            <span style={{ marginLeft: "auto" }}>
              Ersteinschätzung, kein Gutachten
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
