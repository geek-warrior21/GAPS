import type { LessonPlan } from "@gaps/contracts";

export const SCI_CONDUCTORS_LESSON: LessonPlan = {
  lessonId: "lesson-sci-conductors-1",
  version: "1.0",
  subject: "science",
  level: 6,
  topicId: "sci-elec-conductors",
  title: "Conductors & Insulators: Testing Materials",
  description:
    "Test different materials in an electric circuit to discover which allow electric current to pass through (conductors) and which block it (insulators).",
  learningObjectives: [
    "Differentiate between electrical conductors and electrical insulators",
    "Identify common metals as conductors and plastics/rubbers as insulators",
    "Predict circuit behaviour when different objects bridge a gap",
  ],
  activities: [
    {
      id: "act_1_intro",
      type: "intro",
      title: "Real-World Context: Why Are Wires Coated in Plastic?",
      instructions: "Observe everyday electrical cords.",
      config: {
        type: "intro",
        headline: "The Metal Core and the Plastic Skin",
        body: "Look closely at any electric cord at home. Inside is shiny copper metal, but on the outside is flexible plastic. Why? Copper is a conductor—it allows current to flow freely. Plastic is an insulator—it stops electric current from escaping and shocking our hands!",
        hookQuestion:
          "What happens if we insert a copper key vs a rubber eraser into a circuit gap?",
      },
    },
    {
      id: "act_2_predict",
      type: "predict_and_observe",
      title: "Predict & Observe: Testing a Copper Key",
      instructions: "Predict whether a metal copper key will complete the circuit.",
      config: {
        type: "predict_and_observe",
        prompt:
          "If a copper metal key is placed in the gap of an open circuit with the switch closed, will the bulb light up?",
        predictionChoices: [
          {
            id: "choice_key_glow",
            text: "Yes, copper is a metal conductor and will complete the loop.",
            isExpected: true,
          },
          {
            id: "choice_key_dark",
            text: "No, only wires can conduct electricity.",
          },
        ],
        simulation: {
          simulationKind: "circuit_loop",
          initialSwitchState: "closed",
          initialWireConnected: true,
          hasBattery: true,
          hasBulb: true,
          conductiveObject: "copper_key",
          instruction: "Observe how current flows through the copper key to light the bulb.",
        },
        observationReveal: {
          expectedObservation:
            "The bulb lights up brightly because copper is an excellent electrical conductor.",
          explanation:
            "Metals have free electrons that drift easily under electrical voltage, completing the circuit path.",
        },
      },
    },
    {
      id: "act_3_check",
      type: "independent_check",
      title: "Independent Check: Conductor or Insulator?",
      instructions: "Classify materials based on electrical conductivity.",
      config: {
        type: "independent_check",
        conceptId: "SCI-ELEC-CONDUCTORS",
        prompt: "Which of the following objects is an electrical insulator?",
        questionType: "choice",
        choices: [
          { id: "choice_iron_nail", text: "An iron nail" },
          { id: "choice_rubber_eraser", text: "A rubber eraser" },
          { id: "choice_copper_coin", text: "A copper coin" },
          { id: "choice_aluminum_foil", text: "Aluminum foil" },
        ],
        correctAnswer: "choice_rubber_eraser",
        explanation:
          "Rubber is an electrical insulator that does not allow electric charges to flow freely. Iron, copper, and aluminum are metals and electrical conductors.",
      },
    },
  ],
};
