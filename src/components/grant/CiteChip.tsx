import type { Cite } from '~/library/grant/data'

// A small badge showing exactly where a statement comes from in the official
// guidelines. Grounding + citation is a core principle of this tool.
export default function CiteChip(props: { cite: Cite }) {
  return (
    <span
      class="inline-flex items-center gap-1 rounded bg-[var(--gov-blue-50)] px-1.5 py-0.5 text-xs font-medium text-[var(--gov-navy)]"
      title={`Program Guidelines ${props.cite.section} — ${props.cite.title}`}
    >
      <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="sr-only">Source: Program Guidelines </span>
      {props.cite.section} · {props.cite.title}
    </span>
  )
}
