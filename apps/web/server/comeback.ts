import messages from "../messages/en.json";
import type { ComebackCardData } from "@gaps/domain";

/**
 * Render structured ComebackCardData into localized student-facing copy
 * using templates from apps/web/messages/en.json.
 */
export function renderComebackMessage(
  card: ComebackCardData,
  msgSource: typeof messages = messages,
): string {
  const key = card.messageKey.replace("comeback.", "") as "singleDay" | "multiDay" | "retention";
  const template = msgSource.comeback[key];
  return template
    .replace("{pastDate}", card.copyParams.pastDate)
    .replace("{pastCorrect}", String(card.copyParams.pastCorrect))
    .replace("{pastTotal}", String(card.copyParams.pastTotal))
    .replace("{studentTitle}", card.copyParams.studentTitle)
    .replace("{presentCorrect}", String(card.copyParams.presentCorrect));
}
