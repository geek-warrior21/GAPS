import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { startDailyQuestSession } from "@/server/session/engine";

export async function POST(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const session = await startDailyQuestSession(principal.userId);
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
