import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { canUseDevTools } from "@/server/dev-tools";
import { DevLessonPlannerClient } from "./DevLessonPlannerClient";

// Decided per request on the server: never prerendered, never cached.
export const dynamic = "force-dynamic";

/**
 * Developer-only lesson planner and teaching-engine comparison.
 * Unavailable in production; elsewhere it needs DEV_TOOLS_ENABLED=true and a
 * staff-admin session. Everyone else gets the ordinary not-found page.
 */
export default async function DevLessonPlannerPage() {
  const sessionToken = (await cookies()).get("gaps_session")?.value;
  if (!(await canUseDevTools(sessionToken))) {
    notFound();
  }
  return <DevLessonPlannerClient />;
}
