// Baut die Ansichtsseite mit den eingebetteten Bildschirmfotos.
//
// Die Bilder werden als data:-URIs eingebettet, weil die Artefakt-Seite
// keine fremden Hosts laden darf. Sie liegen deshalb vorher als JPEG in
// scratchpad/shots, nicht als PNG – ein sechsstelliges PNG je Seite waere
// in base64 zu gross.

import fs from "node:fs";
import path from "node:path";

const SHOTS = process.argv[2];
const ZIEL = process.argv[3];

function bild(datei) {
  const b64 = fs.readFileSync(path.join(SHOTS, datei)).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}

/** Ein Bildschirmfoto im Rahmen. Hohe Seiten scrollen im Rahmen. */
function rahmen({ datei, pfad, hoehe, alt }) {
  const scrollt = hoehe > 900;
  return `
      <figure class="schuss">
        <div class="leiste"><span class="punkte" aria-hidden="true"></span><code>${pfad}</code></div>
        <div class="glas${scrollt ? " scrollt" : ""}">
          <img src="${bild(datei)}" alt="${alt}" loading="lazy" />
        </div>
        ${scrollt ? `<figcaption class="hinweis">Im Rahmen scrollen · Seitenhöhe ${hoehe.toLocaleString("de-DE")} px</figcaption>` : ""}
      </figure>`;
}

const schritte = [
  {
    nr: "01",
    titel: "Die Startseite",
    text: `Die Überschrift nennt das Ergebnis, nicht das Werkzeug. Der Gegner im Text ist die Uhr, nicht der Makler. Direkt unter dem Formular stehen die Einwände, die sonst zum Abbruch führen — kostenlos, kein Konto, kein Abo. Weiter unten: was wir <em>nicht</em> können, die Ampel-Einordnung, Ihr Vertrauensabschnitt im Wortlaut, der Gründerabschnitt und die Preise.`,
    merken: `Im Gründerabschnitt steht noch <code>[Name der verantwortlichen Person]</code> — der Platzhalter aus der Umgebungsvariable.`,
    datei: "01-start.jpg",
    pfad: "/",
    hoehe: 6093,
    alt: "Startseite von HauskaufChecker in voller Länge",
  },
  {
    nr: "02",
    titel: "Während die Analyse läuft",
    text: `Kein Ladebalken, sondern die acht Schritte der Pipeline. Was Sie hier sehen, ist der echte Stand aus den gespeicherten Zwischenergebnissen — kein Timer, der einfach losläuft. Erledigte Schritte grauen aus, der laufende steht fett.`,
    datei: "06-warten.jpg",
    pfad: "/analyse/HKC-3740-DYCB",
    hoehe: 900,
    alt: "Wartebildschirm mit acht Arbeitsschritten, vier davon erledigt",
  },
  {
    nr: "03",
    titel: "Die kostenlose Kurzfassung",
    text: `So sieht sie jemand ohne Konto. Ampel mit Handlungsanweisung darüber, Kurzfazit, die Kennzahlen, die ausgelesenen Objektdaten — und die zwei wichtigsten Hypothesen vollständig ausformuliert, mit Zitat aus dem Exposé und den Fragen für den Termin.`,
    merken: `Die zwei Hypothesen sind bewusst ganz zu lesen. Ein angerissener Halbsatz erzeugt Misstrauen, kein Kaufinteresse.`,
    datei: "02-kurzfassung.jpg",
    pfad: "/analyse/HKC-4537-FBRA",
    hoehe: 3050,
    alt: "Kostenlose Kurzfassung eines Reports mit roter Ampel",
  },
  {
    nr: "04",
    titel: "Die Bezahlschranke",
    text: `Hier angemeldet gezeigt, deshalb stehen die Kaufknöpfe direkt da. Die Überschrift zählt, was noch kommt („10 weitere Hypothesen, die Sie klären sollten"). Keine verschwommene Vorschau — stattdessen eine Liste dessen, was der Käufer bekommt, und darüber die Zusage, dass er das Ergebnis vor dem Zahlen sieht.`,
    datei: "08-schranke.jpg",
    pfad: "/analyse/HKC-4537-FBRA",
    hoehe: 3050,
    alt: "Report mit Bezahlschranke und den beiden Kaufknöpfen",
  },
  {
    nr: "05",
    titel: "Die vollständige Besichtigungsmappe",
    text: `Der freigeschaltete Report — hier am fiktiven Problemhaus, das auch der öffentliche Beispielreport zeigt. Zwölf Hypothesen mit Belegen, Marktwert-Korridor, alle acht Gewerke einzeln, Sanierungsstau mit Rechenweg, Finanzierung samt Stresstest, Sanierungsfahrplan.`,
    merken: `Die Sanierungsstau-Kachel zeigt jetzt oben den Gesamtansatz (100.000–192.000 €) und darunter, welcher Teil davon belegt ist. Vorher stand die kleinere Zahl groß.`,
    datei: "03-mappe.jpg",
    pfad: "/analyse/HKC-4537-FBRA",
    hoehe: 14641,
    alt: "Vollständiger Report über die gesamte Länge",
  },
];

