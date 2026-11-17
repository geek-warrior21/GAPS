import { NextResponse } from "next/server";
import { OpenLessonRequestSchema } from "@gaps/contracts";
import { getDb } from "@gaps/db";
import { errorResponse } from "@/server/api";
import { requireDevTools } from "@/server/dev-tools";
import { createPreviewLesson, getProviderReadiness } from "@/server/open-topic/dev-preview";

/** Developer preview: whether a model provider is configured (no secrets returned). */
export async function GET(req: Request) {
  try {
    await requireDevTools(req);
    return NextResponse.json(getProviderReadiness());
  } catch (err) {
    return errorResponse(err);
  }
}

/** Developer preview: start an open-topic lesson for the synthetic learner. */
export async function POST(req: Request) {
  try {
    const principal = await requireDevTools(req);
    const parsed = OpenLessonRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Enter a topic (2 to 120 characters) and a class from 6 to 8.",
          },
        },
        { status: 400 },
      );
    }
    const result = await createPreviewLesson(parsed.data, getDb(), principal.orgId);
    return NextResponse.json(result, { status: result.status === "ready" ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
