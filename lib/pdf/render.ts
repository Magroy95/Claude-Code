import { chromium } from "playwright";

const EXECUTABLE_PATH = "/opt/pw-browsers/chromium";

export async function renderPdfFromUrl(url: string): Promise<Buffer> {
  const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH });
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
