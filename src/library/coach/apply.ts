// BROWSER "apply" pass. Runs the accepted suggestions as edit operations
// ON-DEVICE inside an iframe sandbox (IframeSandboxExecutor), against the local
// draft. The draft never leaves the device. The operation functions (host-side,
// bound to a working copy) enforce the invariants — edited points refuse edits.

import {
  IframeSandboxExecutor,
  type ResolvedProvider,
} from '@cloudflare/codemode/browser'
import type { ApplicationDraft } from './schema'
import type { Suggestion } from './suggestions'
import {
  addPoint,
  addFollowUp,
  assignPointIds,
  removePoint,
  reorderPoints,
  revisePoint,
  setSectionStatus,
  type OpResult,
} from './operations'

export type ApplyOutcome = {
  draft: ApplicationDraft
  results: Array<OpResult>
  error?: string
  logs?: Array<string>
}

// The program the sandbox runs: it dispatches each accepted suggestion to the
// matching on-device operation. (Deterministic today; the same sandbox could
// later run model-authored apply code against these same bindings.)
const APPLY_CODE = `async () => {
  const results = []
  for (const s of __accepted) {
    if (s.kind === 'revise') results.push(await ops.revisePoint({ pointId: s.pointId, text: s.proposedText, sources: s.sources }))
    else if (s.kind === 'remove') results.push(await ops.removePoint({ pointId: s.pointId }))
    else if (s.kind === 'status') results.push(await ops.setSectionStatus({ sectionId: s.sectionId, status: s.status }))
    else if (s.kind === 'followUp') results.push(await ops.addFollowUp({ sectionId: s.sectionId, text: s.proposedText }))
    else if (s.kind === 'add') results.push(await ops.addPoint({ sectionId: s.sectionId, text: s.proposedText, sources: s.sources || [] }))
  }
  return results
}`

export async function applySuggestions(
  draft: ApplicationDraft,
  accepted: Array<Suggestion>,
): Promise<ApplyOutcome> {
  // Work on a copy with stable ids; ops mutate it host-side as the sandbox calls them.
  const working = assignPointIds(structuredClone(draft))

  // The sandbox→host call is a dynamic boundary: args arrive as `unknown`, so we
  // cast each to its operation's exact arg type and let the operation validate
  // at runtime (unknown ids/sections return an error result). No blanket `any`.
  const ops: ResolvedProvider['fns'] = {
    addPoint: async (a) => addPoint(working, a as Parameters<typeof addPoint>[1]),
    revisePoint: async (a) =>
      revisePoint(working, a as Parameters<typeof revisePoint>[1]),
    removePoint: async (a) =>
      removePoint(working, a as Parameters<typeof removePoint>[1]),
    reorderPoints: async (a) =>
      reorderPoints(working, a as Parameters<typeof reorderPoints>[1]),
    setSectionStatus: async (a) =>
      setSectionStatus(working, a as Parameters<typeof setSectionStatus>[1]),
    addFollowUp: async (a) =>
      addFollowUp(working, a as Parameters<typeof addFollowUp>[1]),
  }
  const provider: ResolvedProvider = { name: 'ops', fns: ops }

  const executor = new IframeSandboxExecutor()
  // Inline the accepted suggestions; the executor normalizes + invokes the arrow.
  const code = APPLY_CODE.replace('__accepted', JSON.stringify(accepted))

  const res = await executor.execute(code, [provider])
  return {
    draft: working,
    results: (res.result as Array<OpResult>) ?? [],
    error: res.error,
    logs: res.logs,
  }
}
