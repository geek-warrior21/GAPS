import type { SyntheticLearnerProfile } from "@gaps/contracts";

export interface ObjectiveSourcePack {
  objectiveId: string;
  subject: "maths" | "science";
  grade: number;
  title: string;
  strand: string;
  coreConcepts: string[];
  prerequisites: string[];
  cataloguedMisconceptions: Array<{
    id: string;
    name: string;
    description: string;
    indicator: string;
    remediationStrategy: string;
  }>;
  groundedMetaphors: string[];
  supportedSimulation: "fraction_strip" | "circuit_loop";
}

export const OBJECTIVE_SOURCE_PACKS: Record<string, ObjectiveSourcePack> = {
  "MATH-FRAC-PART": {
    objectiveId: "MATH-FRAC-PART",
    subject: "maths",
    grade: 6,
    title: "Fractions: Parts of a Whole (Numerator and Denominator)",
    strand: "fractions",
    coreConcepts: [
      "A fraction represents parts of an equal-sized whole",
      "Denominator (bottom number) specifies the total number of equal parts into which the whole is divided",
      "Numerator (top number) specifies how many of those equal parts are chosen or considered",
      "Equal partition size is mandatory; unequal divisions do not form valid fractions",
    ],
    prerequisites: ["Whole number counting", "Basic division and sharing equally"],
    cataloguedMisconceptions: [
      {
        id: "REV",
        name: "Numerator/Denominator Reversal",
        description:
          "Inverting numerator and denominator (e.g. writing 4/3 instead of 3/4 when 3 parts out of 4 are shaded).",
        indicator: "Student writes the total parts on top and shaded parts on bottom.",
        remediationStrategy:
          "Ground the denominator in total slices first before counting chosen parts.",
      },
      {
        id: "WHOLE",
        name: "Whole Number Fraction Bias",
        description:
          "Treating numerator and denominator as two independent disconnected whole numbers (e.g. seeing 3/4 as '3' and '4').",
        indicator: "Comparing fractions by comparing top numbers alone or bottom numbers alone.",
        remediationStrategy:
          "Visual strip models showing fraction as a single measure on the number line.",
      },
    ],
    groundedMetaphors: [
      "Sharing a round roti or paratha into equal quarter slices",
      "Breaking a rectangular chocolate bar into equal blocks",
      "Water bottle markings divided into equal decilitre marks",
    ],
    supportedSimulation: "fraction_strip",
  },
  "MATH-FRAC-EQUIV": {
    objectiveId: "MATH-FRAC-EQUIV",
    subject: "maths",
    grade: 6,
    title: "Equivalent Fractions: Equal Value Representation",
    strand: "fractions",
    coreConcepts: [
      "Fractions with different numerators and denominators can represent the exact same portion of a whole",
      "Multiplying or dividing both numerator and denominator by the same non-zero integer yields an equivalent fraction (multiplying by 1)",
      "Area coverage remains identical even as the count of subdivisions increases",
    ],
    prerequisites: ["MATH-FRAC-PART", "Basic multiplication and division tables"],
    cataloguedMisconceptions: [
      {
        id: "ADD_NUM_DEN",
        name: "Additive Equivalence Error",
        description:
          "Believing that adding the same number to numerator and denominator creates an equivalent fraction (e.g., 1/2 = 2/3).",
        indicator: "Student adds +1/+1 instead of multiplying by n/n.",
        remediationStrategy: "Overlay strip models showing that 2/3 is strictly larger than 1/2.",
      },
    ],
    groundedMetaphors: [
      "Cutting 1 large pizza slice (1/2) into 2 smaller slices (2/4)",
      "Two runners on parallel tracks covering the exact same distance",
    ],
    supportedSimulation: "fraction_strip",
  },
  "SCI-ELEC-CIRCUITS": {
    objectiveId: "SCI-ELEC-CIRCUITS",
    subject: "science",
    grade: 6,
    title: "Electric Current & Simple Circuits",
    strand: "electricity",
    coreConcepts: [
      "Electric current requires an unbroken, closed conductive loop connecting both battery terminals through a load",
      "A switch is a physical control mechanism that introduces or closes an air gap in the circuit",
      "Air is an electrical insulator at standard low voltages; electrons cannot jump an open air gap",
      "A break anywhere in the loop stops electric current everywhere in that loop",
    ],
    prerequisites: ["Familiarity with battery-operated torches and switches"],
    cataloguedMisconceptions: [
      {
        id: "AIR_GAP",
        name: "Air Gap Jump Misconception",
        description:
          "Believing that electricity jumps through the open switch air gap because the battery is still attached.",
        indicator: "Student predicts bulb will glow even when switch is in the OPEN position.",
        remediationStrategy:
          "Visualizing the air gap in a circuit simulation as a complete barrier to charge flow.",
      },
      {
        id: "SINGLE_WIRE",
        name: "Single Wire Supply Error",
        description:
          "Thinking current flows out of a single battery terminal like water from a tap, requiring only one wire.",
        indicator:
          "Predicting a bulb will glow with only one wire attached to the positive terminal.",
        remediationStrategy:
          "Tracing the return path to the negative terminal as mandatory for electrical circulation.",
      },
    ],
    groundedMetaphors: [
      "Torch switch mechanism bridging internal metal strips",
      "Toy car circular train track: a missing rail section stops the train immediately",
      "Bicycle chain: must be connected in a full loop around both gears to transmit force",
    ],
    supportedSimulation: "circuit_loop",
  },
  "SCI-ELEC-CONDUCTORS": {
    objectiveId: "SCI-ELEC-CONDUCTORS",
    subject: "science",
    grade: 6,
    title: "Electrical Conductors & Insulators",
    strand: "electricity",
    coreConcepts: [
      "Conductors are materials (mostly metals) with mobile charges that permit electric current to flow through them",
      "Insulators (rubber, plastics, wood, glass) tightly bind electrons, preventing charge movement",
      "Electric safety cords combine copper metal conductors inside with plastic insulators outside",
    ],
    prerequisites: ["SCI-ELEC-CIRCUITS"],
    cataloguedMisconceptions: [
      {
        id: "ALL_SOLIDS",
        name: "Solid State Conductivity Fallacy",
        description:
          "Assuming that all solid, rigid objects (such as plastic or wood) conduct electricity like metal.",
        indicator: "Classifying a plastic ruler or wooden chopstick as a conductor.",
        remediationStrategy: "Bench test simulation replacing circuit gap with various materials.",
      },
    ],
    groundedMetaphors: [
      "Power cord copper core and PVC plastic skin",
      "Electrician safety rubber gloves protecting hands from conductive live wires",
    ],
    supportedSimulation: "circuit_loop",
  },
};

