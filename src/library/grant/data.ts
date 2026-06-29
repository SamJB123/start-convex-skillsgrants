// Structured, CITED knowledge base for the ACT VET Completions Grants 2026.
//
// Everything here is transcribed directly from the official Program Guidelines
// (the .docx in the repo root). Each rule carries a `cite` so the UI can show
// users exactly where a requirement comes from — this is the "strict, grounded
// + cited" principle applied to the deterministic wizard, mirroring how the
// (Milestone 2) chat assistant will cite the guidelines.
//
// IMPORTANT: this is decision-support, not legal/eligibility advice. The wizard
// surfaces what the guidelines say; it never makes the funding decision.

export type Cite = {
  /** Short section reference, e.g. "§5.1". */
  section: string
  /** Human-readable section title. */
  title: string
}

export const PROGRAM = {
  name: 'ACT VET Completions Grants 2026',
  administrator: 'Skills Canberra (Chief Minister, Treasury and Economic Development Directorate)',
  portalUrl: 'https://CMTEDD.smartygrants.com.au/2026VETCompletionsGrants',
  maxFunding: 250000,
  quoteThreshold: 5000,
  publicLiabilityMin: 10000000,
  gstTurnoverThreshold: 150000,
  projectStart: 'August 2026',
  projectEnd: '31 December 2027',
  opens: '9:00am, Tuesday 21 April 2026',
  closes: '5:00pm, Thursday 4 June 2026',
  contactPhone: '6205 4006',
  contactEmail: 'skills.projects@act.gov.au',
} as const

// ---------------------------------------------------------------------------
// Applicant organisation types (§5.1 eligible, §5.3 not eligible)
// ---------------------------------------------------------------------------

export type OrgTypeId =
  | 'rto'
  | 'gto'
  | 'community'
  | 'industry'
  | 'employer'
  | 'acco'
  | 'fno_rto'
  | 'government'
  | 'school'

export type OrgType = {
  id: OrgTypeId
  label: string
  description: string
  /** 'eligible' | 'conditional' (eligible but with an important caveat) | 'ineligible' */
  status: 'eligible' | 'conditional' | 'ineligible'
  note?: string
  cite: Cite
}

const ELIG_CITE: Cite = { section: '§5.1', title: 'Applicant eligibility' }
const INELIG_CITE: Cite = { section: '§5.3', title: 'Who is not eligible to apply' }

export const ORG_TYPES: OrgType[] = [
  {
    id: 'rto',
    label: 'Education / training provider or RTO',
    description:
      'Education and training providers, or other organisations with training as a key focus, including registered training organisations (RTOs).',
    status: 'eligible',
    cite: ELIG_CITE,
  },
  {
    id: 'gto',
    label: 'Group training organisation',
    description: 'A group training organisation (GTO).',
    status: 'eligible',
    cite: ELIG_CITE,
  },
  {
    id: 'community',
    label: 'Community organisation',
    description: 'A community organisation.',
    status: 'eligible',
    cite: ELIG_CITE,
  },
  {
    id: 'industry',
    label: 'Industry association',
    description: 'An industry association.',
    status: 'eligible',
    cite: ELIG_CITE,
  },
  {
    id: 'employer',
    label: 'Employer',
    description: 'An employer.',
    status: 'eligible',
    cite: ELIG_CITE,
  },
  {
    id: 'acco',
    label: 'Aboriginal Community-Controlled Organisation (ACCO)',
    description:
      'An ACCO as per Clause 44 of the National Agreement on Closing the Gap. ACCOs are strongly encouraged to apply and applications contributing to Closing the Gap are prioritised.',
    status: 'eligible',
    note: 'ACCOs are encouraged to apply and are prioritised, consistent with self-determination and Closing the Gap.',
    cite: ELIG_CITE,
  },
  {
    id: 'fno_rto',
    label: 'First Nations Owned (FNO) RTO',
    description: 'An ACCO or First Nations Owned Organisation (FNO) RTO.',
    status: 'eligible',
    note: 'FNO RTOs are encouraged to apply and are prioritised.',
    cite: ELIG_CITE,
  },
  {
    id: 'government',
    label: 'Government agency',
    description: 'A state, territory or federal government agency.',
    status: 'ineligible',
    note: 'Government agencies are not eligible — UNLESS the agency is itself an RTO, in which case it may apply.',
    cite: INELIG_CITE,
  },
  {
    id: 'school',
    label: 'School',
    description: 'A school.',
    status: 'ineligible',
    note: 'Schools cannot apply directly. However, applications from eligible organisations partnering with schools WILL be considered — consider applying with an eligible partner.',
    cite: INELIG_CITE,
  },
]

