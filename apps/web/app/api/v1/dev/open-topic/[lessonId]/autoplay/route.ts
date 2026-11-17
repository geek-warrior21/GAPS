import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@gaps/db";
import { errorResponse } from "@/server/api";
import { requireDevTools } from "@/server/dev-tools";
import { autoplayPreviewLesson } from "@/server/open-topic/dev-preview";
import { isOpenLessonId } from "@/server/open-topic/session";

const AutoplaySchema = z.object({ profile: z.enum(["succeeding", "struggling"]) });

/** Developer preview: let a scripted synthetic learner play the stored lesson. */
export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    await requireDevTools(req);
    const { lessonId } = await params;
    const parsed = AutoplaySchema.safeParse(await req.json().catch(() => null));
    if (!isOpenLessonId(lessonId) || !parsed.success) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: "profile must be succeeding or struggling" },
        },
        { status: 400 },
      );
    }
    return NextResponse.json(await autoplayPreviewLesson(lessonId, parsed.data.profile, getDb()));
  } catch (err) {
    return errorResponse(err);
  }
}
