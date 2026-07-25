import { NextResponse } from "next/server";
import { createEnrichmentFromForm } from "@/lib/analysis/enrich";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData();
  const result = await createEnrichmentFromForm(id, formData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
