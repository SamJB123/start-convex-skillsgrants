// On-device data layer for the coach. Everything sensitive (interview
// transcript, generated draft, provenance) lives in the browser via OPFS
// (wa-sqlite) — NOT in Convex. This is a hard data-sovereignty requirement for
// the communities we support. Cross-device sync is consciously traded away.
//
// Collections initialise asynchronously (OPFS opens a Web Worker), so this is
// strictly browser-only and exposes a lazily-created singleton.

import { isServer } from '@solidjs/web'
import { createCollection } from '@tanstack/db'
import {
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
  persistedCollectionOptions,
} from '@tanstack/browser-db-sqlite-persistence'

export type VoiceProvider = 'openai' | 'elevenlabs'

// One drafting effort. Rounds increment with each follow-up interview.
export type CoachSession = {
  id: string
  createdAt: number
  updatedAt: number
  round: number
  provider: VoiceProvider
  status: 'interviewing' | 'structuring' | 'review' | 'done'
  // The structured draft (ApplicationDraft) as JSON, once built. Lets the draft
  // be revisited without re-structuring, and carries manual edits.
  draftJson?: string
  // The round the current draftJson reflects. If round > draftRound, new
  // conversation has happened since → the draft needs a smart-merge rebuild.
  draftRound?: number
}

// A point-in-time snapshot of a draft, so applicants can revisit/restore older
// versions (e.g. wording they preferred before a follow-up round).
export type DraftVersionRow = {
  id: string
  sessionId: string
  version: number
  createdAt: number
  round: number
  draftJson: string
}

// A single utterance from the interview (kept on-device).
export type TranscriptSegment = {
  id: string
  sessionId: string
  round: number
  role: 'user' | 'assistant'
  text: string
  startTime: number // seconds from interview start
  endTime: number
}

// Per-section draft state with traffic-light coverage.
export type SectionRow = {
  id: string // `${sessionId}:${sectionId}`
  sessionId: string
  sectionId: string
  status: 'green' | 'yellow' | 'red'
  followUps: string[]
  gaps: string[]
  updatedAt: number
  edited: boolean // true once a human hand-edits (drops interview-provenance guarantee)
}

// A populated point within a section, in the applicant's own words.
export type PointRow = {
  id: string
  sessionId: string
  sectionId: string
  text: string
  order: number
  edited: boolean
}

// Provenance: the verbatim transcript excerpt(s) a point was derived from.
export type ProvenanceRow = {
  id: string
  pointId: string
  sessionId: string
  quote: string
  startTime: number
}

// A captured "brick" from the live interview (key concept + coverage). Persisted
// continuously so an interrupted conversation can be resumed/seeded.
export type NoteRow = {
  id: string
  sessionId: string
  round: number
  sectionId: string
  keyConcept: string
  coverage: 'touched' | 'covered'
  at: number
}

// Inferred from init() so the exact persisted-collection types (utils,
// non-single-result) come straight from the library rather than being
// hand-reconstructed.
export type CoachCollections = Awaited<ReturnType<typeof init>>

let dbPromise: Promise<CoachCollections> | null = null

// Lazily open the OPFS database and create the persisted collections (once).
export function getCoachDb(): Promise<CoachCollections> {
  if (isServer) {
    return Promise.reject(
      new Error('Coach on-device storage is only available in the browser.'),
    )
  }
  if (!dbPromise) dbPromise = init()
  return dbPromise
}

async function init() {
  const database = await openBrowserWASQLiteOPFSDatabase({
    databaseName: 'actvet-coach.sqlite',
  })
  const persistence = createBrowserWASQLitePersistence({ database })

  const sessions = createCollection(
    persistedCollectionOptions<CoachSession, string>({
      id: 'coach_sessions',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )
  const segments = createCollection(
    persistedCollectionOptions<TranscriptSegment, string>({
      id: 'coach_segments',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )
  const sections = createCollection(
    persistedCollectionOptions<SectionRow, string>({
      id: 'coach_sections',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )
  const points = createCollection(
    persistedCollectionOptions<PointRow, string>({
      id: 'coach_points',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )
  const provenance = createCollection(
    persistedCollectionOptions<ProvenanceRow, string>({
      id: 'coach_provenance',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )
  const notes = createCollection(
    persistedCollectionOptions<NoteRow, string>({
      id: 'coach_notes',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )
  const draftVersions = createCollection(
    persistedCollectionOptions<DraftVersionRow, string>({
      id: 'coach_draft_versions',
      getKey: (r) => r.id,
      persistence,
      schemaVersion: 1,
    }),
  )

  return { sessions, segments, sections, points, provenance, notes, draftVersions }
}

// The most recent conversation that was never finished (still 'interviewing') —
// i.e. interrupted by a tab-close, refresh, crash, or dropped connection.
export async function findUnfinishedSession(): Promise<CoachSession | null> {
  const { sessions } = await getCoachDb()
  const all = await sessions.toArrayWhenReady()
  const unfinished = all
    .filter((s) => s.status === 'interviewing')
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return unfinished[0] ?? null
}

// Everything captured for a drafting effort (across rounds), for resume/seeding.
export async function loadSessionContent(sessionId: string) {
  const { segments, notes } = await getCoachDb()
  const segs = (await segments.toArrayWhenReady())
    .filter((s) => s.sessionId === sessionId)
    .sort((a, b) => a.round - b.round || a.startTime - b.startTime)
  const ns = (await notes.toArrayWhenReady()).filter((n) => n.sessionId === sessionId)
  return { segments: segs, notes: ns }
}

export async function getSession(sessionId: string): Promise<CoachSession | null> {
  const { sessions } = await getCoachDb()
  const all = await sessions.toArrayWhenReady()
  return all.find((s) => s.id === sessionId) ?? null
}

// Save the built/edited draft JSON onto the session (status → 'review').
export async function saveDraft(sessionId: string, draftJson: string, round: number) {
  const { sessions } = await getCoachDb()
  sessions.update(sessionId, (d) => {
    d.draftJson = draftJson
    d.draftRound = round
    d.status = 'review'
    d.updatedAt = Date.now()
  })
}

// Snapshot a draft as a recoverable version (called before a rebuild/merge,
// capturing whatever the applicant currently has — including manual edits).
export async function snapshotDraftVersion(
  sessionId: string,
  draftJson: string,
  round: number,
) {
  const { draftVersions } = await getCoachDb()
  const existing = (await draftVersions.toArrayWhenReady()).filter(
    (v) => v.sessionId === sessionId,
  )
  const version = existing.length + 1
  draftVersions.insert({
    id: `${sessionId}:v${version}`,
    sessionId,
    version,
    createdAt: Date.now(),
    round,
    draftJson,
  })
}

export async function loadDraftVersions(sessionId: string): Promise<DraftVersionRow[]> {
  const { draftVersions } = await getCoachDb()
  return (await draftVersions.toArrayWhenReady())
    .filter((v) => v.sessionId === sessionId)
    .sort((a, b) => b.version - a.version)
}
