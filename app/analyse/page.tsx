import { LookupAnalysisForm } from "@/app/components/LookupAnalysisForm";

export const metadata = { title: "Analyse abrufen – HauskaufChecker" };

export default function AnalyseLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold mb-2">Analyse abrufen</h1>
      <p className="text-sm text-black/60 dark:text-white/60 mb-6">
        Geben Sie Ihre Analyse-ID ein, um Ihr Ergebnis anzusehen oder es um
        Besichtigungsergebnisse zu ergänzen.
      </p>
      <LookupAnalysisForm />
    </div>
  );
}
