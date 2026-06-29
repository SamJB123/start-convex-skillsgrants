// Solid 2 bridge over @tanstack/ai-client's framework-agnostic RealtimeClient.
// (The official @tanstack/ai-solid hooks are Solid 1 only.) Browser-only: the
// RealtimeClient + provider adapters use WebRTC/mic, so we lazy-import them on
// start() — nothing browser-only runs at module load or during SSR.
//
// Durability: the session is created in OPFS at start and every finalised
// utterance + captured note is persisted as it arrives, so an interruption
// (tab close, refresh, dropped connection, crash) leaves a recoverable
// 'interviewing' session rather than losing the conversation.

import { createSignal, onCleanup } from 'solid-js'
import type { RealtimeClient } from '@tanstack/ai-client'
import type { RealtimeMessage } from '@tanstack/ai/client'
import type { CoachCollections, VoiceProvider } from './collections'
import { captureNoteTool, type CapturedNote } from './tools'
import { ALL_SECTIONS } from './sections'
import type { AnalystResult } from './analyst'

export type CoverageStatus = 'red' | 'yellow' | 'green'
export type NoteBrick = CapturedNote & { at: number }

const NEARLY_UP_MS = 9 * 60_000
const TIME_UP_MS = 10 * 60_000
const OVERTIME_NUDGE_EVERY_MS = 3 * 60_000
const GRACEFUL_SIGNOFF_MS = 4_000
// How long after the applicant's last turn before the background analyst runs.
const ANALYST_DEBOUNCE_MS = 2_500

const CUE = {
  nearly:
    '[DIRECTOR: about a minute to the ten-minute mark — gently begin steering toward a natural pause point.]',
  timeUp:
    '[DIRECTOR: you have reached about ten minutes. Warmly offer to pause here and turn this into a draft, while making clear you are happy to keep going if they would like.]',
  overtime:
    "[DIRECTOR: still going, and that's fine — when it feels natural, gently offer again to wrap up and build the draft, but follow the applicant's lead.]",
  finish:
    '[DIRECTOR: the applicant would like to finish now. Give a brief, warm one or two sentence sign-off, then stop.]',
}

export type StartArgs = {
  provider: VoiceProvider
  instructions: string
  /** Resume/continue an existing drafting effort (appends a new round). */
  resumeSessionId?: string
  round?: number
}

