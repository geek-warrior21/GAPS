import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface PartParams {
  readonly a: number;
  readonly b: number;
}

export const partShapeTemplate: Template<PartParams> = {
  id: "MATH-FRAC-PART/identify-shape",
  version: 1,
  conceptId: "MATH-FRAC-PART",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): PartParams | null {
    const b = rng.int(2, 8);
    const a = rng.int(1, b - 1);
    if (a * 2 === b) {
      // Avoid ambiguity with ratio when a == b - a
      if (rng.next() > 0.5) return null;
    }
    return { a, b };
  },
  prompt(p: PartParams): RichText {
    return [
      {
        t: "text",
        v: `A strip is divided into ${p.b} equal parts. Exactly ${p.a} parts are shaded. What fraction of the strip is shaded?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: PartParams) {
    return { kind: "rational", value: rational(BigInt(p.a), BigInt(p.b)), form: "any" };
  },
  misconceptions(p: PartParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    if (p.a !== p.b - p.a) {
      result["MC-PART-RATIO"] = rational(BigInt(p.a), BigInt(p.b - p.a));
    }
    return result;
  },
  hints() {
    return [
      [{ t: "text", v: "Count how many parts are shaded." }],
      [{ t: "text", v: "Count the total number of equal parts in the strip." }],
      [{ t: "text", v: "Write shaded parts over total parts: ☐ / ☐." }],
    ];
  },
  workedExample(rng: Rng, p: PartParams) {
    let exB = rng.int(3, 9);
    while (exB === p.b) exB = rng.int(3, 9);
    const exA = rng.int(1, exB - 1);
    return {
      steps: [
        [{ t: "text", v: `A circle has ${exB} equal slices. ${exA} slices are shaded.` }],
        [{ t: "text", v: "Shaded slices go on top; total slices go at the bottom." }],
      ],
      result: [
        { t: "text", v: `The shaded fraction is ` },
        { t: "frac", n: exA, d: exB },
        { t: "text", v: "." },
      ],
    };
  },
  visual(p: PartParams) {
    return {
      type: "fraction_bar",
      bars: [{ parts: p.b, shaded: p.a }],
    };
  },
};

export interface CollectionParams {
  readonly items: number;
  readonly chosen: number;
}

export const partCollectionTemplate: Template<CollectionParams> = {
  id: "MATH-FRAC-PART/collection",
  version: 1,
  conceptId: "MATH-FRAC-PART",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): CollectionParams | null {
    const items = rng.int(5, 12);
    const chosen = rng.int(1, items - 1);
    if (chosen * 2 === items) return null;
    return { items, chosen };
  },
  prompt(p: CollectionParams): RichText {
    return [
      {
        t: "text",
        v: `A box holds ${p.items} laddoos. Priya eats ${p.chosen} of them. What fraction of the laddoos did Priya eat?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: CollectionParams) {
    return { kind: "rational", value: rational(BigInt(p.chosen), BigInt(p.items)), form: "any" };
  },
  misconceptions(p: CollectionParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    if (p.chosen !== p.items - p.chosen) {
      result["MC-PART-RATIO"] = rational(BigInt(p.chosen), BigInt(p.items - p.chosen));
    }
    return result;
  },
  hints() {
    return [
      [{ t: "text", v: "Identify the number of laddoos eaten." }],
      [{ t: "text", v: "Identify the total number of laddoos in the box." }],
      [{ t: "text", v: "Put eaten laddoos over total laddoos." }],
    ];
  },
  workedExample(rng: Rng, p: CollectionParams) {
    let exTotal = rng.int(6, 14);
    while (exTotal === p.items) exTotal = rng.int(6, 14);
    const exChosen = rng.int(1, exTotal - 1);
    return {
      steps: [
        [{ t: "text", v: `There are ${exTotal} pencils. ${exChosen} pencils are red.` }],
        [{ t: "text", v: "Write red pencils on top and all pencils on the bottom." }],
      ],
      result: [
        { t: "text", v: `Red fraction = ` },
        { t: "frac", n: exChosen, d: exTotal },
        { t: "text", v: "." },
      ],
    };
  },
};

export interface GridParams {
  readonly rows: number;
  readonly cols: number;
  readonly shaded: number;
}

export const partGridTemplate: Template<GridParams> = {
  id: "MATH-FRAC-PART/grid-area",
  version: 1,
  conceptId: "MATH-FRAC-PART",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): GridParams | null {
    const rows = rng.int(2, 4);
    const cols = rng.int(2, 5);
    const total = rows * cols;
    const shaded = rng.int(1, total - 1);
    if (shaded * 2 === total) return null;
    return { rows, cols, shaded };
  },
  prompt(p: GridParams): RichText {
    const total = p.rows * p.cols;
    return [
      {
        t: "text",
        v: `A grid has ${p.rows} rows and ${p.cols} columns of squares, making ${total} equal squares. Exactly ${p.shaded} squares are green. What fraction of the grid is green?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: GridParams) {
    const total = p.rows * p.cols;
    return { kind: "rational", value: rational(BigInt(p.shaded), BigInt(total)), form: "any" };
  },
  misconceptions(p: GridParams) {
    const total = p.rows * p.cols;
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    if (p.shaded !== total - p.shaded) {
      result["MC-PART-RATIO"] = rational(BigInt(p.shaded), BigInt(total - p.shaded));
    }
    return result;
  },
  hints() {
    return [
      [{ t: "text", v: "Green squares form the numerator on top." }],
      [{ t: "text", v: "Total squares in the grid form the denominator at the bottom." }],
      [{ t: "text", v: "Write green squares divided by total squares." }],
    ];
  },
  workedExample(rng: Rng, p: GridParams) {
    let exR = rng.int(2, 4);
    let exC = rng.int(2, 4);
    while (exR * exC === p.rows * p.cols) {
      exR = rng.int(2, 4);
      exC = rng.int(2, 4);
    }
    const exTotal = exR * exC;
    const exShaded = rng.int(1, exTotal - 1);
    return {
      steps: [
        [
          {
            t: "text",
            v: `A grid has ${exR} rows and ${exC} columns, giving ${exTotal} squares. ${exShaded} are coloured.`,
          },
        ],
        [{ t: "text", v: "Write coloured squares over all squares in the grid." }],
      ],
      result: [
        { t: "text", v: `Fraction = ` },
        { t: "frac", n: exShaded, d: exTotal },
        { t: "text", v: "." },
      ],
    };
  },
  visual(p: GridParams) {
    return {
      type: "area_model",
      rows: p.rows,
      cols: p.cols,
      shadedRows: Math.floor(p.shaded / p.cols),
      shadedCols: p.shaded % p.cols,
    };
  },
};

export const partTemplates = [partShapeTemplate, partCollectionTemplate, partGridTemplate] as const;
