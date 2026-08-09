import { z } from "zod";
import { priorityScoreSchema } from "../../src/domain/events";

export const coordinatorDecisionSchema = z
  .object({
    station: z.enum(["principal", "reserve"]),
    priorityScore: priorityScoreSchema,
    thought: z.string().min(1).max(120),
  })
  .strict();

export const thoughtDecisionSchema = z
  .object({
    thought: z.string().min(1).max(120),
  })
  .strict();

export type CoordinatorDecision = z.infer<typeof coordinatorDecisionSchema>;
export type ThoughtDecision = z.infer<typeof thoughtDecisionSchema>;
