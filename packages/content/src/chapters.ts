import type { ChapterDefinition } from "./types";

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: "A",
    strand: "fractions",
    title: "Meet the fractions",
    ord: 1,
  },
  {
    id: "B",
    strand: "fractions",
    title: "Fraction operations",
    ord: 2,
  },
  {
    id: "C",
    strand: "fractions",
    title: "Fractions in the world",
    ord: 3,
  },
] as const;
