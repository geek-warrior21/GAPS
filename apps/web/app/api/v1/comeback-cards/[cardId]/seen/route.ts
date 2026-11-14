import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { createStudentRepo, getDb } from "@gaps/db";

export async function POST(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const { cardId } = await params;
    const studentRepo = createStudentRepo(principal.userId, getDb());
    await studentRepo.markComebackCardSeen(cardId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
