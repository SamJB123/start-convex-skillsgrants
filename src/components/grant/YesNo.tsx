import { For, Show } from 'solid-js'
import type { Cite } from '~/library/grant/data'
import type { YN } from '~/library/grant/assess'
import CiteChip from './CiteChip'
import SpeakButton from './SpeakButton'

const OPTIONS: { v: YN; label: string }[] = [
  { v: 'yes', label: 'Yes' },
  { v: 'no', label: 'No' },
  { v: 'unsure', label: 'Not sure' },
]

// Accessible Yes / No / Not-sure question. Uses native radios (keyboard- and
// screen-reader-friendly) with a visible custom appearance.
export default function YesNo(props: {
  name: string
  legend: string
  help?: string
  cite?: Cite
  value?: YN
  onChange: (v: YN) => void
}) {
  const speakText = () => `${props.legend}. ${props.help ?? ''}`
  return (
    <fieldset class="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
      <legend class="flex items-start gap-2 px-1 text-base font-semibold text-[var(--gov-navy)]">
        <span>{props.legend}</span>
        <SpeakButton text={speakText()} id={`q-${props.name}`} />
      </legend>
      <Show when={props.help}>
        {(h) => <p class="mt-1 text-sm text-[var(--gov-muted)]">{h()}</p>}
      </Show>
      <Show when={props.cite}>
        {(c) => (
          <p class="mt-2">
            <CiteChip cite={c()} />
          </p>
        )}
      </Show>
      <div class="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={props.legend}>
        <For each={OPTIONS}>
          {(o) => (
            <label
              class={[
                'cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors',
                {
                  'border-[var(--gov-blue)] bg-[var(--gov-blue-50)] font-semibold text-[var(--gov-navy)]':
                    props.value === o.v,
                  'border-gray-300 text-gray-700 hover:border-gray-400':
                    props.value !== o.v,
                },
              ]}
            >
              <input
                type="radio"
                name={props.name}
                value={o.v}
                checked={props.value === o.v}
                onChange={() => props.onChange(o.v)}
                class="sr-only"
              />
              {o.label}
            </label>
          )}
        </For>
      </div>
    </fieldset>
  )
}
