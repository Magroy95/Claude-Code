import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = siteConfig.defaultTitle;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          // Farbwelt des Reports statt Schwarz: Papier und Ziegelrot.
          background: "#e7e2d2",
          color: "#21201c",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>
          {siteConfig.name}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            lineHeight: 1.4,
            color: "#5b564c",
            maxWidth: 900,
          }}
        >
          Ersteinschätzung zu Substanz, Sanierungskosten und Marktwert – vor
          der Besichtigung, nicht vor dem Notartermin.
        </div>
      </div>
    ),
    { ...size }
  );
}
