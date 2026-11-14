import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getDailyQuest } from "@/server/session/engine";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const quest = await getDailyQuest(principal.userId);
    return NextResponse.json({ quest });
  } catch (err) {
    return errorResponse(err);
  }
}
