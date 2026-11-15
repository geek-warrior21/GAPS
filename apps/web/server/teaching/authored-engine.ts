import type {
  LessonActivity,
  LessonTeachingAction as TeachingAction,
  TeachingDecisionInput,
  TeachingDecisionOutput,
} from "@gaps/contracts";
import type { TeachingDecisionEngine } from "./types";
import { TeachingPolicyEngine } from "./policy";

/**
 * Deterministic, authored implementation of TeachingDecisionEngine.
 * Operates without any external AI provider or network call.
 * Requirement 2: "Keep a deterministic authored implementation of the same interface
 * so the entire experience works without a provider."
 */
export class AuthoredTeachingDecisionEngine implements TeachingDecisionEngine {
  public async decideNextStep(input: TeachingDecisionInput): Promise<TeachingDecisionOutput> {
    const policyResult = TeachingPolicyEngine.evaluatePolicy(input);
    const action = policyResult.recommendedAction;
    const evidence = policyResult.evidence;
    const assessmentTarget = policyResult.assessmentTarget;

    const activity = this.buildActivityForAction(
      action,
      input.objectiveId,
      evidence.inferredMisconception,
      evidence.isAmbiguous,
      evidence.remediationCycle,
      input.previouslyDeliveredActivities.length + 1,
    );

    return {
      action,
      activity,
      evidence,
      assessmentTarget,
      audit: {
        source: "authored",
        unverifiedExplanatoryProse: false,
      },
    };
  }

