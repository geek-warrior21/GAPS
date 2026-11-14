import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { createStudentRepo, getDb } from "@gaps/db";

export async function GET(req: Request, { params }: { params: Promise<{ conceptId: string }> }) {
  try {
    const { conceptId } = await params;
    const principal = await requirePrincipal(req, ["student", "teacher", "staff_admin"]);
    const db = getDb();

    let targetStudentId = principal.userId;
    const url = new URL(req.url);
    const queryStudentId = url.searchParams.get("studentId");
    if (queryStudentId && (principal.role === "teacher" || principal.role === "staff_admin")) {
      targetStudentId = queryStudentId;
    }

    const repo = createStudentRepo(targetStudentId, db);
    const belief = await repo.getConceptBelief(conceptId);
    const allAttempts = await repo.getAllAttempts();

    const conceptAttempts = allAttempts
      .filter((a) => a.conceptId === conceptId)
      .map((a) => ({
        id: a.id,
        at: a.createdAt.toISOString(),
        outcome: a.outcome,
        assistanceLevel: a.assistanceLevel,
        tryNo: a.tryNo,
        rawAnswer: a.rawAnswer,
        misconceptionId: a.misconceptionId,
      }));

    return NextResponse.json({
      conceptId,
      status: belief?.status ?? "not_assessed",
      reliability: belief?.reliability ?? "missing",
      demonstratedAt: belief?.demonstratedAt?.toISOString() ?? null,
      retainedAt: belief?.retainedAt?.toISOString() ?? null,
      firstNeedsSupportAt: belief?.firstNeedsSupportAt?.toISOString() ?? null,
      independentN: belief?.independentN ?? 0,
      independentCorrectN: belief?.independentCorrectN ?? 0,
      attempts: conceptAttempts,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
