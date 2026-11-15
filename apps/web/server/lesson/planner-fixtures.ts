import type { LessonPlan } from "@gaps/contracts";

// ============================================================================
// MATHS OBJECTIVE: MATH-FRAC-PART
// Profile A: Struggling with Misconception REV (Numerator/Denominator Reversal)
// ============================================================================
export const FIXTURE_MATHS_STRUGGLING_REV: LessonPlan = {
  lessonId: "lesson-model-maths-struggling-rev",
  version: "1.0",
  subject: "maths",
  level: 6,
  topicId: "maths-frac-part",
  title: "Fractions: Conquering the Inversion Trap",
  description:
    "A targeted, scaffolded lesson designed to resolve numerator/denominator reversal by grounding the denominator in total equal slices.",
  learningObjectives: [
    "Distinguish between the total number of equal parts (denominator) and selected parts (numerator)",
    "Avoid the common reversal mistake of writing total parts on top",
    "Identify fractions accurately from visual strip models",
  ],
  activities: [
    {
      id: "act_intro_grounding",
      type: "intro",
      title: "Real-World Context: Slicing the Roti",
      instructions: "Observe how total equal parts create the denominator.",
      config: {
        type: "intro",
        headline: "The Foundation: Total Slices First",
        body: "Imagine Maa makes a round roti and cuts it into 4 equal quarters. She gives 3 quarters to you. Which number goes on the bottom? The bottom number—the denominator—names how many total equal pieces exist. The top number counts how many you hold. Never flip them!",
        hookQuestion:
          "If you cut a paratha into 4 equal pieces and take 3, why is it 3/4 and never 4/3?",
      },
    },
    {
      id: "act_interactive_grounding",
      type: "interactive_manipulation",
      title: "Hands-On Model: Denominator as Slices",
      instructions: "Change the number of total slices, then observe the bottom number.",
      config: {
        type: "interactive_manipulation",
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 4,
          initialShaded: 1,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 2,
          maxParts: 8,
          instruction:
            "Adjust the total parts. Notice how the denominator always matches the total number of equal divisions.",
        },
      },
    },
    {
      id: "act_predict_reversal",
      type: "predict_and_observe",
      title: "Predict & Observe: Naming the Shaded Portion",
      instructions: "Choose the correct fraction representing the shaded bars.",
      config: {
        type: "predict_and_observe",
        prompt:
          "Look at a strip divided into 4 equal parts with 3 parts shaded. What fraction of the strip is shaded?",
        predictionChoices: [
          {
            id: "choice_correct_3_4",
            text: "3/4 (three-fourths: 3 shaded out of 4 total)",
            isExpected: true,
          },
          {
            id: "choice_reversed_4_3",
            text: "4/3 (four-thirds: 4 parts on top)",
          },
          {
            id: "choice_whole_3_1",
            text: "3/1 (three whole strips)",
          },
        ],
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 4,
          initialShaded: 3,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 2,
          maxParts: 6,
          instruction: "Compare 3 shaded parts inside a 4-part whole.",
        },
        observationReveal: {
          expectedObservation: "3 of the 4 equal parts are shaded. The fraction is 3/4.",
          explanation:
            "The bottom number (denominator) MUST be 4 because the whole is divided into 4 equal slices. The top number is 3 because 3 parts are shaded. 4/3 would mean four whole strips, which is incorrect!",
        },
      },
      remediation: {
        branchId: "branch_reversal_remediation",
        triggerCondition: "incorrect_prediction",
        targetedExplanation:
          "Remember: Denominator is the 'Down' number—the total number of pieces in one whole. Let's practice building this directly.",
        remediationActivity: {
          id: "act_remed_manip",
          type: "interactive_manipulation",
          title: "Guided Investigation: Total Slices First",
          instructions: "Set the total parts to 4 and shade 3 parts.",
          config: {
            type: "interactive_manipulation",
            simulation: {
              simulationKind: "fraction_strip",
              initialParts: 4,
              initialShaded: 3,
              allowChangeParts: true,
              allowChangeShaded: true,
              minParts: 2,
              maxParts: 6,
              instruction: "Count the total parts (4), then count the shaded parts (3).",
            },
          },
        },
        followUpCheck: {
          id: "act_remed_check",
          type: "independent_check",
          title: "Fresh Check: Denominator Placement",
          instructions: "Answer this fresh check to verify denominator placement.",
          config: {
            type: "independent_check",
            conceptId: "MATH-FRAC-PART",
            prompt:
              "A ribbon is divided into 5 equal pieces. Neha colors 2 pieces blue. What fraction is blue?",
            questionType: "choice",
            choices: [
              { id: "choice_2_5", text: "2/5 (two-fifths)" },
              { id: "choice_5_2", text: "5/2 (five-halves)" },
              { id: "choice_2_3", text: "2/3 (two-thirds)" },
            ],
            correctAnswer: "choice_2_5",
            explanation:
              "Total pieces = 5 (denominator at the bottom). Blue pieces = 2 (numerator at the top). Hence, 2/5.",
          },
        },
        stoppingPoint: {
          id: "act_remed_stopping",
          type: "stopping_point",
          title: "Key Takeaway: The D Rule",
          instructions: "Review the golden memory rule for fractions.",
          config: {
            type: "stopping_point",
            headline: "Remember: D is for Down and Denominator",
            body: "Whenever you write a fraction, ask yourself: 'How many pieces make the whole?' Write that Down at the bottom first. Then count the pieces you took and write that on top.",
            recommendation: "Continue to guided practice to lock in this concept.",
            keyTakeaways: [
              "Denominator = Total equal pieces (Down at the bottom).",
              "Numerator = Selected pieces (on top).",
            ],
          },
        },
      },
    },
    {
      id: "act_guided_reversal",
      type: "guided_practice",
      title: "Guided Challenge: Build 3/5 with Precision",
      instructions: "Set the total parts to 5 and shade 3 parts.",
      config: {
        type: "guided_practice",
        prompt: "Configure the fraction strip so it shows exactly 3/5.",
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 3,
          initialShaded: 1,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 2,
          maxParts: 8,
          instruction: "Use the + buttons to set parts to 5 and shaded to 3.",
        },
        targetCriteria: {
          property: "fraction_state",
          expectedValue: "parts:5,shaded:3",
        },
        successFeedback:
          "Excellent! 5 equal parts total, 3 parts shaded. You mastered the denominator placement!",
        retryFeedback: "Not quite. Make sure the total parts count is 5 and shaded is 3.",
      },
    },
    {
      id: "act_final_check_rev",
      type: "independent_check",
      title: "Independent Check: Final Verification",
      instructions: "Identify the fraction of the shaded strip.",
      config: {
        type: "independent_check",
        conceptId: "MATH-FRAC-PART",
        templateId: "tpl_frac_part_ident_v1",
        itemInstanceId: "itm_model_maths_rev_1",
        prompt:
          "A chocolate bar has 6 equal pieces. Rahul eats 5 pieces. What fraction did he eat?",
        questionType: "choice",
        choices: [
          { id: "choice_5_6", text: "5/6" },
          { id: "choice_6_5", text: "6/5" },
          { id: "choice_1_6", text: "1/6" },
        ],
        correctAnswer: "choice_5_6",
        explanation:
          "Total pieces is 6, which is the denominator. Pieces eaten is 5, which is the numerator. The fraction is 5/6.",
      },
    },
  ],
};

