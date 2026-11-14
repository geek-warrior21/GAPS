import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api";
import { requirePrincipal } from "@/server/auth/guard";
import { getChapterBosses } from "@/server/session/engine";

export async function GET(req: Request) {
  try {
    const principal = await requirePrincipal(req, ["student"]);
    const bosses = await getChapterBosses(principal.userId);
    return NextResponse.json({ bosses });
  } catch (err) {
    return errorResponse(err);
  }
}
