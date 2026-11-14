import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requireCoreConsent, requirePrincipal } from "@/server/auth/guard";
import { advanceLearningSessionStep } from "@/server/session/engine";

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    const result = await advanceLearningSessionStep(principal.userId, sessionId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
