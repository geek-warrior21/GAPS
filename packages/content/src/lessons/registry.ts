import type { CurriculumTopic, LessonPlan } from "@gaps/contracts";
import { MATHS_FRAC_PART_LESSON } from "./maths-frac-part";
import { SCI_CIRCUITS_LESSON, SCI_CIRCUITS_MASTERY_LESSON } from "./sci-circuits";
import { SCI_CONDUCTORS_LESSON } from "./sci-conductors";

export const CURRICULUM_TOPICS: readonly CurriculumTopic[] = [
  // Mathematics
  {
    id: "maths-frac-part",
    subject: "maths",
    level: 6,
    title: "Fractions: Parts of a Whole",
    studentTitle: "Parts of a whole",
    description:
      "Explore equal shares and fractions using hands-on partition strips and prediction challenges.",
    defaultLessonId: "lesson-maths-frac-part-1",
    conceptId: "MATH-FRAC-PART",
    strand: "fractions",
  },
  {
    id: "maths-frac-equiv",
    subject: "maths",
    level: 6,
    title: "Equivalent Fractions: Equal Value",
    studentTitle: "Equal pieces & equivalence",
    description: "Discover why 2/4 and 1/2 cover the exact same portion of a whole.",
    defaultLessonId: "lesson-maths-frac-part-1", // maps to base fraction exploration
    conceptId: "MATH-FRAC-EQUIV",
    strand: "fractions",
  },
  // Science
  {
    id: "sci-elec-circuits",
    subject: "science",
    level: 6,
    title: "Electric Current & Simple Circuits",
    studentTitle: "Simple electric circuits",
    description:
      "Investigate how electric current flows through complete, unbroken loops with switches and bulbs.",
    defaultLessonId: "lesson-sci-circuits-1",
    conceptId: "SCI-ELEC-CIRCUITS",
    strand: "electricity",
  },
  {
    id: "sci-elec-conductors",
    subject: "science",
    level: 6,
    title: "Conductors & Insulators",
    studentTitle: "Conductors and insulators",
    description:
      "Test different materials in a circuit to see which conduct electricity and which insulate.",
    defaultLessonId: "lesson-sci-conductors-1",
    conceptId: "SCI-ELEC-CONDUCTORS",
    strand: "electricity",
  },
] as const;

export const LESSON_REGISTRY: Record<string, LessonPlan> = {
  [MATHS_FRAC_PART_LESSON.lessonId]: MATHS_FRAC_PART_LESSON,
  [SCI_CIRCUITS_LESSON.lessonId]: SCI_CIRCUITS_LESSON,
  [SCI_CIRCUITS_MASTERY_LESSON.lessonId]: SCI_CIRCUITS_MASTERY_LESSON,
  [SCI_CONDUCTORS_LESSON.lessonId]: SCI_CONDUCTORS_LESSON,
};

export function getAllCurriculumTopics(): readonly CurriculumTopic[] {
  return CURRICULUM_TOPICS;
}

export function getTopicsBySubject(subject: "maths" | "science"): CurriculumTopic[] {
  return CURRICULUM_TOPICS.filter((t) => t.subject === subject);
}

export function getTopicById(topicId: string): CurriculumTopic | undefined {
  return CURRICULUM_TOPICS.find((t) => t.id === topicId);
}

export function getLessonById(lessonId: string): LessonPlan | undefined {
  return LESSON_REGISTRY[lessonId];
}

export function getDefaultLessonForTopic(topicId: string): LessonPlan | undefined {
  const topic = getTopicById(topicId);
  if (!topic) return undefined;
  return LESSON_REGISTRY[topic.defaultLessonId];
}
