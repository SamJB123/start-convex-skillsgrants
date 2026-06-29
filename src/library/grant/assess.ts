// Pure, deterministic assessment logic for the eligibility & navigation wizard.
//
// Given the user's answers, produce:
//  - an eligibility verdict (with cited reasons / flags / blockers), and
//  - a tailored supporting-document checklist.
//
// This makes NO funding decision and gives NO advice — it only reflects what
// the official guidelines say, with citations. All copy is plain language.

import {
  CHECKLIST_ITEMS,
  ORG_REQUIREMENTS,
  ORG_TYPES,
  PARTICIPANT_REQUIREMENTS,
  PROGRAM,
  type ChecklistItem,
  type Cite,
  type OrgTypeId,
  type Requirement,
} from './data'

/** Yes / No / Not sure — "unsure" never blocks; it becomes a thing to check. */
export type YN = 'yes' | 'no' | 'unsure'

export type Answers = {
  orgType?: OrgTypeId
  isAccoOrFno?: boolean
  // Org "must also" requirements, keyed by requirement id -> YN
  orgRequirements: Record<string, YN>
  // Project shape
  supportsParticipants?: YN // does the project support individual learners?
  hasPartnerships?: YN // identified partnerships with letters of support
  fundingSought: number | null // dollars (GST exclusive); always present (null = unset)
  withinTimeframe?: YN // commence by Aug 2026, complete by 31 Dec 2027
  externalRtoTraining?: YN // accredited training delivered by an RTO that isn't the applicant
  expenditureOver5k?: YN // any single purchased item / subcontract over $5,000
  engagesVolunteers?: YN // engages volunteers (affects insurance requirement)
  // Participant requirements (only meaningful if supportsParticipants === 'yes')
  participantRequirements: Record<string, YN>
}

export function emptyAnswers(): Answers {
  return {
    orgRequirements: {},
    participantRequirements: {},
    fundingSought: null,
  }
}

export type Finding = {
  kind: 'blocker' | 'flag' | 'ok'
  message: string
  cite?: Cite
}

export type Verdict = {
  /** 'eligible' = no blockers; 'check' = open questions only; 'ineligible' = at least one blocker. */
  status: 'eligible' | 'check' | 'ineligible'
  headline: string
  findings: Finding[]
}

const req = (id: string): Requirement | undefined =>
  ORG_REQUIREMENTS.find((r) => r.id === id) ??
  PARTICIPANT_REQUIREMENTS.find((r) => r.id === id)

