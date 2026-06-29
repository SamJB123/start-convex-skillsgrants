import { createFileRoute, Link } from '@tanstack/solid-router'
import { For, Show, createMemo } from 'solid-js'
import GrantShell from '~/components/grant/Shell'
import SpeakButton from '~/components/grant/SpeakButton'
import CiteChip from '~/components/grant/CiteChip'
import { assessEligibility, buildChecklist } from '~/library/grant/assess'
import { EVALUATION_CRITERIA, PROGRAM } from '~/library/grant/data'
import { assessment } from '~/library/grant/store'

export const Route = createFileRoute('/summary')({
  component: RouteComponent,
})

const TEMPLATE_URLS: Record<'budget' | 'project_plan', string> = {
  budget: '/templates/ACT-VET-Completions-Grants-Program-2026-Budget-Template.xlsx',
  project_plan: '/templates/ACT-VET-Completions-Grants-Program-2026-Project-Plan.docx',
}

const STATUS_STYLE = {
  eligible: { bg: 'var(--gov-ok-bg)', fg: 'var(--gov-ok)', label: 'Looks eligible' },
  check: { bg: 'var(--gov-warn-bg)', fg: 'var(--gov-warn)', label: 'A few things to check' },
  ineligible: { bg: 'var(--gov-stop-bg)', fg: 'var(--gov-stop)', label: 'Eligibility issue found' },
} as const

