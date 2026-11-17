import { NextResponse } from "next/server";
import { getDb } from "@gaps/db";
import { errorResponse } from "@/server/api";
import { requireDevTools } from "@/server/dev-tools";
import { resumePreviewLesson } from "@/server/open-topic/dev-preview";
import { isOpenLessonId } from "@/server/open-topic/session";

/** Developer preview: resume the synthetic learner's lesson (also the retry after a provider failure). */
export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    await requireDevTools(req);
    const { lessonId } = await params;
    if (!isOpenLessonId(lessonId)) {
      return NextResponse.json(
        { error: { code: "LESSON_NOT_FOUND", message: "This lesson could not be found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(await resumePreviewLesson(lessonId, getDb()));
  } catch (err) {
    return errorResponse(err);
  }
}
