import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Yes / No / Not-sure answer used throughout the eligibility wizard.
const yn = v.union(v.literal('yes'), v.literal('no'), v.literal('unsure'))

// The wizard answers blob. Kept small and bounded (no unbounded arrays), so it
// is safe to store on a single document. Mirrors `Answers` in
// src/library/grant/assess.ts.
export const answersValidator = v.object({
  orgType: v.optional(v.string()),
  isAccoOrFno: v.optional(v.boolean()),
  orgRequirements: v.record(v.string(), yn),
  supportsParticipants: v.optional(yn),
  hasPartnerships: v.optional(yn),
  fundingSought: v.union(v.number(), v.null()),
  withinTimeframe: v.optional(yn),
  externalRtoTraining: v.optional(yn),
  expenditureOver5k: v.optional(yn),
  engagesVolunteers: v.optional(yn),
  participantRequirements: v.record(v.string(), yn),
})

export default defineSchema({
  // Eligibility & navigation assessments. One (latest) per signed-in user for
  // the proof of concept; anonymous users keep their assessment in the browser.
  assessments: defineTable({
    userId: v.string(),
    answers: answersValidator,
    currentStep: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  // --- template demo (kept so the existing dashboard keeps working) ---
  numbers: defineTable({
    value: v.number(),
    userId: v.string(),
  }).index('userId', ['userId']),
})
