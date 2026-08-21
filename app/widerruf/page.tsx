import { RechtsSeite } from "@/app/components/RechtsSeite";
import { ANBIETER } from "@/lib/site-config";

export const metadata = { title: "Widerrufsbelehrung" };

/**
 * ACHTUNG – vor dem Livegang anwaltlich prüfen lassen.
 *
 * Der Text folgt dem gesetzlichen Muster der Anlage 1 zu Art. 246a § 1 Abs.
 * 2 Satz 2 EGBGB, angepasst an digitale Inhalte. Eine fehlerhafte
 * Widerrufsbelehrung verlängert die Widerrufsfrist auf zwölf Monate und
 * vierzehn Tage und ist abmahnfähig – das ist kein Bereich für Näherungen.
 */
export default function WiderrufSeite() {
  return (
    <RechtsSeite titel="Widerrufsbelehrung">
      <h2>Widerrufsrecht</h2>
      <p>
        Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
        widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
      </p>
      <p>
        Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
      </p>
      <p>
        {ANBIETER.name}
        <br />
        {ANBIETER.strasse}
        <br />
        {ANBIETER.plzOrt}
        <br />
        E-Mail: {ANBIETER.email}
      </p>
      <p>
        mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine
        E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür
        das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
      </p>
      <p>
        Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des
        Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
      </p>

      <h2>Folgen des Widerrufs</h2>
      <p>
        Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen
        erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen,
        an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese
        Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen
        Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes
        vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
      </p>

      <h2>Vorzeitiges Erlöschen des Widerrufsrechts</h2>
      <p>
        Bei einem Vertrag über die Bereitstellung digitaler Inhalte, die nicht auf einem körperlichen
        Datenträger geliefert werden, erlischt Ihr Widerrufsrecht, wenn wir mit der Ausführung des
        Vertrags begonnen haben, nachdem Sie
      </p>
      <ol>
        <li>
          ausdrücklich zugestimmt haben, dass wir mit der Ausführung des Vertrags vor Ablauf der
          Widerrufsfrist beginnen, und
        </li>
        <li>
          Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der
          Ausführung des Vertrags Ihr Widerrufsrecht verlieren, und
        </li>
        <li>wir Ihnen eine Bestätigung des Vertrags zur Verfügung gestellt haben.</li>
      </ol>
      <p>
        <strong>Was das für Sie konkret bedeutet:</strong> Die Auswertung startet unmittelbar nach
        dem Kauf — das ist der Sinn des Angebots. Sie bestätigen im Bezahlvorgang, dass wir sofort
        beginnen sollen und dass Ihr Widerrufsrecht damit erlischt, sobald der Report vollständig
        erstellt ist. Bis dahin können Sie widerrufen. Schlägt die Auswertung fehl, wird Ihnen nichts
        berechnet.
      </p>

      <h2>Muster-Widerrufsformular</h2>
      <p className="opacity-70">
        (Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie
        es zurück.)
      </p>
      <blockquote>
        <p>
          An {ANBIETER.name}, {ANBIETER.strasse}, {ANBIETER.plzOrt}, {ANBIETER.email}:
        </p>
        <p>
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf
          der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)
        </p>
        <p>
          — Bestellt am (*) / erhalten am (*)
          <br />— Name des/der Verbraucher(s)
          <br />— Anschrift des/der Verbraucher(s)
          <br />— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)
          <br />— Datum
        </p>
        <p>(*) Unzutreffendes streichen.</p>
      </blockquote>
    </RechtsSeite>
  );
}
