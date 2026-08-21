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
  searchParams: Promise<{ fehler?: string }>;
}) {
  if (await aktuellerNutzer()) redirect("/konto");
  const { fehler } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      {fehler === "link" && (
        <p className="mt-4 rounded border border-current/25 p-3 text-sm leading-relaxed">
          Dieser Anmeldelink gilt nicht mehr. Links sind 20 Minuten gültig und lassen sich nur
          einmal verwenden — das schützt Ihr Konto, falls die E-Mail in falsche Hände gerät.
          Fordern Sie einfach einen neuen an.
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed opacity-80">
        Wir schicken Ihnen einen Anmeldelink per E-Mail — ohne Passwort. Haben Sie noch kein Konto,
        wird es dabei angelegt.
      </p>
      <AnmeldeForm />
    </main>
  );
}