export const SUPPORTED_ACTIVITY_CATALOGUE = `
SUPPORTED ACTIVITY SPECIFICATIONS (Version 1.0):

1. "intro"
   - headline: string (engaging context headline)
   - body: string (conceptual real-world framing)
   - hookQuestion?: string (thought-provoking query)

2. "interactive_manipulation"
   - simulation:
     a) fraction_strip:
        - simulationKind: "fraction_strip"
        - initialParts: number (1 to 12)
        - initialShaded: number (0 to initialParts)
        - minParts: number (>= 1)
        - maxParts: number (<= 12)
        - instruction: string
     b) circuit_loop:
        - simulationKind: "circuit_loop"
        - initialSwitchState: "open" | "closed"
        - initialWireConnected: boolean
        - hasBattery: boolean
        - hasBulb: boolean
        - conductiveObject: "none" | "copper_key" | "rubber_eraser"
        - instruction: string

3. "predict_and_observe"
   - prompt: string (predict question)
   - predictionChoices: Array<{ id: string, text: string, isExpected?: boolean }> (EXACTLY ONE isExpected: true)
   - simulation: (fraction_strip or circuit_loop)
   - observationReveal:
     - expectedObservation: string
     - explanation: string
   - remediation?: (optional remediation branch for incorrect predictions):
     - branchId: string
     - triggerCondition: string
     - targetedExplanation: string
     - remediationActivity: LessonActivity (hands-on exploration)
     - followUpCheck: LessonActivity (independent_check)
     - stoppingPoint: LessonActivity (stopping_point)

4. "guided_practice"
   - prompt: string
   - simulation?: (fraction_strip or circuit_loop)
   - targetCriteria: { property: string, expectedValue: string }
   - successFeedback: string
   - retryFeedback: string

5. "independent_check"
   - conceptId: string (valid concept ID)
   - templateId?: string
   - itemInstanceId?: string
   - prompt: string
   - questionType: "choice" | "number" | "fraction"
   - choices: Array<{ id: string, text: string }> (for choice type)
   - correctAnswer: string (must match a choice id)
   - explanation: string

6. "stopping_point"
   - headline: string
   - body: string
   - recommendation: string
   - keyTakeaways: string[]
`;

