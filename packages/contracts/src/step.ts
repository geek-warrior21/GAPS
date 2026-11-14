import { z } from "zod";
import { ConceptIdSchema, ItemInstanceIdSchema } from "./domain";

export const RichTextSegmentSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("text"), v: z.string() }),
  z.object({ t: z.literal("frac"), n: z.number().int(), d: z.number().int().positive() }),
  z.object({
    t: z.literal("mixed"),
    w: z.number().int(),
    n: z.number().int().nonnegative(),
    d: z.number().int().positive(),
  }),
  z.object({ t: z.literal("blank") }),
  z.object({ t: z.literal("math"), v: z.string() }),
]);

export const RichTextSchema = z.array(RichTextSegmentSchema);

const SerializedRationalSchema = z.object({
  n: z.number().int(),
  d: z.number().int().positive(),
});

export const VisualSpecSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fraction_bar"),
    bars: z.array(
      z.object({
        parts: z.number().int().positive(),
        shaded: z.number().int().nonnegative(),
        label: z.string().optional(),
        highlightUnknown: z.boolean().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal("number_line"),
    min: z.number().int(),
    max: z.number().int(),
    divisions: z.number().int().positive(),
    markers: z
      .array(
        z.object({
          value: SerializedRationalSchema,
          label: z.string().optional(),
        }),
      )
      .optional(),
    jumps: z
      .array(
        z.object({
          from: SerializedRationalSchema,
          to: SerializedRationalSchema,
          label: z.string().optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    type: z.literal("area_model"),
    rows: z.number().int().positive(),
    cols: z.number().int().positive(),
    shadedRows: z.number().int().nonnegative(),
    shadedCols: z.number().int().nonnegative(),
  }),
]);

/** Client-safe item payload; strict object excludes answers, misconceptions, and seeds (I9). */
export const ItemViewSchema = z
  .object({
    id: ItemInstanceIdSchema,
    conceptId: ConceptIdSchema,
    prompt: RichTextSchema,
    visual: VisualSpecSchema.optional(),
    input: z.object({
      kind: z.enum(["number", "fraction", "mixed", "decimal", "comparison", "choice", "order"]),
      choices: z
        .array(
          z.object({
            id: z.string().min(1),
            label: RichTextSchema,
          }),
        )
        .optional(),
    }),
  })
  .strict();

export const SessionSummarySchema = z.object({
  itemsAttempted: z.number().int().nonnegative(),
  sparksEarned: z.number().int().nonnegative(),
  conceptsUpdated: z.array(ConceptIdSchema),
  comebackUnlocked: z.boolean(),
  note: z.string(),
});

export const StepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("item"),
    stepSeq: z.number().int().nonnegative(),
    context: z.enum(["learn", "review", "quest", "boss", "quick_check", "diagnostic"]),
    item: ItemViewSchema,
    help: z.array(z.enum(["hint", "explain", "worked_example"])),
    preShownHint: RichTextSchema.optional(),
  }),
  z.object({
    kind: z.literal("feedback_then_retry"),
    stepSeq: z.number().int().nonnegative(),
    message: RichTextSchema,
    hint: RichTextSchema.optional(),
    item: ItemViewSchema,
  }),
  z.object({
    kind: z.literal("explanation"),
    stepSeq: z.number().int().nonnegative(),
    route: z.enum(["picture", "everyday", "steps", "rephrase"]),
    body: RichTextSchema,
    visual: VisualSpecSchema.optional(),
    source: z.enum(["authored", "ai"]),
    then: z.enum(["retry", "continue"]),
  }),
  z.object({
    kind: z.literal("worked_example"),
    stepSeq: z.number().int().nonnegative(),
    steps: z.array(RichTextSchema),
    result: RichTextSchema,
  }),
  z.object({
    kind: z.literal("clarify"),
    stepSeq: z.number().int().nonnegative(),
    message: RichTextSchema,
    item: ItemViewSchema,
  }),
  z.object({
    kind: z.literal("summary"),
    stepSeq: z.number().int().nonnegative(),
    summary: SessionSummarySchema,
  }),
  z.object({
    kind: z.literal("blocked"),
    reason: z.enum(["consent_pending", "locked", "boss_locked"]),
  }),
]);

export type RichTextDto = z.infer<typeof RichTextSchema>;
export type VisualSpecDto = z.infer<typeof VisualSpecSchema>;
export type ItemViewDto = z.infer<typeof ItemViewSchema>;
export type SessionSummaryDto = z.infer<typeof SessionSummarySchema>;
export type StepDto = z.infer<typeof StepSchema>;
