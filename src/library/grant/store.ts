// Module-scope assessment store. In Solid 2 a module-scope store IS a global,
// which is exactly what we want: the wizard and the summary page share one
// source of truth. Progress is mirrored to localStorage so anyone (including
// anonymous users) gets save-and-resume; signed-in users additionally sync to
// Convex (handled in the wizard route).

import { createStore } from 'solid-js'
import { flush } from 'solid-js'
import { isServer } from '@solidjs/web'
import { emptyAnswers, type Answers } from './assess'

const STORAGE_KEY = 'actvet.assessment.v1'

type State = {
  answers: Answers
  currentStep: number
  /** True once we've merged any server-side saved assessment. */
  hydratedFromServer: boolean
}

function load(): State {
  const base: State = {
    answers: emptyAnswers(),
    currentStep: 0,
    hydratedFromServer: false,
  }
  if (isServer) return base
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    return {
      answers: { ...emptyAnswers(), ...(parsed.answers ?? {}) },
      currentStep: typeof parsed.currentStep === 'number' ? parsed.currentStep : 0,
      hydratedFromServer: false,
    }
  } catch {
    return base
  }
}

const [state, setState] = createStore<State>(load())

// Read-only handle for components.
export const assessment = state

function persistLocal() {
  if (isServer) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers: state.answers, currentStep: state.currentStep }),
    )
  } catch {
    // Storage may be unavailable (private mode / blocked); fail silently.
  }
}

// All mutators are called from event handlers or onSettled (writes are allowed
// there). We `flush()` before persisting because Solid 2 setters are queued —
// reads return the previous value until the microtask flushes.

export function updateAnswers(mut: (a: Answers) => void) {
  setState((s) => {
    mut(s.answers)
  })
  flush()
  persistLocal()
}

export function setStep(n: number) {
  setState((s) => {
    s.currentStep = n
  })
  flush()
  persistLocal()
}

export function hydrateFromServer(answers: Answers, currentStep: number) {
  setState((s) => {
    s.answers = { ...emptyAnswers(), ...answers }
    s.currentStep = currentStep
    s.hydratedFromServer = true
  })
  flush()
  persistLocal()
}

export function markServerHydrated() {
  setState((s) => {
    s.hydratedFromServer = true
  })
}

export function resetAssessment() {
  setState((s) => {
    s.answers = emptyAnswers()
    s.currentStep = 0
  })
  flush()
  persistLocal()
}

/** Has the user entered anything meaningful yet? */
export function hasProgress(): boolean {
  const a = state.answers
  return Boolean(
    a.orgType ||
      a.isAccoOrFno ||
      Object.keys(a.orgRequirements).length ||
      a.hasPartnerships ||
      a.supportsParticipants ||
      (typeof a.fundingSought === 'number' && a.fundingSought > 0),
  )
}
