import type { LessonPlan, SubjectId } from "@gaps/contracts";
import type { ConceptId } from "@gaps/domain";

/**
 * Lessons whose steps are chosen one at a time by the teaching decision engine.
 * They share the lesson endpoints, session table and player with the fixed
 * authored lessons; only the source of the next activity differs.
 */
export interface AdaptiveLessonDefinition {
  readonly lessonId: string;
  readonly objectiveId: ConceptId;
  readonly subject: SubjectId;
  readonly level: number;
  readonly topicId: string;
  readonly title: string;
  readonly description: string;
  readonly learningObjectives: readonly string[];
}

const DEFINITIONS: readonly AdaptiveLessonDefinition[] = [
  {
    lessonId: "lesson-maths-frac-part-adaptive",
    objectiveId: "MATH-FRAC-PART",
    subject: "maths",
    level: 6,
    topicId: "maths-frac-part",
    title: "Parts of a Whole: Step-by-Step",
    description:
      "A lesson that chooses each next step from your answers: explore, practise, and show what you know about fractions as parts of a whole.",
    learningObjectives: [
      "Name a fraction from equal parts of a whole",
      "Explain what the top and bottom numbers of a fraction count",
      "Recognise that fraction names need equal parts",
    ],
  },
  {
    lessonId: "lesson-sci-circuits-adaptive",
    objectiveId: "SCI-ELEC-CIRCUITS",
    subject: "science",
    level: 6,
    topicId: "sci-elec-circuits",
    title: "Simple Circuits: Step-by-Step",
    description:
      "A lesson that chooses each next step from your answers: experiment, practise, and show what you know about complete circuits.",
    learningObjectives: [
      "Explain that current flows only around a complete, unbroken loop",
      "Predict what an open switch or a loose wire does to a bulb",
      "Find the fault in a circuit that does not work",
    ],
  },
];

export function getAdaptiveLesson(lessonId: string): AdaptiveLessonDefinition | undefined {
  return DEFINITIONS.find((d) => d.lessonId === lessonId);
}

export function listAdaptiveLessons(): readonly AdaptiveLessonDefinition[] {
  return DEFINITIONS;
}

/** Lesson header stored with the session. Activities are added as they are delivered. */
export function toLessonShell(def: AdaptiveLessonDefinition): Omit<LessonPlan, "activities"> {
  return {
    lessonId: def.lessonId,
    version: "1.0",
    subject: def.subject,
    level: def.level,
    topicId: def.topicId,
    title: def.title,
    description: def.description,
    learningObjectives: [...def.learningObjectives],
  };
}
