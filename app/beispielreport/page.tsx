import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { BEISPIEL_ANALYSE_ID } from "@/lib/beispiel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Beispielreport",
  description: "Ein vollständiger HauskaufChecker-Report zu einem Beispielobjekt.",
};

/**
 * Leitet auf den fertigen Beispielreport weiter. Die Prüfung, ob die
 * hinterlegte Analyse überhaupt öffentlich zeigbar ist, passiert hier und
 * nicht erst im Report – sonst landet ein Interessent auf einer
 * Bezahlschranke, obwohl auf der Startseite „ohne Anmeldung" steht.
 */
export default async function BeispielreportSeite() {
  const analyse = BEISPIEL_ANALYSE_ID
    ? await prisma.analysis.findUnique({
        where: { id: BEISPIEL_ANALYSE_ID },
        select: { id: true, status: true, userId: true, freigeschaltet: true },
      })
    : null;

  // Ziel ist das PDF, nicht die Reportseite: Der Knopf auf der Startseite
  // sagt "Beispielreport ansehen (PDF)", und ein Versprechen, das schon beim
  // Klick nicht stimmt, ist ein schlechter Anfang für eine Vertrauensseite.
  // Das PDF entsteht ohnehin aus genau dieser Reportseite – es ist dasselbe
  // Dokument, nur in der Form, die zugesagt wurde.
  if (analyse && analyse.status === "DONE" && analyse.userId === null && analyse.freigeschaltet) {
    redirect(`/api/analyses/${analyse.id}/pdf`);
  }

  return (
    <div className="lp-bahn schmal lp-seite mittig">
      <p className="lp-augenbraue">Beispielreport</p>
      <h1 className="lp-h2">Der Beispielreport ist gerade nicht abrufbar</h1>
      <p className="lp-text">
        Das liegt an uns, nicht an Ihnen. Sie können stattdessen direkt Ihr eigenes Exposé
        hochladen — die Kurzfassung kostet nichts und zeigt Ihnen dasselbe, was der Beispielreport
        zeigen würde: wie wir arbeiten.
      </p>
      <Link href="/#start" className="lp-knopf" style={{ marginTop: "28px" }}>
        Eigenes Exposé hochladen
      </Link>
    </div>
  );
}
