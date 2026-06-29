// The structured-output schema Claude fills after the interview, and the two
// system prompts that govern the coach. Provenance has no library primitive, so
// we encode it IN the schema: every populated point bundles its value with the
// verbatim transcript excerpt(s) that justify it.

import { z } from 'zod'
import { ALL_SECTIONS, type CoachSection } from './sections'

// --- Structured output schema ---------------------------------------------

// A verbatim excerpt from the interview that justifies a populated point.
export const ProvenanceSchema = z.object({
  quote: z
    .string()
    .describe('VERBATIM excerpt from the interview transcript — copy it exactly, do not paraphrase'),
  startTime: z
    .number()
    .describe('Start time of the excerpt in seconds from the start of the interview'),
})

// One structured point, traceable to what the applicant actually said.
export const PopulatedPointSchema = z.object({
  // Stable id assigned by OUR code (not the model) so follow-up rounds can target
  // points precisely. The model must never invent or change ids.
  id: z.string().optional(),
  text: z
    .string()
    .describe(
      "The application point, in the applicant's own voice — translated/structured from what they said, never invented",
    ),
  edited: z
    .boolean()
    .optional()
    .describe(
      'True ONLY for points the applicant hand-wrote/edited. You (the AI) must never set this — leave it unset on points you author.',
    ),
  sources: z
    .array(ProvenanceSchema)
    .describe(
      'Verbatim transcript excerpt(s) this point is derived from. Include at least one for every point you author (applicant-edited points may have none).',
    ),
})

export const SECTION_IDS = ALL_SECTIONS.map((s) => s.id) as [string, ...string[]]

// Traffic-light coverage for a section after a round.
export const SectionStatus = z.enum(['green', 'yellow', 'red'])

export const SectionDraftSchema = z.object({
  sectionId: z.enum(SECTION_IDS).describe('Which application section this is'),
  status: SectionStatus.describe(
    'green = well covered; yellow = partially covered, needs elaboration; red = not yet covered',
  ),
  points: z
    .array(PopulatedPointSchema)
    .describe('Structured points for this section, each with provenance. Empty if red.'),
  followUps: z
    .array(z.string())
    .describe(
      'For yellow sections: specific, friendly follow-up prompts to ask next round to strengthen this section',
    ),
  gaps: z
    .array(z.string())
    .describe('For red/yellow sections: what is missing and needs to be discussed'),
})

export const ApplicationDraftSchema = z.object({
  sections: z.array(SectionDraftSchema),
})

export type Provenance = z.infer<typeof ProvenanceSchema>
export type PopulatedPoint = z.infer<typeof PopulatedPointSchema>
export type SectionDraft = z.infer<typeof SectionDraftSchema>
export type ApplicationDraft = z.infer<typeof ApplicationDraftSchema>

// --- Prompt builders -------------------------------------------------------

function coverageChecklist(sections: CoachSection[]): string {
  return sections
    .map(
      (s) =>
        `- ${s.title} (${s.id})${s.weight ? ` [${s.weight}%]` : ''}: ${s.purpose}\n` +
        s.coverageGuide.map((g) => `    • ${g}`).join('\n'),
    )
    .join('\n')
}

// Instructions for the realtime VOICE model (the interviewer). The goal is a
// warm, organic ~10-minute conversation — NOT reading a list of questions.
export function buildInterviewInstructions(opts: {
  sections: CoachSection[]
  seedSummary?: string
  /** When the user wants to focus a follow-up round on one section. */
  focusSectionId?: string
  /** Sections still needing work (drives a follow-up round). */
  outstanding?: { title: string; gaps: string[] }[]
}): string {
  const focus = opts.focusSectionId
    ? ALL_SECTIONS.find((s) => s.id === opts.focusSectionId)
    : undefined
  const fields = opts.sections.filter((s) => s.kind === 'projectPlan')
  const criteria = opts.sections.filter((s) => s.kind === 'criterion')

  return [
    `You are a warm, PROACTIVE grant coach having a live spoken conversation (about ten minutes) with someone applying for the ACT VET Completions Grants 2026. Many applicants are from Aboriginal and Torres Strait Islander communities and other priority groups; some find writing hard. Your job is to gently draw out everything their application needs — but it must feel like a genuine, encouraging yarn, never an interview or a form.`,
    ``,
    focus
      ? `OPEN by warmly picking that thread back up yourself — don't wait for them. A short, friendly lead-in, then your first question.`
      : `OPEN THE CONVERSATION YOURSELF — lead; don't wait for them to know what to say. Greet them warmly and open with ONE inviting, concrete question about the heart of it, for example: "I'd love to hear about the project you've got in mind — who are you hoping to help, and what's getting in their way right now?" Keep your opener short and human.`,
    ``,
    `BE AN ACTIVE LISTENER AND FACILITATOR:`,
    `- You lead the conversation. Talk less so they talk more: keep your turns to a sentence or two, and ALWAYS end your turn with a warm question or invitation — never trail off into silence.`,
    `- Reflect back what you heard in a few words so they feel heard ("So young people are dropping out before they finish — that's exactly what this grant is for"), then ask ONE focused follow-up that deepens it.`,
    `- Follow their energy; pull on the threads they care about. When a thread is rich enough, make a NATURAL bridge to something the application still needs ("That's great — and who's helping you make it happen? Any partners or local organisations?"). Steer by curiosity, not by working through a list.`,
    `- One thing at a time. Never fire several questions at once, and never read a checklist aloud.`,
    `- If they go quiet, hesitate, or say "I don't know", reassure them, make the question smaller, and offer an example of the KIND of answer — never put specific facts or words in their mouth.`,
    `- Plain, everyday language. Be mindful of cultural load: don't make them explain or justify their identity, and don't ask for unpaid cultural labour.`,
    `- You are drawing out THEIR words and THEIR truth — never invent, suggest, or assume facts, numbers, or partners.`,
    ``,
    focus
      ? `THIS IS A FOCUSED FOLLOW-UP about "${focus.title}". Concentrate here:\n${focus.coverageGuide.map((g) => `    • ${g}`).join('\n')}`
      : [
          `WHAT YOU'RE GATHERING (your PRIVATE map — weave it in through natural segues; never read it out or treat it as an order). Two DIFFERENT things:`,
          ``,
          `1) THE PLAN FIELDS TO POPULATE — the concrete sections of their application you're drawing content out for:`,
          coverageChecklist(fields),
          ``,
          `2) THE FOUR QUALITIES ASSESSORS SCORE (25% each) — these are NOT boxes to fill in; they are the lens the application is judged by. As you gather the content above, keep gently steering so it adds up to clear evidence of these qualities:`,
          coverageChecklist(criteria),
        ].join('\n'),
    opts.outstanding && opts.outstanding.length
      ? `\nThese areas still need more from a previous round — prioritise them:\n${opts.outstanding
          .map((o) => `- ${o.title}: ${o.gaps.join('; ')}`)
          .join('\n')}`
      : ``,
    opts.seedSummary
      ? `\nWHAT WE ALREADY KNOW (from their eligibility check — do not re-ask, just build on it):\n${opts.seedSummary}`
      : ``,
    ``,
    `TAKING NOTES (do this continuously): you have a tool "captureNote". Call it QUIETLY and OFTEN as you listen — each time the applicant shares something noteworthy, capture a 2–5 word key concept or stand-out insight (NOT a full sentence), the section id it relates to, and whether that section is now "touched" or well "covered". This is how the person sees that they are being heard. Never mention the tool or that you are taking notes.`,
    ``,
    `TIMING: aim for a relaxed conversation of around ten minutes. A facilitator will send you private cues in square brackets, e.g. "[DIRECTOR: …]" — treat these as quiet guidance meant only for you: act on them naturally, and don't read them aloud or mention them. When a cue signals that time is getting close, gently start drawing the conversation toward a natural pause point. It's completely fine if not everything is covered — reassure the person we've made a great start and can pick up again in another short chat. Then let them know you'll turn what they shared into a draft they can review.`,
  ]
    .filter(Boolean)
    .join('\n')
}

