// The behind-the-scenes "analyst" that runs during the live interview. A
// reasoning model (Claude) reviews the running transcript, synthesises facts
// and promising leads — connecting dots across things said at different moments
// — keyed by template section AND one of the four scored criteria, and returns
// the single most useful thing for the coach to explore next. The realtime
// voice model can't do this cross-conversation synthesis well; this can.

import { z } from 'zod'
import { PROJECT_PLAN_SECTIONS, CRITERIA_SECTIONS } from './sections'

export const AnalystResultSchema = z.object({
  facts: z
    .array(
      z.object({
        sectionId: z.string().describe('Template section id this fact informs'),
        criterion: z
          .string()
          .optional()
          .describe('Which of the four criteria ids it most strengthens'),
        fact: z
          .string()
          .describe(
            'A concrete fact, synthesised faithfully from the conversation — may piece together several things the applicant said at different times. Never invented.',
          ),
      }),
    )
    .describe('Useful facts gathered so far'),
  leads: z
    .array(
      z.object({
        sectionId: z.string(),
        criterion: z.string().optional(),
        lead: z
          .string()
          .describe('A specific, promising thread worth gently exploring next'),
        connects: z
          .string()
          .optional()
          .describe('How this ties together things the applicant has already said'),
      }),
    )
    .describe('Promising leads to follow up at the right moment'),
  nextNudge: z
    .string()
    .optional()
    .describe(
      "The SINGLE most useful thing for the coach to gently explore next — one short sentence of natural guidance (not a script to read), considering what's strong and what's thin.",
    ),
})

export type AnalystResult = z.infer<typeof AnalystResultSchema>

export function buildAnalystPrompt(): string {
  const fieldList = PROJECT_PLAN_SECTIONS.map((s) => `- ${s.id}: ${s.title}`).join('\n')
  const criteriaList = CRITERIA_SECTIONS.map(
    (s) => `- ${s.id}: ${s.title} (${s.weight}%)`,
  ).join('\n')
  return [
    `You are a behind-the-scenes analyst supporting a LIVE grant-application conversation for the ACT VET Completions Grants 2026. You never speak to the applicant — you help the coach by synthesising what has been said and spotting where to go next.`,
    ``,
    `Two DIFFERENT things matter, and you must keep them distinct:`,
    `- PLAN FIELDS: the concrete sections of the application that get populated with content. A fact/lead's "sectionId" is the plan field its content belongs in.`,
    `- THE FOUR SCORED QUALITIES (criteria): the qualities the content must DEMONSTRATE to score well — NOT fields to fill in. A fact/lead's "criterion" names which quality it most strengthens.`,
    `One piece of content typically lives in a single plan field AND provides evidence for one or more qualities — part of your job is to make those connections.`,
    ``,
    `Given the transcript so far, do three things — grounded ONLY in what the applicant actually said (never invent, never infer beyond the evidence):`,
    `1. facts: concrete facts useful for the application, each keyed to the plan field (sectionId) its content belongs in and the quality (criterion) it strengthens. Where useful, CONNECT THE DOTS — combine things the applicant said at different points into one fact.`,
    `2. leads: specific, promising threads worth gently exploring next — to fill a thin plan field OR to shore up a quality that isn't yet well-evidenced — each with sectionId, criterion, and a short "connects" note on how it ties together what's been said.`,
    `3. nextNudge: the single most useful thing for the coach to gently explore next — one short sentence of natural guidance (NOT a script), weighing which fields are still thin against which qualities still lack evidence.`,
    ``,
    `PLAN FIELDS to populate (sectionId: title):`,
    fieldList,
    ``,
    `The FOUR SCORED QUALITIES (criterion id: title, weight) — what the content must demonstrate:`,
    criteriaList,
  ].join('\n')
}
