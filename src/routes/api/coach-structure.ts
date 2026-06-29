import { createFileRoute } from '@tanstack/solid-router'
import {
  chat,
  chatParamsFromRequestBody,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { z } from 'zod'
import { ALL_SECTIONS } from '~/library/coach/sections'
import {
  ApplicationDraftSchema,
  buildStructuringSystemPrompt,
} from '~/library/coach/schema'

// Our extras travel alongside the chat payload (top level or forwardedProps).
// Validated with a schema rather than cast.
const ExtrasSchema = z.object({
  seedSummary: z.string().optional(),
  priorDraft: z.unknown().optional(),
})

// Faithful structuring pass: takes the interview transcript (sent by the client
// as chat messages) and streams back a provenance-tagged ApplicationDraft.
// Runs on the Worker; reads ANTHROPIC_API_KEY. Streamed structured output
// requires a Claude model in ANTHROPIC_COMBINED_TOOLS_AND_SCHEMA_MODELS.
const MODEL = 'claude-sonnet-4-6'

export const Route = createFileRoute('/api/coach-structure')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const params = await chatParamsFromRequestBody(body)
        // `send(content, body)` extras may arrive at the top level or under
        // forwardedProps depending on the client transport — validate both.
        const top = ExtrasSchema.parse(body)
        const fwd = ExtrasSchema.parse(params.forwardedProps ?? {})
        const seedSummary = top.seedSummary ?? fwd.seedSummary
        // Note: with the operation-based edit pipeline, follow-up rounds use
        // /api/coach-suggest; priorDraft here remains for any direct re-structure.
        const priorDraft = top.priorDraft ?? fwd.priorDraft
        const priorDraftJson = priorDraft ? JSON.stringify(priorDraft) : undefined

        // Server-owned system prompt: faithfulness + provenance rules + the
        // section coverage guide. Never trusted to the client.
        const system = buildStructuringSystemPrompt({
          sections: ALL_SECTIONS,
          seedSummary,
          priorDraftJson,
        })

        // Lazy-load the Anthropic adapter (which pulls @anthropic-ai/sdk) only
        // when this handler runs — keeping the heavy SDK out of the eager worker
        // graph. (Statically importing it pulls the CommonJS-laden SDK into the
        // route-tree's eager chunk, which crashes SSR for every route.)
        const { anthropicText } = await import('@tanstack/ai-anthropic')

        const abortController = new AbortController()
        const stream = chat({
          adapter: anthropicText(MODEL),
          outputSchema: ApplicationDraftSchema,
          stream: true,
          // The full draft (12 sections × points × verbatim quotes) far exceeds
          // the adapter's 1024-token default — which truncates the JSON mid-
          // stream, so the structured output never completes and the UI stalls.
          modelOptions: { max_tokens: 32000 },
          threadId: params.threadId,
          runId: params.runId,
          systemPrompts: [system],
          messages: params.messages,
          abortController,
        })

        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
})
