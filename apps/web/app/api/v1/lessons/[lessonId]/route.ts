import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getLessonSession } from "@/server/lesson/service";

export async function GET(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const { lessonId } = await params;
    const sessionData = await getLessonSession(principal.userId, lessonId);
    return NextResponse.json(sessionData);
  } catch (err) {
    return errorResponse(err);
  }
}
