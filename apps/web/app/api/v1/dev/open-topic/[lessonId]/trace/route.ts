import { NextResponse } from "next/server";
import { getDb } from "@gaps/db";
import { errorResponse } from "@/server/api";
import { requireDevTools } from "@/server/dev-tools";
import { getPreviewTrace } from "@/server/open-topic/dev-preview";
import { isOpenLessonId } from "@/server/open-topic/session";

/** Developer preview: decisions, answer keys and model rationale for a stored lesson. */
export async function GET(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    await requireDevTools(req);
    const { lessonId } = await params;
    const trace = isOpenLessonId(lessonId) ? await getPreviewTrace(lessonId, getDb()) : null;
    if (!trace) {
      return NextResponse.json(
        { error: { code: "LESSON_NOT_FOUND", message: "This lesson could not be found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(trace);
  } catch (err) {
    return errorResponse(err);
  }
}