export function assessEligibility(a: Answers): Verdict {
  const findings: Finding[] = []

  // --- Organisation type ---------------------------------------------------
  const orgType = a.orgType ? ORG_TYPES.find((o) => o.id === a.orgType) : undefined
  if (orgType) {
    if (orgType.status === 'ineligible') {
      // Government RTOs and school-partnerships are the documented exceptions.
      if (orgType.id === 'government') {
        findings.push({
          kind: 'flag',
          message:
            'Government agencies are generally not eligible — UNLESS the agency is itself an RTO. If you are a government RTO you may apply; otherwise you are not eligible.',
          cite: orgType.cite,
        })
      } else if (orgType.id === 'school') {
        findings.push({
          kind: 'blocker',
          message:
            'Schools cannot apply directly. You could still take part by partnering with an eligible organisation that applies on the project’s behalf.',
          cite: orgType.cite,
        })
      } else {
        findings.push({ kind: 'blocker', message: `${orgType.label} is not eligible to apply.`, cite: orgType.cite })
      }
    } else {
      findings.push({
        kind: 'ok',
        message: `${orgType.label} is an eligible type of applicant.`,
        cite: orgType.cite,
      })
      if (orgType.note) findings.push({ kind: 'flag', message: orgType.note, cite: orgType.cite })
    }
  }

  if (a.isAccoOrFno) {
    findings.push({
      kind: 'flag',
      message:
        'As an ACCO or First Nations Owned RTO you are encouraged and prioritised, and you do not need to hold a TIFA for accredited training to be considered.',
      cite: { section: '§5.5', title: 'Training delivery' },
    })
  }

  // --- Organisation "must also" requirements -------------------------------
  for (const r of ORG_REQUIREMENTS) {
    const answer = a.orgRequirements[r.id]
    if (answer === 'no') {
      // Conditional requirements can be legitimately "no" (not applicable).
      const conditional = Boolean(r.conditional)
      findings.push({
        kind: conditional ? 'flag' : 'blocker',
        message: conditional
          ? `"${r.label}" — confirm this does not apply to you. ${r.conditional ?? ''}`.trim()
          : `You indicated you do NOT meet: "${r.label}". This is an eligibility requirement.`,
        cite: r.cite,
      })
    } else if (answer === 'unsure') {
      findings.push({
        kind: 'flag',
        message: `Check: "${r.label}". ${r.help}`,
        cite: r.cite,
      })
    }
  }

  // --- Project shape -------------------------------------------------------
  if (a.hasPartnerships === 'no') {
    findings.push({
      kind: 'blocker',
      message:
        'Projects must involve identified partnerships, with letters confirming the arrangement. A project with no partners would not meet the funding parameters.',
      cite: { section: '§4', title: 'Funding Parameters' },
    })
  } else if (a.hasPartnerships === 'unsure') {
    findings.push({
      kind: 'flag',
      message:
        'Confirm your partnerships. Community-led and ACCO-driven models are valid — partnerships do not need to be employer-led, but genuine collaboration must be demonstrated.',
      cite: { section: '§4', title: 'Funding Parameters' },
    })
  }

  if (typeof a.fundingSought === 'number' && a.fundingSought > PROGRAM.maxFunding) {
    findings.push({
      kind: 'blocker',
      message: `You entered $${a.fundingSought.toLocaleString()}. The maximum funding per application is $${PROGRAM.maxFunding.toLocaleString()} (GST exclusive).`,
      cite: { section: '§4', title: 'Funding Parameters' },
    })
  }

  if (a.withinTimeframe === 'no') {
    findings.push({
      kind: 'blocker',
      message: `Projects must commence by ${PROGRAM.projectStart} and be completed by ${PROGRAM.projectEnd}.`,
      cite: { section: '§4', title: 'Funding Parameters' },
    })
  } else if (a.withinTimeframe === 'unsure') {
    findings.push({
      kind: 'flag',
      message: `Check your timing: projects must commence by ${PROGRAM.projectStart} and finish by ${PROGRAM.projectEnd}.`,
      cite: { section: '§4', title: 'Funding Parameters' },
    })
  }

  // --- Participant eligibility (only if supporting individual learners) ----
  if (a.supportsParticipants === 'yes') {
    for (const r of PARTICIPANT_REQUIREMENTS) {
      const answer = a.participantRequirements[r.id]
      if (answer === 'no') {
        findings.push({
          kind: 'flag',
          message: `Some participants may not meet: "${r.label}". Only eligible participants can be supported. ${r.help}`,
          cite: r.cite,
        })
      } else if (answer === 'unsure') {
        findings.push({ kind: 'flag', message: `Check participant rule: "${r.label}". ${r.help}`, cite: r.cite })
      }
    }
  }

  // --- Verdict -------------------------------------------------------------
  const hasBlocker = findings.some((f) => f.kind === 'blocker')
  const hasFlag = findings.some((f) => f.kind === 'flag')

  if (hasBlocker) {
    return {
      status: 'ineligible',
      headline:
        'Based on your answers, there is at least one eligibility requirement that is not met. See the items marked “must fix” below.',
      findings,
    }
  }
  if (hasFlag) {
    return {
      status: 'check',
      headline:
        'You look broadly eligible, but there are a few things to confirm before you apply. See the items marked “check” below.',
      findings,
    }
  }
  return {
    status: 'eligible',
    headline:
      'Based on your answers, your organisation appears to meet the eligibility requirements. Eligibility does not guarantee funding — applications are assessed competitively on merit.',
    findings,
  }
}

// ---------------------------------------------------------------------------
// Tailored supporting-document checklist
// ---------------------------------------------------------------------------

export function buildChecklist(a: Answers): ChecklistItem[] {
  const items: ChecklistItem[] = []

  // Always required by §5.4 for an eligible application.
  items.push(CHECKLIST_ITEMS.budget_template)
  items.push(CHECKLIST_ITEMS.project_plan)

  // Partnerships are required → letters of support always belong on the list
  // unless the user has explicitly said they have no partnerships (a blocker).
  if (a.hasPartnerships !== 'no') items.push(CHECKLIST_ITEMS.letters_of_support)

  // Quotes for expenditure over $5,000.
  if (a.expenditureOver5k === 'yes' || a.expenditureOver5k === 'unsure') {
    items.push(CHECKLIST_ITEMS.quote_over_5k)
  }

  // RTO quote for externally delivered accredited training.
  if (a.externalRtoTraining === 'yes' || a.externalRtoTraining === 'unsure') {
    items.push(CHECKLIST_ITEMS.rto_quote)
  }

  // Evidence of public liability insurance is worth having ready.
  items.push(CHECKLIST_ITEMS.public_liability_evidence)

  return items
}
