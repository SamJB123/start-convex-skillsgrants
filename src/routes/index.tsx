import { createFileRoute, Link } from '@tanstack/solid-router'
import { For } from 'solid-js'
import GrantShell from '~/components/grant/Shell'
import SpeakButton from '~/components/grant/SpeakButton'
import { KEY_DATES, PROGRAM } from '~/library/grant/data'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

const INTRO =
  'This free helper guides eligible organisations — including Aboriginal Community-Controlled Organisations and First Nations owned RTOs — through the ACT VET Completions Grants 2026. Check your eligibility, get a tailored list of the documents you need, and understand the guidelines in plain language. Everything is grounded in the official guidelines and shows you exactly where each rule comes from.'

const STEPS = [
  {
    title: 'Check eligibility',
    body: 'Answer a few plain-language questions about your organisation and project. We tell you what the guidelines say — and never make the funding decision for you.',
  },
  {
    title: 'Get your document checklist',
    body: 'Based on your answers, we build a tailored list of the supporting documents you need to submit, with links to the official templates.',
  },
  {
    title: 'Understand the guidelines',
    body: 'Ask the guide or browse the glossary to understand terms like ACCO, TIFA, KPIs and acquittal — in clear, everyday language.',
  },
]

function RouteComponent() {
  return (
    <GrantShell>
      <section class="rounded-2xl bg-white p-6 shadow-sm md:p-10">
        <div class="flex items-start justify-between gap-2">
          <h1 class="text-3xl font-bold text-[var(--gov-navy)] md:text-4xl">
            Apply for the ACT VET Completions Grants 2026 with confidence
          </h1>
          <SpeakButton text={INTRO} id="home-intro" label="Read introduction aloud" />
        </div>
        <p class="mt-4 max-w-3xl text-lg text-[var(--gov-ink)]">{INTRO}</p>

        <div class="mt-6 flex flex-wrap gap-3">
          <Link
            to="/check"
            class="rounded-lg bg-[var(--gov-blue)] px-6 py-3 text-base font-semibold text-white shadow hover:bg-[var(--gov-navy-700)]"
          >
            Check your eligibility →
          </Link>
          <Link
            to="/glossary"
            class="rounded-lg border border-[var(--gov-blue)] px-6 py-3 text-base font-semibold text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]"
          >
            Browse the guide &amp; glossary
          </Link>
        </div>

        <p class="mt-6 max-w-3xl rounded-lg bg-[var(--gov-blue-50)] p-4 text-sm text-[var(--gov-navy)]">
          <strong>Up to ${PROGRAM.maxFunding.toLocaleString()}</strong> (GST
          exclusive) per application. Projects run from {PROGRAM.projectStart} to{' '}
          {PROGRAM.projectEnd}. ACCOs and First Nations owned RTOs are encouraged
          and prioritised, consistent with self-determination and Closing the Gap.
        </p>
      </section>

      <section class="mt-8 grid gap-4 md:grid-cols-3">
        <For each={STEPS}>
          {(step, i) => (
            <div class="rounded-xl border border-gray-200 bg-white p-5">
              <div class="grid h-9 w-9 place-items-center rounded-full bg-[var(--gov-navy)] font-bold text-white">
                {i() + 1}
              </div>
              <h2 class="mt-3 flex items-center gap-2 text-lg font-semibold text-[var(--gov-navy)]">
                {step.title}
                <SpeakButton text={`${step.title}. ${step.body}`} id={`step-${i()}`} />
              </h2>
              <p class="mt-2 text-sm text-[var(--gov-muted)]">{step.body}</p>
            </div>
          )}
        </For>
      </section>

      <section class="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 class="text-xl font-bold text-[var(--gov-navy)]">Key dates</h2>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2">
          <For each={KEY_DATES}>
            {(d) => (
              <div class="rounded-lg bg-[var(--gov-bg)] p-4">
                <dt class="text-sm font-medium text-[var(--gov-muted)]">{d.label}</dt>
                <dd class="text-base font-semibold text-[var(--gov-navy)]">{d.value}</dd>
              </div>
            )}
          </For>
        </dl>
        <p class="mt-4 text-xs text-[var(--gov-muted)]">
          Late applications are not accepted. ACCOs may request additional time
          for community consultation and governance — contact Skills Canberra
          before the closing date.
        </p>
      </section>
    </GrantShell>
  )
}
