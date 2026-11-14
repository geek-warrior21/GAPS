import { NextResponse } from "next/server";
import { RecordConsentRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { and, consentRecords, createTeacherRepo, eq, getDb, users } from "@gaps/db";

export async function POST(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
    const principal = await requirePrincipal(req, ["teacher", "staff_admin"]);
    const db = getDb();

    if (principal.role === "teacher") {
      const teacherRepo = createTeacherRepo(principal.userId, db);
      const isAssigned = await teacherRepo.isAssignedToStudent(studentId);
      if (!isAssigned) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Not assigned to this student" } },
          { status: 403 },
        );
      }
    }

    // Verify student exists
    const [student] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "student")))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Student not found" } },
        { status: 404 },
      );
    }

    const body: unknown = await req.json();
    const parsed = RecordConsentRequestSchema.parse(body);

    const consentId = `con_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const [record] = await db
      .insert(consentRecords)
      .values({
        id: consentId,
        studentId,
        scope: parsed.scope,
        method: parsed.method,
        evidenceRef: parsed.evidenceRef,
        recordedBy: principal.userId,
        grantedAt: new Date(),
      })
      .returning();

    // If core_learning consent granted, promote student status from pending_consent to active
    if (parsed.scope === "core_learning" && student.status === "pending_consent") {
      await db.update(users).set({ status: "active" }).where(eq(users.id, studentId));
    }

    return NextResponse.json({ consent: record }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
