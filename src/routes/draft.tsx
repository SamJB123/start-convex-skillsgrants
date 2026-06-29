import { createFileRoute, useNavigate, Link } from '@tanstack/solid-router'
import { For, Show, createEffect, createSignal, onSettled } from 'solid-js'
import GrantShell from '~/components/grant/Shell'
import SpeakButton from '~/components/grant/SpeakButton'
import { SECTION_BY_ID } from '~/library/coach/sections'
import type { ApplicationDraft } from '~/library/coach/schema'
import type { Suggestion, Suggestions } from '~/library/coach/suggestions'
import { useStructuredChat } from '~/library/coach/use-structured-chat'
import { applySuggestions } from '~/library/coach/apply'
import { assignPointIds } from '~/library/coach/operations'
import { buildSeedSummary } from '~/library/coach/seed'
import { assessment } from '~/library/grant/store'

export const Route = createFileRoute('/draft')({
  validateSearch: (s: Record<string, unknown>) => ({
    session: typeof s.session === 'string' ? s.session : '',
  }),
  component: RouteComponent,
})

const STATUS_DOT: Record<string, string> = {
  green: 'bg-[var(--gov-ok)]',
  yellow: 'bg-[var(--gov-gold-bright)]',
  red: 'bg-gray-300',
}
const STATUS_LABEL: Record<string, string> = {
  green: 'Good shape',
  yellow: 'Needs a little more',
  red: 'Let’s talk about this',
}