// ============================================================================
// MATHS OBJECTIVE: MATH-FRAC-PART
// Profile B: Ready for a Challenge
// ============================================================================
export const FIXTURE_MATHS_CHALLENGE: LessonPlan = {
  lessonId: "lesson-model-maths-challenge-1",
  version: "1.0",
  subject: "maths",
  level: 6,
  topicId: "maths-frac-part",
  title: "Fractions: Multi-Partition & Challenge Analysis",
  description:
    "An accelerated learning track exploring high-density partitions, complex fraction models, and analytical verification.",
  learningObjectives: [
    "Analyze complex multi-partition fraction models with up to 12 equal divisions",
    "Synthesize fractional parts in multi-step visual contexts",
    "Evaluate complementary fractions (shaded vs unshaded portions)",
  ],
  activities: [
    {
      id: "act_challenge_intro",
      type: "intro",
      title: "Inquiry: High-Precision Measurements",
      instructions: "Consider how micro-divisions enable engineering accuracy.",
      config: {
        type: "intro",
        headline: "Beyond Halves and Quarters",
        body: "In architectural blueprints and medical dosages, fractions are divided into 8, 10, or 12 micro-partitions. How do numerator and denominator scale when precision increases?",
        hookQuestion:
          "When a ruler divides 1 centimetre into 10 millimetres, how do we write 7 millimetres as a fraction?",
      },
    },
    {
      id: "act_challenge_guided_1",
      type: "guided_practice",
      title: "Guided Challenge: Model 7/10 High-Density Strip",
      instructions: "Construct a 10-partition model with 7 parts shaded.",
      config: {
        type: "guided_practice",
        prompt: "Adjust the fraction model to show precisely 7/10.",
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 4,
          initialShaded: 2,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 2,
          maxParts: 12,
          instruction: "Scale parts to 10 and shade 7 units.",
        },
        targetCriteria: {
          property: "fraction_state",
          expectedValue: "parts:10,shaded:7",
        },
        successFeedback:
          "Perfect execution! 10 total partitions provide high resolution, with 7 units highlighted.",
        retryFeedback: "Check your count: you need exactly 10 total parts and 7 shaded.",
      },
    },
    {
      id: "act_challenge_guided_2",
      type: "guided_practice",
      title: "Guided Challenge: Complementary Fractions (5/8)",
      instructions: "Model 5/8 and analyze the remaining unshaded portion.",
      config: {
        type: "guided_practice",
        prompt: "Configure the model to 8 parts total with 5 parts shaded.",
        simulation: {
          simulationKind: "fraction_strip",
          initialParts: 6,
          initialShaded: 3,
          allowChangeParts: true,
          allowChangeShaded: true,
          minParts: 2,
          maxParts: 12,
          instruction: "Set parts to 8 and shaded to 5.",
        },
        targetCriteria: {
          property: "fraction_state",
          expectedValue: "parts:8,shaded:5",
        },
        successFeedback: "Brilliant! Notice that if 5/8 is shaded, exactly 3/8 remains unshaded.",
        retryFeedback: "Ensure parts is 8 and shaded is 5.",
      },
    },
    {
      id: "act_challenge_check_1",
      type: "independent_check",
      title: "Independent Challenge: Complementary Analysis",
      instructions: "Calculate the unshaded portion of a multi-partition whole.",
      config: {
        type: "independent_check",
        conceptId: "MATH-FRAC-PART",
        templateId: "tpl_frac_part_ident_v2",
        itemInstanceId: "itm_model_maths_chal_1",
        prompt:
          "A pizza is divided into 12 equal slices. If 7 slices are eaten, what fraction of the pizza remains uneaten?",
        questionType: "choice",
        choices: [
          { id: "choice_5_12", text: "5/12" },
          { id: "choice_7_12", text: "7/12" },
          { id: "choice_12_5", text: "12/5" },
          { id: "choice_5_7", text: "5/7" },
        ],
        correctAnswer: "choice_5_12",
        explanation:
          "Total slices = 12. Slices remaining = 12 - 7 = 5. The fraction remaining uneaten is 5/12.",
      },
    },
    {
      id: "act_challenge_check_2",
      type: "independent_check",
      title: "Independent Challenge: Proportional Reasoning",
      instructions: "Evaluate fraction equivalence under scaled partitions.",
      config: {
        type: "independent_check",
        conceptId: "MATH-FRAC-PART",
        templateId: "tpl_frac_part_word_v1",
        itemInstanceId: "itm_model_maths_chal_2",
        prompt:
          "A carpenter cuts an 8-metre timber into 8 equal beams. He uses 6 beams for a roof frame. Which fraction represents the timber used?",
        questionType: "choice",
        choices: [
          { id: "choice_6_8", text: "6/8" },
          { id: "choice_8_6", text: "8/6" },
          { id: "choice_2_8", text: "2/8" },
        ],
        correctAnswer: "choice_6_8",
        explanation:
          "There are 8 equal beams total (denominator 8) and 6 beams are used (numerator 6). The fraction used is 6/8.",
      },
    },
  ],
};

