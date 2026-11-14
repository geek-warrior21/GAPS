import { describe, expect, it } from "vitest";
import { LessonPlanSchema, CurriculumTopicsResponseSchema, type LessonPlan } from "./lesson";

describe("Lesson Contracts & Validation", () => {
  const validMathLesson: LessonPlan = {
    lessonId: "lesson-maths-frac-part-1",
    version: "1.0",
    subject: "maths",
    level: 6,
    topicId: "maths-frac-part",
    title: "Fractions: Parts of a Whole",
    description: "Understand numerator and denominator as equal parts of a whole.",
    learningObjectives: [
      "Identify equal shares",
      "Manipulate fraction strips",
      "Connect shaded parts to fraction notation",
    ],
    activities: [
      {
        id: "act_1_intro",
        type: "intro",
        title: "Sharing Fairly",
        instructions: "Read the story below",
        config: {
          type: "intro",
          headline: "Sharing Chapatis",
          body: "Imagine sharing 1 whole chapati equally among friends.",
          hookQuestion: "How do we write each share?",
        },
      },
      {
        id: "act_2_explore",
        type: "interactive_manipulation",
        title: "Fraction Strip Sandbox",
        instructions: "Adjust parts and shaded count",
        config: {
          type: "interactive_manipulation",
          simulation: {
            simulationKind: "fraction_strip",
            initialParts: 4,
            initialShaded: 1,
            allowChangeParts: true,
            allowChangeShaded: true,
            minParts: 1,
            maxParts: 12,
            instruction: "Slide to change parts",
          },
        },
      },
      {
        id: "act_3_predict",
        type: "predict_and_observe",
        title: "Predicting Slices",
        instructions: "Make a prediction first, then test in the simulator",
        config: {
          type: "predict_and_observe",
          prompt: "If we slice into 4 parts and shade 3, what fraction is that?",
          predictionChoices: [
            { id: "c1", text: "1/4" },
            { id: "c2", text: "3/4", isExpected: true },
            { id: "c3", text: "4/3" },
          ],
          simulation: {
            simulationKind: "fraction_strip",
            initialParts: 4,
            initialShaded: 1,
            allowChangeParts: true,
            allowChangeShaded: true,
            minParts: 1,
            maxParts: 12,
            instruction: "Set to 4 parts and shade 3",
          },
          observationReveal: {
            expectedObservation: "3 out of 4 parts are shaded",
            explanation: "The denominator 4 shows total parts; numerator 3 shows shaded parts.",
          },
        },
      },
      {
        id: "act_4_guided",
        type: "guided_practice",
        title: "Make 2/5",
        instructions: "Model the fraction 2/5",
        config: {
          type: "guided_practice",
          prompt: "Adjust the strip to represent 2/5",
          targetCriteria: {
            property: "parts_shaded",
            expectedValue: "2/5",
          },
          successFeedback: "Spot on! 2 out of 5 parts are shaded.",
          retryFeedback: "Not yet. Make sure total parts is 5 and shaded is 2.",
        },
      },
      {
        id: "act_5_check",
        type: "independent_check",
        title: "Check Your Understanding",
        instructions: "Answer independently",
        config: {
          type: "independent_check",
          conceptId: "MATH-FRAC-PART",
          prompt: "A shape is split into 6 equal parts. 5 parts are shaded. What is the fraction?",
          questionType: "choice",
          choices: [
            { id: "a", text: "5/6" },
            { id: "b", text: "1/6" },
            { id: "c", text: "6/5" },
          ],
          correctAnswer: "a",
          explanation: "5 shaded parts out of 6 equal parts is 5/6.",
        },
      },
    ],
  };

  it("validates a well-formed Maths fraction lesson plan", () => {
    const parsed = LessonPlanSchema.safeParse(validMathLesson);
    expect(parsed.success).toBe(true);
  });

  it("validates a well-formed Science simple circuits lesson plan", () => {
    const scienceLesson: LessonPlan = {
      lessonId: "lesson-sci-circuits-1",
      version: "1.0",
      subject: "science",
      level: 6,
      topicId: "sci-elec-circuits",
      title: "Electric Current and Simple Circuits",
      description: "Explore complete loops and switches in simple circuits.",
      learningObjectives: [
        "Explain complete circuit loops",
        "Demonstrate how switches break or close circuits",
      ],
      activities: [
        {
          id: "act_1_intro",
          type: "intro",
          title: "Torch Mystery",
          instructions: "Think about how a torch works",
          config: {
            type: "intro",
            headline: "Lighting the Torch",
            body: "Pressing the switch turns on the bulb. How does electricity get there?",
          },
        },
        {
          id: "act_2_explore",
          type: "interactive_manipulation",
          title: "Circuit Sandbox",
          instructions: "Flip the switch and observe current",
          config: {
            type: "interactive_manipulation",
            simulation: {
              simulationKind: "circuit_loop",
              initialSwitchState: "open",
              initialWireConnected: true,
              hasBattery: true,
              hasBulb: true,
              conductiveObject: "none",
              instruction: "Click the switch to open or close the loop",
            },
          },
        },
      ],
    };

    const parsed = LessonPlanSchema.safeParse(scienceLesson);
    expect(parsed.success).toBe(true);
  });

  it("rejects lessons with fewer than 2 activities", () => {
    const invalid = {
      ...validMathLesson,
      activities: [validMathLesson.activities[0]],
    };
    const parsed = LessonPlanSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid activity configurations or mismatched discriminator types", () => {
    const invalidActivity = {
      ...validMathLesson,
      activities: [
        validMathLesson.activities[0],
        {
          id: "bad_act",
          type: "intro",
          title: "Bad",
          instructions: "None",
          config: {
            type: "interactive_manipulation", // Mismatch with activity type
            simulation: {
              simulationKind: "unknown_simulation",
            },
          },
        },
      ],
    };
    const parsed = LessonPlanSchema.safeParse(invalidActivity);
    expect(parsed.success).toBe(false);
  });

  it("validates curriculum topic catalog schema", () => {
    const catalog = {
      topics: [
        {
          id: "maths-frac-part",
          subject: "maths",
          level: 6,
          title: "Parts of a Whole",
          studentTitle: "Parts of a whole",
          description: "Understanding equal pieces and fractions",
          defaultLessonId: "lesson-maths-frac-part-1",
          conceptId: "MATH-FRAC-PART",
          strand: "fractions",
        },
        {
          id: "sci-elec-circuits",
          subject: "science",
          level: 6,
          title: "Simple Circuits",
          studentTitle: "Simple circuits",
          description: "Complete loops, batteries, bulbs and switches",
          defaultLessonId: "lesson-sci-circuits-1",
          strand: "electricity",
        },
      ],
    };

    const parsed = CurriculumTopicsResponseSchema.safeParse(catalog);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.topics).toHaveLength(2);
    }
  });
});
