import { createFileRoute } from '@tanstack/solid-router'
import { chat } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { z } from 'zod'
import { AnalystResultSchema, buildAnalystPrompt } from '~/library/coach/analyst'

// Behind-the-scenes analyst: called (debounced) during the LIVE interview with
// the running transcript. Claude synthesises facts + leads keyed by section and
// criterion — connecting dots across the conversation — and returns the single
// most useful thing for the coach to explore next. One-shot structured output
// (no streaming): the caller only needs the final object to nudge the coach.
const MODEL = 'claude-sonnet-4-6'

const BodySchema = z.object({ transcript: z.string() })

export const Route = createFileRoute('/api/coach-analyst')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { transcript } = BodySchema.parse(await request.json())
        if (!transcript.trim()) {
          return Response.json({ facts: [], leads: [] })
        }

        const result = await chat({
          adapter: anthropicText(MODEL),
          outputSchema: AnalystResultSchema,
          systemPrompts: [buildAnalystPrompt()],
          messages: [{ role: 'user', content: transcript }],
        })

        return Response.json(result)
      },
    },
  },
})
