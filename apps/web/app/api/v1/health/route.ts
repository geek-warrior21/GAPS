import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const snapshot = await getHealthSnapshot();
  return NextResponse.json(snapshot.body, { status: snapshot.httpStatus });
}
