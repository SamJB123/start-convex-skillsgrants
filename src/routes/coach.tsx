import { createFileRoute, useNavigate } from '@tanstack/solid-router'
import { For, Show, createSignal, onSettled, untrack } from 'solid-js'
import GrantShell from '~/components/grant/Shell'
import SpeakButton from '~/components/grant/SpeakButton'
import {
  ALL_SECTIONS,
  CRITERIA_SECTIONS,
  PROJECT_PLAN_SECTIONS,
  type CoachSection,
} from '~/library/coach/sections'
import { buildInterviewInstructions } from '~/library/coach/schema'
import type { ApplicationDraft } from '~/library/coach/schema'
import { buildSeedSummary } from '~/library/coach/seed'
import { useRealtime, type CoverageStatus } from '~/library/coach/use-realtime'
import type { VoiceProvider } from '~/library/coach/collections'
import { assessment } from '~/library/grant/store'

export const Route = createFileRoute('/coach')({
  validateSearch: (s: Record<string, unknown>) => ({
    resume: typeof s.resume === 'string' ? s.resume : undefined,
    focus: typeof s.focus === 'string' ? s.focus : undefined,
  }),
  component: RouteComponent,
})

const CONSENT_TEXT =
  "Let's talk it through. I'll ask you about your project in a friendly chat — about ten minutes. Just speak naturally; there are no wrong answers. As you talk, I listen and quietly note the key points, and you'll see them appear. Afterwards I turn what you said into a draft you can review. You can pause or stop anytime, and we can continue in another short chat."

type ResumeInfo = {
  id: string
  provider: VoiceProvider
  round: number
  concepts: string[]
}

type SavedDraft = { id: string; updatedAt: number; round: number; preview: string }

