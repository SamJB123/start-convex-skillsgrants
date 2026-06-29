# Research & Design Foundations
### An AI-assisted grant-application tool for the ACT VET Completions Grants 2026, built with and for First Nations and other disadvantaged communities

> Status: research synthesis (v1, 2026-06-29). This is the evidence base and spec-driven
> requirements set that should govern design decisions. It is not yet an implementation plan.
> Source-quality caveats from the research are preserved at the end of each section.

---

## 0. Context

**The grant.** ACT VET Completions Grants 2026 (Skills Canberra / CMTEDD). Up to $250k (GST excl.)
for organisations (RTOs, ACCOs, FNO RTOs, employers, community orgs, GTOs, industry associations)
to run projects from Aug 2026 – Dec 2027 that help **priority-group learners** complete accredited
VET training and move into sustainable employment. Priority groups: **Aboriginal and Torres Strait
Islander people**, women, people with disability, young people, long-term unemployed, CALD
communities, mature-age people.

Salient features of the guidelines that shape our design:
- Explicit acknowledgement of **cultural load** and a stated government responsibility to mitigate it.
- **Self-determination** and **community-led / ACCO-driven** approaches are named as valid and encouraged.
- Alignment to **Closing the Gap** and the **ACT Aboriginal and Torres Strait Islander Agreement 2019–2028**.
- Proportionate, low-burden documentation for smaller orgs / ACCOs.
- Four equally weighted (25% each) evaluation criteria: **Project design / Longer-term impact /
  Partnerships & capability / Value for money.**
- Submission is via **SmartyGrants** (`CMTEDD.smartygrants.com.au`). Material is held "in confidence"
  but the **FOI Act 2016 (ACT)** applies. Information must be **"true and correct."**

**The codebase.** TanStack **SolidStart** (Solid 2.0 beta) frontend → Cloudflare Worker; **Convex**
backend; **Better Auth** (`@convex-dev/better-auth`). Currently template scaffolding only (a demo
`numbers` table). Note: production `build` is currently stubbed pending Solid 2.0 support.

---

## 1. The single most important constraint: data residency & sovereignty

