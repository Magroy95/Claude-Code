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
