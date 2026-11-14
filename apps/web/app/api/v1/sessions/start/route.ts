import { NextResponse } from "next/server";
import { StartSessionRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { requireCoreConsent, requirePrincipal } from "@/server/auth/guard";
import { startLearningSession } from "@/server/session/engine";

export async function POST(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed, defaults to learn mode
    }

    const parsed = StartSessionRequestSchema.parse(body);
    const result = await startLearningSession(principal.userId, parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