function fmtTime(sec?: number): string {
  const s = Math.max(0, Math.round(sec ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type VersionMeta = { version: number; createdAt: number; round: number; draftJson: string }

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const structureChat = useStructuredChat<ApplicationDraft>('/api/coach-structure')
  const suggestChat = useStructuredChat<Suggestions>('/api/coach-suggest')

  const [doc, setDoc] = createSignal<ApplicationDraft | null>(null)
  const [editing, setEditing] = createSignal<string | null>(null)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const [noContent, setNoContent] = createSignal(false)
  const [roundNum, setRoundNum] = createSignal(1)
  const [reviewQueue, setReviewQueue] = createSignal<Array<Suggestion>>([])
  const [accepted, setAccepted] = createSignal<Set<number>>(new Set<number>())
  const [autoNote, setAutoNote] = createSignal<string | null>(null)
  const [versions, setVersions] = createSignal<Array<VersionMeta>>([])
  const [showVersions, setShowVersions] = createSignal(false)
  const [pendingTalk, setPendingTalk] = createSignal<string | null>(null)

  let lastHandled: Suggestions | null = null

  const editsExist = () =>
    Boolean(doc()?.sections.some((s) => s.points.some((p) => p.edited)))

  onSettled(() => {
    void init()
  })

  async function init() {
    const sessionId = search().session
    if (!sessionId) {
      setLoadError('No conversation selected.')
      return
    }
    try {
      const { getSession, loadSessionContent } = await import(
        '~/library/coach/collections'
      )
      const session = await getSession(sessionId)
      setRoundNum(session?.round ?? 1)

      if (session?.draftJson) {
        const prior = assignPointIds(JSON.parse(session.draftJson) as ApplicationDraft)
        setDoc(prior)
        // A later round happened than the draft reflects → integrate the new
        // round's transcript as operations (add new content; review changes).
        if ((session.round ?? 1) > (session.draftRound ?? 1)) {
          const { segments } = await loadSessionContent(sessionId)
          const newSegs = segments.filter((s) => s.round === session.round)
          if (newSegs.length) {
            await snapshotCurrent()
            const newTranscript = newSegs
              .map(
                (s) =>
                  `(${Math.round(s.startTime)}s) ${s.role === 'assistant' ? 'Coach' : 'Applicant'}: ${s.text}`,
              )
              .join('\n')
            void suggestChat.send(JSON.stringify({ draft: prior, newTranscript }))
          }
        }
        void refreshVersions()
        return
      }

      // Round 1: structure the full transcript.
      const { segments } = await loadSessionContent(sessionId)
      if (!segments.length) {
        setNoContent(true)
        return
      }
      const transcript = segments
        .map(
          (s) =>
            `(${Math.round(s.startTime)}s) ${s.role === 'assistant' ? 'Coach' : 'Applicant'}: ${s.text}`,
        )
        .join('\n')
      void structureChat.send(transcript, {
        seedSummary: buildSeedSummary(assessment.answers),
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the conversation.')
    }
  }

  // Round-1 structuring completed → take an editable, id-stamped copy.
  createEffect(
    () => structureChat.final(),
    (f) => {
      if (!f || doc()) return
      const d = assignPointIds(f)
      setDoc(d)
      void persist(d)
      void refreshVersions()
    },
  )

  // Suggestions (integrate or strengthen) completed → apply per the agreed rule:
  // additions + status + follow-ups auto-apply; revisions/removals go to review.
  createEffect(
    () => suggestChat.final(),
    (s) => {
      if (!s || s === lastHandled) return
      lastHandled = s
      void handleSuggestions(s.suggestions)
    },
  )

  async function handleSuggestions(suggestions: Array<Suggestion>) {
    const current = doc()
    if (!current) return
    const auto = suggestions.filter(
      (x) => x.kind === 'add' || x.kind === 'status' || x.kind === 'followUp',
    )
    const review = suggestions.filter(
      (x) => x.kind === 'revise' || x.kind === 'remove',
    )
    if (auto.length) {
      await snapshotCurrent()
      const outcome = await applySuggestions(current, auto)
      setDoc(outcome.draft)
      await persist(outcome.draft)
      setAutoNote(`Added ${auto.filter((a) => a.kind === 'add').length} new point(s) from what you said.`)
    } else {
      // Still persist so draftRound catches up (no re-integrate on revisit).
      await persist(current)
    }
    setReviewQueue(review)
    setAccepted(new Set<number>())
    void refreshVersions()
  }

  async function applyAccepted() {
    const current = doc()
    if (!current) return
    const queue = reviewQueue()
    const picked = queue.filter((_, i) => accepted().has(i))
    if (!picked.length) {
      setReviewQueue([])
      return
    }
    await snapshotCurrent()
    const outcome = await applySuggestions(current, picked)
    setDoc(outcome.draft)
    await persist(outcome.draft)
    setReviewQueue([])
    setAccepted(new Set<number>())
    void refreshVersions()
  }

  function strengthen() {
    const current = doc()
    if (!current) return
    lastHandled = null
    void suggestChat.send(JSON.stringify({ draft: current }))
  }

  async function persist(d: ApplicationDraft) {
    try {
      const { saveDraft } = await import('~/library/coach/collections')
      await saveDraft(search().session, JSON.stringify(d), roundNum())
    } catch {
      /* best-effort */
    }
  }

  async function snapshotCurrent() {
    const d = doc()
    if (!d) return
    try {
      const { snapshotDraftVersion } = await import('~/library/coach/collections')
      await snapshotDraftVersion(search().session, JSON.stringify(d), roundNum())
    } catch {
      /* best-effort */
    }
  }

  async function refreshVersions() {
    try {
      const { loadDraftVersions } = await import('~/library/coach/collections')
      const vs = await loadDraftVersions(search().session)
      setVersions(vs.map((v) => ({ version: v.version, createdAt: v.createdAt, round: v.round, draftJson: v.draftJson })))
    } catch {
      /* best-effort */
    }
  }

  async function restoreVersion(v: VersionMeta) {
    await snapshotCurrent()
    setDoc(assignPointIds(JSON.parse(v.draftJson) as ApplicationDraft))
    await persist(doc()!)
    void refreshVersions()
  }

  function editPoint(si: number, pi: number, text: string) {
    const d = doc()
    if (!d) return
    const next: ApplicationDraft = structuredClone(d)
    const pt = next.sections[si]?.points[pi]
    if (!pt) return
    pt.text = text
    pt.edited = true
    pt.sources = [] // editing drops the 'from your words' provenance
    if (!pt.id) assignPointIds(next)
    setDoc(next)
  }

  function talkAbout(sectionId: string) {
    if (editsExist()) {
      setPendingTalk(sectionId)
      return
    }
    navigate({ to: '/coach', search: { resume: search().session, focus: sectionId } })
  }
  function confirmTalk() {
    const sectionId = pendingTalk()
    setPendingTalk(null)
    if (sectionId) {
      navigate({ to: '/coach', search: { resume: search().session, focus: sectionId } })
    }
  }

  async function copySection(sectionId: string) {
    const d = doc()
    const sec = d?.sections.find((s) => s.sectionId === sectionId)
    if (!sec) return
    const heading = SECTION_BY_ID[sectionId]?.title ?? sectionId
    const text = `${heading}\n\n${sec.points.map((p) => p.text).join('\n\n')}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* clipboard blocked */
    }
  }

  const streamingSections = () => structureChat.partial().sections ?? []

  return (
    <GrantShell>
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-3xl font-bold text-[var(--gov-navy)]">Your draft</h1>
        <div class="no-print flex flex-wrap gap-2">
          <Link
            to="/coach"
            search={{ resume: undefined, focus: undefined }}
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to coach
          </Link>
          <Show when={doc()}>
            <button
              type="button"
              onClick={strengthen}
              class="rounded-lg border border-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]"
            >
              ✨ Strengthen
            </button>
            <button
              type="button"
              onClick={() => typeof window !== 'undefined' && window.print()}
              class="rounded-lg bg-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--gov-navy-700)]"
            >
              Print / save as PDF
            </button>
          </Show>
        </div>
      </div>

      <p class="mt-2 max-w-3xl text-sm text-[var(--gov-muted)]">
        Built faithfully from what you said — each point shows the words it came from.
        Edit anything, talk through weaker sections, ask to strengthen it, then copy
        each part into SmartyGrants. Nothing here is submitted automatically.
      </p>

      <Show when={loadError()}>
        {(e) => (
          <p role="alert" class="mt-6 rounded-lg bg-[var(--gov-stop-bg)] p-4 text-[var(--gov-stop)]">
            {e()}
          </p>
        )}
      </Show>
      <Show when={noContent()}>
        <p class="mt-6 rounded-lg bg-[var(--gov-bg)] p-4 text-[var(--gov-muted)]">
          There’s nothing captured for this conversation yet.{' '}
          <Link to="/coach" search={{ resume: undefined, focus: undefined }} class="underline">
            Start a conversation
          </Link>
          .
        </p>
      </Show>

      {/* Streaming (round-1 build) */}
      <Show when={!doc() && !loadError() && !noContent()}>
        <div class="mt-6">
          <p class="text-sm text-[var(--gov-muted)]" aria-live="polite">
            Building your draft from the conversation…
          </p>
          <div class="mt-4 space-y-4">
            <For each={streamingSections()}>
              {(s) => (
                <div class="rounded-2xl border border-gray-200 bg-white p-5">
                  <h2 class="font-bold text-[var(--gov-navy)]">
                    {s?.sectionId ? (SECTION_BY_ID[s.sectionId]?.title ?? s.sectionId) : '…'}
                  </h2>
                  <ul class="mt-2 space-y-1">
                    <For each={s?.points ?? []}>
                      {(p) => <li class="text-[var(--gov-ink)]">{p?.text}</li>}
                    </For>
                  </ul>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Coach activity / auto-applied note */}
      <Show when={suggestChat.isLoading()}>
        <p class="mt-4 rounded-lg bg-[var(--gov-blue-50)] p-3 text-sm text-[var(--gov-navy)]" aria-live="polite">
          Looking at your draft against the criteria…
        </p>
      </Show>
      <Show when={autoNote()}>
        {(n) => (
          <p class="mt-4 rounded-lg bg-[var(--gov-ok-bg)] p-3 text-sm text-[var(--gov-ok)]">{n()}</p>
        )}
      </Show>

      {/* Review queue: revisions/removals need acceptance */}
      <Show when={reviewQueue().length > 0}>
        <section class="mt-6 rounded-2xl border border-amber-300 bg-[var(--gov-warn-bg)] p-5">
          <h2 class="text-lg font-bold text-[var(--gov-warn)]">
            Suggested changes to review ({reviewQueue().length})
          </h2>
          <p class="mt-1 text-sm text-[var(--gov-warn)]">
            These change existing points, so they’re yours to accept. Your hand-edited
            points are never altered.
          </p>
          <ul class="mt-3 space-y-2">
            <For each={reviewQueue()}>
              {(sug, i) => (
                <li class="rounded-lg border border-amber-200 bg-white p-3">
                  <label class="flex items-start gap-2">
                    <input
                      type="checkbox"
                      class="mt-1 h-4 w-4"
                      checked={accepted().has(i())}
                      onChange={(e) => {
                        const next = new Set(accepted())
                        if (e.currentTarget.checked) next.add(i())
                        else next.delete(i())
                        setAccepted(next)
                      }}
                    />
                    <span class="text-sm">
                      <span class="font-semibold text-[var(--gov-navy)]">
                        {sug.kind === 'remove' ? 'Remove a point' : 'Reword a point'}
                        {SECTION_BY_ID[sug.sectionId] ? ` · ${SECTION_BY_ID[sug.sectionId].title}` : ''}
                      </span>
                      <Show when={sug.proposedText}>
                        <span class="mt-1 block text-[var(--gov-ink)]">“{sug.proposedText}”</span>
                      </Show>
                      <span class="mt-1 block text-[var(--gov-muted)]">{sug.rationale}</span>
                    </span>
                  </label>
                </li>
              )}
            </For>
          </ul>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              onClick={applyAccepted}
              class="rounded-lg bg-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-white"
            >
              Apply {accepted().size} accepted
            </button>
            <button
              type="button"
              onClick={() => {
                setReviewQueue([])
                setAccepted(new Set<number>())
              }}
              class="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-[var(--gov-warn)]"
            >
              Dismiss
            </button>
          </div>
        </section>
      </Show>

      {/* Editable draft */}
      <Show when={doc()}>
        {(d) => (
          <div class="mt-6 space-y-4">
            <For each={d().sections}>
              {(s, si) => (
                <section class="print-card rounded-2xl border border-gray-200 bg-white p-5">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <h2 class="flex items-center gap-2 text-lg font-bold text-[var(--gov-navy)]">
                      <span
                        class={['inline-block h-3 w-3 rounded-full', STATUS_DOT[s.status]]}
                        title={STATUS_LABEL[s.status]}
                        aria-hidden="true"
                      />
                      {SECTION_BY_ID[s.sectionId]?.title ?? s.sectionId}
                      <span class="text-xs font-normal text-[var(--gov-muted)]">
                        {STATUS_LABEL[s.status]}
                      </span>
                    </h2>
                    <div class="no-print flex gap-2">
                      <Show when={s.status !== 'green'}>
                        <button
                          type="button"
                          onClick={() => talkAbout(s.sectionId)}
                          class="rounded-md bg-[var(--gov-blue-50)] px-3 py-1 text-sm font-semibold text-[var(--gov-blue)] hover:underline"
                        >
                          🎤 Talk about this
                        </button>
                      </Show>
                      <button
                        type="button"
                        onClick={() => copySection(s.sectionId)}
                        class="rounded-md px-3 py-1 text-sm font-medium text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <ul class="mt-3 space-y-3">
                    <For each={s.points}>
                      {(p, pi) => {
                        const key = `${si()}:${pi()}`
                        return (
                          <li class="border-l-4 border-gray-200 pl-3">
                            <Show
                              when={editing() === key}
                              fallback={
                                <div>
                                  <p class="text-[var(--gov-ink)]">
                                    {p.text}
                                    <button
                                      type="button"
                                      onClick={() => setEditing(key)}
                                      class="no-print ml-2 text-xs font-medium text-[var(--gov-blue)] underline"
                                    >
                                      Edit
                                    </button>
                                    <SpeakButton text={p.text} id={`pt-${key}`} class="ml-1" />
                                  </p>
                                  <Show
                                    when={!p.edited && p.sources.length > 0}
                                    fallback={
                                      <Show when={p.edited}>
                                        <p class="mt-1 text-xs italic text-[var(--gov-muted)]">
                                          edited by you
                                        </p>
                                      </Show>
                                    }
                                  >
                                    <ul class="mt-1 space-y-0.5">
                                      <For each={p.sources}>
                                        {(src) => (
                                          <li class="text-xs text-[var(--gov-muted)]">
                                            🔊 from your words ({fmtTime(src.startTime)}): “{src.quote}”
                                          </li>
                                        )}
                                      </For>
                                    </ul>
                                  </Show>
                                </div>
                              }
                            >
                              <textarea
                                class="w-full rounded-lg border border-gray-300 p-2 text-[var(--gov-ink)]"
                                rows={3}
                                value={p.text}
                                onInput={(e) => editPoint(si(), pi(), e.currentTarget.value)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(null)
                                  const cur = doc()
                                  if (cur) void persist(cur)
                                }}
                                class="mt-1 rounded-md bg-[var(--gov-blue)] px-3 py-1 text-sm font-semibold text-white"
                              >
                                Done
                              </button>
                            </Show>
                          </li>
                        )
                      }}
                    </For>
                  </ul>

                  <Show when={s.followUps.length > 0 || s.gaps.length > 0}>
                    <div class="mt-3 rounded-lg bg-[var(--gov-warn-bg)] p-3 text-sm text-[var(--gov-warn)]">
                      <p class="font-semibold">To strengthen this section:</p>
                      <ul class="mt-1 list-disc pl-5">
                        <For each={[...s.gaps, ...s.followUps]}>{(g) => <li>{g}</li>}</For>
                      </ul>
                    </div>
                  </Show>
                </section>
              )}
            </For>

            {/* Version history */}
            <Show when={versions().length > 0}>
              <section class="no-print rounded-2xl border border-gray-200 bg-white p-5">
                <button
                  type="button"
                  onClick={() => setShowVersions(!showVersions())}
                  class="text-sm font-semibold text-[var(--gov-navy)]"
                >
                  {showVersions() ? '▾' : '▸'} Earlier versions ({versions().length})
                </button>
                <Show when={showVersions()}>
                  <ul class="mt-3 space-y-2">
                    <For each={versions()}>
                      {(v) => (
                        <li class="flex items-center justify-between gap-2 text-sm">
                          <span class="text-[var(--gov-muted)]">
                            Version {v.version} · round {v.round}
                          </span>
                          <button
                            type="button"
                            onClick={() => void restoreVersion(v)}
                            class="rounded-md px-3 py-1 font-medium text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]"
                          >
                            Restore
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </section>
            </Show>
          </div>
        )}
      </Show>

      {/* Pre-round confirm (you have manual edits) */}
      <Show when={pendingTalk()}>
        <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div class="max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 class="text-lg font-bold text-[var(--gov-navy)]">Talk it through?</h2>
            <p class="mt-2 text-sm text-[var(--gov-ink)]">
              Talking more will add to your draft. Your hand-edited points are kept exactly
              as you wrote them, and you can review any changes to other points.
            </p>
            <div class="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTalk(null)}
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmTalk}
                class="rounded-lg bg-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </Show>
    </GrantShell>
  )
}
