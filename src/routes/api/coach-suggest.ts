import { createFileRoute } from '@tanstack/solid-router'
import { env } from 'cloudflare:workers'
import {
  chat,
  chatParamsFromRequestBody,
  toServerSentEventsResponse,
  toolDefinition,
} from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { createCodeTool, tanstackTools } from '@cloudflare/codemode/tanstack-ai'
import { DynamicWorkerExecutor } from '@cloudflare/codemode'
import { z } from 'zod'
import { SECTION_BY_ID } from '~/library/coach/sections'
import { EVALUATION_CRITERIA } from '~/library/grant/data'
import { SuggestionsSchema } from '~/library/coach/suggestions'

// SERVER "strengthen" pass. Runs grounded analysis as Code Mode inside an
// isolated Dynamic Worker (network-blocked). The model must use the code tool
// to fetch the rubric (it isn't in the prompt), genuinely exercising the
// server executor. Returns concrete, reviewable suggestions; the browser pass
// applies the accepted ones to the on-device draft.
const MODEL = 'claude-sonnet-4-6'

const getCriteria = toolDefinition({
  name: 'get_criteria',
  description:
    'Return the four ACT VET Completions Grants evaluation criteria (each 25%) and what each rewards.',
  inputSchema: z.object({}),
}).server(async () => EVALUATION_CRITERIA)

const getCoverageGuide = toolDefinition({
  name: 'get_coverage_guide',
  description:
    'Return the coverage guide (the concrete points a strong answer covers) for a given section id.',
  inputSchema: z.object({ sectionId: z.string() }),
}).server(async ({ sectionId }) => SECTION_BY_ID[sectionId]?.coverageGuide ?? [])

const SUGGEST_PROMPT = [
  'You are a coach helping improve a draft application for the ACT VET Completions Grants 2026.',
  'The user message is JSON with `draft` (sections → points; each point has an id, text, sources, and possibly "edited": true) and OPTIONALLY `newTranscript` (a fresh short conversation the applicant just had).',
  '',
  'You have a code tool (execute_typescript). Use it to call codemode.get_criteria() and codemode.get_coverage_guide(sectionId) to GROUND your analysis — the rubric is not in this prompt, so fetch it.',
  '',
  'Propose concrete, reviewable suggestions as operations:',
  '- "add": add a genuinely NEW point. ONLY allowed when `newTranscript` is present and the content comes from it — include `sources` quoting the newTranscript verbatim. Provide sectionId + proposedText + sources. Never invent facts.',
  '- "revise": reword an AI-written point so it is clearer or better aligned to a criterion. Preserve its meaning; introduce NO new facts (the point keeps its existing sources). Provide pointId + proposedText.',
  '- "remove": remove a genuinely redundant/duplicative AI-written point. Provide pointId.',
  '- "status": re-assess a section\'s traffic light. Provide sectionId + status.',
  '- "followUp": note a specific gap to cover in a future short conversation. Provide sectionId + proposedText.',
  '',
  'RULES:',
  '- NEVER propose "revise" or "remove" on a point with "edited": true — those are the applicant\'s own words. Leave them alone.',
  '- Use "add" ONLY for content grounded in `newTranscript`. If there is no `newTranscript`, do NOT add anything — only revise/remove/status/followUp to strengthen what exists.',
  '- Every suggestion needs a plain-language rationale; name the criterion it helps where relevant.',
  '- Be selective and high-value — a few strong suggestions beat many weak ones.',
].join('\n')

export const Route = createFileRoute('/api/coach-suggest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // chatParamsFromRequestBody validates the AG-UI payload itself.
        const params = await chatParamsFromRequestBody(await request.json())

        const executor = new DynamicWorkerExecutor({
          loader: env.LOADER,
          globalOutbound: null,
        })
        const codeTool = createCodeTool({
          tools: [tanstackTools([getCriteria, getCoverageGuide])],
          executor,
        })

        const abortController = new AbortController()
        const stream = chat({
          adapter: anthropicText(MODEL),
          tools: [codeTool],
          outputSchema: SuggestionsSchema,
          stream: true,
          systemPrompts: [SUGGEST_PROMPT],
          threadId: params.threadId,
          runId: params.runId,
          messages: params.messages,
          abortController,
        })
        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
})
