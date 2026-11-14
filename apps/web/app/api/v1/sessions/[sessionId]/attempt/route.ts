import { NextResponse } from "next/server";
import { SubmitAttemptRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { requireCoreConsent, requirePrincipal } from "@/server/auth/guard";
import { processSessionAttempt } from "@/server/session/engine";

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    const body: unknown = await req.json();
    const parsed = SubmitAttemptRequestSchema.parse(body);

    const result = await processSessionAttempt(principal.userId, sessionId, parsed);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
