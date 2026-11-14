import { describe, expect, it } from "vitest";
import { checkAnswerLeak, countWords, isWithinWordLimit, scrubPii } from "./guards";

describe("PII Scrubber", () => {
  it("removes email addresses", () => {
    const text = "Contact me at student123@school.edu for notes.";
    expect(scrubPii(text)).toBe("Contact me at [removed] for notes.");
  });

  it("removes Indian mobile numbers and international numbers", () => {
    const text1 = "Call me at +91 9876543210 immediately.";
    expect(scrubPii(text1)).toBe("Call me at [removed] immediately.");

    const text2 = "Phone is 9123456789 or 555-123-4567.";
    expect(scrubPii(text2)).toBe("Phone is [removed] or [removed].");
  });

  it("removes URLs", () => {
    const text = "Look at https://maths-cheats.com/ans and www.google.com";
    expect(scrubPii(text)).toBe("Look at [removed] and [removed]");
  });

  it("removes known roster names", () => {
    const text = "Aarav and Meera Sharma are working together.";
    expect(scrubPii(text, ["Aarav", "Meera Sharma"])).toBe(
      "[removed] and [removed] are working together.",
    );
  });
});

describe("Word count and limits", () => {
  it("accurately counts words", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  one   two  three ")).toBe(3);
  });

  it("validates upper word bound", () => {
    expect(isWithinWordLimit("one two three", 3)).toBe(true);
    expect(isWithinWordLimit("one two three four", 3)).toBe(false);
  });
});

describe("Answer Leak Detector", () => {
  it("detects fraction answer leaks in text", () => {
    expect(checkAnswerLeak("The answer is 3/4 here.", ["3/4"])).toBe(true);
    expect(checkAnswerLeak("Write 3/4 on the answer pad.", ["3/4"])).toBe(true);
  });

  it("detects whole number and decimal leaks", () => {
    expect(checkAnswerLeak("The answer is 12.", ["12"])).toBe(true);
    expect(checkAnswerLeak("It is 0.75.", ["0.75"])).toBe(true);
  });

  it("does not trigger false positive on unrelated numbers", () => {
    expect(checkAnswerLeak("Divide into 4 equal slices.", ["3/4"])).toBe(false);
    expect(checkAnswerLeak("There are 12 items in chapter 2.", ["5"])).toBe(false);
  });

  it("handles empty forbidden set gracefully", () => {
    expect(checkAnswerLeak("The answer is 3/4.", [])).toBe(false);
  });
});