const nebenseiten = [
  {
    titel: "Preise",
    text: `Beide Produkte mit Ihren Namen und Preisen. Darunter der Vergleich mit den 600 €, die Sie selbst für den Bausachverständigen gezahlt haben — in der ersten Person, weil es Ihre Rechnung ist und keine Marktrecherche. Die Stundenbremse steht im Kleingedruckten, nicht auf der Karte.`,
    datei: "04-preise.jpg",
    pfad: "/preise",
    hoehe: 1096,
    alt: "Preisseite mit Einzel-Check und Hausjäger-Pass",
  },
  {
    titel: "Meine Häuser",
    text: `Alle geprüften Objekte mit Ampel, Preis und dem Hinweis „Kurzfassung", solange nicht freigeschaltet. Unten die drei Knöpfe, die das Löschkonzept praktisch machen: abmelden, Daten herunterladen, Konto löschen.`,
    datei: "07-meine-haeuser.jpg",
    pfad: "/konto",
    hoehe: 900,
    alt: "Kontoübersicht mit drei geprüften Häusern",
  },
  {
    titel: "Anmelden",
    text: `Kein Passwort. Eine E-Mail-Adresse, ein Link, fertig — es gibt schlicht kein Passwort, das jemand bei uns erbeuten könnte.`,
    datei: "05-anmelden.jpg",
    pfad: "/anmelden",
    hoehe: 900,
    alt: "Anmeldeformular mit einem einzigen Eingabefeld",
  },
];

const offen = [
  {
    was: "Anbieterangaben",
    detail:
      "ANBIETER_NAME, _STRASSE, _PLZ_ORT, _EMAIL und _VERANTWORTLICH sind leer. Ohne ladungsfähige Anschrift ist das Impressum unvollständig (§ 5 DDG), und im Gründerabschnitt steht der Platzhalter statt Ihres Namens.",
  },
  {
    was: "Beispielreport in der Produktivdatenbank",
    detail:
      "Die Analyse HKC-4537-FBRA existiert bisher nur lokal. In der Produktivumgebung muss der Lauf einmal wiederholt, freigeschaltet und BEISPIEL_ANALYSE_ID gesetzt werden.",
  },
  {
    was: "Zugänge",
    detail:
      "Domain, Stripe-Schlüssel, Datenbank, Brevo-Schlüssel und die Geheimnisse für PDF-Token, Cron und Pipeline.",
  },
  {
    was: "Juristische Durchsicht",
    detail:
      "AGB und Widerrufsbelehrung sind von mir geschrieben, nicht von einer Anwältin oder einem Anwalt geprüft.",
  },
  {
    was: "Sachwertfaktor Landkreis Osterholz",
    detail:
      "Die Tabelle des Gutachterausschusses ist an dieser Stelle leer, das Sachwertverfahren nach ImmoWertV rechnet dort deshalb nicht durch.",
  },
];

