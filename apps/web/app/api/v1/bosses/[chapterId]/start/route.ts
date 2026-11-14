import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { startBossBattle } from "@/server/session/engine";

export async function POST(req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const { chapterId } = await params;
    const session = await startBossBattle(principal.userId, chapterId);
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
