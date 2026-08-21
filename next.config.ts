import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Die alten Nutzungsbedingungen sind durch die AGB ersetzt. Zwei
        // konkurrierende Vertragsdokumente nebeneinander sind ein
        // vermeidbares Risiko – im Streitfall wäre offen, welches gilt.
        // Dauerhafte Weiterleitung, damit bestehende Verweise nicht ins
        // Leere laufen.
        source: "/nutzungsbedingungen",
        destination: "/agb",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
