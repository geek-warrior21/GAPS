import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requireCoreConsent, requirePrincipal } from "@/server/auth/guard";
import { createStudentRepo, getDb } from "@gaps/db";

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    const db = getDb();
    const repo = createStudentRepo(principal.userId, db);
    const session = await repo.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        studentId: session.studentId,
        mode: session.mode,
        focusConceptId: session.focusConceptId,
        status: session.status,
        budgetS: session.budgetS,
        stepSeq: session.stepSeq,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
      },
      step: session.currentStep,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
