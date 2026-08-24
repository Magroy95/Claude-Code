import { redirect } from "next/navigation";
import { aktuellerNutzer } from "@/lib/auth/session";
import { AnmeldeForm } from "@/app/components/AnmeldeForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Anmelden",
  description: "Melden Sie sich an, um Ihre Analysen einzusehen.",
};

export default async function AnmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; weiter?: string }>;
}) {
  if (await aktuellerNutzer()) redirect("/konto");
  const { fehler, weiter } = await searchParams;

  return (
    <div className="lp-bahn schmal lp-seite">
      <p className="lp-augenbraue">Ihr Konto</p>
      <h1 className="lp-h2">Anmelden</h1>
      <p className="lp-text">
        Wir schicken Ihnen einen Anmeldelink per E-Mail — ohne Passwort. Haben Sie noch kein Konto,
        wird es dabei angelegt.
      </p>
      {fehler === "link" && (
        <p className="lp-warnung" style={{ marginTop: "22px" }}>
          Dieser Anmeldelink gilt nicht mehr. Links sind 20 Minuten gültig und lassen sich nur
          einmal verwenden — das schützt Ihr Konto, falls die E-Mail in falsche Hände gerät.
          Fordern Sie einfach einen neuen an.
        </p>
      )}
      <AnmeldeForm weiter={weiter} />
    </div>
  );
}
