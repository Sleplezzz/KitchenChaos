import { z } from "zod";

/**
 * Esquemas de salida estructurada por agente (checklist: "Define strict
 * model response schemas"). El SDK de IA valida contra estos esquemas
 * ANTES de que cualquier decisión del modelo llegue a publicarse — si
 * la salida no calza, se trata como fallo de modelo y activa el
 * fallback determinista (ver fallbacks.ts).
 *
 * `thought` se mantiene corto a propósito: es una explicación operativa
 * visible en la UI, no un razonamiento interno.
 */

const thoughtSchema = z
  .string()
  .trim()
  .min(1, "thought no puede estar vacío")
  .max(140, "thought debe ser una explicación corta (máx. 140 caracteres)");

export const CoordinatorDecisionSchema = z.object({
  station: z.enum(["principal", "reserve"]),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  thought: thoughtSchema,
});

export const BackupDecisionSchema = z.object({
  thought: thoughtSchema,
});

export const DeliveryDecisionSchema = z.object({
  thought: thoughtSchema,
});
