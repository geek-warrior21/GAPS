import type { ChapterDefinition, ConceptDefinition } from "./types";

export const SCIENCE_CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: "SCI-ELEC",
    strand: "electricity",
    title: "Electricity & Circuits",
    ord: 101,
  },
] as const;

export const SCIENCE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    id: "SCI-ELEC-CIRCUITS",
    chapterId: "SCI-ELEC",
    title: "Electric Current & Simple Circuits",
    studentTitle: "Simple electric circuits",
    description: "Understand complete circuits, switch operation, and bulb illumination.",
    gradeMin: 6,
    gradeMax: 8,
    topoOrder: 101,
  },
  {
    id: "SCI-ELEC-CONDUCTORS",
    chapterId: "SCI-ELEC",
    title: "Electrical Conductors & Insulators",
    studentTitle: "Conductors and insulators",
    description: "Distinguish materials that conduct electricity from insulators that block it.",
    gradeMin: 6,
    gradeMax: 8,
    topoOrder: 102,
  },
] as const;
