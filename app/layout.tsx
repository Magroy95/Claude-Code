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
        <header className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              HauskaufChecker
            </Link>
            <nav className="flex items-center gap-5 text-sm text-black/60 dark:text-white/60">
              <Link href="/preise" className="hover:underline">
                Preise
              </Link>
              <Link href="/analyse" className="hover:underline">
                Analyse abrufen
              </Link>
              {/* Ein Link fuer beide Faelle: Wer angemeldet ist, landet im
                  Konto; wer nicht, auf der Anmeldeseite, die nach dem Login
                  dorthin weiterleitet. Spart eine Sitzungspruefung im
                  Layout, das sonst auf jeder Seite dynamisch werden wuerde. */}
              <Link href="/konto" className="hover:underline">
                Meine Häuser
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/10 dark:border-white/10 mt-16">
          <div className="mx-auto max-w-4xl px-4 py-6 text-xs text-black/50 dark:text-white/50 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/datenschutz" className="hover:underline">
              Datenschutz
            </Link>
            <Link href="/impressum" className="hover:underline">
              Impressum
            </Link>
            <Link href="/agb" className="hover:underline">
              AGB
            </Link>
            <Link href="/widerruf" className="hover:underline">
              Widerruf
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
