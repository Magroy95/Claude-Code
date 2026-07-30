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
   Finanzen → Synthese → Vier-Augen-Prüfung des Sanierungsfahrplans →
   Vier-Augen-Prüfung des GESAMTEN Reports. Die `/analyse/[id]`-Seite pollt
   den Status und zeigt das Ergebnis, sobald es fertig ist. Jeder erfolgreich
   abgeschlossene Schritt wird als Checkpoint in `Analysis.pipelineState`
   persistiert (siehe unten, "Zuverlässigkeit"); schlägt ein Schritt
   dauerhaft fehl, kann die Analyse über den "Erneut versuchen"-Button auf
   der Fehlerseite ab genau diesem Schritt fortgesetzt werden, statt
   komplett neu zu beginnen.
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

## Zuverlässigkeit der Analyse-Pipeline

- **Retry + Checkpointing**: Jeder Agenten-Schritt läuft über `withRetry`
  (`lib/analysis/retry.ts`, bis zu 3 Versuche mit exponentiellem Backoff) und
  wird bei Erfolg sofort in `Analysis.pipelineState` zwischengespeichert
  (`lib/analysis/pipeline.ts`). Schlägt ein Schritt nach allen Versuchen
  weiterhin fehl, geht die Analyse auf `ERROR`, aber die bereits
  abgeschlossenen (und bezahlten) Schritte bleiben erhalten. Ein erneuter
  Aufruf von `runAnalysisPipeline` (über `POST /api/analyses/[id]/retry`,
  ausgelöst durch den "Erneut versuchen"-Button) setzt exakt beim
  fehlgeschlagenen Schritt fort.
- **Vier-Augen-Prüfung für den gesamten Report** (`gesamtPruefungAgent` in
  `lib/analysis/pipeline.ts`): Läuft zusätzlich zur bestehenden, engeren
  Sanierungsfahrplan-Prüfung als letzter Schritt vor dem Speichern. Anders
  als eine reine Konsistenz-Prüfung (siehe unten) ist das ein eigener
  LLM-Aufruf mit eigenem Fokus, der gezielt nach den Fehlern sucht, die erst
  beim Zusammenfügen unabhängig erstellter Abschnitte entstehen: Passt die
  Ampel wirklich zu den eigenen Hypothesen? Widerspricht ein Pro-Argument
  einer Hypothese? Ist irgendwo ein verbotener Begriff aus den Sprachregeln
  durchgerutscht? Stimmen die im Marktwert-Text genannten Zahlen exakt mit
  dem Preiskorridor überein? Objektdaten, Preiskorridor, Kaufnebenkosten,
  Hypothesen-Kostenrahmen, Sanierungsstau, Cashflow und der
  Sanierungsfahrplan selbst sind dabei bewusst gesperrt (nur als Kontext
  mitgegeben), damit diese Prüfung keine bereits korrekten Zahlen verwässern
  kann – korrigierbar sind ausschließlich Texte, Argumente, Risikoszenario-
  Beschreibungen, offene Punkte und die Ampel/Kurzfazit-Einordnung. Läuft
  identisch auch nach der Anreicherung (`runImpactPipeline`), damit die
  Qualität auch nach der Besichtigung ohne manuelle Prüfung erhalten bleibt.
- **Numerische Konsistenz-Guards** (`lib/analysis/consistency.ts`): Prüft
  deterministisch Dinge, die Zod allein nicht abdeckt – z.B. dass ein
  Preiskorridor- oder Kostenrahmen-Minimum nie über dem Maximum liegt, oder
  dass Hypothesen-Keys eindeutig sind. Ein Verstoß wirft `ConsistencyError`,
  was denselben Agenten-Schritt (über `withRetry`) einfach erneut anfragt,
  statt einen inkonsistenten Report auszuliefern.
- **Marktdaten-Grounding** (`lib/analysis/marktdaten/`): Der marktwertAgent
  bekommt zusätzlich zwei öffentliche, fachlich anerkannte Referenzen
  mitgegeben, falls verfügbar – den amtlichen Bodenrichtwert des
  Gutachterausschusses (aktuell nur Niedersachsen implementiert) und den
  Häuserpreisindex des Statistischen Bundesamts (Destatis). Liegt keine
  amtliche Referenz vor, wird der Agent angewiesen, seinen Korridor spürbar
  vorsichtiger zu formulieren und das Fehlen explizit zu benennen, statt es
  zu verschweigen. Beide Quellen degradieren bei jedem Fehler (Timeout,
  falsches Format, fehlende Zugangsdaten) auf `null`, statt die Analyse zu
  blockieren.

  **Marktdaten-Quellen verifizieren (vor Live-Betrieb):** Diese Anbindung
  wurde in einer Sandbox ohne Internetzugriff zu Drittanbieter-Hosts gebaut
  (die Egress-Policy dieser Umgebung blockiert unbekannte Hosts). Vor dem
  Live-Gang bitte einmal mit einer bekannten Adresse in Niedersachsen
  gegenprüfen:
  - `lib/analysis/marktdaten/bodenrichtwerteNiedersachsen.ts`: WFS-Endpunkt,
    Layer-Name (`brw:Bodenrichtwerte`) und Feldnamen (`brw`, `stag`) gegen
    den tatsächlichen LGLN-Dienst verifizieren.
  - `lib/analysis/marktdaten/destatis.ts`: kostenloses GENESIS-Online-Konto
    anlegen, Zugangsdaten in `DESTATIS_GENESIS_USERNAME`/`_PASSWORD` eintragen
    und die Tabellen-Kennung (`DESTATIS_TABELLE_HAEUSERPREISINDEX`, Default
    ist ein Platzhalter) gegen den echten Katalog prüfen.
  - Beide Adapter sind bewusst fail-safe: Ein falscher Endpunkt führt zu
    `null` (keine zusätzliche Referenz), nicht zu einem Analyse-Fehler.
  - Weitere Bundesländer für Bodenrichtwerte sind nicht implementiert
    (eigener Gutachterausschuss/Dienst je Land) – `holeMarktdaten` liefert
    dafür bewusst `bodenrichtwert: null`.

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
