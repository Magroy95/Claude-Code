import { LookupAnalysisForm } from "@/app/components/LookupAnalysisForm";

export const metadata = { title: "Analyse abrufen – HauskaufChecker" };

export default function AnalyseLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold mb-2">Analyse abrufen</h1>
      <p className="text-sm text-black/60 dark:text-white/60 mb-6">
        Gib deine Analyse-ID ein, um dein Ergebnis anzusehen oder es mit
        Besichtigungsergebnissen anzureichern.
      </p>
      <LookupAnalysisForm />
    </div>
  );
}
