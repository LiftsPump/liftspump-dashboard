export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Direct routine creation disabled. Use /api/admin/trainer/routine/import instead." },
    { status: 405 }
  );
}
