# HauskaufChecker

KI-gestützte, unverbindliche Ersteinschätzung einer Immobilie (Substanz,
Modernisierungskosten, Marktwert, Cashflow, Risiken) auf Basis eines
hochgeladenen Exposés – als Prototyp.

## Setup

1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. `.env.example` nach `.env.local` kopieren und den Anthropic API-Key
   eintragen:
   ```bash
   cp .env.example .env.local
   ```
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   (`DATABASE_URL` ist für die lokale Entwicklung bereits in `.env` gesetzt.)
3. Postgres-Datenbank bereitstellen (lokal per `psql`/`pg_ctlcluster` oder
   beliebiger Hoster) und Migrationen anwenden:
   ```bash
   npx prisma migrate dev
   ```
4. Dev-Server starten:
   ```bash
   npm run dev
   ```

## Ablauf

1. **Analyse starten** (`/`): Exposé hochladen, E-Mail, Eigenkapital,
   Makler-/Privat-Verkauf, Freitext zu Besonderheiten/Mängeln.
2. Im Hintergrund läuft eine Multi-Agenten-Pipeline (`lib/analysis/pipeline.ts`)
   über die Anthropic Messages API: Extraktion → Marktwert → Risiko/Substanz →
   Finanzen → Synthese. Die `/analyse/[id]`-Seite pollt den Status und zeigt
   das Ergebnis, sobald es fertig ist.
3. **Ergebnis** (`/analyse/[id]`): strukturierter Report inkl. PDF-Download
   (`/api/analyses/[id]/pdf`, gerendert per Playwright/Chromium).
4. **Anreicherung nach Besichtigung** (`/analyse/[id]/anreichern`): Antworten
   auf die offenen Prüffragen inkl. Foto-/Dokument-Upload erzeugen eine neue,
   versionierte Report-Version mit Änderungs-Zusammenfassung.

## Domain & SEO-Grundeinstellungen

Titel, Beschreibung, Keywords und die Basis-URL für Sitemap/Metadata/OG-Bild
liegen zentral in `lib/site-config.ts`. Sobald eine echte Domain feststeht:

1. `url` in `lib/site-config.ts` anpassen (oder die Umgebungsvariable
   `NEXT_PUBLIC_SITE_URL` setzen – hat Vorrang).
2. Beim jeweiligen Hoster (siehe unten) dieselbe Domain als Custom Domain
   hinterlegen.

Sitemap (`/sitemap.xml`) und `robots.txt` werden automatisch aus dieser
Konfiguration generiert; die Analyse-Ergebnisseiten (`/analyse/[id]`) sind
darin bewusst von der Indexierung ausgeschlossen, da sie personenbezogene
Objektdaten einzelner Nutzer enthalten.

## Veröffentlichen auf Netlify

Für einen ersten öffentlichen Test ohne Terminal:

1. Repository auf GitHub liegen lassen (bereits der Fall).
2. Auf [netlify.com](https://netlify.com) einloggen → "Add new site" →
   "Import an existing project" → das GitHub-Repo auswählen.
3. Netlify erkennt Next.js automatisch (Build-Einstellungen liegen bereits
   in `netlify.toml`).
4. Unter "Site settings" → "Environment variables" die Variablen aus
   `.env.example` eintragen (`ANTHROPIC_API_KEY`, `DATABASE_URL` – siehe
   nächster Punkt) sowie optional `NEXT_PUBLIC_SITE_URL`.
5. Deploy starten. Netlify vergibt automatisch eine `*.netlify.app`-URL für
   den ersten Test; eine eigene Domain kann später unter "Domain settings"
   ergänzt werden.

**Wichtig vor dem ersten Netlify-Deploy:**

- **Datenbank**: `DATABASE_URL` muss auf eine öffentlich erreichbare
  Postgres-Instanz zeigen (z.B. [Neon](https://neon.tech) oder
  [Supabase](https://supabase.com) – beide haben kostenlose Einstiegsstufen).
  Eine nur lokal laufende Postgres-Installation reicht nicht.
- **Datei-Storage**: Wie unten beschrieben liegen Uploads aktuell lokal unter
  `./uploads/`. Auf Netlify (wie auf jedem Serverless-Hosting) wird dieser
  Ordner bei jedem Funktionsaufruf zurückgesetzt – hochgeladene Exposés
  würden verloren gehen. Das muss vor einem echten Live-Test noch auf einen
  S3/R2-kompatiblen Adapter umgestellt werden (siehe `lib/storage/`).

## Wichtige Hinweise

- **Rechtstexte** (`/datenschutz`, `/impressum`, `/nutzungsbedingungen`) sind
  sorgfältig formulierte Entwürfe für den Prototyp-Betrieb – **vor einem
  echten Live-Gang bitte anwaltlich prüfen lassen.** Das Impressum enthält
  Platzhalter, die durch echte Anbieterdaten ersetzt werden müssen.
- **Datei-Storage**: Uploads liegen lokal unter `./uploads/` (siehe
  `lib/storage/`). Für ein Deployment auf Serverless-Hosting (z.B. Vercel)
  müsste hier ein S3/R2-Adapter ergänzt werden, der dasselbe
  `StorageAdapter`-Interface implementiert.
- **Modell**: Die Pipeline nutzt `claude-opus-4-8` (`lib/anthropic.ts`). Für
  einen kostengünstigeren Betrieb kann hier z.B. auf `claude-sonnet-5`
  umgestellt werden.
- **Nicht enthalten** (bewusst zurückgestellt): Nutzerkonten/Login,
  Zahlungsanbindung, Admin-Dashboard, transaktionaler E-Mail-Versand.

## Tech-Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL + Prisma 7 · Anthropic SDK ·
Playwright (PDF-Export) · Zod (Validierung) · Tailwind CSS
