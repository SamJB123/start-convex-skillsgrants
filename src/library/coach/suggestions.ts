// Suggestions produced by the SERVER "strengthen" pass (DynamicWorkerExecutor +
// grounded Code Mode). Each suggestion is a concrete, reviewable operation
// intent that the BROWSER "apply" pass turns into an actual edit on the
// on-device draft (via src/library/coach/operations.ts). The applicant accepts
// the ones they want; edited points are never targetable (enforced in ops).

import { z } from 'zod'
import { ProvenanceSchema } from './schema'

export const SuggestionSchema = z.object({
  // Assigned by our code on receipt; the model should not set it.
  id: z.string().optional(),
  kind: z.enum(['add', 'revise', 'remove', 'status', 'followUp']),
  sectionId: z.string().describe('The section this suggestion applies to'),
  pointId: z
    .string()
    .optional()
    .describe('For revise/remove: the id of the AI-written point to change'),
  proposedText: z
    .string()
    .optional()
    .describe('For add/revise/followUp: the proposed text'),
  sources: z
    .array(ProvenanceSchema)
    .optional()
    .describe('For add/revise: transcript excerpts supporting the proposed text'),
  status: z
    .enum(['green', 'yellow', 'red'])
    .optional()
    .describe('For status: the new traffic-light value'),
  rationale: z
    .string()
    .describe('Why this strengthens the application (plain language)'),
  criterion: z
    .string()
    .optional()
    .describe('Which evaluation criterion this most helps'),
})

export const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionSchema),
})

export type Suggestion = z.infer<typeof SuggestionSchema>
export type Suggestions = z.infer<typeof SuggestionsSchema>
