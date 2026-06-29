// The sections the coach gathers in conversation and then faithfully
// populates. Two groups, drafted from one gathered story (the user chose
// "both, as one connected flow"):
//   1. CRITERIA_SECTIONS  — the four 25% scored evaluation-criteria narratives.
//   2. PROJECT_PLAN_SECTIONS — the official 2026 Project Plan template fields.
//
// Each section carries a `coverageGuide`: the concrete points a strong answer
// needs. This single source of truth is used three ways —
//   • to STEER the live interview (the interviewer gently ensures coverage),
//   • to guide FAITHFUL STRUCTURING (what to look for in the transcript), and
//   • to drive the TRAFFIC-LIGHT assessment (green/yellow/red per section).
//
// Citations (§) trace each section to the Program Guidelines / templates.

export type SectionKind = 'criterion' | 'projectPlan'

export type CoachSection = {
  id: string
  title: string
  kind: SectionKind
  /** For criterion sections: the assessment weight. */
  weight?: number
  /** One-line purpose, in plain language, shown to the user. */
  purpose: string
  /** The concrete points a strong answer covers (steer + assess against these). */
  coverageGuide: string[]
  /** Where this comes from in the guidelines / templates. */
  cite: string
}

export const CRITERIA_SECTIONS: CoachSection[] = [
  {
    id: 'project_design',
    title: 'Project design',
    kind: 'criterion',
    weight: 25,
    purpose: 'What you will do, who for, and why it will work.',
    coverageGuide: [
      'Who the learners are and the specific barriers they face',
      'A clear, logical project model — key activities and intended impacts',
      'How it is targeted and tailored (not one-size-fits-all)',
      'Lived experience and on-the-ground insight informing the design',
      'Culturally safe, community-led approaches where relevant',
      'How it is new / does not duplicate existing services or funding',
      'Quality of wrap-around supports (relational, not just referral)',
    ],
    cite: '§6.2 Project design (25%)',
  },
  {
    id: 'longer_term_impact',
    title: 'Longer-term impact',
    kind: 'criterion',
    weight: 25,
    purpose: 'The lasting difference and what others can learn from it.',
    coverageGuide: [
      'How you will track and measure expected outcomes',
      'Potential for sustained improvement in completions or employment',
      'How the project tests models/tools/partnerships and informs future approaches',
      'How learnings will be captured and shared',
    ],
    cite: '§6.2 Longer-term Impact (25%)',
  },
  {
    id: 'partnerships_capability',
    title: 'Partnerships, capacity and capability',
    kind: 'criterion',
    weight: 25,
    purpose: 'Who is involved and why you can deliver it.',
    coverageGuide: [
      'Your organisation’s capacity and capability to deliver',
      'Skills and experience of the project staff',
      'Evidence of effective, genuine partnerships (incl. ACCO/community-led where relevant)',
      'Stakeholder engagement',
      'Track record under ACT/Australian Government programs, if previously funded',
    ],
    cite: '§6.2 Demonstrated partnerships, capacity and capability (25%)',
  },
  {
    id: 'value_for_money',
    title: 'Value for money',
    kind: 'criterion',
    weight: 25,
    purpose: 'Why the budget is a sound, proportionate investment.',
    coverageGuide: [
      'The budget is clear and reasonable',
      'Costs are proportionate to scale and expected benefits',
      'Resources are efficiently allocated to core (learner-facing) activities',
      'Any partner financial/in-kind contributions',
    ],
    cite: '§6.2 Value for money (25%)',
  },
]

export const PROJECT_PLAN_SECTIONS: CoachSection[] = [
  {
    id: 'project_overview',
    title: 'Project overview',
    kind: 'projectPlan',
    purpose: 'Background and a plain summary of the project.',
    coverageGuide: [
      'Background/context that prompted the project',
      'An overview of what the project is and does',
      'The expected benefits/outcomes',
    ],
    cite: 'Project Plan — Project Overview',
  },
  {
    id: 'kpis',
    title: 'Key performance indicators (KPIs)',
    kind: 'projectPlan',
    purpose: 'At least three measurable indicators and how you’ll measure them.',
    coverageGuide: [
      'At least three specific, measurable KPIs',
      'How each KPI will be measured (data source/method)',
      'A mix of quantitative and qualitative measures',
      'KPIs aligned to the Program objectives/outcomes',
    ],
    cite: 'Project Plan — Key Performance Indicators',
  },
  {
    id: 'partners',
    title: 'Partners and contributions',
    kind: 'projectPlan',
    purpose: 'Each partner, what they contribute, and the arrangement.',
    coverageGuide: [
      'Name of each project partner',
      'What each partner contributes (cash and/or in-kind)',
      'Key contact for each partner',
      'Note: a letter of support is required for each partner',
    ],
    cite: 'Project Plan — Partnerships',
  },
  {
    id: 'project_outline',
    title: 'Project outline (activities & timeline)',
    kind: 'projectPlan',
    purpose: 'The activities in order, with indicative dates and who leads.',
    coverageGuide: [
      'Key activities listed in chronological order',
      'A short description of each activity',
      'Indicative start and completion month/year (within Aug 2026 – Dec 2027)',
      'The lead party for each activity (applicant or named partner)',
    ],
    cite: 'Project Plan — Project Outline',
  },
  {
    id: 'personnel',
    title: 'Key project personnel',
    kind: 'projectPlan',
    purpose: 'The people delivering it and their relevant experience.',
    coverageGuide: [
      'Key personnel and their role in the project',
      'Relevant experience for each',
    ],
    cite: 'Project Plan — Key Project Personnel',
  },
  {
    id: 'participant_supports',
    title: 'Participant supports',
    kind: 'projectPlan',
    purpose: 'The supports individual learners receive (if applicable).',
    coverageGuide: [
      'The activities/supports participants will engage in',
      'Expected participant cohort(s) and numbers',
      'Expected duration (indicative start/finish)',
      'Any training included (accredited/non-accredited), the RTO, and units',
    ],
    cite: 'Project Plan — Participant Supports',
  },
  {
    id: 'risks',
    title: 'Risk management',
    kind: 'projectPlan',
    purpose: 'What could go wrong and how you’ll manage it.',
    coverageGuide: [
      'Key risks to delivery and outcomes (what could happen and how)',
      'The impact on the project if each occurs',
      'Treatment/prevention strategies for each',
    ],
    cite: 'Project Plan — Risk Management',
  },
  {
    id: 'communications',
    title: 'Communications plan',
    kind: 'projectPlan',
    purpose: 'How you’ll promote the project and reach participants.',
    coverageGuide: [
      'Target audience(s)',
      'Key messages',
      'Communication methods/channels',
    ],
    cite: 'Project Plan — Communications Plan',
  },
]

export const ALL_SECTIONS: CoachSection[] = [
  ...CRITERIA_SECTIONS,
  ...PROJECT_PLAN_SECTIONS,
]

export const SECTION_BY_ID: Record<string, CoachSection> = Object.fromEntries(
  ALL_SECTIONS.map((s) => [s.id, s]),
)
