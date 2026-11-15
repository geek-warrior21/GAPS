import type { LessonActivity } from "@gaps/contracts";

/**
 * Authored assessment items for engine-driven lessons.
 *
 * Every assessed question a student sees in an adaptive lesson comes from this
 * bank, never from a model. Each item is a genuinely different question, so the
 * belief reducer's "3 distinct items across 2 templates" rule cannot be met by
 * answering one question several times. This module is server-only: answers and
 * misconception tags must not be imported into client components.
 */

export const ITEM_BANK_VERSION = "adaptive-items-1.0";

export interface BankChoice {
  readonly id: string;
  readonly text: string;
  /**
   * Teaching-level misconception this distractor points to. Absent on a wrong
   * choice means the error is ambiguous and needs a diagnostic probe.
   */
  readonly misconception?: string;
}

export interface BankItem {
  readonly itemId: string;
  readonly templateId: string;
  /** Unique per template: (templateId, templateVersion, seed) is a database key. */
  readonly seed: number;
  readonly objectiveId: string;
  readonly kind: "assessment" | "diagnostic";
  readonly title: string;
  readonly instructions: string;
  readonly prompt: string;
  readonly choices: readonly BankChoice[];
  readonly correctChoiceId: string;
  readonly explanation: string;
}

/** Teaching tag -> canonical misconception id in packages/domain, where one exists. */
export const CANONICAL_MISCONCEPTION_IDS: Readonly<Record<string, string>> = {
  PART_RATIO: "MC-PART-RATIO",
};

/** Feedback after a "not yet" answer. It names the idea to revisit, not the answer. */
export const MISCONCEPTION_FEEDBACK: Readonly<Record<string, string>> = {
  REVERSAL:
    "Not yet. Look again at which number counts ALL the equal parts and which counts the chosen parts.",
  PART_RATIO:
    "Not yet. Count the chosen parts first, then count all the parts together in the whole.",
  UNSHADED_CONFUSION: "Not yet. Check which parts the question is asking about.",
  WHOLE_PART_CONFUSION:
    "Not yet. Remember the whole has been split into equal parts, and a fraction names some of them.",
  UNEQUAL_PARTS: "Not yet. Think about whether the pieces are all the same size.",
  AIR_GAP: "Not yet. Think about what a gap in the loop does to the path the current needs.",
  SINGLE_WIRE: "Not yet. Think about the whole path the current travels, out and back.",
  CURRENT_CONSUMPTION:
    "Not yet. Think about whether current is used up, or keeps moving round the loop.",
};

export const AMBIGUOUS_FEEDBACK = "Not yet. Let's look at this idea from another angle together.";

const FRAC_NAME = "tpl_adp_frac_part_name";
const FRAC_MEANING = "tpl_adp_frac_part_meaning";
const CIRCUIT_CONTINUITY = "tpl_adp_circuits_continuity";
const CIRCUIT_FAULTS = "tpl_adp_circuits_faults";