const html = `<title>HauskaufChecker im Nutzerblick</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;1,400&display=swap"
/>
<style>
  :root {
    --grund: #eceef0;
    --flaeche: #ffffff;
    --flaeche-tief: #e3e6e9;
    --tinte: #15181b;
    --tinte-weich: #59626a;
    --tinte-blass: #8b959c;
    --linie: #d2d8dc;
    --linie-stark: #b6bfc5;
    --akzent: #9c3524;
    --gut: #2f6b4f;
    --schrift-anzeige: "IBM Plex Sans Condensed", "Helvetica Neue", Arial, sans-serif;
    --schrift-text: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
    --schrift-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --grund: #101316;
      --flaeche: #191d21;
      --flaeche-tief: #14181b;
      --tinte: #e6e9eb;
      --tinte-weich: #99a2a9;
      --tinte-blass: #6d777e;
      --linie: #272d32;
      --linie-stark: #394248;
      --akzent: #d4785f;
      --gut: #62ab86;
    }
  }
  :root[data-theme="dark"] {
    --grund: #101316;
    --flaeche: #191d21;
    --flaeche-tief: #14181b;
    --tinte: #e6e9eb;
    --tinte-weich: #99a2a9;
    --tinte-blass: #6d777e;
    --linie: #272d32;
    --linie-stark: #394248;
    --akzent: #d4785f;
    --gut: #62ab86;
  }

  body {
    background: var(--grund);
    color: var(--tinte);
    font-family: var(--schrift-text);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  .bahn { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
  .text { max-width: 68ch; }

  header.kopf {
    border-bottom: 1px solid var(--linie-stark);
    padding: 56px 0 28px;
    margin-bottom: 48px;
  }
  .marke {
    font-family: var(--schrift-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--akzent);
  }
  h1 {
    font-family: var(--schrift-anzeige);
    font-weight: 700;
    font-size: clamp(30px, 5vw, 46px);
    line-height: 1.1;
    letter-spacing: -0.015em;
    text-wrap: balance;
    margin: 10px 0 14px;
  }
  .unterzeile { color: var(--tinte-weich); font-size: 17px; max-width: 62ch; }
  .stand {
    display: flex; flex-wrap: wrap; gap: 8px 26px;
    margin-top: 22px;
    font-family: var(--schrift-mono); font-size: 11.5px;
    color: var(--tinte-blass);
  }
  .stand b { color: var(--tinte-weich); font-weight: 500; }

  h2 {
    font-family: var(--schrift-anzeige);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tinte-weich);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--linie);
    margin: 0 0 34px;
  }
  section { margin-bottom: 72px; }

  .schritt { display: grid; grid-template-columns: 60px 1fr; gap: 0 24px; margin-bottom: 56px; }
  .zahl {
    font-family: var(--schrift-mono);
    font-size: 13px; font-weight: 500;
    color: var(--akzent);
    padding-top: 6px;
    font-variant-numeric: tabular-nums;
  }
  .schritt h3, .neben h3 {
    font-family: var(--schrift-anzeige);
    font-weight: 600; font-size: 24px; line-height: 1.25;
    letter-spacing: -0.01em; margin: 0 0 10px;
  }
  .schritt p, .neben p { margin: 0 0 14px; color: var(--tinte-weich); }
  .schritt p em, .neben p em { color: var(--tinte); font-style: italic; }
  .schritt .inhalt, .neben .inhalt { min-width: 0; }

  /* Bewusst block, nicht flex: In einem Flex-Container wird jedes
     <code> zu einem eigenen Element in der Reihe, und der Satz zerfaellt
     in Spalten statt weiterzulaufen. */
  .merken {
    display: block;
    border-left: 2px solid var(--akzent);
    padding: 2px 0 2px 14px;
    margin: 0 0 20px;
    font-size: 14.5px; color: var(--tinte-weich);
  }
  .merken code, .offen code {
    font-family: var(--schrift-mono); font-size: 12.5px;
    background: var(--flaeche-tief); padding: 1px 5px; border-radius: 3px;
    color: var(--tinte);
  }

  .schuss { margin: 0; }
  .leiste {
    display: flex; align-items: center; gap: 12px;
    background: var(--flaeche-tief);
    border: 1px solid var(--linie-stark); border-bottom: 0;
    border-radius: 7px 7px 0 0;
    padding: 9px 14px;
  }
  .punkte {
    flex: none; width: 38px; height: 8px;
    background:
      radial-gradient(circle 4px at 4px 4px, var(--linie-stark) 96%, transparent 0),
      radial-gradient(circle 4px at 19px 4px, var(--linie-stark) 96%, transparent 0),
      radial-gradient(circle 4px at 34px 4px, var(--linie-stark) 96%, transparent 0);
  }
  .leiste code {
    font-family: var(--schrift-mono); font-size: 12px;
    color: var(--tinte-weich); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .glas {
    border: 1px solid var(--linie-stark);
    border-radius: 0 0 7px 7px;
    overflow: hidden;
    background: var(--flaeche);
  }
  .glas.scrollt { max-height: 620px; overflow-y: auto; }
  .glas img { display: block; width: 100%; height: auto; }
  .hinweis {
    font-family: var(--schrift-mono); font-size: 11px;
    color: var(--tinte-blass); margin-top: 8px;
  }

  .neben { display: grid; grid-template-columns: 60px 1fr; gap: 0 24px; margin-bottom: 56px; }
  .neben .zahl { color: var(--tinte-blass); }

  .mobil { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px; }
  .mobil .glas.scrollt { max-height: 700px; }

  ul.offen { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; }
  ul.offen li {
    display: grid; grid-template-columns: minmax(190px, 260px) 1fr; gap: 4px 28px;
    padding: 16px 0; border-top: 1px solid var(--linie);
  }
  ul.offen li:last-child { border-bottom: 1px solid var(--linie); }
  ul.offen b {
    font-family: var(--schrift-anzeige); font-weight: 600; font-size: 16px;
  }
  ul.offen span { color: var(--tinte-weich); font-size: 15px; }

  footer {
    border-top: 1px solid var(--linie-stark);
    padding: 26px 0 60px;
    font-family: var(--schrift-mono); font-size: 11.5px; color: var(--tinte-blass);
  }
  @media (max-width: 640px) {
    .schritt, .neben { grid-template-columns: 1fr; gap: 6px; }
    .zahl { padding-top: 0; }
    ul.offen li { grid-template-columns: 1fr; }
  }
</style>

<header class="kopf">
  <div class="bahn">
    <p class="marke">HauskaufChecker · Stand der Umsetzung</p>
    <h1>So sieht die Seite gerade aus</h1>
    <p class="unterzeile">
      Alle Bildschirmfotos stammen aus der laufenden Anwendung, nicht aus einem Entwurf. Der Weg
      unten ist der, den ein Käufer nimmt: von der Startseite bis zur fertigen Mappe.
    </p>
    <p class="stand">
      <span><b>Aufgenommen</b> 23. August 2026</span>
      <span><b>Branch</b> claude/hauskaufchecker-prototype-setup-nzq51j</span>
      <span><b>Ansicht</b> 1280 px, hell</span>
    </p>
  </div>
</header>

<main class="bahn">
  <section>
    <h2>Der Weg durch die Seite</h2>
    ${schritte
      .map(
        (s) => `
    <article class="schritt">
      <div class="zahl">${s.nr}</div>
      <div class="inhalt">
        <h3>${s.titel}</h3>
        <div class="text"><p>${s.text}</p></div>
        ${s.merken ? `<div class="merken text">${s.merken}</div>` : ""}
        ${rahmen(s)}
      </div>
    </article>`,
      )
      .join("")}
  </section>

  <section>
    <h2>Die übrigen Seiten</h2>
    ${nebenseiten
      .map(
        (s) => `
    <article class="neben">
      <div class="zahl">·</div>
      <div class="inhalt">
        <h3>${s.titel}</h3>
        <div class="text"><p>${s.text}</p></div>
        ${rahmen(s)}
      </div>
    </article>`,
      )
      .join("")}
  </section>

  <section>
    <h2>Auf dem Handy</h2>
    <div class="text" style="margin-bottom: 28px">
      <p>
        390 px breit, also ein iPhone in Normalgröße — die Breite, in der die meisten Exposés
        abends auf dem Sofa gelesen werden.
      </p>
    </div>
    <div class="mobil">
      ${rahmen({ datei: "m-start.jpg", pfad: "/ · 390 px", hoehe: 7966, alt: "Startseite auf dem Handy" })}
      ${rahmen({ datei: "m-kurzfassung.jpg", pfad: "/analyse/… · 390 px", hoehe: 4862, alt: "Kurzfassung auf dem Handy" })}
    </div>
  </section>

  <section>
    <h2>Was vor dem Livegang noch fehlt</h2>
    <ul class="offen">
      ${offen.map((o) => `<li><b>${o.was}</b><span>${o.detail}</span></li>`).join("")}
    </ul>
  </section>
</main>

<footer>
  <div class="bahn">
    Alle abgebildeten Reports zeigen dasselbe fiktive Musterobjekt. Reports zu echten Inseraten
    sind hier bewusst nicht abgebildet: Sie nennen Adresse, Kaufpreis und vermutete Mängel, und
    das gehört in keine Seite, die weitergegeben werden kann. In „Meine Häuser" erscheinen Objekte
    aus der Testdatenbank, die nur Gemeinde und Ortsteil nennen, keine Straße.
  </div>
</footer>
`;

fs.writeFileSync(ZIEL, html);
console.log(`${ZIEL} geschrieben, ${(fs.statSync(ZIEL).size / 1024 / 1024).toFixed(2)} MB`);
