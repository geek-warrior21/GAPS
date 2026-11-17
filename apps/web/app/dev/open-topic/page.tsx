import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { canUseDevTools } from "@/server/dev-tools";
import { OpenTopicPreviewClient } from "./OpenTopicPreviewClient";

// Decided per request on the server: never prerendered, never cached.
export const dynamic = "force-dynamic";

/**
 * Developer preview of open-topic teaching with a synthetic learner.
 * Unavailable in production; elsewhere it needs DEV_TOOLS_ENABLED=true and a
 * staff-admin session. Everyone else gets the ordinary not-found page.
 */
export default async function OpenTopicPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const sessionToken = (await cookies()).get("gaps_session")?.value;
  if (!(await canUseDevTools(sessionToken))) {
    notFound();
  }
  const { lesson } = await searchParams;
  return <OpenTopicPreviewClient initialLessonId={lesson?.startsWith("open-") ? lesson : null} />;
}
