// PDF-Erzeugung: Die Reportseite wird von einem Browser aufgerufen und
// gedruckt.
//
// Bewusst kein zweites Template: Was im Browser steht, steht auch im PDF –
// zwei getrennte Vorlagen würden mit der Zeit auseinanderlaufen, und der
// Unterschied fiele erst dem Kunden auf.
//
// Der Browser kommt je nach Umgebung aus zwei Quellen. Lokal liegt ein
// vollständiges Chromium vor. In einer Netlify-Funktion gibt es das nicht:
// Dort läuft der Code in einer Lambda ohne Systembrowser, und ein
// vollständiges Playwright-Paket sprengt die Größenbegrenzung. Dafür gibt es
// @sparticuz/chromium – ein für diese Umgebung gebautes, komprimiertes
// Chromium, das zur Laufzeit entpackt wird.

import { chromium } from "playwright-core";
import type { Browser } from "playwright-core";

/** Pfad zu einem lokal installierten Chromium, wenn vorhanden. */
const LOKALER_PFAD = process.env.CHROMIUM_PFAD ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

function inServerlessUmgebung(): boolean {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function starteBrowser(): Promise<Browser> {
  if (!inServerlessUmgebung()) {
    return chromium.launch({ executablePath: LOKALER_PFAD });
  }

  // Erst hier laden: Das Paket entpackt beim Import ein Chromium und hat in
  // der Entwicklungsumgebung nichts verloren.
  const { default: serverlessChromium } = await import("@sparticuz/chromium");
  return chromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: serverlessChromium.args,
    headless: true,
  });
}

export async function renderPdfFromUrl(url: string): Promise<Buffer> {
  const browser = await starteBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    return buffer;
  } finally {
    await browser.close();
  }
}
