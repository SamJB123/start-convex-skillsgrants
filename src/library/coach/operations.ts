// Point-level edit operations over an ApplicationDraft. These are the SINGLE
// source of truth for what a follow-up round may change. The Code Mode sandboxes
// (server "suggest", browser "apply") only *call* these functions — the
// invariants enforced here are what actually guarantee the applicant's
// hand-edited points are never altered. The model has no path around them.

import type {
  ApplicationDraft,
  PopulatedPoint,
  Provenance,
  SectionDraft,
} from './schema'

export type OpResult = { ok: boolean; error?: string; pointId?: string }

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `p-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

// Assign stable ids to any points missing one. Called by OUR code after the
// round-1 generation (the model never sets ids) so later rounds can target
// points precisely.
export function assignPointIds(draft: ApplicationDraft): ApplicationDraft {
  for (const section of draft.sections) {
    for (const point of section.points) {
      if (!point.id) point.id = newId()
    }
  }
  return draft
}

function findSection(
  draft: ApplicationDraft,
  sectionId: string,
): SectionDraft | undefined {
  return draft.sections.find((s) => s.sectionId === sectionId)
}

function findPoint(
  draft: ApplicationDraft,
  pointId: string,
): { section: SectionDraft; point: PopulatedPoint; index: number } | null {
  for (const section of draft.sections) {
    const index = section.points.findIndex((p) => p.id === pointId)
    if (index >= 0) return { section, point: section.points[index], index }
  }
  return null
}

// Add a brand-new point (must cite at least one transcript excerpt).
export function addPoint(
  draft: ApplicationDraft,
  args: { sectionId: string; text: string; sources: Array<Provenance> },
): OpResult {
  const section = findSection(draft, args.sectionId)
  if (!section) return { ok: false, error: `Unknown section: ${args.sectionId}` }
  if (!args.text?.trim()) return { ok: false, error: 'A new point needs text.' }
  if (!args.sources || args.sources.length < 1) {
    return {
      ok: false,
      error: 'A new point must cite at least one transcript excerpt.',
    }
  }
  const id = newId()
  section.points.push({ id, text: args.text.trim(), sources: args.sources })
  return { ok: true, pointId: id }
}

// Revise an AI-authored point. HARD INVARIANT: applicant-edited points refuse.
export function revisePoint(
  draft: ApplicationDraft,
  args: { pointId: string; text?: string; sources?: Array<Provenance> },
): OpResult {
  const loc = findPoint(draft, args.pointId)
  if (!loc) return { ok: false, error: `Unknown point: ${args.pointId}` }
  if (loc.point.edited) {
    return {
      ok: false,
      error: 'This point was hand-written by the applicant and cannot be changed.',
    }
  }
  if (args.text !== undefined) loc.point.text = args.text
  if (args.sources !== undefined) loc.point.sources = args.sources
  return { ok: true, pointId: args.pointId }
}

// Remove an AI-authored point. HARD INVARIANT: applicant-edited points refuse.
export function removePoint(
  draft: ApplicationDraft,
  args: { pointId: string },
): OpResult {
  const loc = findPoint(draft, args.pointId)
  if (!loc) return { ok: false, error: `Unknown point: ${args.pointId}` }
  if (loc.point.edited) {
    return {
      ok: false,
      error: 'This point was hand-written by the applicant and cannot be removed.',
    }
  }
  loc.section.points.splice(loc.index, 1)
  return { ok: true }
}

// Reorder a section's points by id. Unnamed points keep their relative order.
export function reorderPoints(
  draft: ApplicationDraft,
  args: { sectionId: string; order: Array<string> },
): OpResult {
  const section = findSection(draft, args.sectionId)
  if (!section) return { ok: false, error: `Unknown section: ${args.sectionId}` }
  const byId = new Map(section.points.map((p) => [p.id, p] as const))
  const reordered: Array<PopulatedPoint> = []
  for (const id of args.order) {
    const p = byId.get(id)
    if (p) {
      reordered.push(p)
      byId.delete(id)
    }
  }
  for (const p of section.points) {
    if (byId.has(p.id)) reordered.push(p)
  }
  section.points = reordered
  return { ok: true }
}

export function setSectionStatus(
  draft: ApplicationDraft,
  args: { sectionId: string; status: 'green' | 'yellow' | 'red' },
): OpResult {
  const section = findSection(draft, args.sectionId)
  if (!section) return { ok: false, error: `Unknown section: ${args.sectionId}` }
  section.status = args.status
  return { ok: true }
}

export function addFollowUp(
  draft: ApplicationDraft,
  args: { sectionId: string; text: string; kind?: 'followUp' | 'gap' },
): OpResult {
  const section = findSection(draft, args.sectionId)
  if (!section) return { ok: false, error: `Unknown section: ${args.sectionId}` }
  if (!args.text?.trim()) return { ok: false, error: 'Follow-up text required.' }
  if (args.kind === 'gap') section.gaps.push(args.text.trim())
  else section.followUps.push(args.text.trim())
  return { ok: true }
}