// ---------------------------------------------------------------------------
// Organisation "must also" requirements (§5.1)
// ---------------------------------------------------------------------------

export type Requirement = {
  id: string
  label: string
  help: string
  cite: Cite
  /** Some requirements only apply in certain conditions. */
  conditional?: string
}

export const ORG_REQUIREMENTS: Requirement[] = [
  {
    id: 'act_delivery',
    label: 'Delivers programs within the ACT',
    help: 'The project must be delivered within the Australian Capital Territory.',
    cite: ELIG_CITE,
  },
  {
    id: 'public_liability',
    label: 'Holds Public Liability Insurance of at least $10,000,000',
    help: 'You must hold public liability cover of at least ten million dollars.',
    cite: ELIG_CITE,
  },
  {
    id: 'abn_matches',
    label: 'Holds an ABN that matches the legal entity name',
    help: 'Your Australian Business Number must match the legal name of the applying entity.',
    cite: ELIG_CITE,
  },
  {
    id: 'gst_registered',
    label: 'Registered for GST (if turnover is over $150,000 per year)',
    help: 'You must be registered for GST if your annual turnover is greater than $150,000. If your turnover is below this, GST registration is not required.',
    cite: ELIG_CITE,
    conditional: 'Only required if annual turnover is greater than $150,000.',
  },
  {
    id: 'associations_compliant',
    label: 'Compliant under the Associations Incorporation Act 1991 (if applicable)',
    help: 'If your organisation is an incorporated association, it must be compliant under the Associations Incorporation Act 1991.',
    cite: ELIG_CITE,
    conditional: 'Only applies if your organisation is an incorporated association.',
  },
  {
    id: 'acquitted_prior',
    label: 'Has satisfactorily acquitted all previous ACT Government grants',
    help: 'Any earlier ACT Government grants must have been acquitted (reported and reconciled) satisfactorily. No new funding is provided until outstanding grants are acquitted.',
    cite: ELIG_CITE,
  },
  {
    id: 'volunteer_insurance',
    label: 'Holds volunteer workers insurance (if volunteers will be engaged)',
    help: 'If your project will engage volunteers, you must hold volunteer workers insurance.',
    cite: ELIG_CITE,
    conditional: 'Only required if volunteers will be engaged.',
  },
  {
    id: 'workers_comp',
    label: "Holds workers' compensation insurance",
    help: "You must hold workers' compensation insurance.",
    cite: ELIG_CITE,
  },
]

// ---------------------------------------------------------------------------
// Participant eligibility (§5.2) — only relevant if the project supports
// individual learners.
// ---------------------------------------------------------------------------

const PARTICIPANT_CITE: Cite = { section: '§5.2', title: 'Participant Eligibility' }

export const PARTICIPANT_REQUIREMENTS: Requirement[] = [
  {
    id: 'live_work_act',
    label: 'Participants live or work in the ACT',
    help: 'At the time of enrolment, each participant must live or work in the ACT.',
    cite: PARTICIPANT_CITE,
  },
  {
    id: 'citizenship',
    label: 'Australian citizen, New Zealand citizen, or holder of an eligible visa',
    help: 'Each participant must be an Australian citizen, a New Zealand citizen, or hold an eligible visa (as defined on the Skills Canberra website).',
    cite: PARTICIPANT_CITE,
  },
  {
    id: 'age_pathway',
    label: 'Aged 17+ and not in school/Year 12, OR in/considering an ASbA',
    help: 'Each participant must be aged 17 or over and not enrolled in school/college or another Year 12 program; OR be currently enrolled in, or considering, an Australian School-based Apprenticeship (ASbA).',
    cite: PARTICIPANT_CITE,
  },
]

// ---------------------------------------------------------------------------
// Supporting documents (§5.4) — checklist rules. `appliesIf` is evaluated by
// assess.ts against the user's answers.
// ---------------------------------------------------------------------------

export type ChecklistRuleId =
  | 'letters_of_support'
  | 'quote_over_5k'
  | 'budget_template'
  | 'project_plan'
  | 'public_liability_evidence'
  | 'rto_quote'

export type ChecklistItem = {
  id: ChecklistRuleId
  label: string
  detail: string
  cite: Cite
  /** A downloadable template lives in the repo for these. */
  template?: 'budget' | 'project_plan'
}

