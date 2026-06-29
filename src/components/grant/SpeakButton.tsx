import { Show, createSignal, onSettled } from 'solid-js'
import {
  readAloudSpeak,
  ttsSpeaking,
  ttsSpeakingId,
  ttsSupported,
} from '~/library/a11y/read-aloud'

// A small "read this aloud" button. Hidden until mounted on a browser that
// supports speech synthesis (avoids rendering a dead control during SSR).
export default function SpeakButton(props: {
  text: string
  id?: string
  label?: string
  class?: string
}) {
  const [mounted, setMounted] = createSignal(false)
  onSettled(() => {
    setMounted(true)
  })

  const key = () => props.id ?? props.text
  const isThis = () => ttsSpeaking() && ttsSpeakingId() === key()

  return (
    <Show when={mounted() && ttsSupported()}>
      <button
        type="button"
        onClick={() => readAloudSpeak(props.text, key())}
        aria-pressed={isThis() ? 'true' : 'false'}
        title={isThis() ? 'Stop reading' : 'Read this aloud'}
        class={[
          'no-print inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-[var(--gov-blue)] hover:bg-[var(--gov-blue-50)]',
          props.class,
        ]}
      >
        <Show
          when={isThis()}
          fallback={
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 5.343a1 1 0 011.414 0 7 7 0 010 9.9 1 1 0 11-1.414-1.414 5 5 0 000-7.072 1 1 0 010-1.414z" />
              <path d="M12.293 7.757a1 1 0 011.414 0 3 3 0 010 4.243 1 1 0 01-1.414-1.414 1 1 0 000-1.415 1 1 0 010-1.414z" />
            </svg>
          }
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="10" height="10" rx="1.5" />
          </svg>
        </Show>
        <span class="sr-only">
          {isThis() ? 'Stop reading aloud' : (props.label ?? 'Read aloud')}
        </span>
      </button>
    </Show>
  )
}