  private buildActivityForAction(
    action: TeachingAction,
    objectiveId: string,
    misconception: string | null | undefined,
    isAmbiguous: boolean,
    remediationCycle: number,
    stepNum: number,
  ): LessonActivity {
    const isMaths = objectiveId === "MATH-FRAC-PART" || objectiveId === "MATH-FRAC-EQUIV";

    switch (action) {
      // =======================================================================
      // 1. PAUSE (Bounded Remediation / Stopping Point)
      // =======================================================================
      case "pause": {
        return {
          id: `act_pause_step_${stepNum}`,
          type: "stopping_point",
          title: "Support & Reflection: Let's Pause for Now",
          instructions: "Take a short break to let these ideas settle. Your progress is saved.",
          config: {
            type: "stopping_point",
            headline: isMaths
              ? "Let's Pause & Review Key Fraction Ideas"
              : "Let's Pause & Review Circuit Fundamentals",
            body: isMaths
              ? "Fractions can be tricky when numbers flip. Taking a short pause helps your brain reset. Remember: the denominator always counts the total equal pieces in one whole."
              : "Circuit loops require complete paths. Taking a short pause helps solidify your understanding. Remember: electric current cannot jump across empty air gaps.",
            recommendation:
              "Save your progress now. You can return anytime to resume with a fresh perspective.",
            keyTakeaways: isMaths
              ? [
                  "Denominator (Down) = Total equal pieces into which the whole is divided",
                  "Numerator (Top) = Number of selected or shaded pieces",
                  "3 shaded out of 4 total is ALWAYS 3/4, never 4/3",
                ]
              : [
                  "A circuit must be a complete, unbroken conducting loop",
                  "An open switch creates an air gap that halts current immediately",
                  "Current flows from the battery, through the bulb, and back to the battery",
                ],
          },
        };
      }

      // =======================================================================
      // 2. ADVANCE (Mastery Threshold Reached)
      // =======================================================================
      case "advance": {
        return {
          id: `act_advance_step_${stepNum}`,
          type: "intro",
          title: "Milestone Achieved: Understanding Demonstrated!",
          instructions:
            "You have demonstrated consistent, independent mastery across multiple checks.",
          config: {
            type: "intro",
            headline: isMaths
              ? "Mastery Demonstrated: Parts of a Whole!"
              : "Mastery Demonstrated: Electric Circuits!",
            body: isMaths
              ? "You consistently identified numerators and denominators without confusion across multiple questions. You are now ready to advance to Equivalent Fractions."
              : "You demonstrated an accurate understanding of continuous loops, air gaps, and circuit continuity. You are ready to explore Conductors & Insulators.",
            hookQuestion: "Ready to take on the next curriculum milestone?",
          },
        };
      }

      // =======================================================================
      // 3. INDEPENDENT CHECK
      // =======================================================================
      case "independent_check": {
        // 3A: Ambiguous Error -> Diagnostic Question
        if (isAmbiguous) {
          if (isMaths) {
            return {
              id: `act_diag_maths_${stepNum}`,
              type: "independent_check",
              title: "Diagnostic Check: Meaning of the Numbers",
              instructions: "Choose the statement that correctly explains the fraction.",
              config: {
                type: "independent_check",
                conceptId: objectiveId,
                templateId: "tpl_frac_diagnostic_roles",
                itemInstanceId: `itm_frac_diag_${stepNum}`,
                seed: 100 + stepNum,
                prompt: "In the fraction 3/4, what does the bottom number 4 represent?",
                questionType: "choice",
                choices: [
                  {
                    id: "choice_total",
                    text: "The total number of equal parts the whole is divided into",
                  },
                  {
                    id: "choice_shaded",
                    text: "The number of parts that are shaded",
                  },
                ],
                correctAnswer: "choice_total",
                explanation:
                  "The bottom number (denominator) always tells us the total number of equal parts that make up one whole.",
              },
            };
          } else {
            return {
              id: `act_diag_sci_${stepNum}`,
              type: "independent_check",
              title: "Diagnostic Check: Circuit Path Requirement",
              instructions: "Select the rule that electric current always follows.",
              config: {
                type: "independent_check",
                conceptId: objectiveId,
                templateId: "tpl_sci_diagnostic_path",
                itemInstanceId: `itm_sci_diag_${stepNum}`,
                seed: 200 + stepNum,
                prompt: "What does electric current require to keep a light bulb glowing?",
                questionType: "choice",
                choices: [
                  {
                    id: "choice_closed_loop",
                    text: "A continuous, unbroken loop from the battery and back",
                  },
                  {
                    id: "choice_single_wire",
                    text: "Just one wire touching the bulb, with no return loop",
                  },
                ],
                correctAnswer: "choice_closed_loop",
                explanation:
                  "Electricity must have a continuous, closed conducting loop to flow and power the bulb.",
              },
            };
          }
        }

        // 3B: Standard Independent Check
        if (isMaths) {
          return {
            id: `act_check_maths_${stepNum}`,
            type: "independent_check",
            title: "Independent Check: Check Your Understanding",
            instructions: "Identify the fraction from the description.",
            config: {
              type: "independent_check",
              conceptId: objectiveId,
              templateId: "tpl_maths_frac_part_check",
              itemInstanceId: `itm_maths_check_${stepNum}`,
              seed: 300 + stepNum,
              prompt:
                "A paper strip is divided into 5 equal parts. 2 parts are shaded. What fraction of the strip is shaded?",
              questionType: "choice",
              choices: [
                { id: "choice_2_5", text: "2/5 (two-fifths)" },
                { id: "choice_5_2", text: "5/2 (five-halves)" },
                { id: "choice_2_3", text: "2/3 (two-thirds)" },
              ],
              correctAnswer: "choice_2_5",
              explanation: "2 parts are shaded out of 5 total equal parts. The fraction is 2/5.",
            },
          };
        } else {
          return {
            id: `act_check_sci_${stepNum}`,
            type: "independent_check",
            title: "Independent Check: Circuit Continuity",
            instructions: "Predict what happens to the circuit.",
            config: {
              type: "independent_check",
              conceptId: objectiveId,
              templateId: "tpl_sci_circuits_continuity",
              itemInstanceId: `itm_sci_check_${stepNum}`,
              seed: 400 + stepNum,
              prompt: "A switch in a simple circuit is opened. Why does the bulb turn off?",
              questionType: "choice",
              choices: [
                {
                  id: "choice_air_gap",
                  text: "The open switch creates an air gap that current cannot cross",
                },
                {
                  id: "choice_battery_dead",
                  text: "The battery immediately loses all its chemical energy",
                },
              ],
              correctAnswer: "choice_air_gap",
              explanation:
                "Air is an insulator. An open switch creates a physical gap that breaks the continuous path, stopping the current.",
            },
          };
        }
      }

      // =======================================================================
      // 4. EXPLORE (Interactive Manipulation / Targeted Exploration)
      // =======================================================================
      case "explore": {
        if (isMaths) {
          return {
            id: `act_explore_maths_${stepNum}`,
            type: "interactive_manipulation",
            title:
              misconception === "REVERSAL"
                ? "Targeted Lab: Denominator Controls the Slices"
                : "Interactive Exploration: Fraction Strip Lab",
            instructions:
              "Adjust the strip partitions and shade parts to observe how the fraction changes.",
            config: {
              type: "interactive_manipulation",
              simulation: {
                simulationKind: "fraction_strip",
                initialParts: 4,
                initialShaded: 3,
                allowChangeParts: true,
                allowChangeShaded: true,
                minParts: 2,
                maxParts: 8,
                instruction:
                  "Notice that the bottom number ALWAYS equals the total count of equal slices.",
              },
            },
          };
        } else {
          return {
            id: `act_explore_sci_${stepNum}`,
            type: "interactive_manipulation",
            title:
              misconception === "AIR_GAP"
                ? "Targeted Lab: Testing the Open Switch Air Gap"
                : "Interactive Circuit Simulator",
            instructions: "Toggle the switch and observe the flow of charges and the bulb.",
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
                  "Flip the switch to 'closed' to create a continuous loop, or 'open' to break the loop.",
              },
            },
          };
        }
      }