**Finding:** Convex **Cloud** offers only two regions — US East and EU West. **There is no
Australia / Asia-Pacific region, and a deployment's region cannot be changed after creation.**
(Source: https://docs.convex.dev/production/regions)

This collides directly with **Indigenous Data Sovereignty** and Australian government data-residency
expectations. Indigenous data is defined broadly (Maiam nayri Wingara) as "information or knowledge…
which is about and may affect Indigenous peoples both collectively and individually" — grant-application
data is squarely within scope.

**Implication / path:**
- **Convex Cloud cannot keep this data on Australian soil today.** It is acceptable for a prototype
  using *synthetic / non-sensitive* data only.
- For production handling of real community data, **self-host Convex** (open-source Docker backend +
  Postgres + S3-compatible storage) on **Australian infrastructure** (AWS Sydney `ap-southeast-2`, or
  an IRAP-assessed sovereign provider such as NextDC / Macquarie / Vault).
  (Sources: https://news.convex.dev/self-hosting/ , https://stack.convex.dev/self-hosted-develop-and-deploy)
- The **LLM API call is a second egress point.** Even with AU-hosted Convex, content sent to an LLM
  leaves the country unless you use an in-region endpoint (e.g. **Claude via AWS Bedrock Sydney**).
- **Cross-check with Convex before launch** — more regions are promised but not yet shipped.

---

## 2. Governance & ethical framework (the backbone)

Adopt as the **stated governance framework**: **Maiam nayri Wingara Indigenous Data Sovereignty
Principles + the CARE Principles**, operationalised against the **NIAA Framework for the Governance
of Indigenous Data (GID, 2024)**, with **FAIR** applied for technical data quality ("Be FAIR and CARE").
Treat Canada's OCAP as comparative prior art only (take its "Possession"/residency lesson seriously);
do not claim it as our framework.

| Framework | Publisher | What it gives us |
|---|---|---|
| **CARE Principles** — Collective benefit, Authority to control, Responsibility, Ethics | Global Indigenous Data Alliance (https://www.gida-global.org/careprinciples) | The international baseline; pairs with FAIR. |
| **Maiam nayri Wingara IDS Principles** (5 rights: Control, Contextual/disaggregated, Relevant, Accountable, Protective) | Maiam nayri Wingara Collective / AIGI (https://www.maiamnayriwingara.org/mnw-principles) | Australia's canonical IDS authority. |
| **AIATSIS Code of Ethics (2020)** — self-determination, leadership, impact & value, sustainability & accountability | AIATSIS (https://aiatsis.gov.au/research/ethical-research/code-ethics) | FPIC (ongoing, revocable); ICIP control. |
| **NHMRC ethical conduct guidelines (2018)** — 6 values | NHMRC | Consent as reciprocity, not tick-box; ICIP protection. |
| **NIAA GID Framework (2024)** — Partner / build capability / knowledge of data assets / inclusive system | National Indigenous Australians Agency (https://www.niaa.gov.au/our-work/data-evaluation-and-research/framework-governance-indigenous-data-gid) | The official *government* operationalisation; directly applicable since this is government-held Indigenous data. |
| **Closing the Gap — Priority Reform Four** (shared access to data at a regional level) | Joint Council on CtG (https://www.closingthegap.gov.au/national-agreement/national-agreement-closing-the-gap/6-priority-reform-areas/four) | "Build capability, not dependency." |
| **ACT Aboriginal & Torres Strait Islander Agreement 2019–2028** — self-determination | ACT Gov + ATSIEB (https://www.act.gov.au/open/act-aboriginal-and-torres-strait-islander-agreement) | Local mandate; co-design, not impose. |
| **ATSIEB** (elected representative body, ACT) | https://atsieb.com.au/ | **The natural governance / endorsement body for this app in the ACT.** |
| **ICIP / "True Tracks"** — 10 principles (Respect, Self-determination, Consent & consultation, Interpretation, Integrity, Secrecy & privacy, Attribution, Benefit-sharing, Maintaining cultures, Recognition & protection) | Terri Janke and Company (https://www.terrijanke.com.au/true-tracks) | Community knowledge never becomes app/vendor IP; secret/sacred material must never be stored or sent to a model. |
| **Indigenous Protocol & AI position paper** | IP·AI Working Group (https://www.indigenous-ai.net/position-paper/) | "No single Indigenous perspective" — build with communities; avoid homogenisation. |
| **Cultural load** | Diversity Council Australia (https://www.dca.org.au/) | Design to *reduce*, never add, cultural load; pay community reviewers. |

### Governance design requirements
- **Co-design and seek endorsement** (ATSIEB and/or an ACT ACCO) before launch and on an ongoing basis;
  the app is governed *with* community, not deployed *at* it. Run a **Lowitja-style IDS readiness assessment**.
- **Community/users own their data; the app is a steward, not an owner.** Publish a plain-language
  **data governance charter** (who owns / controls / can access, and how the community can change it).
- **Capability-building, not dependency** — the tool should leave users more able to apply over time.
- **Reduce cultural load:** never make users explain/justify identity repeatedly; pre-fill prior context;
  use **paid community reviewers** for cultural validation rather than offloading unpaid correction onto users.
- **Strengths-based, non-deficit framing** in all copy, prompts, and analytics.

### AI-with-Indigenous-data safeguards
- Use LLM vendors with contractual **no-training / zero-(or short, controlled)-retention** terms.
- **Never send secret/sacred or restricted cultural material to any external model.** Provide a way to
  flag and **quarantine** such content so it is never logged, embedded, or transmitted.
- Keep an **Indigenous-controlled data layer separate from the LLM**; the model sees only minimal, scrubbed input.
- **Never auto-generate cultural content** (Acknowledgements of Country, language, cultural statements).
- Assess **collective (community-level) re-identification risk**, not just individual — de-identification
  is not a silver bullet for small ACT populations.

---

## 3. Compliance & responsible-AI spec

**Posture:** treat this as **elevated/high-risk AI** (it shapes access to public funds and processes
sensitive personal information). Assume we are bound by the **Commonwealth Privacy Act / APPs** (sensitive
& health info; services to/for a government agency defeat the $3M small-business exemption) **and/or the
ACT Territory Privacy Principles** (binding on a contracted service provider to CMTEDD).

| Area | Key obligations / sources |
|---|---|
| **Privacy (APPs / TPPs)** | Free, clear privacy policy (APP1); point-of-collection notice (APP5); collect only what's necessary (APP3); primary-purpose use only, no training on applicant data without specific consent (APP6); access/correction (APP12/13); accuracy + human review (APP10). OAIC: **do not enter personal/sensitive info into publicly available GenAI tools.** (https://www.oaic.gov.au/privacy/australian-privacy-principles) |
| **Sensitive info** | Aboriginal/Torres Strait Islander status, health, disadvantage indicators = **sensitive information**; need **express, unbundled, affirmative consent** (no pre-ticked boxes). |
| **Responsible AI** | Australia's 8 AI Ethics Principles (DISR); National AI Assurance Framework; DTA Policy for responsible AI in government; NSW AI Assessment Framework (use as risk-triage template); Voluntary AI Safety Standard **10 guardrails** — esp. human oversight (G5), inform users of AI use (G6), contestability (G7), record-keeping (G9). |
| **GenAI in grant apps** | NHMRC/ARC model: applicant **remains responsible** for content; **confidentiality** — anything entered into a GenAI tool "could be made public." No mandatory AI-use declaration yet, but disclosure is an emerging norm. Acute risks: **fabrication/hallucination, misrepresentation, homogenised voice, confidentiality leakage.** |
| **SmartyGrants** | **No public applicant API; submitted applications are immutable; 20-min session timeouts; 25MB uploads.** Their own AI tool ("Drafter") uses **only applicant-supplied content** with **data held in Australia** — a model to mirror. |
| **Security** | ASD **ISM** as control catalogue; **Essential Eight ~ Maturity Level 2** (MFA, patching, backups, least privilege); TLS + encryption at rest; audit logging; **Australian hosting** (Hosting Certification Framework); NDB breach plan (assess within ~30 days; notify OAIC + individuals). |
| **FOI & records** | FOI Act 2016 (ACT) "push model" — application material can be accessible unless contrary to public interest; consult affected third parties before release. Territory Records Act 2002 — retention/disposal program. **Minimise what we store.** |
| **Accessibility law** | Disability Discrimination Act 1992 — inaccessible services can be unlawful; **WCAG AA** is the benchmark (see §4). |

### Integration approach (decided by the evidence)
Operate as a **standalone preparation / drafting tool**. The user composes and refines in our app, then
**copies the final, human-reviewed text into the official SmartyGrants form themselves.** Do **not**
auto-submit, scrape, or attempt API integration (none exists publicly; submissions are immutable).

---

## 4. Accessibility, plain language & AI-coaching UX

| Area | Standard / source | Requirement |
|---|---|---|
| **Accessibility** | WCAG **2.2 Level AA** (https://www.w3.org/TR/WCAG22/); AU Digital Inclusion Standard Criterion 4; DDA 1992 | Conform AA across forms, AI chat, drafts & exports. New 2.2 criteria that matter: 24×24px targets, no drag-only interactions, visible/un-obscured focus, **consistent help**, **redundant entry** (never re-ask), **accessible authentication** (magic links, no cognitive-puzzle CAPTCHAs). AI chat: ARIA live regions for streamed text, reachable Stop control, keyboard operable. |
| **Plain language** | Australian Government Style Manual | Short sentences, one idea each, active voice, defined terms. Target **~Grade 5–8 reading level**. Applies to *both* UI copy and AI-drafted text. |
| **Easy Read mode** | Style Manual / PWDA / Inclusion Australia | One idea per line + supporting image, ≥14pt sans-serif, high contrast, ≥1.5 spacing. **User-test with people with intellectual disability.** |
| **Inclusive form UX** | GOV.UK Service Manual / MOJ | Write a **question protocol** (justify every field, cut the rest); **one thing per page**; progress indicator; **auto-save + save-and-resume**; error-summary pattern with plain-language fixes; never placeholder-only labels. |
| **Trauma-informed & culturally safe** | SAMHSA principles via Content Design London; ANZSOG co-design | User-paced, predictable, no forced disclosure, calm non-judgemental copy, genuine choice/control; **co-design with communities**, not one-off consultation. |
| **Multilingual / oral-first** | CALD Assist; IVR research; Style Manual | **Read-aloud (TTS)** for every question/hint/draft; **voice input (STT)**; up-front language choice + machine translation paired with pictorial cues; path to **professional interpreter** for high-stakes content. |

### AI coaching guardrails (the ethical heart of the writing assistant)
- **Coach, don't ghost-write.** The AI asks guided questions, suggests structure, gives examples, and
  polishes the user's *own words*. It must **not** invent achievements, dates, numbers, or quotes.
  (Frameworks: Microsoft HAX guidelines; Google PAIR; CoachGPT scaffolding research.)
- **Anti-fabrication:** ground all factual content in the applicant's own inputs (RAG over their answers).
  Any sentence containing a fact is **flagged for explicit user confirmation** before it enters the application.
- **Human in control:** every suggestion editable / acceptable / rejectable; undo, regenerate, and a global
  "write it myself / AI off" control. Set an accurate mental model: *"I'm a helper that can make mistakes — you are the author."*
- **Transparency:** display an AI transparency statement; label AI-assisted text; support disclosure if the funder asks.
- **Bias checks:** don't penalise non-standard English or cultural framings; never smooth away authentic voice.
- **Criteria-aware feedback:** because the four criteria are equally weighted and explicit, the coach can map
  the user's answers to each criterion and show *coverage* (what's strong, what's thin) — without writing claims for them.

---

## 5. Recommended Convex architecture

Install (in `convex/convex.config.ts`):

| Component | npm | Role here |
|---|---|---|
| **Agent** | `@convex-dev/agent` | The AI coach: a thread per application, persistent messages, tool calling, memory. Use its **async delta streaming** (`saveStreamDeltas: true`) — persists to DB and streams to all clients via reactive queries (no separate streaming infra). |
| **RAG** | `@convex-dev/rag` | Ground the coach in the **grant guidelines + evaluation criteria** and per-org uploaded docs; namespace per funding round / per org. |
| **Workflow** (+ **Workpool**) | `@convex-dev/workflow`, `@convex-dev/workpool` | Durable multi-step generation: outline → draft per criterion → self-critique against rubric → refine → assemble. Resumable, cancelable. |
| **Action Retrier** | `@convex-dev/action-retrier` | Reliable LLM API calls (retry + backoff). |
| **Rate Limiter** | `@convex-dev/rate-limiter` | Cap AI usage/cost per user & per org (token-bucket), transactionally. |
| **Better Auth + Organization plugin** | `@convex-dev/better-auth` | **Orgs = applicants**; members with owner/admin/member roles; invitations. Authorize all data by `organizationId`. |
| **Migrations** | `@convex-dev/migrations` | Evolve the application schema across funding rounds without downtime. |
| Optional | `@convex-dev/aggregate` (dashboards), `@convex-dev/crons` (deadline reminders), `@convex-dev/prosemirror-sync` + `@convex-dev/presence` (collaborative section editing), `@convex-dev/r2` (files in Cloudflare R2, region-controllable), `@convex-dev/action-cache` (cache embeddings) | |

- **LLM layer:** call Claude via `@ai-sdk/anthropic` from Convex **actions**, driven by the Agent.
  Keep API keys in Convex env vars. For sensitive content, route via an **AU-region endpoint (Bedrock Sydney)**.
- **Files:** built-in Convex file storage (`generateUploadUrl` 3-step) or R2 for letters of support, quotes,
  budget templates. Parse PDFs client-side (PDF.js) before RAG ingest.
- **Drafts/forms:** model each application as a draft document; debounced mutations autosave; reactive
  queries power the multi-step wizard, resume-in-place, and live multi-user sync.
- **Deploy:** SolidStart on a Cloudflare Worker (`@cloudflare/vite-plugin` + Wrangler) → separate Convex
  deployment over websockets. (Resolve the stubbed production `build` / Solid 2.0 status early.)

---

## 6. Open decisions for the team
1. **Hosting & sovereignty stance** — self-host Convex on AU infra for production (recommended), vs. Convex
   Cloud (prototype/synthetic data only). Plus AU-region LLM endpoint for sensitive content.
2. **Community governance** — engage ATSIEB / an ACT ACCO for co-design and endorsement; budget for **paid**
   community reviewers.
3. **MVP scope** — which slice first (e.g. guided drafting for the four criteria with anti-fabrication +
   accessibility, single org), and whether to start with a synthetic-data prototype on Convex Cloud while
   the AU self-hosting path is stood up.

---

## 7. Source caveats to verify before quoting as load-bearing
- ACT Agreement PDF is a scanned image — verify exact clause wording directly.
- Verbatim **True Tracks 10-principle** names and **CARE sub-point lettering** — confirm against the book / GIDA one-pager.
- NHMRC/AIATSIS are *research-ethics* instruments — applied here by analogy (their consent/benefit/ICIP model is the recognised national standard).
- **OAIC small-business ($3M) exemption** still in force mid-2026 (under reform, not repealed).
- **SmartyGrants ISO 27001 / IRAP / AU hosting** reported but unverified — confirm on their Security & Assurance page if precise claims are needed.
- ARC/NHMRC GenAI policies are dated **effective 28 Apr 2026** (forward-looking but authoritative).
- Confirm current **Convex region availability** with Convex directly before launch.
