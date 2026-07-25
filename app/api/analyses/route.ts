import { NextResponse } from "next/server";
import { createAnalysisFromForm } from "@/lib/analysis/create";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await createAnalysisFromForm(formData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
