import type {
  AnswerSpec,
  ConceptId,
  MisconceptionId,
  Rational,
  RichText,
  Rng,
  VisualSpec,
} from "@gaps/domain";

export interface ItemInputSpec {
  readonly kind: "number" | "fraction" | "mixed" | "decimal" | "comparison" | "choice" | "order";
  readonly choices?: readonly { readonly id: string; readonly label: RichText }[];
  readonly orderItems?: readonly RichText[];
}

export interface Template<P = unknown> {
  readonly id: string;
  readonly version: number;
  readonly conceptId: ConceptId;
  readonly difficulty: 1 | 2 | 3;
  readonly review: {
    readonly status: "draft" | "reviewed" | "retired";
    readonly by?: string;
    readonly at?: string;
  };
  generate(rng: Rng): P | null;
  prompt(p: P): RichText;
  input(p: P): ItemInputSpec;
  answer(p: P): AnswerSpec;
  misconceptions?(p: P): Partial<Record<MisconceptionId, Rational | "<" | ">" | "=">>;
  hints(p: P): readonly [RichText, RichText, RichText];
  workedExample(rng: Rng, p: P): { readonly steps: readonly RichText[]; readonly result: RichText };
  visual?(p: P): VisualSpec;
}

export interface ChapterDefinition {
  readonly id: "A" | "B" | "C";
  readonly strand: "fractions";
  readonly title: string;
  readonly ord: number;
}

export interface ConceptDefinition {
  readonly id: ConceptId;
  readonly chapterId: "A" | "B" | "C";
  readonly title: string;
  readonly studentTitle: string;
  readonly description: string;
  readonly gradeMin: number;
  readonly gradeMax: number;
  readonly topoOrder: number;
}

export interface EdgeDefinition {
  readonly prereqId: ConceptId;
  readonly conceptId: ConceptId;
}

export interface MisconceptionDefinition {
  readonly id: MisconceptionId;
  readonly conceptIds: readonly ConceptId[];
  readonly title: string;
  readonly studentFeedback: string;
  readonly teacherNote: string;
}

export interface ConceptExplanation {
  readonly conceptId: ConceptId;
  readonly picture: RichText;
  readonly everyday: RichText;
  readonly steps: RichText;
}