export function useRealtime(opts?: { voice?: string }) {
  const [status, setStatus] = createSignal<string>('idle')
  const [mode, setMode] = createSignal<string>('idle')
  const [error, setError] = createSignal<string | null>(null)
  const [notes, setNotes] = createSignal<NoteBrick[]>([])
  const [coverage, setCoverage] = createSignal<Record<string, CoverageStatus>>({})
  const [elapsedMs, setElapsedMs] = createSignal(0)
  const [paused, setPaused] = createSignal(false)
  const [overtime, setOvertime] = createSignal(false)
  const [wrapping, setWrapping] = createSignal(false)
  const [sessionId, setSessionId] = createSignal<string | null>(null)
  const [storageError, setStorageError] = createSignal<string | null>(null)

  let client: RealtimeClient | null = null
  let db: CoachCollections | null = null
  let activeSessionId = ''
  let round = 1
  let roundStart = 0
  const persistedSegmentIds = new Set<string>()
  let noteSeq = 0

  let tick: ReturnType<typeof setInterval> | null = null
  let accumMs = 0
  let segStart = 0
  let isPaused = false
  let warnedNearly = false
  let warnedUp = false
  let lastOvertimeNudge = 0

  // Background analyst (debounced, runs during the live interview).
  let analystTimer: ReturnType<typeof setTimeout> | null = null
  let analystRunning = false
  let lastMode = 'idle'

  function msgText(msg: RealtimeMessage): string {
    return msg.parts
      .map((p) => (p as any).transcript ?? (p as any).content ?? '')
      .join(' ')
      .trim()
  }

  function persistSegment(msg: RealtimeMessage) {
    if (!db) return
    const text = msgText(msg)
    if (!text) return
    // Private facilitator cues are sent as messages but are NOT part of the
    // applicant's transcript — never persist or structure them.
    if (text.startsWith('[DIRECTOR')) return
    const id = `${activeSessionId}:${round}:${msg.id}`
    try {
      if (persistedSegmentIds.has(id)) {
        db.segments.update(id, (d) => {
          d.text = text
        })
      } else {
        db.segments.insert({
          id,
          sessionId: activeSessionId,
          round,
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          text,
          startTime: Math.max(0, (msg.timestamp - roundStart) / 1000),
          endTime: 0,
        })
        persistedSegmentIds.add(id)
      }
    } catch {
      /* best-effort persistence */
    }
  }

  function applyNote(note: CapturedNote) {
    const at = (accumMs + (Date.now() - segStart)) / 1000
    setNotes((prev) => [...prev, { ...note, at }])
    setCoverage((prev) => {
      const current = prev[note.sectionId]
      const next: CoverageStatus =
        note.coverage === 'covered' ? 'green' : current === 'green' ? 'green' : 'yellow'
      return { ...prev, [note.sectionId]: next }
    })
    if (db) {
      try {
        db.notes.insert({
          id: `${activeSessionId}:${round}:${noteSeq++}`,
          sessionId: activeSessionId,
          round,
          sectionId: note.sectionId,
          keyConcept: note.keyConcept,
          coverage: note.coverage,
          at,
        })
      } catch {
        /* best-effort */
      }
    }
  }

  // A short summary of current section coverage, returned to the model in the
  // captureNote tool result so it always knows what's still thin.
  function coverageSummary(): string {
    const cov = coverage()
    const covered: string[] = []
    const thin: string[] = []
    const notYet: string[] = []
    for (const s of ALL_SECTIONS) {
      const st = cov[s.id]
      if (st === 'green') covered.push(s.title)
      else if (st === 'yellow') thin.push(s.title)
      else notYet.push(s.title)
    }
    return [
      `Well covered: ${covered.join(', ') || 'none yet'}.`,
      `Touched but thin: ${thin.join(', ') || 'none'}.`,
      `Not yet covered: ${notYet.join(', ') || 'none'}.`,
    ].join(' ')
  }

  // The running transcript so far (applicant + coach turns), excluding the
  // private facilitator cues. Sent to the background analyst.
  function buildTranscript(): string {
    if (!client) return ''
    return client.messages
      .map((m) => ({ role: m.role, text: msgText(m) }))
      .filter((m) => m.text && !m.text.startsWith('[DIRECTOR'))
      .map((m) => `${m.role === 'assistant' ? 'Coach' : 'Applicant'}: ${m.text}`)
      .join('\n')
  }

  function onRealtimeMessage(msg: RealtimeMessage) {
    persistSegment(msg)
    // After a genuine applicant turn, (re)arm the debounced analyst.
    if (msg.role === 'user') {
      const text = msgText(msg)
      if (text && !text.startsWith('[DIRECTOR')) scheduleAnalyst()
    }
  }

  function scheduleAnalyst() {
    if (analystTimer) clearTimeout(analystTimer)
    analystTimer = setTimeout(() => {
      void runAnalyst()
    }, ANALYST_DEBOUNCE_MS)
  }

  // Background analyst: Claude reviews the transcript so far, connects dots into
  // facts + leads keyed by section/criterion, and returns the single best thing
  // to explore next. We feed that to the coach as a private cue (nudge-only;
  // not shown in the UI). Best-effort — never disrupts the conversation.
  async function runAnalyst() {
    if (analystRunning || !client || isPaused) return
    const transcript = buildTranscript()
    if (!transcript) return
    analystRunning = true
    try {
      const res = await fetch('/api/coach-analyst', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      if (!res.ok) return
      const data: AnalystResult = await res.json()
      // Only nudge while the coach isn't mid-utterance, so it doesn't talk over
      // itself; the cue then shapes its next turn.
      if (data.nextNudge && client && lastMode !== 'speaking') {
        client.sendText(`[DIRECTOR: ${data.nextNudge}]`)
      }
    } catch {
      /* best-effort */
    } finally {
      analystRunning = false
    }
  }

  async function start(args: StartArgs) {
    setError(null)
    setStatus('connecting')
    activeSessionId = args.resumeSessionId ?? crypto.randomUUID()
    round = args.round ?? 1
    setSessionId(activeSessionId)
    persistedSegmentIds.clear()

    // Open OPFS and create/resume the session (best-effort).
    try {
      const { getCoachDb } = await import('./collections')
      db = await getCoachDb()
      const now = Date.now()
      if (args.resumeSessionId) {
        db.sessions.update(activeSessionId, (d) => {
          d.updatedAt = now
          d.status = 'interviewing'
          d.round = round
          // Keep the prior draft: the next build smart-merges over it, preserving
          // the applicant's manual edits (round > draftRound triggers the merge).
        })
      } else {
        db.sessions.insert({
          id: activeSessionId,
          createdAt: now,
          updatedAt: now,
          round,
          provider: args.provider,
          status: 'interviewing',
        })
      }
    } catch (e) {
      db = null
      setStorageError(e instanceof Error ? e.message : 'on-device storage unavailable')
    }

    try {
      const [{ RealtimeClient }, adapter] = await Promise.all([
        import('@tanstack/ai-client'),
        args.provider === 'elevenlabs'
          ? import('@tanstack/ai-elevenlabs').then((m) => m.elevenlabsRealtime())
          : import('@tanstack/ai-openai').then((m) => m.openaiRealtime()),
      ])

      client = new RealtimeClient({
        getToken: () =>
          fetch(`/api/realtime-token?provider=${args.provider}`).then((r) => {
            if (!r.ok) throw new Error('Could not start the voice session (token).')
            return r.json()
          }),
        adapter,
        instructions: args.instructions,
        voice: opts?.voice ?? 'cedar',
        vadMode: 'semantic',
        semanticEagerness: 'low',
        tools: [captureNoteTool(applyNote, coverageSummary)],
        onStatusChange: (s) => setStatus(s),
        onModeChange: (m) => {
          lastMode = m
          setMode(m)
        },
        onMessage: (m) => onRealtimeMessage(m),
        onError: (e) => setError(e.message),
      })

      await client.connect()
      accumMs = 0
      segStart = Date.now()
      roundStart = Date.now()
      isPaused = false
      tick = setInterval(onTick, 1000)
      // Open proactively: cue the coach to greet and ask the first question now,
      // rather than waiting silently for the applicant to speak first.
      client.sendText(
        '[DIRECTOR: the conversation has started — greet the applicant warmly and ask your opening question now.]',
      )
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function onTick() {
    if (isPaused || !client) return
    const ms = accumMs + (Date.now() - segStart)
    setElapsedMs(ms)
    if (!warnedNearly && ms >= NEARLY_UP_MS) {
      warnedNearly = true
      client.sendText(CUE.nearly)
    }
    if (!warnedUp && ms >= TIME_UP_MS) {
      warnedUp = true
      lastOvertimeNudge = ms
      setOvertime(true)
      client.sendText(CUE.timeUp)
    } else if (warnedUp && ms - lastOvertimeNudge >= OVERTIME_NUDGE_EVERY_MS) {
      lastOvertimeNudge = ms
      client.sendText(CUE.overtime)
    }
  }

  function pause() {
    if (!client || isPaused) return
    accumMs += Date.now() - segStart
    isPaused = true
    setPaused(true)
    client.stopListening()
  }

  function resume() {
    if (!client || !isPaused) return
    segStart = Date.now()
    isPaused = false
    setPaused(false)
    client.startListening()
  }

  function clearTimer() {
    if (tick) {
      clearInterval(tick)
      tick = null
    }
    if (analystTimer) {
      clearTimeout(analystTimer)
      analystTimer = null
    }
  }

  function markReviewed() {
    if (!db) return
    try {
      db.sessions.update(activeSessionId, (d) => {
        d.status = 'review'
        d.updatedAt = Date.now()
      })
    } catch {
      /* best-effort */
    }
  }

  async function finishGraceful(): Promise<RealtimeMessage[]> {
    if (client && !isPaused) {
      setWrapping(true)
      client.sendText(CUE.finish)
      await new Promise((r) => setTimeout(r, GRACEFUL_SIGNOFF_MS))
    }
    return stop()
  }

  async function stop(): Promise<RealtimeMessage[]> {
    clearTimer()
    const messages = client?.messages ?? []
    await client?.disconnect()
    markReviewed()
    setMode('idle')
    setWrapping(false)
    return messages
  }

  function interrupt() {
    client?.interrupt()
  }

  function getAudio() {
    return client?.audio ?? null
  }

  onCleanup(() => {
    clearTimer()
    client?.destroy()
  })

  return {
    status,
    mode,
    error,
    notes,
    coverage,
    elapsedMs,
    paused,
    overtime,
    wrapping,
    sessionId,
    storageError,
    start,
    pause,
    resume,
    finishGraceful,
    stop,
    interrupt,
    getAudio,
  }
}
