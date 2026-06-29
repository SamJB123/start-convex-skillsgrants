import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { answersValidator } from './schema'
import { authComponent } from './auth'

// Save/resume for the eligibility assessment. Persistence is for SIGNED-IN
// users only; anonymous users keep their progress in the browser. We always
// derive the user identity server-side (never trust a client-supplied id).

// Load the current user's latest assessment, or null if none / not signed in.
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx)
    if (!user?._id) return null
    const existing = await ctx.db
      .query('assessments')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!existing) return null
    return {
      answers: existing.answers,
      currentStep: existing.currentStep,
      updatedAt: existing.updatedAt,
    }
  },
})

// Upsert the current user's assessment (one document per user).
export const save = mutation({
  args: {
    answers: answersValidator,
    currentStep: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx)
    if (!user?._id) {
      throw new Error('You must be signed in to save your progress.')
    }
    const existing = await ctx.db
      .query('assessments')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    const patch = {
      answers: args.answers,
      currentStep: args.currentStep,
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, patch)
      return existing._id
    }
    return await ctx.db.insert('assessments', { userId: user._id, ...patch })
  },
})

// Clear the current user's saved assessment (start over).
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx)
    if (!user?._id) return null
    const rows = await ctx.db
      .query('assessments')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .take(50)
    for (const row of rows) await ctx.db.delete(row._id)
    return null
  },
})
