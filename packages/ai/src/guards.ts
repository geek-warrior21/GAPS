const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?91[\s-]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const URL_REGEX = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;

/**
 * Scrubs personally identifiable information (PII) including phone numbers,
 * email addresses, URLs, and known user/student display names from text.
 * SPEC §21: "phone numbers, emails, URLs, and every display name and username
 * in the student's school, replaced with [removed]."
 */
export function scrubPii(text: string, knownNames: readonly string[] = []): string {
  let result = text
    .replace(EMAIL_REGEX, "[removed]")
    .replace(PHONE_REGEX, "[removed]")
    .replace(URL_REGEX, "[removed]");

  for (const name of knownNames) {
    if (!name || name.trim().length < 2) continue;
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(nameRegex, "[removed]");
  }

  return result;
}

/**
 * Counts words in a string.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Checks if text is within an upper word bound.
 */
export function isWithinWordLimit(text: string, maxWords: number): boolean {
  return countWords(text) <= maxWords;
}

function normalizeAnswerToken(raw: string): string {
  return raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\u00f7/g, "/")
    .replace(/\u2044/g, "/")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Extracts numbers, fractions, mixed numbers and decimals from text to detect
 * answer leaks. If any token equals a forbidden answer, returns true (leak detected).
 * SPEC §21: "Answer leak: extract every number and fraction in the output...
 * If any equals the current item's answer... reject."
 */
export function checkAnswerLeak(text: string, forbiddenAnswers: readonly string[]): boolean {
  if (forbiddenAnswers.length === 0) return false;

  const normalizedForbidden = new Set(
    forbiddenAnswers.map((ans) => normalizeAnswerToken(ans)).filter((ans) => ans.length > 0),
  );

  if (normalizedForbidden.size === 0) return false;

  const normalizedText = normalizeAnswerToken(text);

  // Direct substring check for exact answers (e.g. "3/4", "5", "0.75")
  for (const ans of normalizedForbidden) {
    // Check with word boundaries or non-digit boundaries
    const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`);
    if (regex.test(normalizedText)) {
      return true;
    }
  }

  // Extract explicit fraction and number patterns: e.g. "3/4", "1 1/2", "0.25", "42"
  const tokens = normalizedText.match(/\b\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?\b/g) ?? [];
  for (const token of tokens) {
    if (normalizedForbidden.has(token)) {
      return true;
    }
  }

  return false;
}
