import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req);
    return NextResponse.json({
      user: {
        id: principal.userId,
        role: principal.role,
        displayName: principal.displayName,
        username: principal.username,
        email: principal.email,
        orgId: principal.orgId,
        cohortId: principal.cohortId,
        cohortName: principal.cohortName,
        status: principal.status,
        consents: principal.consents,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
