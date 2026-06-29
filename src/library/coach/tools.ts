// The `captureNote` client tool the realtime interviewer calls continuously as
// it listens. Each call surfaces a short "brick" (a 2–5 word key concept) and
// updates the section's traffic-light coverage — this is what makes the
// applicant feel heard without showing them a live transcript.

import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { SECTION_IDS } from './schema'

export type CapturedNote = {
  sectionId: string
  keyConcept: string
  coverage: 'touched' | 'covered'
}

export function captureNoteTool(
  onNote: (note: CapturedNote) => void,
  // Optional: returns a short summary of current section coverage. Returned to
  // the model in the tool result so it always knows what's still thin and can
  // steer toward gaps — closing the loop on an otherwise fire-and-forget tool.
  getCoverage?: () => string,
) {
  return toolDefinition({
    name: 'captureNote',
    description:
      'Record a short key concept the applicant just shared and how well its section is now covered. Call this often and quietly as you listen.',
    inputSchema: z.object({
      sectionId: z.enum(SECTION_IDS).describe('Which application section this relates to'),
      keyConcept: z
        .string()
        .describe('A 2–5 word key concept, phrase, or stand-out insight — NOT a full sentence'),
      coverage: z
        .enum(['touched', 'covered'])
        .describe('Whether this section is now lightly touched on, or well covered'),
    }),
  }).client(async (input) => {
    onNote(input as CapturedNote)
    return JSON.stringify({ ok: true, coverageSoFar: getCoverage?.() })
  })
}
