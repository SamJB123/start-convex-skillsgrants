import { createFileRoute, useNavigate } from '@tanstack/solid-router'
import { For, Show, createMemo, onSettled, snapshot } from 'solid-js'
import { api } from 'convex/_generated/api'
import GrantShell from '~/components/grant/Shell'
import YesNo from '~/components/grant/YesNo'
import SpeakButton from '~/components/grant/SpeakButton'
import CiteChip from '~/components/grant/CiteChip'
import { convexClient } from '~/library/convex-client'
import { useSession } from '~/library/use-session'
import {
  ORG_REQUIREMENTS,
  ORG_TYPES,
  PARTICIPANT_REQUIREMENTS,
  PROGRAM,
} from '~/library/grant/data'
import type { Answers, YN } from '~/library/grant/assess'
import {
  assessment,
  hasProgress,
  hydrateFromServer,
  markServerHydrated,
  resetAssessment,
  setStep,
  updateAnswers,
} from '~/library/grant/store'

export const Route = createFileRoute('/check')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const session = useSession()
  const signedIn = () => Boolean(session().data?.user)

  // Hydrate from the server once, for signed-in users with no local progress.
  // We do this in onSettled (writes are allowed after first settle) and read
  // the query imperatively so we never write a store from inside an effect.
  onSettled(() => {
    void (async () => {
      try {
        const remote = await convexClient.query(api.assessments.getMine, {})
        if (remote && !assessment.hydratedFromServer && !hasProgress()) {
          hydrateFromServer(remote.answers as Answers, remote.currentStep)
        } else {
          markServerHydrated()
        }
      } catch {
        markServerHydrated()
      }
    })()
  })

  function persistRemote() {
    if (!signedIn()) return
    convexClient
      .mutation(api.assessments.save, {
        answers: snapshot(assessment.answers) as Answers,
        currentStep: assessment.currentStep,
      })
      .catch(() => {
        /* best-effort; localStorage is the source of truth offline */
      })
  }

  // Steps; the Participants step only appears when the project supports
  // individual learners.
  const steps = createMemo(() => {
    const base = [
      { key: 'org', label: 'Your organisation' },
      { key: 'requirements', label: 'Requirements' },
      { key: 'project', label: 'Your project' },
    ]
    if (assessment.answers.supportsParticipants === 'yes') {
      base.push({ key: 'participants', label: 'Participants' })
    }
    return base
  })

  const current = () => Math.min(assessment.currentStep, steps().length - 1)
  const stepKey = () => steps()[current()]?.key

  function goNext() {
    if (current() < steps().length - 1) {
      setStep(current() + 1)
      persistRemote()
    } else {
      persistRemote()
      navigate({ to: '/summary' })
    }
  }
  function goBack() {
    if (current() > 0) {
      setStep(current() - 1)
      persistRemote()
    } else {
      navigate({ to: '/' })
    }
  }
  function startOver() {
    resetAssessment()
    if (signedIn()) convexClient.mutation(api.assessments.clear, {}).catch(() => {})
  }

  const setReq = (id: string, v: YN) =>
    updateAnswers((a) => {
      a.orgRequirements[id] = v
    })
  const setParticipantReq = (id: string, v: YN) =>
    updateAnswers((a) => {
      a.participantRequirements[id] = v
    })

  return (
    <GrantShell>
      {/* Progress */}
      <nav aria-label="Progress" class="no-print mb-6">
        <ol class="flex flex-wrap gap-2">
          <For each={steps()}>
            {(s, i) => (
              <li class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(i())
                    persistRemote()
                  }}
                  class={[
                    'rounded-full px-3 py-1 text-sm font-medium',
                    {
                      'bg-[var(--gov-navy)] text-white': i() === current(),
                      'bg-[var(--gov-blue-50)] text-[var(--gov-navy)]': i() < current(),
                      'bg-gray-100 text-gray-500': i() > current(),
                    },
                  ]}
                  aria-current={i() === current() ? 'step' : undefined}
                >
                  {i() + 1}. {s.label}
                </button>
              </li>
            )}
          </For>
        </ol>
        <p class="mt-2 text-sm text-[var(--gov-muted)]">
          Step {current() + 1} of {steps().length}.{' '}
          <Show when={signedIn()} fallback="Your progress is saved in this browser.">
            Your progress is saved to your account.
          </Show>
        </p>
      </nav>

      <div class="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        {/* STEP: Organisation type */}
        <Show when={stepKey() === 'org'}>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-[var(--gov-navy)]">
            What type of organisation are you?
            <SpeakButton
              id="step-org"
              text="What type of organisation are you? Choose the option that best describes the organisation that would apply for the grant."
            />
          </h1>
          <p class="mt-2 text-[var(--gov-muted)]">
            Choose the option that best describes the organisation that would
            apply. The grant is applied for by organisations, not individuals.
          </p>
          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <For each={ORG_TYPES}>
              {(o) => (
                <button
                  type="button"
                  onClick={() => updateAnswers((a) => {
                    a.orgType = o.id
                  })}
                  class={[
                    'rounded-xl border p-4 text-left transition-colors',
                    {
                      'border-[var(--gov-blue)] bg-[var(--gov-blue-50)] ring-1 ring-[var(--gov-blue)]':
                        assessment.answers.orgType === o.id,
                      'border-gray-300 hover:border-gray-400':
                        assessment.answers.orgType !== o.id,
                    },
                  ]}
                  aria-pressed={assessment.answers.orgType === o.id ? 'true' : 'false'}
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-[var(--gov-navy)]">{o.label}</span>
                    <Show when={o.status === 'ineligible'}>
                      <span class="rounded bg-[var(--gov-stop-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--gov-stop)]">
                        Usually not eligible
                      </span>
                    </Show>
                  </span>
                  <span class="mt-1 block text-sm text-[var(--gov-muted)]">{o.description}</span>
                </button>
              )}
            </For>
          </div>

          <label class="mt-5 flex items-start gap-3 rounded-xl border border-gray-200 bg-[var(--gov-blue-50)] p-4">
            <input
              type="checkbox"
              checked={Boolean(assessment.answers.isAccoOrFno)}
              onChange={(e) => updateAnswers((a) => {
                a.isAccoOrFno = e.currentTarget.checked
              })}
              class="mt-1 h-5 w-5"
            />
            <span class="text-sm text-[var(--gov-navy)]">
              <span class="font-semibold">
                My organisation is an ACCO or a First Nations owned RTO.
              </span>
              <span class="mt-1 block text-[var(--gov-muted)]">
                ACCOs and FNO RTOs are encouraged and prioritised, and do not
                need to hold a TIFA for accredited training. <CiteChip cite={{ section: '§5.5', title: 'Training delivery' }} />
              </span>
            </span>
          </label>
        </Show>

        {/* STEP: Organisation requirements */}
        <Show when={stepKey() === 'requirements'}>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-[var(--gov-navy)]">
            Does your organisation meet these requirements?
            <SpeakButton
              id="step-req"
              text="Does your organisation meet these requirements? Answer yes, no, or not sure for each. Not sure is fine — we will add it to your list of things to check."
            />
          </h1>
          <p class="mt-2 text-[var(--gov-muted)]">
            Answer for each. “Not sure” is fine — we’ll add it to your list of
            things to check.
          </p>
          <div class="mt-5 space-y-4">
            <For each={ORG_REQUIREMENTS}>
              {(r) => (
                <YesNo
                  name={r.id}
                  legend={r.label}
                  help={r.help}
                  cite={r.cite}
                  value={assessment.answers.orgRequirements[r.id]}
                  onChange={(v) => setReq(r.id, v)}
                />
              )}
            </For>
          </div>
        </Show>

        {/* STEP: Project */}
        <Show when={stepKey() === 'project'}>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-[var(--gov-navy)]">
            Tell us about your project
            <SpeakButton
              id="step-project"
              text="Tell us about your project. These questions help us build your document checklist and flag anything to confirm."
            />
          </h1>
          <div class="mt-5 space-y-4">
            <YesNo
              name="hasPartnerships"
              legend="Does your project involve identified partnerships (with letters of support)?"
              help="Projects must involve partnerships. Community-led and ACCO-driven models count — partnerships do not have to be employer-led."
              cite={{ section: '§4', title: 'Funding Parameters' }}
              value={assessment.answers.hasPartnerships}
              onChange={(v) => updateAnswers((a) => {
                a.hasPartnerships = v
              })}
            />

            <fieldset class="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
              <legend class="flex items-center gap-2 px-1 text-base font-semibold text-[var(--gov-navy)]">
                How much funding will you request? (GST exclusive)
                <SpeakButton
                  id="q-funding"
                  text={`How much funding will you request, GST exclusive? The maximum is ${PROGRAM.maxFunding} dollars.`}
                />
              </legend>
              <div class="mt-3 flex items-center gap-2">
                <span class="text-lg font-semibold text-[var(--gov-navy)]">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  inputmode="numeric"
                  value={assessment.answers.fundingSought ?? ''}
                  onInput={(e) => {
                    const raw = e.currentTarget.value
                    updateAnswers((a) => {
                      a.fundingSought = raw === '' ? null : Number(raw)
                    })
                  }}
                  class="w-48 rounded-lg border border-gray-300 px-3 py-2 text-lg"
                  aria-describedby="funding-help"
                />
              </div>
              <p id="funding-help" class="mt-2 text-sm text-[var(--gov-muted)]">
                Maximum ${PROGRAM.maxFunding.toLocaleString()} per application. No
                minimum. <CiteChip cite={{ section: '§4', title: 'Funding Parameters' }} />
              </p>
            </fieldset>

            <YesNo
              name="withinTimeframe"
              legend={`Can your project start by ${PROGRAM.projectStart} and finish by ${PROGRAM.projectEnd}?`}
              cite={{ section: '§4', title: 'Funding Parameters' }}
              value={assessment.answers.withinTimeframe}
              onChange={(v) => updateAnswers((a) => {
                a.withinTimeframe = v
              })}
            />
            <YesNo
              name="expenditureOver5k"
              legend="Will any single purchased item or subcontracted service cost more than $5,000?"
              help="If yes, you’ll need at least one quote for each of those items."
              cite={{ section: '§5.4', title: 'Provision of quotes and supporting documents' }}
              value={assessment.answers.expenditureOver5k}
              onChange={(v) => updateAnswers((a) => {
                a.expenditureOver5k = v
              })}
            />
            <YesNo
              name="externalRtoTraining"
              legend="Will accredited training be delivered by an RTO that is not your organisation?"
              help="If yes, you’ll need a quote from that RTO for delivery, assessment and certification."
              cite={{ section: '§5.5', title: 'Training delivery' }}
              value={assessment.answers.externalRtoTraining}
              onChange={(v) => updateAnswers((a) => {
                a.externalRtoTraining = v
              })}
            />
            <YesNo
              name="engagesVolunteers"
              legend="Will your project engage volunteers?"
              help="If yes, you must hold volunteer workers insurance."
              cite={{ section: '§5.1', title: 'Applicant eligibility' }}
              value={assessment.answers.engagesVolunteers}
              onChange={(v) => updateAnswers((a) => {
                a.engagesVolunteers = v
              })}
            />
            <YesNo
              name="supportsParticipants"
              legend="Does your project support individual learners/participants?"
              help="If yes, we’ll ask a few questions about participant eligibility next."
              cite={{ section: '§5.2', title: 'Participant Eligibility' }}
              value={assessment.answers.supportsParticipants}
              onChange={(v) => updateAnswers((a) => {
                a.supportsParticipants = v
              })}
            />
          </div>
        </Show>

        {/* STEP: Participants */}
        <Show when={stepKey() === 'participants'}>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-[var(--gov-navy)]">
            Participant eligibility
            <SpeakButton
              id="step-participants"
              text="Participant eligibility. These rules apply to each individual learner at the time they enrol."
            />
          </h1>
          <p class="mt-2 text-[var(--gov-muted)]">
            These rules apply to each individual learner at the time they enrol.
          </p>
          <div class="mt-5 space-y-4">
            <For each={PARTICIPANT_REQUIREMENTS}>
              {(r) => (
                <YesNo
                  name={r.id}
                  legend={r.label}
                  help={r.help}
                  cite={r.cite}
                  value={assessment.answers.participantRequirements[r.id]}
                  onChange={(v) => setParticipantReq(r.id, v)}
                />
              )}
            </For>
          </div>
        </Show>

        {/* Nav buttons */}
        <div class="no-print mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            class="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Back
          </button>
          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={startOver}
              class="text-sm font-medium text-[var(--gov-muted)] underline hover:text-[var(--gov-navy)]"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={goNext}
              class="rounded-lg bg-[var(--gov-blue)] px-6 py-2.5 font-semibold text-white hover:bg-[var(--gov-navy-700)]"
            >
              {current() < steps().length - 1 ? 'Next →' : 'See my results →'}
            </button>
          </div>
        </div>
      </div>
    </GrantShell>
  )
}