export function buildPlannerPrompt(params: {
  sourcePack: ObjectiveSourcePack;
  learnerProfile: SyntheticLearnerProfile;
}): string {
  const { sourcePack, learnerProfile } = params;

  return `You are an expert curriculum and pedagogical AI designer for Class 6 school students.
Design a complete, version 1.0 JSON lesson plan for:
Objective: ${sourcePack.title} (${sourcePack.objectiveId})
Subject: ${sourcePack.subject} (Class ${sourcePack.grade})
Strand: ${sourcePack.strand}

SYNTHETIC LEARNER PROFILE:
- Type: ${learnerProfile.profileType}
- Prior Mastery: ${learnerProfile.priorMastery}
${learnerProfile.namedMisconception ? `- Active Misconception to address: ${learnerProfile.namedMisconception}` : ""}
${learnerProfile.notes ? `- Pedagogical Notes: ${learnerProfile.notes}` : ""}

CURATED DOMAIN SOURCE PACK:
Core Concepts:
${sourcePack.coreConcepts.map((c) => `- ${c}`).join("\n")}

Grounded Metaphors:
${sourcePack.groundedMetaphors.map((m) => `- ${m}`).join("\n")}

Catalogued Misconceptions:
${sourcePack.cataloguedMisconceptions.map((m) => `- ${m.id} (${m.name}): ${m.description} | Remediation: ${m.remediationStrategy}`).join("\n")}

${SUPPORTED_ACTIVITY_CATALOGUE}

PEDAGOGICAL INSTRUCTIONS BASED ON PROFILE:
${
  learnerProfile.profileType === "struggling"
    ? `The student is struggling with misconception "${learnerProfile.namedMisconception ?? "concept confusion"}".
You MUST structure the lesson with:
1. An intuitive real-world intro targeting the misconception.
2. A hands-on interactive simulation.
3. A predict_and_observe activity targeting this specific error with an authored remediation branch.
4. Scaffolded guided practice.
5. Independent verification check.`
    : learnerProfile.profileType === "ready_for_challenge"
      ? `The student is ready for a challenge and already understands basic definitions.
You MUST structure the lesson with:
1. A concise, real-world context intro with high-level inquiry.
2. A guided practice challenge requiring multi-step configuration or deeper verification.
3. Two independent checks testing boundary cases or transfer problems.
Avoid remedial hand-holding.`
      : `The student is a new learner encountering this topic for the first time.
You MUST structure the lesson with:
1. A warm, engaging real-world context intro.
2. Free exploration with the interactive simulation.
3. A simple predict-and-observe challenge.
4. Guided practice reinforcing foundational success.
5. A clear independent check.`
}

CRITICAL RULES:
- version MUST be "1.0".
- Output valid JSON conforming to LessonPlan schema.
- All simulation properties must strictly adhere to the supported ranges.
- Independent checks must have choices and a correctAnswer that exactly matches one choice ID.
`;
}
