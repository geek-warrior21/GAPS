import type { MisconceptionDefinition } from "./types";

export const MISCONCEPTIONS: readonly MisconceptionDefinition[] = [
  {
    id: "MC-PART-RATIO",
    conceptIds: ["MATH-FRAC-PART"],
    title: "Part-to-part ratio instead of part-to-whole",
    studentFeedback: "Count the shaded parts first. Then count all parts together in the whole.",
    teacherNote: "Student wrote shaded parts over unshaded parts instead of total parts.",
  },
  {
    id: "MC-NUMLINE-TICKS",
    conceptIds: ["MATH-FRAC-NUMLINE"],
    title: "Counting tick marks instead of intervals",
    studentFeedback: "Count the hops between zero and one. Each hop is one equal step.",
    teacherNote: "Student counted tick marks including endpoints rather than unit intervals.",
  },
  {
    id: "MC-EQUIV-ADDITIVE",
    conceptIds: ["MATH-FRAC-EQUIV"],
    title: "Additive change to numerator and denominator",
    studentFeedback:
      "Equivalent fractions grow by multiplying. Multiply the top and bottom by the same factor.",
    teacherNote:
      "Student added the difference to both terms instead of multiplying by a common scale factor.",
  },
  {
    id: "MC-NUMERATOR-ONLY",
    conceptIds: ["MATH-FRAC-COMPARE"],
    title: "Comparing numerators while ignoring denominators",
    studentFeedback:
      "Check the size of each slice first. Smaller slices need different comparisons.",
    teacherNote:
      "Student compared numerators directly without considering denominator slice sizes.",
  },
  {
    id: "MC-BIGGER-DENOM",
    conceptIds: ["MATH-FRAC-COMPARE"],
    title: "Treating larger denominator as larger value",
    studentFeedback:
      "More pieces make each piece smaller. A bigger bottom number means smaller slices.",
    teacherNote: "Student applied whole-number ordering to denominators directly.",
  },
  {
    id: "MC-MIXED-ADD-PARTS",
    conceptIds: ["MATH-FRAC-MIXED"],
    title: "Adding whole to numerator directly",
    studentFeedback: "Multiply whole rotis by the slices per roti first. Then add leftover slices.",
    teacherNote:
      "Student added the whole number directly to the numerator without multiplying by the denominator.",
  },
  {
    id: "MC-MIXED-WRONG-PRODUCT",
    conceptIds: ["MATH-FRAC-MIXED"],
    title: "Incorrect product formula for mixed numbers",
    studentFeedback: "Multiply the whole number by the denominator. Then add the numerator on top.",
    teacherNote: "Student calculated (w * a + b)/b instead of (w * b + a)/b.",
  },
  {
    id: "MC-ADD-ACROSS",
    conceptIds: ["MATH-FRAC-ADDLIKE", "MATH-FRAC-ADDUNLIKE", "MATH-FRAC-WORD"],
    title: "Adding numerators and denominators across",
    studentFeedback:
      "Never add bottom numbers. Make the denominators equal, then add only top numbers.",
    teacherNote: "Student added numerators together and denominators together directly.",
  },
  {
    id: "MC-ADD-DENOMS-LIKE",
    conceptIds: ["MATH-FRAC-ADDLIKE"],
    title: "Adding denominators of like fractions",
    studentFeedback:
      "The slice size stays unchanged. Add the top numbers and keep the bottom number.",
    teacherNote: "Student added denominators when adding like fractions.",
  },
  {
    id: "MC-SUB-ACROSS",
    conceptIds: ["MATH-FRAC-ADDUNLIKE"],
    title: "Subtracting numerators and denominators across",
    studentFeedback:
      "Find a common denominator first. Subtract only the numerators once bottom numbers match.",
    teacherNote: "Student subtracted both numerators and denominators directly.",
  },
  {
    id: "MC-MULT-SAME-DENOM",
    conceptIds: ["MATH-FRAC-MULT"],
    title: "Preserving common denominator during multiplication",
    studentFeedback:
      "In multiplication, pieces get subdivided. Multiply top by top and bottom by bottom.",
    teacherNote:
      "Student preserved the denominator as in addition instead of multiplying denominators.",
  },
  {
    id: "MC-FRACTION-OF-UNIT",
    conceptIds: ["MATH-FRAC-MULT", "MATH-FRAC-WORD"],
    title: "Finding unit fraction instead of full fraction",
    studentFeedback: "Divide by the denominator to find one share. Then multiply by the numerator.",
    teacherNote: "Student computed N / d only and omitted multiplying by numerator a.",
  },
  {
    id: "MC-DIV-FLIP-FIRST",
    conceptIds: ["MATH-FRAC-DIV"],
    title: "Inverting dividend instead of divisor",
    studentFeedback:
      "Keep the first fraction steady. Flip only the second fraction, then multiply.",
    teacherNote:
      "Student inverted the first fraction (dividend) instead of the second fraction (divisor).",
  },
  {
    id: "MC-DIV-NO-FLIP",
    conceptIds: ["MATH-FRAC-DIV"],
    title: "Multiplying straight across without reciprocal",
    studentFeedback:
      "Division asks how many shares fit. Invert the second fraction before multiplying.",
    teacherNote: "Student multiplied straight across without taking the reciprocal of the divisor.",
  },
  {
    id: "MC-DEC-DIGITS",
    conceptIds: ["MATH-FRAC-DEC"],
    title: "Writing numerator and denominator as digits of a decimal",
    studentFeedback:
      "Convert the denominator to tenths or hundredths first. Then write the decimal.",
    teacherNote:
      "Student concatenated numerator and denominator as decimal digits (e.g. 1/4 -> 0.14).",
  },
] as const;

export const MISCONCEPTIONS_BY_ID: Readonly<Record<string, MisconceptionDefinition>> =
  Object.fromEntries(MISCONCEPTIONS.map((m) => [m.id, m]));
