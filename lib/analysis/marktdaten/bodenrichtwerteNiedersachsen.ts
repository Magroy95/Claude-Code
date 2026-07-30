// Amtlicher Bodenrichtwert für Niedersachsen – die vom Gutachterausschuss
// für Grundstückswerte (gesetzlich mandatierte Sachverständigen-Gremien,
// ImmoWertV) festgestellte, öffentlich zugängliche Referenz für den
// Bodenwert einer Lage. Das ist die fachlich anerkannteste verfügbare
// Grundlage für eine Marktwert-Einordnung, die es in Deutschland gibt.
//
// Ablauf: 1) Freitext-Lage aus dem Exposé wird über den offenen
// OpenStreetMap-Nominatim-Geocoder in Koordinaten übersetzt, 2) mit diesen
// Koordinaten wird der offene WFS-Dienst des Landesamts für Geoinformation
// und Landesvermessung Niedersachsen (LGLN) abgefragt.
//
// WICHTIG (siehe README, Abschnitt "Marktdaten-Quellen verifizieren"): Der
// WFS-Endpunkt, Layer-Name und die Feldnamen unten sind nach bestem Wissen
// zum LGLN-Dienst modelliert, konnten aber in dieser Session NICHT gegen die
// echte, lebende Schnittstelle getestet werden – der Netzwerkzugriff dieser
// Umgebung ist auf eine Allowlist beschränkt (bestätigt per Verbindungstest,
// 403 der Egress-Policy). Vor dem Live-Betrieb einmal mit einer bekannten
// Adresse gegenprüfen; bis dahin liefert jeder Fehler (falscher Layer-Name,
// falsches Feld, Timeout, ...) kontrolliert `null` statt eines Absturzes –
// die Pipeline läuft dann exakt wie ohne diese Anbindung weiter.
//
// Weitere Bundesländer: bewusst noch nicht implementiert (jedes Bundesland
// betreibt einen eigenen Gutachterausschuss mit eigenem Dienst/Format).
// Für eine Lage außerhalb Niedersachsens liefert `holeBodenrichtwert` daher
// `null`, und der Prompt (siehe marktwertAgent) wird angewiesen, das
// Fehlen einer amtlichen Referenz explizit zu benennen statt es zu
// verschweigen.

import { fetchWithTimeout } from "./fetchWithTimeout";
import type { BodenrichtwertErgebnis } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const LGLN_WFS_URL = "https://www.geobasisdaten.niedersachsen.de/doorman/noauth/brw_wfs";

interface Koordinaten {
  lat: number;
  lon: number;
}

async function geokodiere(lageOrOrt: string): Promise<Koordinaten | null> {
  const url =
    `${NOMINATIM_URL}?` +
    new URLSearchParams({
      q: `${lageOrOrt}, Niedersachsen, Deutschland`,
      format: "json",
      limit: "1",
    }).toString();

  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: 5000,
      // Nominatims Nutzungsbedingungen verlangen einen aussagekräftigen
      // User-Agent statt des Standard-fetch-Agents.
      headers: { "User-Agent": "HauskaufChecker/1.0 (Marktwert-Einordnung)" },
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

async function frageBrwWfsAb(
  koordinaten: Koordinaten,
): Promise<BodenrichtwertErgebnis | null> {
  // Kleiner Suchradius (ca. 200m) als Bounding Box um den geokodierten Punkt,
  // da Bodenrichtwertzonen als Flächen und nicht als Punkte modelliert sind.
  const delta = 0.002;
  const bbox = [
    koordinaten.lon - delta,
    koordinaten.lat - delta,
    koordinaten.lon + delta,
    koordinaten.lat + delta,
  ].join(",");

  const url =
    `${LGLN_WFS_URL}?` +
    new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "brw:Bodenrichtwerte",
      outputFormat: "application/json",
      bbox: `${bbox},EPSG:4326`,
      count: "1",
    }).toString();

  try {
    const response = await fetchWithTimeout(url, { timeoutMs: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const properties = feature.properties ?? {};
    const bodenrichtwertEurProQm = Number(properties.brw ?? properties.BRW);
    if (!Number.isFinite(bodenrichtwertEurProQm)) return null;

    return {
      bodenrichtwertEurProQm,
      stichtag: String(properties.stag ?? properties.STAG ?? "unbekannt"),
      quelle: "Gutachterausschuss für Grundstückswerte Niedersachsen (LGLN)",
      quellUrl: "https://www.lgln.niedersachsen.de/",
    };
  } catch {
    return null;
  }
}

export async function holeBodenrichtwertNiedersachsen(
  lageOrOrt: string,
): Promise<BodenrichtwertErgebnis | null> {
  const koordinaten = await geokodiere(lageOrOrt);
  if (!koordinaten) return null;
  return frageBrwWfsAb(koordinaten);
}
