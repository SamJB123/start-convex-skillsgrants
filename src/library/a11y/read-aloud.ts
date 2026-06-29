// App-wide read-aloud singleton. Module-scope signals act as a global in
// Solid 2, so every SpeakButton shares one playback state and only one block
// is read at a time. All writes happen inside user-event handlers.

import { createSignal } from 'solid-js'
import { ttsSupported } from './speech'

const [speaking, setSpeaking] = createSignal(false)
const [speakingId, setSpeakingId] = createSignal<string | null>(null)

export const ttsSpeaking = speaking
export const ttsSpeakingId = speakingId
export { ttsSupported }

export function readAloudStop() {
  if (!ttsSupported()) return
  window.speechSynthesis.cancel()
  setSpeaking(false)
  setSpeakingId(null)
}

/** Speak `text`; pass a stable `id` so the UI can show which block is playing.
 *  Calling again with the same id toggles playback off. */
export function readAloudSpeak(text: string, id: string | null = null) {
  if (!ttsSupported() || !text.trim()) return
  if (speaking() && speakingId() === id) {
    readAloudStop()
    return
  }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'en-AU'
  utter.rate = 0.95
  utter.onend = () => {
    setSpeaking(false)
    setSpeakingId(null)
  }
  utter.onerror = () => {
    setSpeaking(false)
    setSpeakingId(null)
  }
  setSpeaking(true)
  setSpeakingId(id)
  window.speechSynthesis.speak(utter)
}