// ============================================================================
// SCIENCE OBJECTIVE: SCI-ELEC-CIRCUITS
// Profile A: Struggling with Misconception AIR_GAP
// ============================================================================
export const FIXTURE_SCIENCE_STRUGGLING_AIRGAP: LessonPlan = {
  lessonId: "lesson-model-sci-struggling-airgap",
  version: "1.0",
  subject: "science",
  level: 6,
  topicId: "sci-elec-circuits",
  title: "Circuits: Demystifying the Open Switch Air Gap",
  description:
    "A targeted remediation sequence explaining why electric current cannot jump across the air gap of an open switch.",
  learningObjectives: [
    "Understand that air is an electrical insulator at low circuit voltages",
    "Explain that opening a switch creates a physical gap that halts electric charges",
    "Identify closed conductive loops as mandatory for current flow",
  ],
  activities: [
    {
      id: "act_airgap_intro",
      type: "intro",
      title: "Real-World Context: The Invisible Wall",
      instructions: "Observe what happens when metal conductors separate.",
      config: {
        type: "intro",
        headline: "Why Electricity Stops at Air",
        body: "When you open a light switch, the metal contacts inside move apart by just two millimetres. That tiny gap is filled with air. Unlike copper wire, air molecules hold their electrons tightly. To electric current, an air gap is an impenetrable wall!",
        hookQuestion:
          "If a battery has full chemical power, why can't electrons simply jump across the open switch?",
      },
    },
    {
      id: "act_airgap_manip",
      type: "interactive_manipulation",
      title: "Interactive Sandbox: The Air Gap Barrier",
      instructions: "Toggle the switch and observe the air gap.",
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
            "Toggle the switch open and closed. Watch the air gap: current ONLY flows when metal touches metal!",
        },
      },
    },
    {
      id: "act_airgap_predict",
      type: "predict_and_observe",
      title: "Predict & Observe: Open Switch Continuity",
      instructions: "Predict whether current can cross an open switch.",
      config: {
        type: "predict_and_observe",
        prompt:
          "Predict: When the switch is OPEN, will current jump across the air gap to light the bulb?",
        predictionChoices: [
          {
            id: "choice_dark_insulator",
            text: "No, air is an insulator so current halts completely and the bulb stays dark",
            isExpected: true,
          },
          {
            id: "choice_glow_spark",
            text: "Yes, current jumps across the gap because the battery is strong",
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
            "With the switch OPEN, the bulb stays completely dark. With the switch CLOSED, current flows instantly.",
          explanation:
            "Air has high resistance and acts as an electrical insulator. Electrons cannot jump the air gap at battery voltage.",
        },
      },
    },
    {
      id: "act_airgap_guided",
      type: "guided_practice",
      title: "Guided Challenge: Restore Continuity",
      instructions: "Close the switch to bridge the air gap.",
      config: {
        type: "guided_practice",
        prompt: "Close the switch so the conductive path becomes continuous.",
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
          "Brilliant! The air gap is bridged by metal contacts, completing the conductive loop.",
        retryFeedback: "Make sure the switch is in the CLOSED position.",
      },
    },
    {
      id: "act_airgap_check",
      type: "independent_check",
      title: "Independent Check: Air Gap Properties",
      instructions: "Verify your understanding of electrical continuity.",
      config: {
        type: "independent_check",
        conceptId: "SCI-ELEC-CIRCUITS",
        templateId: "tpl_sci_circuits_continuity",
        itemInstanceId: "itm_model_sci_airgap_1",
        prompt: "Why does opening a switch in a simple circuit turn off the bulb?",
        questionType: "choice",
        choices: [
          {
            id: "choice_creates_gap",
            text: "It introduces an insulating air gap that breaks the continuous conducting loop",
          },
          {
            id: "choice_absorbs_power",
            text: "The switch absorbs all the energy inside itself",
          },
          {
            id: "choice_drains_battery",
            text: "It immediately drains the battery empty",
          },
        ],
        correctAnswer: "choice_creates_gap",
        explanation:
          "Air is an electrical insulator. Opening the switch physically separates metal contacts with an air gap, halting current circulation.",
      },
    },
  ],
};

