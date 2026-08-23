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

  if (analyse && analyse.status === "DONE" && analyse.userId === null && analyse.freigeschaltet) {
    redirect(`/analyse/${analyse.id}`);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Der Beispielreport ist gerade nicht abrufbar
      </h1>
      <p className="mt-3 text-sm text-black/70 dark:text-white/70 leading-relaxed">
        Das liegt an uns, nicht an Ihnen. Sie können stattdessen direkt Ihr eigenes Exposé
        hochladen — die Kurzfassung kostet nichts und zeigt Ihnen dasselbe, was der Beispielreport
        zeigen würde: wie wir arbeiten.
      </p>
      <Link
        href="/#start"
        className="mt-6 inline-block rounded-md bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 text-sm font-medium"
      >
        Eigenes Exposé hochladen
      </Link>
    </main>
  );
}
