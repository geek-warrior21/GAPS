import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getGapMapData } from "@/server/session/engine";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student", "teacher", "staff_admin"]);
    // If student, use their own userId. If query param studentId is provided and caller is teacher/admin, allow it.
    let targetStudentId = principal.userId;
    const url = new URL(req.url);
    const queryStudentId = url.searchParams.get("studentId");
    if (queryStudentId && (principal.role === "teacher" || principal.role === "staff_admin")) {
      targetStudentId = queryStudentId;
    }

    const gapMap = await getGapMapData(targetStudentId);
    return NextResponse.json(gapMap);
  } catch (err) {
    return errorResponse(err);
  }
}
