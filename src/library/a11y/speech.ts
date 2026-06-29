// Browser-native read-aloud (text-to-speech) and voice input (speech-to-text).
//
// We deliberately use the Web Speech API rather than a cloud service: it keeps
// audio and transcripts on-device (no data egress), which suits a tool used by
// First Nations and other vulnerable users and aligns with data-minimisation.
// Both features degrade gracefully where the browser lacks support.
//
// Solid 2 notes: these are plain functions returning signals + actions. All
// signal writes happen inside event-driven callbacks (speech events, user
// actions), never during owned/setup scope.

import { createSignal, onSettled } from 'solid-js'
import { isServer } from '@solidjs/web'

// --- Read-aloud (TTS) ------------------------------------------------------
// A single app-wide controller (module-scope signals are globals in Solid 2)
// so only one block is ever read at a time. See `read-aloud.ts` for the
// singleton built on top of these helpers.

export function ttsSupported(): boolean {
  return !isServer && typeof window !== 'undefined' && 'speechSynthesis' in window
}

// --- Voice input (STT) -----------------------------------------------------

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (isServer || typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function sttSupported(): boolean {
  return getRecognitionCtor() !== null
}

/**
 * Dictation helper. `onTranscript` is called with the final recognised text
 * (the caller appends it to whatever field the user is editing).
 */
export function createDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  let recognition: SpeechRecognitionLike | null = null

  function start() {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('Voice input is not supported in this browser.')
      return
    }
    if (listening()) {
      stop()
      return
    }
    setError(null)
    recognition = new Ctor()
    recognition.lang = 'en-AU'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event: any) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript
      }
      if (text.trim()) onTranscript(text.trim())
    }
    recognition.onerror = (event: any) => {
      setError(event?.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not hear you — please try again.')
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  function stop() {
    if (recognition) recognition.stop()
    setListening(false)
  }

  onSettled(() => {
    return () => {
      if (recognition) recognition.abort()
    }
  })

  return { start, stop, listening, error }
}