// ============================================================================
// SCIENCE OBJECTIVE: SCI-ELEC-CIRCUITS
// Profile B: Ready for a Challenge
// ============================================================================
export const FIXTURE_SCIENCE_CHALLENGE: LessonPlan = {
  lessonId: "lesson-model-sci-challenge-1",
  version: "1.0",
  subject: "science",
  level: 6,
  topicId: "sci-elec-circuits",
  title: "Circuits: Advanced Fault Diagnosis & Conductivity",
  description:
    "An accelerated inquiry into circuit continuity, material bridging, and diagnostic fault finding.",
  learningObjectives: [
    "Diagnose open-circuit faults across switches and wire junctions",
    "Evaluate conductive vs insulating bridge materials in a circuit gap",
    "Demonstrate independent mastery of closed-loop circuit dynamics",
  ],
  activities: [
    {
      id: "act_chal_sci_intro",
      type: "intro",
      title: "Inquiry: The Industrial Circuit Tester",
      instructions: "Examine how electrical technicians detect hidden breaks in wiring.",
      config: {
        type: "intro",
        headline: "Electrical Continuity Engineering",
        body: "In complex machinery with kilometres of wiring, a single loose screw or broken connection stops the entire system. Technicians use continuity testers to verify unbroken loops and identify faulty components.",
        hookQuestion:
          "How can we test whether a circuit failure is caused by an open switch or a broken wire?",
      },
    },
    {
      id: "act_chal_sci_manip",
      type: "interactive_manipulation",
      title: "Interactive Sandbox: Material Gap Testing",
      instructions: "Test different conductive materials in the circuit loop.",
      config: {
        type: "interactive_manipulation",
        simulation: {
          simulationKind: "circuit_loop",
          initialSwitchState: "closed",
          initialWireConnected: true,
          hasBattery: true,
          hasBulb: true,
          conductiveObject: "copper_key",
          instruction:
            "Observe how inserting a conductive copper key completes the loop while rubber stops it.",
        },
      },
    },
    {
      id: "act_chal_sci_guided",
      type: "guided_practice",
      title: "Guided Challenge: Configure Closed Circuit Loop",
      instructions: "Ensure both switch and connections are closed to turn on the bulb.",
      config: {
        type: "guided_practice",
        prompt: "Verify the circuit loop and configure it so the bulb illuminates.",
        simulation: {
          simulationKind: "circuit_loop",
          initialSwitchState: "open",
          initialWireConnected: true,
          hasBattery: true,
          hasBulb: true,
          conductiveObject: "none",
          instruction: "Close the switch to complete the loop.",
        },
        targetCriteria: {
          property: "circuit_state",
          expectedValue: "closed",
        },
        successFeedback:
          "Excellent fault resolution! Loop continuity is verified and current circulates.",
        retryFeedback: "Make sure the switch is closed.",
      },
    },
    {
      id: "act_chal_sci_check_1",
      type: "independent_check",
      title: "Independent Check: Bridge Material Selection",
      instructions: "Select the appropriate material to repair a circuit gap.",
      config: {
        type: "independent_check",
        conceptId: "SCI-ELEC-CIRCUITS",
        templateId: "tpl_sci_circuits_continuity",
        itemInstanceId: "itm_model_sci_chal_1",
        prompt:
          "If a section of wire is missing from a circuit, which item placed in the gap will allow the bulb to light?",
        questionType: "choice",
        choices: [
          { id: "choice_copper_coin", text: "A clean copper coin" },
          { id: "choice_plastic_straw", text: "A plastic drinking straw" },
          { id: "choice_wooden_match", text: "A wooden matchstick" },
          { id: "choice_glass_rod", text: "A glass stirring rod" },
        ],
        correctAnswer: "choice_copper_coin",
        explanation:
          "Copper is an excellent electrical conductor that completes the electrical loop. Plastic, wood, and glass are insulators.",
      },
    },
    {
      id: "act_chal_sci_check_2",
      type: "independent_check",
      title: "Independent Check: Detecting Broken Return Paths",
      instructions: "Diagnose an electrical fault with dual terminals.",
      config: {
        type: "independent_check",
        conceptId: "SCI-ELEC-CIRCUITS",
        templateId: "tpl_sci_circuits_breaks",
        itemInstanceId: "itm_model_sci_chal_2",
        prompt:
          "A circuit has a closed switch and wire connected to the battery positive terminal, but the wire to the negative terminal is cut. What happens?",
        questionType: "choice",
        choices: [
          {
            id: "choice_no_current",
            text: "No current flows anywhere in the circuit and the bulb stays dark",
          },
          {
            id: "choice_partial_glow",
            text: "The bulb lights up because positive electricity already reached it",
          },
          {
            id: "choice_spark_air",
            text: "Electricity leaks onto the workbench from the cut wire",
          },
        ],
        correctAnswer: "choice_no_current",
        explanation:
          "Electric current requires an unbroken return path to the power source. Without a complete loop to the negative terminal, charges cannot circulate.",
      },
    },
  ],
};
