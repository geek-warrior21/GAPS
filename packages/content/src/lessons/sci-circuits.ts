import type { LessonPlan } from "@gaps/contracts";

export const SCI_CIRCUITS_LESSON: LessonPlan = {
  lessonId: "lesson-sci-circuits-1",
  version: "1.0",
  subject: "science",
  level: 6,
  topicId: "sci-elec-circuits",
  title: "Electric Current & Simple Circuits",
  description:
    "Explore how electric current flows through complete, unbroken loops. Experiment with batteries, switches, and bulbs in an interactive circuit simulation.",
  learningObjectives: [
    "Identify the essential components of a circuit: battery (source), wires (conductors), switch (controller), and bulb (load)",
    "Explain that electric current only flows when there is an unbroken, closed loop",
    "Describe the function of an electrical switch in opening and closing a circuit",
    "Predict whether a bulb will glow based on circuit continuity",
  ],
  activities: [
    {
      id: "act_1_intro",
      type: "intro",
      title: "Real-World Context: Why Does the Torch Glow?",
      instructions: "Observe what happens inside everyday appliances.",
      config: {
        type: "intro",
        headline: "The Torch Switch Mystery",
        body: "Have you ever wondered why a torch lights up the exact millisecond you press its slide switch? Inside the plastic casing lies a battery, a small bulb, and metal strips acting as wires. When the switch is pushed forward, it bridges a physical gap in metal conductors, creating a closed loop that allows electric charges to flow continuously.",
        hookQuestion: "What happens if there is even a tiny break anywhere in that metal path?",
      },
    },
    {
      id: "act_2_manipulation",
      type: "interactive_manipulation",
      title: "Interactive Sandbox: The Circuit Workbench",
      instructions: "Click the switch to open or close the circuit, and observe the bulb.",
      config: {
        type: "interactive_manipulation",
        simulation: {
          simulationKind: "circuit_loop",
          initialSwitchState: "open",
          initialWireConnected: true,
          hasBattery: true,
          hasBulb: true,
          conductiveObject: "none",
          instruction:
            "Click on the switch toggle. Notice how electrons only flow and the bulb glows when the switch closes the loop!",
        },
      },
    },
    {
      id: "act_3_predict",
      type: "predict_and_observe",
      title: "Predict & Observe: Open Switch Condition",
      instructions: "Predict what will happen, then test it in the circuit loop.",
      config: {
        type: "predict_and_observe",
        prompt:
          "Predict: If the switch is in the OPEN position, will electric current flow to light up the bulb?",
        predictionChoices: [
          {
            id: "choice_glow",
            text: "Yes, the bulb will glow because the battery is still attached.",
          },
          {
            id: "choice_dark",
            text: "No, the bulb stays dark because the open switch creates an air gap, breaking the loop.",
            isExpected: true,
          },
          {
            id: "choice_half",
            text: "The bulb will glow at half brightness.",
          },
        ],
        simulation: {
          simulationKind: "circuit_loop",
          initialSwitchState: "open",
          initialWireConnected: true,
          hasBattery: true,
          hasBulb: true,
          conductiveObject: "none",
          instruction: "Toggle the switch between OPEN and CLOSED to verify your prediction.",
        },
        observationReveal: {
          expectedObservation:
            "When the switch is OPEN, no current flows and the bulb stays dark. When CLOSED, current flows and the bulb glows brightly.",
          explanation:
            "Air is an electrical insulator. When the switch is open, the air gap stops charges from completing the loop. Current requires a continuous conducting path from the battery positive terminal, through the bulb, and back to the negative terminal.",
        },
      },
      remediation: {
        branchId: "branch_sci_predict_remediation",
        triggerCondition: "incorrect_prediction",
        targetedExplanation:
          "Electric current requires an unbroken, continuous loop. Even if the battery is fully charged, electrons cannot jump across the air gap of an open switch! Let's examine how the air gap stops current.",
        remediationActivity: {
          id: "act_3_remediation_sim",
          type: "interactive_manipulation",
          title: "Guided Investigation: The Air Gap in an Open Circuit",
          instructions:
            "Observe the gap when the switch is open. Notice that current cannot flow across the air gap.",
          config: {
            type: "interactive_manipulation",
            simulation: {
              simulationKind: "circuit_loop",
              initialSwitchState: "open",
              initialWireConnected: true,
              hasBattery: true,
              hasBulb: true,
              conductiveObject: "none",
              instruction: "Toggle the switch to see the air gap open and close.",
            },
          },
        },
        followUpCheck: {
          id: "act_3_remediation_fresh_check",
          type: "independent_check",
          title: "Fresh Check: Circuit Continuity",
          instructions: "Apply what you just learned to this fresh scenario.",
          config: {
            type: "independent_check",
            conceptId: "SCI-ELEC-CIRCUITS",
            prompt:
              "What happens if one wire is disconnected from the battery terminal in a circuit?",
            questionType: "choice",
            choices: [
              {
                id: "fresh_wire_dark",
                text: "Current stops flowing and the bulb stays dark",
              },
              {
                id: "fresh_wire_glow",
                text: "The bulb stays on because one wire is enough",
              },
              {
                id: "fresh_wire_leak",
                text: "Electricity leaks onto the table",
              },
            ],
            correctAnswer: "fresh_wire_dark",
            explanation:
              "Disconnecting a wire breaks the continuous loop. Current cannot flow unless there is a complete path from one battery terminal to the other.",
          },
        },
        stoppingPoint: {
          id: "act_3_stopping_point",
          type: "stopping_point",
          title: "Pause & Reflect: Circuit Loops",
          instructions: "Let's review the fundamental rule of electric circuits.",
          config: {
            type: "stopping_point",
            headline: "Key Rule: The Closed Loop",
            body: "Electric charges cannot travel through open air gaps in low-voltage circuits. For any electric device to work, there MUST be an uninterrupted conducting path from the battery, through the device, and back.",
            recommendation:
              "You have explored the basics of circuits! Let's continue together with guided challenges.",
            keyTakeaways: [
              "Closed circuit = continuous path = current flows.",
              "Open circuit = air gap = current stops completely.",
            ],
          },
        },
      },
    },
    {
      id: "act_4_guided",
      type: "guided_practice",
      title: "Guided Practice: Complete the Circuit",
      instructions: "Close the circuit switch so the bulb lights up.",
      config: {
        type: "guided_practice",
        prompt: "Configure the circuit switch and wires so that the bulb turns ON.",
        simulation: {
          simulationKind: "circuit_loop",
          initialSwitchState: "open",
          initialWireConnected: true,
          hasBattery: true,
          hasBulb: true,
          conductiveObject: "none",
          instruction: "Close the switch to turn ON the bulb.",
        },
        targetCriteria: {
          property: "circuit_state",
          expectedValue: "closed",
        },
        successFeedback:
          "Brilliant! The switch is closed, completing the loop. Current flows uninterrupted through the filament, making the bulb glow.",
        retryFeedback:
          "Not yet. Make sure the switch is in the CLOSED position and wires are connected.",
      },
    },
    {
      id: "act_5_check",
      type: "independent_check",
      title: "Independent Check: Check Your Understanding",
      instructions: "Demonstrate your understanding of electric circuits.",
      config: {
        type: "independent_check",
        conceptId: "SCI-ELEC-CIRCUITS",
        prompt:
          "Which of the following conditions is required for an electric bulb in a circuit to glow?",
        questionType: "choice",
        choices: [
          {
            id: "choice_a",
            text: "A complete, closed conducting loop connecting both battery terminals through the bulb",
          },
          {
            id: "choice_b",
            text: "An open switch so electricity can breathe",
          },
          {
            id: "choice_c",
            text: "Only connecting one wire from the positive terminal to the bulb",
          },
          {
            id: "choice_d",
            text: "Using a wooden stick instead of metal wire",
          },
        ],
        correctAnswer: "choice_a",
        explanation:
          "Electric current requires an unbroken, complete conducting path from one terminal of the battery through the bulb to the other terminal.",
      },
    },
  ],
};
