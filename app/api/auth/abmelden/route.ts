import { NextResponse } from "next/server";
import { meldeAb } from "@/lib/auth/session";

export async function POST() {
  await meldeAb();
  return NextResponse.json({ ok: true });
}
