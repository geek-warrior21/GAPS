import { NextResponse } from "next/server";
import { ResetPinRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { and, createTeacherRepo, eq, getDb, hashPin, users } from "@gaps/db";

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
    const parsed = ResetPinRequestSchema.parse(body);

    const pinHash = hashPin(parsed.newPin);
    const restoredStatus = student.status === "locked" ? "active" : student.status;

    await db
      .update(users)
      .set({
        pinHash,
        failedLogins: 0,
        lockedUntil: null,
        status: restoredStatus,
      })
      .where(eq(users.id, studentId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
