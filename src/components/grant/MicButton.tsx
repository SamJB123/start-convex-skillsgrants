import { Show, createSignal, onSettled } from 'solid-js'
import { createDictation, sttSupported } from '~/library/a11y/speech'

// Voice-input (dictation) button. Calls `onTranscript` with recognised text.
// Hidden until mounted on a browser that supports speech recognition.
export default function MicButton(props: {
  onTranscript: (text: string) => void
  label?: string
  class?: string
}) {
  const [mounted, setMounted] = createSignal(false)
  onSettled(() => {
    setMounted(true)
  })

  const dictation = createDictation((t) => props.onTranscript(t))

  return (
    <Show when={mounted() && sttSupported()}>
      <button
        type="button"
        onClick={() => dictation.start()}
        aria-pressed={dictation.listening() ? 'true' : 'false'}
        title={dictation.listening() ? 'Stop listening' : 'Speak instead of typing'}
        class={[
          'no-print inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium',
          {
            'bg-[var(--gov-stop-bg)] text-[var(--gov-stop)]': dictation.listening(),
            'text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]': !dictation.listening(),
          },
          props.class,
        ]}
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
          <path d="M5.5 9.5a.5.5 0 011 0 3.5 3.5 0 007 0 .5.5 0 011 0 4.5 4.5 0 01-4 4.473V16h2a.5.5 0 010 1h-5a.5.5 0 010-1h2v-2.027a4.5 4.5 0 01-4-4.473z" />
        </svg>
        <span class="sr-only">
          {dictation.listening() ? 'Stop listening' : (props.label ?? 'Speak instead of typing')}
        </span>
      </button>
      <Show when={dictation.error()}>
        {(e) => (
          <span role="alert" class="text-xs text-[var(--gov-stop)]">
            {e()}
          </span>
        )}
      </Show>
    </Show>
  )
}
