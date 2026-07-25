import { StartAnalysisForm } from "./components/StartAnalysisForm";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">
        HauskaufChecker
      </h1>
      <p className="text-black/70 dark:text-white/70 mb-8">
        Eine fundierte, aber unverbindliche Ersteinschätzung deiner
        Wunschimmobilie – bevor du 600&nbsp;EUR für eine Besichtigung durch
        einen Bausachverständigen ausgibst. Lade dein Exposé hoch, wir
        analysieren Substanz, Modernisierungskosten, Marktwert und Risiken auf
        Basis der vorliegenden Unterlagen.
      </p>
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-6">
        <StartAnalysisForm />
      </div>
    </div>
  );
}
