import { NextResponse } from "next/server";
import { AddStudentRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import {
  and,
  cohorts,
  createStudentRepo,
  createTeacherRepo,
  eq,
  getDb,
  hashPin,
  users,
} from "@gaps/db";

export async function POST(req: Request, { params }: { params: Promise<{ cohortId: string }> }) {
  try {
    const { cohortId } = await params;
    const principal = await requirePrincipal(req, ["teacher", "staff_admin"]);
    const db = getDb();

    if (principal.role === "teacher") {
      const teacherRepo = createTeacherRepo(principal.userId, db);
      const isAssigned = await teacherRepo.isAssignedToCohort(cohortId);
      if (!isAssigned) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Not assigned to this cohort" } },
          { status: 403 },
        );
      }
    }

    // Verify cohort exists
    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);

    if (!cohort) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Cohort not found" } },
        { status: 404 },
      );
    }

    const body: unknown = await req.json();
    const parsed = AddStudentRequestSchema.parse(body);

    // Check username uniqueness in cohort
    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.cohortId, cohortId), eq(users.username, parsed.username)))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: `Username '${parsed.username}' is already taken in this cohort`,
          },
        },
        { status: 409 },
      );
    }

    const studentId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pinHash = hashPin(parsed.pin);

    const [created] = await db
      .insert(users)
      .values({
        id: studentId,
        role: "student",
        orgId: cohort.orgId,
        cohortId,
        displayName: parsed.displayName,
        username: parsed.username,
        pinHash,
        status: "pending_consent",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create student");
    }

    // Initialize student state
    const studentRepo = createStudentRepo(studentId, db);
    await studentRepo.ensureStudentState({
      focusConceptId: "MATH-FRAC-PART",
      startConceptId: "MATH-FRAC-PART",
    });

    return NextResponse.json(
      {
        student: {
          id: created.id,
          displayName: created.displayName,
          username: created.username,
          status: created.status,
          cohortId: created.cohortId,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
