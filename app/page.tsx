import type { Metadata } from "next";
import { StartAnalysisForm } from "./components/StartAnalysisForm";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const pipelineSchritte = [
  {
    titel: "Extraktion",
    text: "Wohnfläche, Baujahr, Ausstattung, Energieklasse und weitere Kennzahlen werden strukturiert aus deinem Exposé gelesen.",
  },
  {
    titel: "Marktwert-Einordnung",
    text: "Aus Investoren-Perspektive wird der Angebotspreis anhand der Objektdaten in einen realistischen Preiskorridor eingeordnet.",
  },
  {
    titel: "Bausubstanz & Risiken",
    text: "Aus Sicht eines Bausachverständigen werden Sanierungsstau, Mängelhinweise und offene Prüffragen identifiziert.",
  },
  {
    titel: "Sanierungsfahrplan",
    text: "Modernisierungsschritte inkl. iSFP-Logik (Hülle vor Heizung, Förderbonus-Reihenfolge) und voraussichtlicher Energieklassen-Entwicklung.",
  },
  {
    titel: "Qualitätsschleifen",
    text: "Mehrere KI-Agenten prüfen das Ergebnis in unabhängigen Durchgängen gegen Reihenfolge, Förderlogik und Plausibilität. Weil jeder Durchgang das Ergebnis der anderen nicht kennt, fallen Falschaussagen auf, bevor sie in den Report gelangen.",
  },
  {
    titel: "Synthese",
    text: "Alle Perspektiven fließen in einen strukturierten Report mit Ampel-Einschätzung, Preiskorridor und offenen Fragen für die Besichtigung zusammen.",
  },
];

const personas = [
  {
    titel: "Für Käufer:innen mit Investoren-Blick",
    text: "Du willst wissen, ob der Angebotspreis zum Zustand der Immobilie passt, bevor du ein Kaufangebot abgibst.",
  },
  {
    titel: "Für alle, die auf Bausubstanz achten",
    text: "Du willst Sanierungsstau und versteckte Mängelhinweise im Exposé erkennen, bevor du 600 EUR für ein Gutachten ausgibst.",
  },
  {
    titel: "Für energiebewusste Käufer:innen",
    text: "Du willst wissen, welche Modernisierungsschritte in welcher Reihenfolge sinnvoll sind und welche Energieklasse realistisch erreichbar ist.",
  },
];

const faqs = [
  {
    frage: "Ersetzt HauskaufChecker ein Gutachten vom Bausachverständigen?",
    antwort:
      "Nein. HauskaufChecker liefert eine unverbindliche Ersteinschätzung auf Basis der Angaben im Exposé, bevor eine Besichtigung stattgefunden hat. Er hilft dir zu entscheiden, ob sich eine kostenpflichtige Vor-Ort-Prüfung durch einen Bausachverständigen überhaupt lohnt – ersetzt sie aber nicht.",
  },
  {
    frage: "Welche Unterlagen brauche ich für die Analyse?",
    antwort:
      "Ein PDF oder Foto des Exposés reicht für den Start. Nach einer Besichtigung kannst du zusätzliche Antworten, Fotos und Dokumente nachreichen – daraus entsteht eine aktualisierte, versionierte Report-Fassung.",
  },
  {
    frage: "Was kostet die Analyse?",
    antwort:
      "HauskaufChecker befindet sich aktuell in der Testphase und ist kostenlos nutzbar. Es gibt noch keine Zahlungsfunktion.",
  },
  {
    frage: "Wie lange dauert eine Analyse?",
    antwort:
      "Die Auswertung läuft im Hintergrund über mehrere spezialisierte KI-Durchläufe und ist in der Regel nach wenigen Minuten fertig.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url: siteConfig.url,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.frage,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.antwort,
        },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          Hauskauf prüfen, bevor du unterschreibst
        </h1>
        <p className="text-black/70 dark:text-white/70 mb-8">
          Eine fundierte, aber unverbindliche Ersteinschätzung deiner
          Wunschimmobilie – bevor du 600&nbsp;EUR für eine Besichtigung durch
          einen Bausachverständigen ausgibst. Lade dein Exposé hoch, wir
          analysieren Substanz, Modernisierungskosten, Marktwert und Risiken
          auf Basis der vorliegenden Unterlagen.
        </p>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-6">
          <StartAnalysisForm />
        </div>
      </div>

      <section
        aria-labelledby="ablauf-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="ablauf-heading" className="text-xl font-semibold tracking-tight mb-6">
          So läuft die Analyse deines Exposés ab
        </h2>
        <ol className="flex flex-col gap-5">
          {pipelineSchritte.map((schritt, i) => (
            <li key={schritt.titel} className="flex gap-4">
              <span className="font-mono text-sm text-black/40 dark:text-white/40 pt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-medium">{schritt.titel}</p>
                <p className="text-sm text-black/70 dark:text-white/70">
                  {schritt.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="zielgruppe-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2
          id="zielgruppe-heading"
          className="text-xl font-semibold tracking-tight mb-6"
        >
          Für wen sich der Hauskauf-Check lohnt
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {personas.map((p) => (
            <div key={p.titel}>
              <p className="font-medium mb-1">{p.titel}</p>
              <p className="text-sm text-black/70 dark:text-white/70">
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="faq-heading"
        className="mx-auto max-w-2xl px-4 py-12 border-t border-black/10 dark:border-white/10"
      >
        <h2 id="faq-heading" className="text-xl font-semibold tracking-tight mb-6">
          Häufige Fragen
        </h2>
        <div className="flex flex-col gap-6">
          {faqs.map((f) => (
            <div key={f.frage}>
              <h3 className="font-medium mb-1">{f.frage}</h3>
              <p className="text-sm text-black/70 dark:text-white/70">
                {f.antwort}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
