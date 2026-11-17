import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getCurriculumTopicsOverview } from "@/server/lesson/service";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student", "teacher", "staff_admin"]);
    const overview = await getCurriculumTopicsOverview(
      principal.role === "student" ? principal.userId : undefined,
    );
    return NextResponse.json(overview);
  } catch (err) {
    return errorResponse(err);
  }
}
