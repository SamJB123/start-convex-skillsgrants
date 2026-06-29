import { createFileRoute } from '@tanstack/solid-router'
import { For, Show, createMemo, createSignal } from 'solid-js'
import GrantShell from '~/components/grant/Shell'
import SpeakButton from '~/components/grant/SpeakButton'
import CiteChip from '~/components/grant/CiteChip'
import MicButton from '~/components/grant/MicButton'
import { GLOSSARY } from '~/library/grant/data'

export const Route = createFileRoute('/glossary')({
  component: RouteComponent,
})

function RouteComponent() {
  const [queryText, setQueryText] = createSignal('')

  const results = createMemo(() => {
    const q = queryText().trim().toLowerCase()
    if (!q) return GLOSSARY
    return GLOSSARY.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.short.toLowerCase().includes(q) ||
        (t.detail ?? '').toLowerCase().includes(q),
    )
  })

  return (
    <GrantShell>
      <h1 class="text-3xl font-bold text-[var(--gov-navy)]">Guide &amp; glossary</h1>
      <p class="mt-2 max-w-3xl text-[var(--gov-muted)]">
        Plain-language explanations of the words and rules used in the grant
        guidelines. Tap the speaker icon to have any entry read aloud, or use the
        microphone to search by voice.
      </p>

      {/* Search with voice input */}
      <div class="mt-6 flex items-center gap-2 rounded-xl border border-gray-300 bg-white p-2">
        <svg class="ml-2 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
        <label for="glossary-search" class="sr-only">
          Search the guide and glossary
        </label>
        <input
          id="glossary-search"
          type="search"
          value={queryText()}
          onInput={(e) => setQueryText(e.currentTarget.value)}
          placeholder="Search terms, e.g. ACCO, TIFA, acquittal…"
          class="flex-1 border-0 bg-transparent px-1 py-1.5 text-base outline-none"
        />
        <MicButton onTranscript={(t) => setQueryText(t)} label="Search by voice" />
      </div>

      <p class="mt-3 text-sm text-[var(--gov-muted)]">
        {results().length} {results().length === 1 ? 'entry' : 'entries'}
      </p>

      <dl class="mt-4 space-y-4">
        <For each={results()}>
          {(t) => (
            <div class="rounded-2xl border border-gray-200 bg-white p-5">
              <dt class="flex items-center gap-2 text-lg font-bold text-[var(--gov-navy)]">
                {t.term}
                <SpeakButton
                  id={`glossary-${t.term}`}
                  text={`${t.term}. ${t.short} ${t.detail ?? ''}`}
                  label={`Read ${t.term} aloud`}
                />
              </dt>
              <dd class="mt-1 text-[var(--gov-ink)]">{t.short}</dd>
              <Show when={t.detail}>
                {(d) => <dd class="mt-2 text-sm text-[var(--gov-muted)]">{d()}</dd>}
              </Show>
              <Show when={t.cite}>
                {(c) => (
                  <dd class="mt-2">
                    <CiteChip cite={c()} />
                  </dd>
                )}
              </Show>
            </div>
          )}
        </For>
        <Show when={results().length === 0}>
          <p class="rounded-xl bg-white p-6 text-center text-[var(--gov-muted)]">
            No entries match “{queryText()}”. Try a different word, or contact
            Skills Canberra on 6205 4006.
          </p>
        </Show>
      </dl>
    </GrantShell>
  )
}
