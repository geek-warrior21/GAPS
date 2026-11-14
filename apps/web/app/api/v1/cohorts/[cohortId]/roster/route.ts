import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import {
  and,
  conceptBeliefs,
  consentRecords,
  createTeacherRepo,
  eq,
  getDb,
  inArray,
  isNull,
  sql,
  studentState,
  users,
} from "@gaps/db";

export async function GET(req: Request, { params }: { params: Promise<{ cohortId: string }> }) {
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

    // Fetch students in cohort
    const students = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        status: users.status,
        sparksTotal: studentState.sparksTotal,
      })
      .from(users)
      .leftJoin(studentState, eq(users.id, studentState.studentId))
      .where(and(eq(users.cohortId, cohortId), eq(users.role, "student"), isNull(users.deletedAt)));

    if (students.length === 0) {
      return NextResponse.json({ roster: [] });
    }

    const studentIds = students.map((s) => s.id);

    // Fetch active consents for these students
    const activeConsents = await db
      .select({
        studentId: consentRecords.studentId,
        scope: consentRecords.scope,
      })
      .from(consentRecords)
      .where(and(inArray(consentRecords.studentId, studentIds), isNull(consentRecords.revokedAt)));

    const consentMap = new Map<string, Set<string>>();
    for (const c of activeConsents) {
      if (!consentMap.has(c.studentId)) {
        consentMap.set(c.studentId, new Set());
      }
      consentMap.get(c.studentId)!.add(c.scope);
    }

    // Fetch demonstrated beliefs count
    const demonstratedBeliefs = await db
      .select({
        studentId: conceptBeliefs.studentId,
      })
      .from(conceptBeliefs)
      .where(
        and(
          inArray(conceptBeliefs.studentId, studentIds),
          sql`${conceptBeliefs.status} IN ('demonstrated', 'retained')`,
        ),
      );

    const demonstratedCountMap = new Map<string, number>();
    for (const b of demonstratedBeliefs) {
      demonstratedCountMap.set(b.studentId, (demonstratedCountMap.get(b.studentId) ?? 0) + 1);
    }

    const roster = students.map((s) => {
      const studentConsents = consentMap.get(s.id) ?? new Set();
      return {
        id: s.id,
        displayName: s.displayName,
        username: s.username ?? "",
        status: s.status,
        hasCoreConsent: studentConsents.has("core_learning"),
        hasAiConsent: studentConsents.has("ai_free_text"),
        sparksTotal: s.sparksTotal ?? 0,
        demonstratedCount: demonstratedCountMap.get(s.id) ?? 0,
      };
    });

    return NextResponse.json({ roster });
  } catch (err) {
    return errorResponse(err);
  }
}