      // =======================================================================
      // 5. EXPLAIN (Alternative Explanation / Different Route)
      // =======================================================================
      case "explain": {
        if (isMaths) {
          return {
            id: `act_explain_maths_${stepNum}`,
            type: "intro",
            title: "Key Strategy: The 'Denominator is Down' Memory Rule",
            instructions: "Read this simple memory anchor for naming fractions.",
            config: {
              type: "intro",
              headline: "D is for Down = Denominator",
              body: "When you look at a fraction, remember: 'D' is for 'Down' and 'Denominator'. The total number of slices stays DOWN on the plate. The pieces you eat go UP into your hands (Numerator on top). In 3/4, 4 slices are DOWN on the plate, 3 are in your hand. Never flip them!",
              hookQuestion: "Where do the total slices live? DOWN in the denominator!",
            },
          };
        } else {
          return {
            id: `act_explain_sci_${stepNum}`,
            type: "intro",
            title: "Key Concept: Why Electric Loops Cannot Have Gaps",
            instructions: "Read why electric charges require a continuous track.",
            config: {
              type: "intro",
              headline: "Electricity is Like a Closed Train Track",
              body: "Think of electric current like a toy train on an oval track. If you remove even one small section of rail, the train cannot leap across the open carpet gap! A switch acts as a movable section of track. When open, the gap stops all current immediately.",
              hookQuestion: "Can charges jump across open air? No, air is an insulator!",
            },
          };
        }
      }

      // =======================================================================
      // 6. GUIDED PRACTICE
      // =======================================================================
      case "guided_practice": {
        if (isMaths) {
          return {
            id: `act_guided_maths_${stepNum}`,
            type: "guided_practice",
            title: "Guided Challenge: Building 3/4",
            instructions: "Set the fraction strip to show exactly three-fourths.",
            config: {
              type: "guided_practice",
              prompt: "Set the strip to 4 equal parts and shade 3 parts.",
              simulation: {
                simulationKind: "fraction_strip",
                initialParts: 4,
                initialShaded: 1,
                allowChangeParts: true,
                allowChangeShaded: true,
                minParts: 2,
                maxParts: 6,
                instruction: "Shade 3 parts out of 4.",
              },
              targetCriteria: {
                property: "shadedParts",
                expectedValue: "3",
              },
              successFeedback: "Outstanding! You created 3 shaded parts in a 4-part whole (3/4).",
              retryFeedback: "Not yet! Make sure exactly 3 parts are shaded.",
            },
          };
        } else {
          return {
            id: `act_guided_sci_${stepNum}`,
            type: "guided_practice",
            title: "Guided Challenge: Closing the Circuit Loop",
            instructions: "Configure the circuit switch so the bulb glows.",
            config: {
              type: "guided_practice",
              prompt: "Close the switch to complete the loop and light the bulb.",
              simulation: {
                simulationKind: "circuit_loop",
                initialSwitchState: "open",
                initialWireConnected: true,
                hasBattery: true,
                hasBulb: true,
                conductiveObject: "none",
                instruction: "Click the switch to close it.",
              },
              targetCriteria: {
                property: "switchState",
                expectedValue: "closed",
              },
              successFeedback:
                "Great work! The closed switch completes the continuous loop and the bulb glows.",
              retryFeedback: "Not yet! The switch is still open. Click to close the loop.",
            },
          };
        }
      }

      // =======================================================================
      // 7. DEMONSTRATE / REVISIT PREREQUISITE
      // =======================================================================
      case "demonstrate":
      case "revisit_prerequisite":
      default: {
        return {
          id: `act_demo_step_${stepNum}`,
          type: "intro",
          title: isMaths
            ? "Concept Walkthrough: Equal Slices Make a Whole"
            : "Concept Walkthrough: The Closed Circuit Path",
          instructions: "Review this foundational walkthrough.",
          config: {
            type: "intro",
            headline: isMaths
              ? "Equal Parts are the Foundation"
              : "A Continuous Loop from Battery to Bulb",
            body: isMaths
              ? "Before counting parts, each part must be exactly equal in size. When a whole is partitioned into N equal pieces, each piece is 1/N."
              : "Electricity moves along a continuous physical highway made of metal. Both terminals of the battery must connect to the bulb in a continuous loop.",
            hookQuestion: "Why does equal sizing matter in fractions?",
          },
        };
      }
    }
  }
}
