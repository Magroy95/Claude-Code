// Normalisiertes Ergebnis einer externen, öffentlich zugänglichen
// Marktdaten-Quelle, die als fachlich anerkannte Referenz für die
// Marktwert-Einordnung dient (siehe README-Hinweis "Verifizierung").
export interface BodenrichtwertErgebnis {
  bodenrichtwertEurProQm: number;
  /** Stichtag der Wertermittlung, im Format wie von der Quelle geliefert (z.B. "01.01.2024"). */
  stichtag: string;
  /** Name der ausgebenden Stelle, z.B. "Gutachterausschuss für Grundstückswerte Niedersachsen (LGLN)". */
  quelle: string;
  quellUrl: string;
}

export interface PreisindexErgebnis {
  regionOderBund: string;
  /** Jahr, auf das sich der zuletzt verfügbare Indexwert bezieht. */
  jahr: number;
  /** Veränderung zum Vorjahr in Prozent, falls von der Quelle berechenbar. */
  veraenderungVorjahrProzent: number | null;
  quelle: string;
  quellUrl: string;
}

export interface MarktdatenErgebnis {
  bodenrichtwert: BodenrichtwertErgebnis | null;
  preisindex: PreisindexErgebnis | null;
}

export interface BodenrichtwertAdapter {
  /** Länderkürzel, für die dieser Adapter zuständig ist, z.B. ["NI"]. */
  bundeslaender: string[];
  hole(lageOrtPlz: string): Promise<BodenrichtwertErgebnis | null>;
}