const FRACTION_ITEMS: readonly BankItem[] = [
  {
    itemId: "itm_adp_frac_part_name_1",
    templateId: FRAC_NAME,
    seed: 1,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: Name the Fraction",
    instructions: "Choose the fraction that matches the description.",
    prompt:
      "A paper strip is divided into 5 equal parts. 2 parts are shaded. What fraction of the strip is shaded?",
    choices: [
      { id: "c_2_5", text: "2/5 (two-fifths)" },
      { id: "c_5_2", text: "5/2 (five-halves)", misconception: "REVERSAL" },
      { id: "c_2_3", text: "2/3 (two-thirds)", misconception: "PART_RATIO" },
      { id: "c_2_7", text: "2/7 (two-sevenths)" },
    ],
    correctChoiceId: "c_2_5",
    explanation:
      "2 parts are shaded out of 5 equal parts in the whole strip, so the fraction is 2/5.",
  },
  {
    itemId: "itm_adp_frac_part_meaning_1",
    templateId: FRAC_MEANING,
    seed: 1,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: What a Fraction Means",
    instructions: "Choose the statement that describes the fraction.",
    prompt: "Which statement describes the fraction 3/7?",
    choices: [
      { id: "c_3_of_7", text: "3 parts chosen out of 7 equal parts in the whole" },
      {
        id: "c_7_of_3",
        text: "7 parts chosen out of 3 equal parts in the whole",
        misconception: "REVERSAL",
      },
      {
        id: "c_3_and_7",
        text: "3 parts chosen and 7 other parts left over",
        misconception: "PART_RATIO",
      },
      { id: "c_3_wholes", text: "3 wholes with 7 extra parts" },
    ],
    correctChoiceId: "c_3_of_7",
    explanation:
      "The bottom number 7 counts all the equal parts in the whole. The top number 3 counts the chosen parts.",
  },
  {
    itemId: "itm_adp_frac_part_name_2",
    templateId: FRAC_NAME,
    seed: 2,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: Name the Fraction",
    instructions: "Choose the fraction that matches the story.",
    prompt:
      "A chocolate bar has 8 equal pieces. Asha eats 3 pieces. What fraction of the bar did Asha eat?",
    choices: [
      { id: "c_8_3", text: "8/3 (eight-thirds)", misconception: "REVERSAL" },
      { id: "c_3_8", text: "3/8 (three-eighths)" },
      { id: "c_3_5", text: "3/5 (three-fifths)", misconception: "PART_RATIO" },
      { id: "c_3_11", text: "3/11 (three-elevenths)" },
    ],
    correctChoiceId: "c_3_8",
    explanation: "Asha ate 3 pieces out of 8 equal pieces in the whole bar, so she ate 3/8.",
  },
  {
    itemId: "itm_adp_frac_part_meaning_2",
    templateId: FRAC_MEANING,
    seed: 2,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: The Part That Is Left",
    instructions: "Read carefully which part the question asks about.",
    prompt:
      "A pizza is cut into 6 equal slices. 1 slice is eaten. What fraction of the pizza is LEFT?",
    choices: [
      { id: "c_1_6", text: "1/6 (one-sixth)", misconception: "UNSHADED_CONFUSION" },
      { id: "c_6_5", text: "6/5 (six-fifths)", misconception: "REVERSAL" },
      { id: "c_5_6", text: "5/6 (five-sixths)" },
      { id: "c_5_1", text: "5/1 (five wholes)", misconception: "WHOLE_PART_CONFUSION" },
    ],
    correctChoiceId: "c_5_6",
    explanation: "5 slices are left out of 6 equal slices in the whole pizza, so 5/6 is left.",
  },
  {
    itemId: "itm_adp_frac_part_name_3",
    templateId: FRAC_NAME,
    seed: 3,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: Name the Fraction",
    instructions: "Choose the fraction that matches the story.",
    prompt:
      "A garden bed is divided into 6 equal sections. 5 sections are planted. What fraction of the bed is planted?",
    choices: [
      { id: "c_5_6", text: "5/6 (five-sixths)" },
      { id: "c_1_6", text: "1/6 (one-sixth)", misconception: "UNSHADED_CONFUSION" },
      { id: "c_6_5", text: "6/5 (six-fifths)", misconception: "REVERSAL" },
      { id: "c_5_11", text: "5/11 (five-elevenths)" },
    ],
    correctChoiceId: "c_5_6",
    explanation:
      "5 sections are planted out of 6 equal sections in the whole bed, so 5/6 is planted.",
  },
  {
    itemId: "itm_adp_frac_part_meaning_3",
    templateId: FRAC_MEANING,
    seed: 3,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: Equal Parts",
    instructions: "Decide whether the fraction name fits.",
    prompt:
      "A ribbon is cut into 2 long pieces and 1 short piece. Riya takes one long piece. Does Riya have 1/3 of the ribbon?",
    choices: [
      {
        id: "c_yes_three_pieces",
        text: "Yes, because she has 1 of the 3 pieces",
        misconception: "UNEQUAL_PARTS",
      },
      {
        id: "c_no_unequal",
        text: "No, because the 3 pieces are not equal in size",
      },
      { id: "c_no_two_long", text: "No, because there are only 2 long pieces" },
    ],
    correctChoiceId: "c_no_unequal",
    explanation:
      "A fraction such as 1/3 only fits when the whole is divided into EQUAL parts. These pieces are different sizes.",
  },
  {
    itemId: "itm_adp_frac_part_name_4",
    templateId: FRAC_NAME,
    seed: 4,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: Name the Fraction",
    instructions: "Choose the fraction that matches the story.",
    prompt:
      "A roti is cut into 4 equal pieces. 3 pieces are eaten. What fraction of the roti was eaten?",
    choices: [
      { id: "c_4_3", text: "4/3 (four-thirds)", misconception: "REVERSAL" },
      { id: "c_1_4", text: "1/4 (one-fourth)", misconception: "UNSHADED_CONFUSION" },
      { id: "c_3_4", text: "3/4 (three-fourths)" },
      { id: "c_3_1", text: "3/1 (three wholes)", misconception: "WHOLE_PART_CONFUSION" },
    ],
    correctChoiceId: "c_3_4",
    explanation: "3 pieces were eaten out of 4 equal pieces in the whole roti, so 3/4 was eaten.",
  },
  {
    itemId: "itm_adp_frac_part_meaning_4",
    templateId: FRAC_MEANING,
    seed: 4,
    objectiveId: "MATH-FRAC-PART",
    kind: "assessment",
    title: "Check: Reading a Fraction",
    instructions: "Use the fraction to work out the whole.",
    prompt: "A strip shows 4/10 shaded. Into how many equal parts is the whole strip divided?",
    choices: [
      { id: "c_10", text: "10 equal parts" },
      { id: "c_4", text: "4 equal parts", misconception: "REVERSAL" },
      { id: "c_6", text: "6 equal parts", misconception: "UNSHADED_CONFUSION" },
      { id: "c_14", text: "14 equal parts" },
    ],
    correctChoiceId: "c_10",
    explanation: "The bottom number 10 tells us the whole strip is divided into 10 equal parts.",
  },
  {
    itemId: "itm_adp_frac_part_probe_1",
    templateId: "tpl_adp_frac_part_probe",
    seed: 1,
    objectiveId: "MATH-FRAC-PART",
    kind: "diagnostic",
    title: "Diagnostic Check: Meaning of the Numbers",
    instructions: "Choose the statement that fits. This helps pick the best next step for you.",
    prompt: "In the fraction 3/4, what does the bottom number 4 tell us?",
    choices: [
      { id: "c_total", text: "The number of equal parts the whole is divided into" },
      { id: "c_shaded", text: "The number of parts that are shaded" },
    ],
    correctChoiceId: "c_total",
    explanation: "The bottom number (denominator) tells us how many equal parts make up one whole.",
  },
];

