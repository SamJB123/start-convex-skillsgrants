// Build a short plain-language summary of what we already learned in the
// eligibility check (Milestone 1), to seed the interview so the coach doesn't
// re-ask and can tailor the conversation.

import type { Answers } from '~/library/grant/assess'
import { ORG_TYPES, PROGRAM } from '~/library/grant/data'

export function buildSeedSummary(a: Answers): string | undefined {
  const lines: string[] = []

  const orgType = a.orgType ? ORG_TYPES.find((o) => o.id === a.orgType) : undefined
  if (orgType) lines.push(`Organisation type: ${orgType.label}.`)
  if (a.isAccoOrFno) lines.push(`They are an ACCO or First Nations owned RTO (encouraged and prioritised).`)

  if (a.hasPartnerships === 'yes') lines.push(`They have identified project partnerships.`)
  else if (a.hasPartnerships === 'no') lines.push(`They do not yet have partnerships (these are required).`)

  if (typeof a.fundingSought === 'number' && a.fundingSought > 0) {
    lines.push(
      `Funding they're considering: about $${a.fundingSought.toLocaleString()} (max $${PROGRAM.maxFunding.toLocaleString()}).`,
    )
  }
  if (a.supportsParticipants === 'yes') lines.push(`The project supports individual learners/participants.`)
  if (a.externalRtoTraining === 'yes') lines.push(`Accredited training will be delivered by an external RTO.`)
  if (a.engagesVolunteers === 'yes') lines.push(`The project will engage volunteers.`)

  return lines.length ? lines.join('\n') : undefined
}
