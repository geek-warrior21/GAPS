import { MISCONCEPTIONS } from "@gaps/content";
import type { MisconceptionId } from "@gaps/domain";
import type { TutorActionType, VisualSpecDto } from "@gaps/contracts";
import type { TutorContext } from "./context";
import { richTextToPlainText } from "./context";

export interface PolicyDecision {
  readonly text: string;
  readonly actionType: TutorActionType;
  readonly visual?: VisualSpecDto;
  readonly newHintsCount?: number;
}

export function determineDeterministicTutorReply(
  context: TutorContext,
  rawIntent?: string,
  userMessage?: string,
): PolicyDecision {
  const normalizedMsg = (userMessage ?? "").toLowerCase().trim();
  let intent = rawIntent;

  // Infer intent if free_text or unspecified
  if (!intent || intent === "free_text") {
    if (
      normalizedMsg.includes("hint") ||
      normalizedMsg.includes("don't understand") ||
      normalizedMsg.includes("dont understand") ||
      normalizedMsg.includes("stuck") ||
      normalizedMsg.includes("help")
    ) {
      intent = "hint";
    } else if (
      normalizedMsg.includes("why") &&
      (normalizedMsg.includes("wrong") ||
        normalizedMsg.includes("incorrect") ||
        normalizedMsg.includes("not yet"))
    ) {
      intent = "why_incorrect";
    } else if (
      normalizedMsg.includes("explain") ||
      normalizedMsg.includes("mean") ||
      normalizedMsg.includes("differently")
    ) {
      intent = "explain";
    } else if (normalizedMsg.includes("example")) {
      intent = "example";
    } else if (
      normalizedMsg.includes("visual") ||
      normalizedMsg.includes("picture") ||
      normalizedMsg.includes("draw") ||
      normalizedMsg.includes("show")
    ) {
      intent = "visual";
    } else if (normalizedMsg.includes("denominator")) {
      return {
        text: "The denominator is the bottom number of a fraction. It tells us into how many equal parts the whole roti or object is divided.",
        actionType: "clarification",
      };
    } else if (normalizedMsg.includes("numerator")) {
      return {
        text: "The numerator is the top number of a fraction. It tells us how many of those equal parts we are counting or taking.",
        actionType: "clarification",
      };
    } else if (
      normalizedMsg.includes("weather") ||
      normalizedMsg.includes("cricket score") ||
      normalizedMsg.includes("movie") ||
      normalizedMsg.includes("game")
    ) {
      return {
        text: "Let's stay focused on our maths problem together. Would you like a hint or a visual model to help with this question?",
        actionType: "off_topic",
      };
    }
  }

  // 1. Hint Intent
  if (intent === "hint") {
    const hints = context.currentQuestion?.hints ?? [];
    const currentRung = context.revealedHintsCount;

    if (hints.length > 0 && currentRung < hints.length) {
      const hintObj = hints[currentRung];
      const hintText = richTextToPlainText(hintObj);
      return {
        text: hintText || "Look carefully at the parts and what the question is asking for.",
        actionType: "hint",
        newHintsCount: currentRung + 1,
      };
    }

    if (context.currentQuestion?.workedExample) {
      return {
        text:
          "Here is a worked example with similar numbers:\n" +
          richTextToPlainText(context.currentQuestion.workedExample),
        actionType: "example",
      };
    }

    return {
      text: "Think about the total number of equal parts and how many are being selected. You can do this!",
      actionType: "hint",
    };
  }

  // 2. Why Incorrect Intent
  if (intent === "why_incorrect") {
    if (context.activeMisconceptions.length > 0) {
      const miscId = context.activeMisconceptions[0] as MisconceptionId;
      const miscDef = MISCONCEPTIONS.find((m) => m.id === miscId);
      if (miscDef?.studentFeedback) {
        return {
          text: miscDef.studentFeedback,
          actionType: "clarification",
        };
      }
    }

    const latestAttempt = context.recentAttempts[0];
    if (latestAttempt && latestAttempt.outcome !== "correct") {
      return {
        text: "Not quite yet! Double-check how many equal parts make the whole, and make sure your fraction is simplified if needed.",
        actionType: "clarification",
      };
    }

    return {
      text: "You haven't submitted an attempt on this question yet. Give it a try on the AnswerPad!",
      actionType: "encouragement",
    };
  }

  // 3. Explain Intent
  if (intent === "explain") {
    // Prefer everyday explanation with Indian contexts
    const everydayExp = context.explanations.everyday;
    if (everydayExp) {
      return {
        text: everydayExp,
        actionType: "explain",
      };
    }
    const pictureExp = context.explanations.picture;
    if (pictureExp) {
      return {
        text: pictureExp,
        actionType: "explain",
      };
    }
    return {
      text: `In ${context.conceptTitle}, remember that fractions always represent equal parts of a whole item, like sharing a round roti or a plate of laddoos.`,
      actionType: "explain",
    };
  }

  // 4. Example Intent
  if (intent === "example") {
    if (context.currentQuestion?.workedExample) {
      return {
        text: richTextToPlainText(context.currentQuestion.workedExample),
        actionType: "example",
      };
    }
    return {
      text: "Suppose we divide a roti into 4 equal slices and eat 1 slice. We have eaten 1/4 of the roti, and 3/4 remains.",
      actionType: "example",
    };
  }

  // 5. Visual Intent
  if (intent === "visual") {
    if (context.currentQuestion?.visual) {
      return {
        text: "Here is a visual model showing this question:",
        actionType: "visual",
        visual: context.currentQuestion.visual,
      };
    }

    // Default fraction bar visual model
    const visualModel: VisualSpecDto = {
      type: "fraction_bar",
      bars: [
        {
          parts: 4,
          shaded: 2,
          label: "Visual fraction model (2/4)",
        },
      ],
    };

    return {
      text: "Take a look at this fraction bar to see how equal parts make up the whole:",
      actionType: "visual",
      visual: visualModel,
    };
  }

  // Default Socratic / Encouraging response
  return {
    text: `Take a look at what the question is asking in ${context.conceptTitle}. What do you think is the first step?`,
    actionType: "clarification",
  };
}
