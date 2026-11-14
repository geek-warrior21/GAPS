import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { startOrResumeLessonSession } from "@/server/lesson/service";

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const { lessonId } = await params;
    const sessionData = await startOrResumeLessonSession(principal.userId, lessonId);
    return NextResponse.json(sessionData, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