// A short, human preview for a saved draft: the first non-empty point text.
function draftPreview(draftJson: string): string {
  try {
    const d = JSON.parse(draftJson) as ApplicationDraft
    for (const s of d.sections) {
      const p = s.points.find((pt) => pt.text?.trim())
      if (p) return p.text
    }
  } catch {
    /* ignore malformed */
  }
  return 'Draft in progress'
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const rt = useRealtime()

  const [provider, setProvider] = createSignal<VoiceProvider>('openai')
  const [started, setStarted] = createSignal(false)
  const [dismissedOvertime, setDismissedOvertime] = createSignal(false)
  const [resumeInfo, setResumeInfo] = createSignal<ResumeInfo | null>(null)
  const [drafts, setDrafts] = createSignal<SavedDraft[]>([])

  const isResumeLink = () => Boolean(search().resume)

  // Build a fresh round-1 instruction string (seeded from eligibility answers).
  function round1Instructions() {
    return untrack(() =>
      buildInterviewInstructions({
        sections: ALL_SECTIONS,
        seedSummary: buildSeedSummary(assessment.answers),
      }),
    )
  }

  onSettled(() => {
    void (async () => {
      const s = search()
      // Explicit resume link (e.g. "Talk about this" from the draft) →
      // continue that session, optionally focused on one section.
      if (s.resume) {
        await continueSession(s.resume, s.focus)
        return
      }
      // Landing: surface saved drafts to reopen, and offer to resume any
      // interrupted conversation.
      try {
        const { findUnfinishedSession, loadSessionContent, listDrafts } =
          await import('~/library/coach/collections')
        setDrafts(
          (await listDrafts()).map((d) => ({
            id: d.id,
            updatedAt: d.updatedAt,
            round: d.round,
            preview: draftPreview(d.draftJson ?? ''),
          })),
        )
        const found = await findUnfinishedSession()
        if (!found) return
        const { notes } = await loadSessionContent(found.id)
        setResumeInfo({
          id: found.id,
          provider: found.provider,
          round: found.round,
          concepts: [...new Set(notes.map((n) => n.keyConcept))],
        })
      } catch {
        /* nothing to resume */
      }
    })()
  })

  async function continueSession(sessionId: string, focusSectionId?: string) {
    let providerToUse = provider()
    let nextRound = 2
    let concepts: string[] = []
    try {
      const { getSession, loadSessionContent } = await import(
        '~/library/coach/collections'
      )
      const session = await getSession(sessionId)
      if (session) {
        providerToUse = session.provider
        nextRound = session.round + 1
      }
      const { notes } = await loadSessionContent(sessionId)
      concepts = [...new Set(notes.map((n) => n.keyConcept))]
    } catch {
      /* best-effort seed */
    }
    const priorSummary = concepts.length
      ? `So far they have shared: ${concepts.join(', ')}. Pick up naturally and don't re-ask what's covered.`
      : undefined
    const seed = [buildSeedSummary(assessment.answers), priorSummary]
      .filter(Boolean)
      .join('\n')
    const instructions = buildInterviewInstructions({
      sections: ALL_SECTIONS,
      focusSectionId,
      seedSummary: seed || undefined,
    })
    setStarted(true)
    await rt.start({
      provider: providerToUse,
      instructions,
      resumeSessionId: sessionId,
      round: nextRound,
    })
  }

  const minutes = () => Math.floor(rt.elapsedMs() / 60000)
  const progress = () => Math.min(rt.elapsedMs() / (10 * 60000), 1)
  const coveredCount = () =>
    Object.values(rt.coverage()).filter((s) => s === 'green').length

  const liveLabel = () =>
    rt.status() === 'connecting'
      ? 'Connecting…'
      : rt.wrapping()
        ? 'Wrapping up…'
        : rt.paused()
          ? 'Paused'
          : modeLabel(rt.mode())

  async function begin() {
    setStarted(true)
    await rt.start({ provider: provider(), instructions: round1Instructions() })
  }

  function goToDraft() {
    const id = rt.sessionId()
    if (id) navigate({ to: '/draft', search: { session: id } })
  }

  async function finishGraceful() {
    await rt.finishGraceful()
    goToDraft()
  }
  async function stopNow() {
    await rt.stop()
    goToDraft()
  }

  function continueFromCard() {
    const r = resumeInfo()
    if (r) void continueSession(r.id)
  }
  function buildFromCaptured() {
    const r = resumeInfo()
    if (r) navigate({ to: '/draft', search: { session: r.id } })
  }
  async function startFresh() {
    const r = resumeInfo()
    if (r) {
      try {
        const { getCoachDb } = await import('~/library/coach/collections')
        const db = await getCoachDb()
        db.sessions.update(r.id, (d) => {
          d.status = 'done'
        })
      } catch {
        /* best-effort */
      }
    }
    setResumeInfo(null)
  }

  return (
    <GrantShell>
      {/* Resuming via an explicit link — brief placeholder until connected. */}
      <Show when={isResumeLink() && !started()}>
        <p class="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-[var(--gov-muted)] shadow-sm">
          Picking up where you left off…
        </p>
      </Show>

      {/* ---------- Resume an unfinished conversation ---------- */}
      <Show when={!started() && !isResumeLink() && resumeInfo()}>
        {(r) => (
          <section class="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 class="text-2xl font-bold text-[var(--gov-navy)]">Welcome back</h1>
            <p class="mt-2 text-[var(--gov-ink)]">
              You have an unfinished conversation
              {r().concepts.length
                ? ` — ${r().concepts.length} key point${r().concepts.length === 1 ? '' : 's'} captured so far`
                : ''}
              . What would you like to do?
            </p>
            <Show when={r().concepts.length > 0}>
              <div class="mt-3 flex flex-wrap gap-2">
                <For each={r().concepts.slice(0, 16)}>
                  {(c) => (
                    <span class="rounded-full bg-[var(--gov-blue-50)] px-3 py-1 text-sm text-[var(--gov-navy)]">
                      {c}
                    </span>
                  )}
                </For>
              </div>
            </Show>
            <div class="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={continueFromCard}
                class="rounded-lg bg-[var(--gov-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--gov-navy-700)]"
              >
                Continue talking →
              </button>
              <button
                type="button"
                onClick={buildFromCaptured}
                class="rounded-lg border border-[var(--gov-blue)] px-6 py-3 font-semibold text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]"
              >
                Build a draft from what we have
              </button>
              <button
                type="button"
                onClick={startFresh}
                class="text-sm font-medium text-[var(--gov-muted)] underline hover:text-[var(--gov-navy)]"
              >
                Start a new conversation instead
              </button>
            </div>
          </section>
        )}
      </Show>

      {/* ---------- Reopen a saved draft ---------- */}
      <Show when={!started() && !isResumeLink() && drafts().length > 0}>
        <section class="mx-auto mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h2 class="text-xl font-bold text-[var(--gov-navy)]">Your saved drafts</h2>
          <p class="mt-1 text-sm text-[var(--gov-muted)]">
            Stored privately on this device — pick up exactly where you left off.
          </p>
          <ul class="mt-4 divide-y divide-gray-100">
            <For each={drafts()}>
              {(d) => (
                <li class="flex items-center justify-between gap-3 py-3">
                  <div class="min-w-0">
                    <p class="truncate text-[var(--gov-ink)]">{d.preview}</p>
                    <p class="text-xs text-[var(--gov-muted)]">
                      Updated {fmtDate(d.updatedAt)}
                      {d.round > 1 ? ` · round ${d.round}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate({ to: '/draft', search: { session: d.id } })}
                    class="shrink-0 rounded-lg bg-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--gov-navy-700)]"
                  >
                    Open draft →
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      {/* ---------- Consent / privacy gate ---------- */}
      <Show when={!started() && !isResumeLink() && !resumeInfo()}>
        <section class="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <div class="flex items-start justify-between gap-2">
            <h1 class="text-3xl font-bold text-[var(--gov-navy)]">
              Talk it through with your coach
            </h1>
            <SpeakButton text={CONSENT_TEXT} id="coach-intro" label="Read this aloud" />
          </div>
          <p class="mt-4 text-lg text-[var(--gov-ink)]">{CONSENT_TEXT}</p>

          <div class="mt-6 rounded-xl border border-amber-300 bg-[var(--gov-warn-bg)] p-4 text-sm text-[var(--gov-warn)]">
            <p class="font-semibold">Your privacy</p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>
                Your voice is sent to the voice provider <em>only</em> to power the
                live conversation.
              </li>
              <li>
                Your notes and transcript are stored <strong>only on this device</strong>{' '}
                — never on our servers.
              </li>
              <li>We’ll ask for microphone access. You can pause or stop at any time.</li>
            </ul>
          </div>

          <fieldset class="mt-6">
            <legend class="text-sm font-medium text-[var(--gov-muted)]">Voice</legend>
            <div class="mt-2 flex gap-2">
              <For
                each={
                  [
                    { id: 'openai', label: 'Standard voice' },
                    // ElevenLabs hidden for now: its agent is dashboard-configured and
                    // lacks the dynamic instruction + tool control the OpenAI realtime
                    // path needs. Adapter/code remain wired — re-enable by uncommenting.
                    // { id: 'elevenlabs', label: 'Natural voice' },
                  ] as const
                }
              >
                {(o) => (
                  <label
                    class={[
                      'cursor-pointer rounded-lg border px-4 py-2 text-sm',
                      {
                        'border-[var(--gov-blue)] bg-[var(--gov-blue-50)] font-semibold':
                          provider() === o.id,
                        'border-gray-300 text-gray-700': provider() !== o.id,
                      },
                    ]}
                  >
                    <input
                      type="radio"
                      name="provider"
                      class="sr-only"
                      checked={provider() === o.id}
                      onChange={() => setProvider(o.id)}
                    />
                    {o.label}
                  </label>
                )}
              </For>
            </div>
          </fieldset>

          <button
            type="button"
            onClick={begin}
            class="mt-6 rounded-lg bg-[var(--gov-blue)] px-6 py-3 text-base font-semibold text-white hover:bg-[var(--gov-navy-700)]"
          >
            Start the conversation →
          </button>
        </section>
      </Show>

      {/* ---------- Live interview ---------- */}
      <Show when={started()}>
        <>
          {/* Past ~10 min: the person decides. */}
          <Show when={rt.overtime() && !dismissedOvertime()}>
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-[var(--gov-warn-bg)] p-4 text-[var(--gov-warn)]">
              <p class="text-sm">
                We’ve covered a lot — keep going, or finish and build your draft?
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDismissedOvertime(true)}
                  class="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold"
                >
                  Keep going
                </button>
                <button
                  type="button"
                  onClick={finishGraceful}
                  class="rounded-lg bg-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Finish &amp; build
                </button>
              </div>
            </div>
          </Show>

          <section class="grid gap-6 md:grid-cols-2">
            {/* Visualiser + status + controls */}
            <div class="flex flex-col items-center justify-center rounded-2xl bg-[var(--gov-navy)] p-8 text-white">
              <div
                class={[
                  'grid h-40 w-40 place-items-center rounded-full transition-all duration-300',
                  {
                    'bg-blue-400/30 scale-100': rt.mode() === 'listening' && !rt.paused(),
                    'bg-amber-300/40 scale-95': rt.mode() === 'thinking',
                    'bg-emerald-300/50 scale-110 animate-pulse': rt.mode() === 'speaking',
                    'bg-white/10 scale-90': rt.mode() === 'idle' || rt.paused(),
                  },
                ]}
                aria-hidden="true"
              >
                <div class="h-24 w-24 rounded-full bg-white/20" />
              </div>
              <p class="mt-6 text-lg font-semibold" aria-live="polite">
                {liveLabel()}
              </p>

              <div class="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
                <div
                  class="h-full bg-[var(--gov-gold-bright)] transition-all duration-1000"
                  style={{ width: `${progress() * 100}%` }}
                />
              </div>
              <p class="mt-2 text-sm text-blue-100">
                {minutes() === 0 ? 'just getting started' : `about ${minutes()} min`}
              </p>

              <Show when={rt.error()}>
                {(e) => (
                  <p
                    role="alert"
                    class="mt-4 rounded bg-[var(--gov-stop-bg)] px-3 py-2 text-sm text-[var(--gov-stop)]"
                  >
                    {e()}
                  </p>
                )}
              </Show>

              <div class="mt-8 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={finishGraceful}
                  class="rounded-lg bg-white px-6 py-3 font-semibold text-[var(--gov-navy)] hover:bg-gray-100"
                >
                  Finish &amp; build my draft
                </button>
                <div class="flex items-center gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() => (rt.paused() ? rt.resume() : rt.pause())}
                    class="font-medium text-blue-100 underline hover:text-white"
                  >
                    {rt.paused() ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={stopNow}
                    class="font-medium text-blue-100 underline hover:text-white"
                  >
                    Stop now
                  </button>
                </div>
              </div>
            </div>

            {/* Coverage board + bricks */}
            <div class="rounded-2xl bg-white p-6 shadow-sm">
              <h2 class="text-lg font-bold text-[var(--gov-navy)]">
                What we’re covering
                <span class="ml-2 text-sm font-normal text-[var(--gov-muted)]">
                  {coveredCount()}/{ALL_SECTIONS.length} strong
                </span>
              </h2>
              <CoverageGroup
                title="Your application"
                sections={CRITERIA_SECTIONS}
                coverage={rt.coverage()}
              />
              <CoverageGroup
                title="Project plan"
                sections={PROJECT_PLAN_SECTIONS}
                coverage={rt.coverage()}
              />

              <h3 class="mt-6 text-sm font-semibold text-[var(--gov-muted)]">
                Things I’ve noted
              </h3>
              <Show
                when={rt.notes().length > 0}
                fallback={
                  <p class="mt-2 text-sm text-gray-400">
                    Start talking — your key points will appear here.
                  </p>
                }
              >
                <div class="mt-2 flex flex-wrap gap-2">
                  <For each={rt.notes().slice(-14)}>
                    {(n) => (
                      <span class="rounded-full bg-[var(--gov-blue-50)] px-3 py-1 text-sm text-[var(--gov-navy)]">
                        {n.keyConcept}
                      </span>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </section>
        </>
      </Show>
    </GrantShell>
  )
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'listening':
      return '● Listening'
    case 'thinking':
      return 'Thinking…'
    case 'speaking':
      return '🔊 Speaking'
    default:
      return 'Ready'
  }
}

const DOT: Record<CoverageStatus, string> = {
  red: 'bg-gray-300',
  yellow: 'bg-[var(--gov-gold-bright)]',
  green: 'bg-[var(--gov-ok)]',
}

function CoverageGroup(props: {
  title: string
  sections: CoachSection[]
  coverage: Record<string, CoverageStatus>
}) {
  return (
    <div class="mt-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {props.title}
      </p>
      <ul class="mt-2 space-y-1.5">
        <For each={props.sections}>
          {(s) => (
            <li class="flex items-center gap-2 text-sm">
              <span
                class={[
                  'inline-block h-3 w-3 rounded-full',
                  DOT[props.coverage[s.id] ?? 'red'],
                ]}
                aria-hidden="true"
              />
              <span class="text-[var(--gov-ink)]">{s.title}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
