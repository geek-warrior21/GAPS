import type { LessonPlan } from "@gaps/contracts";

export const MATHS_FRAC_PART_LESSON: LessonPlan = {
  lessonId: "lesson-maths-frac-part-1",
  version: "1.0",
  subject: "maths",
  level: 6,
  topicId: "maths-frac-part",
  title: "Fractions: Fair Shares & Parts of a Whole",
  description:
    "Explore how fractions represent equal parts of a whole shape. Manipulate fraction strips, test slice predictions, and verify your understanding.",
  learningObjectives: [
    "Understand that fractions describe equal shares of a single whole",
    "Identify the denominator as the total number of equal parts",
    "Identify the numerator as the count of selected or shaded parts",
    "Accurately read and write fractions from visual fraction strips",
  ],
  activities: [
    {
      id: "act_1_intro",
      type: "intro",
      title: "Real-World Context: Sharing Fairly",
      instructions: "Read the story to see why equal parts matter.",
      config: {
        type: "intro",
        headline: "The Chapati Sharing Problem",
        body: "Three friends—Priya, Rahul, and Amit—are sharing lunch. They have 1 warm, round chapati. If Priya cuts it into 3 unequal chunks, Rahul might complain that his piece is too small! To be completely fair, every piece must be exactly the same size. In mathematics, when 1 whole is divided into equal parts, each piece is a fraction.",
        hookQuestion: "How do we write the number for taking 2 equal pieces out of 3?",
      },
    },
    {
      id: "act_2_manipulation",
      type: "interactive_manipulation",
      title: "Interactive Sandbox: The Fraction Strip Slicer",
      instructions:
        "Use the sliders and buttons to slice the strip into different numbers of parts and shade them.",
      config: {
        type: "interactive_manipulation",
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 4,
          initialShaded: 2,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 1,
          maxParts: 12,
          targetFraction: { n: 2, d: 4 },
          instruction:
            "Try changing total parts from 2 up to 10. Notice how more parts make each individual slice narrower!",
        },
      },
    },
    {
      id: "act_3_predict",
      type: "predict_and_observe",
      title: "Predict & Observe: What Fraction Is Shaded?",
      instructions: "Make your prediction first, then use the simulator to verify.",
      config: {
        type: "predict_and_observe",
        prompt:
          "If we slice a whole strip into 4 equal pieces and color 3 of them blue, what fraction of the whole strip is colored?",
        predictionChoices: [
          { id: "choice_1_4", text: "1/4 (one-fourth)" },
          { id: "choice_3_4", text: "3/4 (three-fourths)", isExpected: true },
          { id: "choice_4_3", text: "4/3 (four-thirds)" },
          { id: "choice_3_1", text: "3/1 (three wholes)" },
        ],
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 4,
          initialShaded: 1,
          allowChangeParts: false,
          allowChangeShaded: true,
          minParts: 4,
          maxParts: 4,
          instruction: "Tap the slices to shade exactly 3 parts out of 4.",
        },
        observationReveal: {
          expectedObservation: "3 parts are shaded out of 4 total parts, forming 3/4.",
          explanation:
            "The bottom number (denominator, 4) counts the total equal parts in 1 whole. The top number (numerator, 3) counts the shaded parts we have.",
        },
      },
      remediation: {
        branchId: "branch_maths_predict_remediation",
        triggerCondition: "incorrect_prediction",
        targetedExplanation:
          "Remember: the bottom number (denominator) always tells us how many equal pieces make up 1 whole. Slicing a bar into 4 equal pieces means the bottom number must be 4! Let's explore this on an interactive 4-part bar.",
        remediationActivity: {
          id: "act_3_remediation_sim",
          type: "interactive_manipulation",
          title: "Guided Investigation: Denominator as Equal Parts",
          instructions: "Notice how the denominator stays 4 as you toggle shaded slices.",
          config: {
            type: "interactive_manipulation",
            simulation: {
              simulationKind: "fraction_strip",
              initialParts: 4,
              initialShaded: 2,
              allowChangeParts: false,
              allowChangeShaded: true,
              minParts: 4,
              maxParts: 4,
              instruction: "Notice how the denominator stays 4 as you toggle shaded parts.",
            },
          },
        },
        followUpCheck: {
          id: "act_3_remediation_fresh_check",
          type: "independent_check",
          title: "Fresh Question: Parts of a Whole",
          instructions: "Demonstrate your understanding with this fresh question.",
          config: {
            type: "independent_check",
            prompt:
              "A round roti is divided into 4 equal quarters. Meera eats 1 quarter. What fraction of the roti did Meera eat?",
            questionType: "choice",
            choices: [
              { id: "fresh_1_4", text: "1/4 (one-fourth)" },
              { id: "fresh_4_1", text: "4/1 (four rotis)" },
              { id: "fresh_3_4", text: "3/4 (three-fourths)" },
              { id: "fresh_1_3", text: "1/3 (one-third)" },
            ],
            correctAnswer: "fresh_1_4",
            explanation:
              "The roti is cut into 4 equal parts in total (denominator = 4), and Meera ate 1 part (numerator = 1). Therefore, she ate 1/4.",
          },
        },
        stoppingPoint: {
          id: "act_3_stopping_point",
          type: "stopping_point",
          title: "Pause & Reflect: Parts of a Whole",
          instructions: "Take a breath! Learning fractions takes time and practice.",
          config: {
            type: "stopping_point",
            headline: "Let's Pause & Review Key Ideas",
            body: "Fractions describe equal shares. When you see a fraction like 1/4:\n• The BOTTOM number (denominator) counts the total equal pieces in the whole.\n• The TOP number (numerator) counts the pieces you are focusing on.",
            recommendation:
              "We have recorded your effort. Let's move ahead together with step-by-step guidance.",
            keyTakeaways: [
              "Always count the total equal parts first—that is your denominator.",
              "Then count the shaded or eaten parts—that is your numerator.",
            ],
          },
        },
      },
    },
    {
      id: "act_4_guided",
      type: "guided_practice",
      title: "Guided Practice: Model the Fraction 2/5",
      instructions: "Use the controls to model the fraction 2/5 on the strip.",
      config: {
        type: "guided_practice",
        prompt: "Slice the strip into 5 equal parts, then shade 2 parts.",
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 3,
          initialShaded: 1,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 2,
          maxParts: 8,
          instruction: "Set parts = 5 and shaded = 2.",
        },
        targetCriteria: {
          property: "parts_shaded",
          expectedValue: "2/5",
        },
        successFeedback:
          "Excellent! You divided the whole into 5 equal parts and shaded 2 of them. That is exactly 2/5.",
        retryFeedback:
          "Not yet. Check that you have divided the whole into 5 total equal parts and shaded exactly 2.",
      },
    },
    {
      id: "act_5_check",
      type: "independent_check",
      title: "Independent Check: Check Your Understanding",
      instructions: "Answer independently to demonstrate mastery of parts of a whole.",
      config: {
        type: "independent_check",
        conceptId: "MATH-FRAC-PART",
        prompt:
          "A chocolate bar is divided into 6 equal squares. Kabir eats 5 squares. What fraction of the chocolate bar did Kabir eat?",
        questionType: "choice",
        choices: [
          { id: "choice_a", text: "5/6" },
          { id: "choice_b", text: "1/6" },
          { id: "choice_c", text: "6/5" },
          { id: "choice_d", text: "5/1" },
        ],
        correctAnswer: "choice_a",
        explanation:
          "There are 6 equal parts in total (denominator = 6) and Kabir ate 5 parts (numerator = 5). Therefore, he ate 5/6.",
      },
    },
  ],
};