const DOCS_CITE: Cite = { section: '§5.4', title: 'Provision of quotes and supporting documents' }

export const CHECKLIST_ITEMS: Record<ChecklistRuleId, ChecklistItem> = {
  letters_of_support: {
    id: 'letters_of_support',
    label: 'Letters of support from each project partner',
    detail:
      'A letter from every project partner confirming their contributions and the partnership arrangement. Partnerships are required for this grant.',
    cite: DOCS_CITE,
  },
  quote_over_5k: {
    id: 'quote_over_5k',
    label: 'At least one quote for any planned expenditure over $5,000',
    detail:
      'For each purchased item or subcontracted service over $5,000, include at least one quote.',
    cite: DOCS_CITE,
  },
  budget_template: {
    id: 'budget_template',
    label: 'Itemised budget (2026 ACT VET Completions Budget Template)',
    detail:
      'Complete the official budget template with itemised costs. Note: the majority of funding is expected to support participant outcomes rather than administration.',
    cite: DOCS_CITE,
    template: 'budget',
  },
  project_plan: {
    id: 'project_plan',
    label: 'Project plan (2026 ACT VET Project Plan Template), including KPIs',
    detail:
      'Complete the official project plan template, including at least three key performance indicators (KPIs) and how each will be measured.',
    cite: DOCS_CITE,
    template: 'project_plan',
  },
  public_liability_evidence: {
    id: 'public_liability_evidence',
    label: 'Evidence of Public Liability Insurance ($10m minimum)',
    detail: 'Have your certificate of currency ready as supporting evidence.',
    cite: ELIG_CITE,
  },
  rto_quote: {
    id: 'rto_quote',
    label: 'RTO quote for accredited training delivery (if an external RTO delivers training)',
    detail:
      'If accredited training is delivered by an RTO that is not the applicant, include a quote for delivery, assessment and certification. The RTO must have the relevant units on scope in the ACT and ensure training meets ASQA requirements. (ACCO and FNO RTOs are not required to hold a TIFA.)',
    cite: { section: '§5.5', title: 'Training delivery' },
  },
}

// ---------------------------------------------------------------------------
// Evaluation criteria (§6.2) — each worth 25%.
// ---------------------------------------------------------------------------

export const EVALUATION_CRITERIA = [
  {
    id: 'project_design',
    label: 'Project design',
    weight: 25,
    summary:
      'Clear, logical project model that aligns with the Program objective and outcomes; incorporates lived experience; targeted and learner-centric; culturally safe and community-led where relevant.',
  },
  {
    id: 'longer_term_impact',
    label: 'Longer-term impact',
    weight: 25,
    summary:
      'A well-developed approach to tracking outcomes; potential for sustained improvements in completions/employment; ability to test models and inform future approaches.',
  },
  {
    id: 'partnerships_capability',
    label: 'Demonstrated partnerships, capacity and capability',
    weight: 25,
    summary:
      'Organisational capacity, skills/experience of staff, evidence of effective partnerships and stakeholder engagement, and track record if previously funded.',
  },
  {
    id: 'value_for_money',
    label: 'Value for money',
    weight: 25,
    summary:
      'Budget is clear and reasonable; costs proportionate to scale and expected benefits; efficient allocation of resources to core activities.',
  },
] as const

// ---------------------------------------------------------------------------
// Key dates (§5.7, §9.2)
// ---------------------------------------------------------------------------

export const KEY_DATES = [
  { label: 'Applications open', value: PROGRAM.opens, cite: { section: '§9.2', title: 'When to submit your application' } },
  { label: 'Applications close', value: PROGRAM.closes, cite: { section: '§9.2', title: 'When to submit your application' } },
  { label: 'Projects commence by', value: PROGRAM.projectStart, cite: { section: '§4', title: 'Funding Parameters' } },
  { label: 'Projects complete by', value: PROGRAM.projectEnd, cite: { section: '§4', title: 'Funding Parameters' } },
] as const

// ---------------------------------------------------------------------------
// Plain-language glossary / explainer (§ references where the term is used).
// ---------------------------------------------------------------------------

