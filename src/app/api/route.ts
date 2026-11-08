import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, game: "magical-tea-house-3d" });
}