// System prompt for the Claude STRUCTURING pass. Faithfulness + provenance are
// the absolute rules.
export function buildStructuringSystemPrompt(opts: {
  sections: CoachSection[]
  seedSummary?: string
  /** When present, run in UPDATE MODE: merge new conversation into this draft. */
  priorDraftJson?: string
}): string {
  return [
    `You structure a grant-application interview transcript into application sections for the ACT VET Completions Grants 2026. You are a faithful scribe, not an author.`,
    ``,
    `ABSOLUTE RULES:`,
    `1. FAITHFUL ONLY. Use ONLY what the applicant actually said. Translate spoken language into clear written points and organise it — but NEVER invent, infer, extrapolate, embellish, or add facts, numbers, names, dates or claims that were not stated.`,
    `2. PROVENANCE ON EVERY POINT. Each point MUST include at least one \`sources\` entry with a VERBATIM \`quote\` copied exactly from the transcript and its \`startTime\` in seconds. If you cannot find a supporting quote, do not write the point.`,
    `3. KEEP THEIR VOICE. Preserve the applicant's authentic wording and meaning. Do not smooth away cultural framing or lived experience.`,
    `4. ASSESS COVERAGE per section with a traffic light:`,
    `   - green: well covered against the section's guide;`,
    `   - yellow: partially covered — add specific, friendly \`followUps\` to ask next round, and note \`gaps\`;`,
    `   - red: not covered — empty \`points\`, and note in \`gaps\` what to chat about. Do NOT fabricate to fill a red section.`,
    `5. Never auto-generate cultural content (e.g. Acknowledgements of Country) or anything the applicant did not say.`,
    ``,
    `This application has TWO DIFFERENT PARTS — keep them distinct. Populate and assess every section id in both, using exactly these sections.`,
    ``,
    `PART A — PLAN FIELDS: operational sections you populate with structured points drawn faithfully from the transcript:`,
    coverageChecklist(opts.sections.filter((s) => s.kind === 'projectPlan')),
    ``,
    `PART B — THE FOUR SCORED CRITERIA (25% each): these are the QUALITIES the application is judged on, not operational boxes. Still populate them with faithful, provenance-tagged points — but SELECT and FRAME the points to show how the project demonstrates each quality (draw on the same things the applicant said; never just duplicate the plan fields, and never fabricate to make the case stronger):`,
    coverageChecklist(opts.sections.filter((s) => s.kind === 'criterion')),
    opts.seedSummary
      ? `\nContext from their eligibility check (background only — still requires a transcript quote to appear as a point):\n${opts.seedSummary}`
      : ``,
    opts.priorDraftJson
      ? [
          ``,
          `UPDATE MODE — a draft already exists (JSON below) and the applicant has continued the conversation to extend it.`,
          `- Points marked "edited": true are the applicant's OWN hand-written words. They are preserved automatically OUTSIDE your output — do NOT include them in your response, and do NOT restate or paraphrase their content anywhere.`,
          `- Keep or refine the points you previously authored (those without "edited"), preserving their sources, and weave in new information from the latest conversation as new points (each with at least one verbatim transcript source).`,
          `- Keep the applicant's authentic voice; re-assess each section's traffic-light status.`,
          `CURRENT DRAFT (JSON):`,
          opts.priorDraftJson,
        ].join('\n')
      : ``,
  ]
    .filter(Boolean)
    .join('\n')
}
