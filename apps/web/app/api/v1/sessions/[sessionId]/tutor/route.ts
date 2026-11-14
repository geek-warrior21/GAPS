import { NextResponse } from "next/server";
import { TutorRequestSchema } from "@gaps/contracts";
import { errorResponse } from "@/server/api";
import { requireCoreConsent, requirePrincipal } from "@/server/auth/guard";
import { getTutorHistory, handleTutorTurn } from "@/server/tutor/service";

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    const result = await getTutorHistory(principal.userId, sessionId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const principal = await requirePrincipal(req, ["student"]);
    requireCoreConsent(principal);

    const body: unknown = await req.json();
    const parsed = TutorRequestSchema.parse(body);

    const result = await handleTutorTurn(principal.userId, sessionId, parsed);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
