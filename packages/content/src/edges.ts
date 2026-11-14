import type { EdgeDefinition } from "./types";

export const EDGES: readonly EdgeDefinition[] = [
  { prereqId: "MATH-FRAC-PART", conceptId: "MATH-FRAC-NUMLINE" },
  { prereqId: "MATH-FRAC-PART", conceptId: "MATH-FRAC-EQUIV" },
  { prereqId: "MATH-FRAC-NUMLINE", conceptId: "MATH-FRAC-EQUIV" },
  { prereqId: "MATH-FRAC-EQUIV", conceptId: "MATH-FRAC-SIMPLIFY" },
  { prereqId: "MATH-NUM-HCF", conceptId: "MATH-FRAC-SIMPLIFY" },
  { prereqId: "MATH-FRAC-EQUIV", conceptId: "MATH-FRAC-COMPARE" },
  { prereqId: "MATH-FRAC-PART", conceptId: "MATH-FRAC-MIXED" },
  { prereqId: "MATH-FRAC-NUMLINE", conceptId: "MATH-FRAC-MIXED" },
  { prereqId: "MATH-FRAC-PART", conceptId: "MATH-FRAC-ADDLIKE" },
  { prereqId: "MATH-FRAC-EQUIV", conceptId: "MATH-FRAC-ADDUNLIKE" },
  { prereqId: "MATH-FRAC-ADDLIKE", conceptId: "MATH-FRAC-ADDUNLIKE" },
  { prereqId: "MATH-NUM-LCM", conceptId: "MATH-FRAC-ADDUNLIKE" },
  { prereqId: "MATH-FRAC-PART", conceptId: "MATH-FRAC-MULT" },
  { prereqId: "MATH-FRAC-SIMPLIFY", conceptId: "MATH-FRAC-MULT" },
  { prereqId: "MATH-FRAC-MULT", conceptId: "MATH-FRAC-DIV" },
  { prereqId: "MATH-FRAC-EQUIV", conceptId: "MATH-FRAC-DEC" },
  { prereqId: "MATH-FRAC-ADDUNLIKE", conceptId: "MATH-FRAC-WORD" },
  { prereqId: "MATH-FRAC-MULT", conceptId: "MATH-FRAC-WORD" },
] as const;
