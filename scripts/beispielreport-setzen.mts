// Macht eine fertige Analyse zum öffentlichen Beispielreport.
//
// Aufruf:  npx tsx --env-file=.env scripts/beispielreport-setzen.mts HKC-XXXX-XXXX
//
// Notwendig sind zwei Dinge, die die Analyse-Seite prüft: Die Analyse darf
// keinem Konto gehören (sonst ist sie für Fremde unsichtbar), und sie muss
// freigeschaltet sein (sonst greift die Bezahlschranke). Beides wird hier
// gesetzt.
//
// Das Skript weigert sich bei einer Analyse, die einem Konto gehört: Dort
// stünden echte Nutzerdaten und ein echtes Objekt, und die dürfen nicht
// öffentlich werden. Die Zuordnung selbst – welche ID der Beispielreport
// ist – steht in der Umgebungsvariablen BEISPIEL_ANALYSE_ID, nicht in der
// Datenbank; so lässt sie sich pro Umgebung unterscheiden.

import { prisma } from "@/lib/db/prisma";

const id = process.argv[2];
if (!id) {
  console.error("Aufruf: beispielreport-setzen.mts <ANALYSE-ID>");
  process.exit(1);
}

const analyse = await prisma.analysis.findUnique({
  where: { id },
  select: { id: true, status: true, userId: true, freigeschaltet: true, email: true },
});

if (!analyse) {
  console.error(`Analyse ${id} existiert nicht.`);
  process.exit(1);
}
if (analyse.status !== "DONE") {
  console.error(`Analyse ${id} ist nicht fertig (Status ${analyse.status}).`);
  process.exit(1);
}
if (analyse.userId !== null) {
  console.error(
    `Analyse ${id} gehört zu einem Konto (${analyse.email}). ` +
      "Ein Beispielreport muss zu einem fiktiven Objekt ohne Konto gehören.",
  );
  process.exit(1);
}

await prisma.analysis.update({ where: { id }, data: { freigeschaltet: true } });

console.log(`Analyse ${id} ist jetzt freigeschaltet und kontolos.`);
console.log(`Trage in die Umgebung ein:  BEISPIEL_ANALYSE_ID=${id}`);