const CIRCUIT_ITEMS: readonly BankItem[] = [
  {
    itemId: "itm_adp_circuits_continuity_1",
    templateId: CIRCUIT_CONTINUITY,
    seed: 1,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: The Open Switch",
    instructions: "Predict what happens in the circuit.",
    prompt: "The switch in a simple circuit is opened. What happens to the bulb?",
    choices: [
      {
        id: "c_jumps_gap",
        text: "It keeps glowing, because current jumps across the small gap",
        misconception: "AIR_GAP",
      },
      {
        id: "c_goes_dark",
        text: "It goes dark, because the open switch leaves a gap the current cannot cross",
      },
      { id: "c_half_bright", text: "It glows at half brightness" },
    ],
    correctChoiceId: "c_goes_dark",
    explanation:
      "Air is an insulator. An open switch leaves a gap in the loop, so the current stops and the bulb goes dark.",
  },
  {
    itemId: "itm_adp_circuits_faults_1",
    templateId: CIRCUIT_FAULTS,
    seed: 1,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: A Loose Wire",
    instructions: "Work out what the fault does to the circuit.",
    prompt:
      "A bulb is glowing in a circuit with a closed switch. One wire slips off the battery terminal. What happens?",
    choices: [
      { id: "c_goes_off", text: "The bulb goes off, because the loop is broken" },
      {
        id: "c_one_wire",
        text: "The bulb stays on, because one connected wire is enough",
        misconception: "SINGLE_WIRE",
      },
      {
        id: "c_through_air",
        text: "The bulb stays on, because electricity travels through the air to it",
        misconception: "AIR_GAP",
      },
      { id: "c_brighter", text: "The bulb glows brighter, because less wire is in use" },
    ],
    correctChoiceId: "c_goes_off",
    explanation:
      "Current needs a complete loop from one battery terminal, through the bulb, and back to the other terminal. One loose wire breaks the loop.",
  },
  {
    itemId: "itm_adp_circuits_continuity_2",
    templateId: CIRCUIT_CONTINUITY,
    seed: 2,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: What a Bulb Needs",
    instructions: "Choose the condition that must be true.",
    prompt: "Which condition is needed for a bulb in a circuit to glow?",
    choices: [
      {
        id: "c_single_wire",
        text: "One wire from the battery to the bulb, with no path back",
        misconception: "SINGLE_WIRE",
      },
      { id: "c_bigger_bulb", text: "A bulb that is larger than the battery" },
      {
        id: "c_closed_loop",
        text: "A complete loop from one battery terminal, through the bulb, back to the other terminal",
      },
    ],
    correctChoiceId: "c_closed_loop",
    explanation:
      "A bulb glows only when it is part of a complete, unbroken loop that joins both battery terminals.",
  },
  {
    itemId: "itm_adp_circuits_faults_2",
    templateId: CIRCUIT_FAULTS,
    seed: 2,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: A Tiny Gap",
    instructions: "Predict what the gap does.",
    prompt:
      "In a torch circuit, a tiny gap is left between two wire ends. Everything else is connected. Will the bulb glow?",
    choices: [
      {
        id: "c_yes_jump",
        text: "Yes, because current can jump a tiny gap",
        misconception: "AIR_GAP",
      },
      { id: "c_no_gap", text: "No, because even a tiny gap breaks the loop" },
      { id: "c_yes_dim", text: "Yes, but only dimly" },
    ],
    correctChoiceId: "c_no_gap",
    explanation:
      "In a torch circuit, current cannot cross an air gap however small it is. The loop must be complete.",
  },
  {
    itemId: "itm_adp_circuits_continuity_3",
    templateId: CIRCUIT_CONTINUITY,
    seed: 3,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: Current Around the Loop",
    instructions: "Think about the whole loop.",
    prompt:
      "Current leaves a battery and passes through a glowing bulb. How much current flows in the wire going back to the battery?",
    choices: [
      { id: "c_same", text: "The same amount, because current flows all the way round the loop" },
      {
        id: "c_none",
        text: "None, because the bulb uses up all the current",
        misconception: "CURRENT_CONSUMPTION",
      },
      {
        id: "c_less",
        text: "Less, because the bulb uses up some of the current",
        misconception: "CURRENT_CONSUMPTION",
      },
    ],
    correctChoiceId: "c_same",
    explanation:
      "Current is not used up by the bulb. The same current flows through every part of a single loop.",
  },
  {
    itemId: "itm_adp_circuits_faults_3",
    templateId: CIRCUIT_FAULTS,
    seed: 3,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: Find the Fault",
    instructions: "Choose the fault that explains what Riya sees.",
    prompt:
      "Riya's bulb does not glow. The battery is fresh and the bulb works. Which fault could explain it?",
    choices: [
      {
        id: "c_used_up",
        text: "The bulb has already used up the current",
        misconception: "CURRENT_CONSUMPTION",
      },
      { id: "c_switch_open", text: "The switch is open, so the loop has a gap" },
      { id: "c_wires_short", text: "The wires are shorter than usual" },
    ],
    correctChoiceId: "c_switch_open",
    explanation:
      "An open switch leaves a gap in the loop. With a fresh battery and a working bulb, a broken loop is the fault to look for.",
  },
  {
    itemId: "itm_adp_circuits_continuity_4",
    templateId: CIRCUIT_CONTINUITY,
    seed: 4,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: What a Switch Does",
    instructions: "Choose the best description.",
    prompt: "A bulb glows when the switch is closed. What does closing the switch do?",
    choices: [
      { id: "c_adds_power", text: "It adds extra electricity to the circuit" },
      {
        id: "c_air_path",
        text: "It lets the current travel through the air",
        misconception: "AIR_GAP",
      },
      { id: "c_joins_gap", text: "It joins the gap, so the loop is complete" },
    ],
    correctChoiceId: "c_joins_gap",
    explanation:
      "A switch is a movable part of the loop. Closing it joins the gap and completes the path for the current.",
  },
  {
    itemId: "itm_adp_circuits_faults_4",
    templateId: CIRCUIT_FAULTS,
    seed: 4,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "assessment",
    title: "Check: Which Circuit Works?",
    instructions: "Choose the circuit in which the bulb will glow.",
    prompt: "In which circuit will the bulb glow?",
    choices: [
      {
        id: "c_no_return",
        text: "Battery, wire, bulb, with no wire going back to the battery",
        misconception: "SINGLE_WIRE",
      },
      {
        id: "c_open_switch",
        text: "Battery, wire, open switch, bulb, wire back to the battery",
        misconception: "AIR_GAP",
      },
      {
        id: "c_complete",
        text: "Battery, wire, closed switch, bulb, wire back to the battery",
      },
    ],
    correctChoiceId: "c_complete",
    explanation:
      "Only the circuit with a closed switch and a wire back to the battery forms a complete loop.",
  },
  {
    itemId: "itm_adp_circuits_probe_1",
    templateId: "tpl_adp_circuits_probe",
    seed: 1,
    objectiveId: "SCI-ELEC-CIRCUITS",
    kind: "diagnostic",
    title: "Diagnostic Check: Circuit Path Requirement",
    instructions: "Choose the statement that fits. This helps pick the best next step for you.",
    prompt: "What does electric current need in order to keep a bulb glowing?",
    choices: [
      { id: "c_loop", text: "A complete, unbroken loop from the battery and back again" },
      { id: "c_one_way", text: "Just one wire touching the bulb, with no way back" },
    ],
    correctChoiceId: "c_loop",
    explanation: "Current flows only around a complete, closed loop.",
  },
];