export type GlossaryTerm = {
  term: string
  short: string
  /** Optional longer plain-language explanation. */
  detail?: string
  cite?: Cite
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: 'VET',
    short: 'Vocational Education and Training — nationally recognised training such as qualifications, skill sets, accredited courses, apprenticeships and traineeships.',
    cite: { section: '§1.3', title: 'Introduction' },
  },
  {
    term: 'RTO',
    short: 'Registered Training Organisation — an organisation registered to deliver and assess nationally recognised VET training.',
  },
  {
    term: 'ACCO',
    short: 'Aboriginal Community-Controlled Organisation — defined in Clause 44 of the National Agreement on Closing the Gap. ACCOs are community-owned and led.',
    detail:
      'ACCOs are encouraged and prioritised for this grant. ACCOs and FNO RTOs do not need to hold a TIFA for accredited training to be considered.',
    cite: { section: '§5.1', title: 'Applicant eligibility' },
  },
  {
    term: 'FNO RTO',
    short: 'First Nations Owned Registered Training Organisation.',
    detail: 'Encouraged to apply; not required to hold a TIFA for accredited training.',
    cite: { section: '§5.5', title: 'Training delivery' },
  },
  {
    term: 'GTO',
    short: 'Group Training Organisation — employs apprentices/trainees and places them with host employers.',
  },
  {
    term: 'TIFA',
    short: 'Training Initiative Funding Agreement — an ACT agreement an RTO normally needs to deliver funded accredited training.',
    detail: 'ACCO and FNO RTOs are NOT required to hold a TIFA for accredited training to be considered. This supports growth of the ACCO/FNO RTO sector.',
    cite: { section: '§5.5', title: 'Training delivery' },
  },
  {
    term: 'ASbA',
    short: 'Australian School-based Apprenticeship — an apprenticeship undertaken while still at school.',
    cite: { section: '§5.2', title: 'Participant Eligibility' },
  },
  {
    term: 'ASQA',
    short: 'Australian Skills Quality Authority — the national VET regulator. Accredited training must meet ASQA national registration requirements.',
    cite: { section: '§5.5', title: 'Training delivery' },
  },
  {
    term: 'Acquittal',
    short: 'The final report and reconciliation showing how grant funds were spent, with supporting documentation (invoices, receipts, bank statements).',
    detail: 'Due within one month after the grant end date. No new funding is provided until all grants are acquitted.',
    cite: { section: '§8.2', title: 'Acquittal of funding' },
  },
  {
    term: 'On-costs',
    short: 'The additional costs of employing someone beyond salary (e.g. superannuation, leave loading, workers’ compensation).',
    cite: { section: '§5.6', title: 'What may be considered for funding project costs' },
  },
  {
    term: 'In-kind contribution',
    short: 'A non-cash contribution to the project (e.g. donated time, facilities or equipment). Must be itemised in the application.',
    cite: { section: '§4', title: 'Funding Parameters' },
  },
  {
    term: 'KPI',
    short: 'Key Performance Indicator — a specific, measurable indicator of progress. You need at least three, with how each is measured.',
    cite: { section: '§5.4', title: 'Supporting documents (Project Plan)' },
  },
  {
    term: 'Deed of Grant',
    short: 'The legal agreement a successful applicant signs, setting out terms, conditions, reporting and acquittal requirements.',
    cite: { section: '§7.1', title: 'Grant requirements and payment process' },
  },
  {
    term: 'Cultural load',
    short: 'The extra, often invisible work carried by Aboriginal and Torres Strait Islander people and organisations — consultation, cultural advice, reporting and educating others.',
    detail:
      'The ACT Government recognises a responsibility to reduce cultural load through early planning, shared responsibility, appropriate resourcing and flexible implementation. Mainstream organisations partnering with an ACCO/FNO RTO must acknowledge and help reduce cultural load.',
    cite: { section: '§5.1', title: 'Acknowledgement of cultural load' },
  },
  {
    term: 'Closing the Gap',
    short: 'The National Agreement to overcome inequality experienced by Aboriginal and Torres Strait Islander people. Projects contributing to Closing the Gap are prioritised.',
    cite: { section: '§5.1', title: 'Applicant eligibility' },
  },
  {
    term: 'Evaluation Panel',
    short: 'The panel, chaired by a senior Skills Canberra officer, that assesses eligible applications on relative merit against the criteria.',
    cite: { section: '§6.1', title: 'Overview of assessment process' },
  },
  {
    term: 'Delegate',
    short: 'The Executive Branch Manager, Skills Canberra, who approves funding recommendations and the final funding amount.',
    cite: { section: '§6.1', title: 'Overview of assessment process' },
  },
  {
    term: 'SmartyGrants',
    short: 'The online portal where applications are submitted. You create a login; once submitted an application cannot be changed.',
    cite: { section: '§9.3', title: 'How to submit your application' },
  },
]
