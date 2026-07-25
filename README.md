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
