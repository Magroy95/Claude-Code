import { LookupAnalysisForm } from "@/app/components/LookupAnalysisForm";

export const metadata = { title: "Analyse abrufen – HauskaufChecker" };

export default function AnalyseLookupPage() {
  return (
    <div className="lp-bahn schmal lp-seite">
      <p className="lp-augenbraue">Ohne Anmeldung</p>
      <h1 className="lp-h2">Analyse abrufen</h1>
      <p className="lp-text" style={{ marginBottom: "26px" }}>
        Geben Sie Ihre Analyse-ID ein, um Ihr Ergebnis wieder aufzurufen. Sie steht in der E-Mail,
        die wir Ihnen nach der Auswertung geschickt haben.
      </p>
      <LookupAnalysisForm />
    </div>
  );
}
