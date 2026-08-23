/**
 * Der öffentlich einsehbare Beispielreport.
 *
 * Das Versprechen auf der Startseite lautet: ein kompletter Report, ohne
 * Unschärfe, ohne Anmeldung. Damit das nicht zu einer leeren Zusage wird,
 * hängt es an einer echten Analyse, die zwei Bedingungen erfüllen muss:
 *
 *   1. Sie gehört keinem Konto (userId = null) – sonst ist sie für Fremde
 *      nicht sichtbar.
 *   2. Sie ist freigeschaltet – sonst greift die Bezahlschranke.
 *
 * Bewusst NICHT geeignet ist jede Analyse zu einem real inserierten Objekt:
 * Ein Report nennt Adresse, Preis und vermutete Mängel. Das öffentlich zu
 * stellen, wäre gegenüber Eigentümer und Verkäufer nicht vertretbar. Der
 * Beispielreport muss deshalb zu einem als fiktiv gekennzeichneten Exposé
 * gehören.
 */
export const BEISPIEL_ANALYSE_ID = process.env.BEISPIEL_ANALYSE_ID ?? null;

/** Der Pfad, auf den die Startseite verweist. */
export const BEISPIELREPORT_PFAD = "/beispielreport";

/**
 * Der Auszug, den die Startseite neben der Überschrift zeigt.
 *
 * Alle Zahlen stammen aus dem veröffentlichten Beispielreport zum fiktiven
 * Musterobjekt (siehe BEISPIEL_ANALYSE_ID) – nichts davon ist ausgedacht,
 * und wer daneben auf "Beispielreport ansehen" klickt, findet genau diese
 * Werte wieder. Deshalb gilt: Wird der Beispiellauf erneuert, gehören die
 * Werte hier mit erneuert, sonst behauptet die Startseite etwas, das der
 * verlinkte Report nicht mehr hergibt.
 *
 * Bewusst als feste Werte und nicht aus der Datenbank gelesen: Die
 * Startseite ist die wichtigste Seite des Angebots, und sie soll auch dann
 * vollständig ausliefern, wenn die Datenbank klemmt oder der Beispielreport
 * in dieser Umgebung noch gar nicht angelegt ist.
 */
export const BEISPIEL_AUSZUG = {
  kennung: "HKC-4537",
  objekt: "Einfamilienhaus · Musterweg 12, 27721 Ritterhude · fiktives Objekt",
  ampelText:
    "Ein kaufentscheidendes Risiko mit hohem Gewicht, Angebotspreis über dem Korridor — Kellerfeuchte, Ölheizung und Wegerecht vor der Entscheidung klären.",
  korridorMinEur: 355_000,
  korridorMaxEur: 400_000,
  angebotspreisEur: 429_000,
  wohnflaecheQm: 142,
  baujahr: 1968,
  sanierungsstauMinEur: 100_000,
  sanierungsstauMaxEur: 192_000,
  stauNotiz:
    "Spanne so breit, weil Dach, Elektro und Fassade im Exposé kein Erneuerungsjahr nennen — gerechnet ab Baujahr.",
  punkte: [
    {
      hoch: true,
      titel: "Kellerfeuchte",
      text: "Ursache nach Starkregen 2024 nicht geklärt, kein Gutachten",
    },
    { hoch: false, titel: "Ölheizung 1998", text: "GEG-Austauschpflicht absehbar" },
    { hoch: false, titel: "Wegerecht", text: "Abt. II des Grundbuchs, Zufahrt wird mitgenutzt" },
  ],
} as const;