const BANK: Readonly<Record<string, readonly BankItem[]>> = {
  "MATH-FRAC-PART": FRACTION_ITEMS,
  "SCI-ELEC-CIRCUITS": CIRCUIT_ITEMS,
};

export function getBankItems(objectiveId: string): readonly BankItem[] {
  return BANK[objectiveId] ?? [];
}

export function getBankItem(itemId: string): BankItem | undefined {
  for (const items of Object.values(BANK)) {
    const found = items.find((i) => i.itemId === itemId);
    if (found) return found;
  }
  return undefined;
}

export function hasItemBank(objectiveId: string): boolean {
  return getBankItems(objectiveId).length > 0;
}

/**
 * Assessment items are authored in an order that alternates templates, so the
 * first unused item always keeps a run of checks spread across both templates.
 */
export function selectAssessmentItem(
  objectiveId: string,
  excludedItemIds: readonly string[] = [],
): BankItem | undefined {
  const excluded = new Set(excludedItemIds);
  return getBankItems(objectiveId).find((i) => i.kind === "assessment" && !excluded.has(i.itemId));
}

export function countRemainingAssessmentItems(
  objectiveId: string,
  excludedItemIds: readonly string[] = [],
): number {
  const excluded = new Set(excludedItemIds);
  return getBankItems(objectiveId).filter((i) => i.kind === "assessment" && !excluded.has(i.itemId))
    .length;
}