function RouteComponent() {
  const verdict = createMemo(() => assessEligibility(assessment.answers))
  const checklist = createMemo(() => buildChecklist(assessment.answers))

  const blockers = () => verdict().findings.filter((f) => f.kind === 'blocker')
  const flags = () => verdict().findings.filter((f) => f.kind === 'flag')
  const oks = () => verdict().findings.filter((f) => f.kind === 'ok')

  const print = () => {
    if (typeof window !== 'undefined') window.print()
  }

  return (
    <GrantShell>
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-3xl font-bold text-[var(--gov-navy)]">Your results</h1>
        <div class="no-print flex gap-2">
          <Link
            to="/check"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Edit answers
          </Link>
          <button
            type="button"
            onClick={print}
            class="rounded-lg bg-[var(--gov-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--gov-navy-700)]"
          >
            Print / save as PDF
          </button>
        </div>
      </div>

      {/* Verdict */}
      <section
        class="print-card mt-6 rounded-2xl border p-6 shadow-sm"
        style={{
          'background-color': STATUS_STYLE[verdict().status].bg,
          'border-color': STATUS_STYLE[verdict().status].fg,
        }}
      >
        <div class="flex items-start justify-between gap-2">
          <p
            class="text-sm font-bold uppercase tracking-wide"
            style={{ color: STATUS_STYLE[verdict().status].fg }}
          >
            {STATUS_STYLE[verdict().status].label}
          </p>
          <SpeakButton id="verdict" text={`${STATUS_STYLE[verdict().status].label}. ${verdict().headline}`} />
        </div>
        <p class="mt-2 text-lg text-[var(--gov-ink)]">{verdict().headline}</p>
        <p class="mt-2 text-sm text-[var(--gov-muted)]">
          This is decision support, not a funding decision. Eligible applications
          are assessed competitively on merit by an Evaluation Panel.
        </p>
      </section>

      {/* Findings */}
      <section class="mt-6 grid gap-4 md:grid-cols-3">
        <FindingColumn
          title="Must fix"
          empty="No blockers found."
          tone="var(--gov-stop)"
          items={blockers()}
        />
        <FindingColumn
          title="Check"
          empty="Nothing to confirm."
          tone="var(--gov-warn)"
          items={flags()}
        />
        <FindingColumn
          title="Looks good"
          empty="—"
          tone="var(--gov-ok)"
          items={oks()}
        />
      </section>

      {/* Document checklist */}
      <section class="print-card mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold text-[var(--gov-navy)]">
            Your supporting-document checklist
          </h2>
          <SpeakButton
            id="checklist"
            text={`Your supporting document checklist. ${checklist()
              .map((c) => c.label)
              .join('. ')}`}
          />
        </div>
        <p class="mt-1 text-sm text-[var(--gov-muted)]">
          Tailored to your answers. All listed documents must be complete at
          submission — additional documents are not considered unless requested.
        </p>
        <ul class="mt-4 space-y-3">
          <For each={checklist()}>
            {(item) => (
              <li class="rounded-xl border border-gray-200 p-4">
                <div class="flex items-start gap-3">
                  <span
                    class="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded border-2 border-gray-400"
                    aria-hidden="true"
                  />
                  <div class="flex-1">
                    <p class="font-semibold text-[var(--gov-navy)]">{item.label}</p>
                    <p class="mt-1 text-sm text-[var(--gov-muted)]">{item.detail}</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <CiteChip cite={item.cite} />
                      <Show when={item.template}>
                        {(t) => (
                          <a
                            href={TEMPLATE_URLS[t()]}
                            download
                            class="no-print inline-flex items-center gap-1 rounded-md bg-[var(--gov-blue-50)] px-2 py-1 text-xs font-semibold text-[var(--gov-blue)] hover:underline"
                          >
                            ↓ Download template
                          </a>
                        )}
                      </Show>
                    </div>
                  </div>
                </div>
              </li>
            )}
          </For>
        </ul>
      </section>

      {/* Criteria reminder */}
      <section class="print-card mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 class="text-xl font-bold text-[var(--gov-navy)]">
          How your application will be assessed
        </h2>
        <p class="mt-1 text-sm text-[var(--gov-muted)]">
          Four criteria, each worth 25%. Keep these in mind as you write.{' '}
          <CiteChip cite={{ section: '§6.2', title: 'Evaluation Criteria' }} />
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <For each={EVALUATION_CRITERIA}>
            {(c) => (
              <div class="rounded-xl bg-[var(--gov-bg)] p-4">
                <p class="font-semibold text-[var(--gov-navy)]">
                  {c.label} <span class="text-[var(--gov-muted)]">({c.weight}%)</span>
                </p>
                <p class="mt-1 text-sm text-[var(--gov-muted)]">{c.summary}</p>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* Next steps */}
      <section class="no-print mt-8 rounded-2xl bg-[var(--gov-navy)] p-6 text-white">
        <h2 class="text-xl font-bold">Next steps</h2>
        <p class="mt-2 text-blue-50">
          When your documents are ready, submit your application through the
          official SmartyGrants portal. Applications close {PROGRAM.closes}.
        </p>
        <a
          href={PROGRAM.portalUrl}
          target="_blank"
          rel="noreferrer"
          class="mt-4 inline-block rounded-lg bg-[var(--gov-gold-bright)] px-6 py-3 font-semibold text-[var(--gov-navy)] hover:brightness-95"
        >
          Open the SmartyGrants portal →
        </a>
      </section>
    </GrantShell>
  )
}

function FindingColumn(props: {
  title: string
  empty: string
  tone: string
  items: { message: string; cite?: { section: string; title: string } }[]
}) {
  return (
    <div class="print-card rounded-2xl border border-gray-200 bg-white p-5">
      <h2 class="text-lg font-bold" style={{ color: props.tone }}>
        {props.title}{' '}
        <span class="text-sm font-normal text-[var(--gov-muted)]">
          ({props.items.length})
        </span>
      </h2>
      <Show
        when={props.items.length > 0}
        fallback={<p class="mt-2 text-sm text-[var(--gov-muted)]">{props.empty}</p>}
      >
        <ul class="mt-3 space-y-3">
          <For each={props.items}>
            {(f) => (
              <li class="border-l-4 pl-3 text-sm" style={{ 'border-color': props.tone }}>
                <p class="text-[var(--gov-ink)]">{f.message}</p>
                <Show when={f.cite}>{(c) => <p class="mt-1"><CiteChip cite={c()} /></p>}</Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
