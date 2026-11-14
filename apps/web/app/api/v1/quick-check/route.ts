import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { startQuickCheckSession } from "@/server/session/engine";

export async function POST(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const session = await startQuickCheckSession(principal.userId);
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