export function selectDiagnosticItem(objectiveId: string): BankItem | undefined {
  return getBankItems(objectiveId).find((i) => i.kind === "diagnostic");
}

export interface GradedChoice {
  readonly isCorrect: boolean;
  /** Teaching-level misconception tag; null for correct or ambiguous answers. */
  readonly misconception: string | null;
  /** True when the answer is not correct and matches no authored misconception. */
  readonly isAmbiguous: boolean;
}

export function gradeBankItem(item: BankItem, submittedChoiceId: string): GradedChoice {
  const submitted = submittedChoiceId.trim();
  if (submitted === item.correctChoiceId) {
    return { isCorrect: true, misconception: null, isAmbiguous: false };
  }
  const choice = item.choices.find((c) => c.id === submitted);
  const misconception = choice?.misconception ?? null;
  return { isCorrect: false, misconception, isAmbiguous: misconception === null };
}

/** Full server-side activity for a bank item. Redact it before sending to a student. */
export function buildCheckActivity(item: BankItem, stepNumber: number): LessonActivity {
  return {
    id: `act_s${stepNumber}_${item.itemId}`,
    type: "independent_check",
    title: item.title,
    instructions: item.instructions,
    config: {
      type: "independent_check",
      conceptId: item.objectiveId,
      templateId: item.templateId,
      itemInstanceId: item.itemId,
      seed: item.seed,
      prompt: item.prompt,
      questionType: "choice",
      choices: item.choices.map((c) => ({ id: c.id, text: c.text })),
      correctAnswer: item.correctChoiceId,
      explanation: item.explanation,
    },
  };
}
