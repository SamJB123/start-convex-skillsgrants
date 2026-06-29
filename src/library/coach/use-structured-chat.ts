// Solid 2 bridge for streaming structured output over @tanstack/ai-client's
// ChatClient. (The official @tanstack/ai-solid useChat is Solid 1 only.)
//
// The server route sets the outputSchema; the client just parses the SSE stream
// into messages and reads the assistant's `structured-output` part — its
// `.partial` fills in as the JSON streams, and `.data` is the validated final.
// Generic over the output type T (e.g. ApplicationDraft or Suggestions).

import { createMemo, createSignal, onCleanup } from 'solid-js'
import { ChatClient, fetchServerSentEvents } from '@tanstack/ai-client'

export type DeepPartial<T> = T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export function useStructuredChat<T>(url: string) {
  const [messages, setMessages] = createSignal<Array<any>>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<Error | undefined>(undefined)

  const client = new ChatClient({
    connection: fetchServerSentEvents(url),
    onMessagesChange: (m: Array<any>) => setMessages(m),
    onLoadingChange: (l: boolean) => setIsLoading(l),
    onErrorChange: (e?: Error) => setError(e),
  })
  // No synchronous seed here: the signal already starts as [] and we pass no
  // initialMessages, so client.getMessages() is []. Writing it during setup
  // would be an owned-scope signal write (forbidden in Solid 2); the
  // onMessagesChange callback (fired outside owned scope) keeps it in sync.

  onCleanup(() => {
    client.stop()
    client.dispose()
  })

  const activeStructuredPart = createMemo(() => {
    const list = messages()
    let lastUserIndex = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.role === 'user') {
        lastUserIndex = i
        break
      }
    }
    for (let i = list.length - 1; i > lastUserIndex; i--) {
      const m = list[i]
      if (m?.role !== 'assistant') continue
      const part = m.parts?.find((p: any) => p.type === 'structured-output')
      if (part) return part
    }
    return null
  })

  const partial = createMemo<DeepPartial<T>>(() => {
    const p = activeStructuredPart()
    return (p ? (p.partial ?? p.data ?? {}) : {}) as DeepPartial<T>
  })

  const final = createMemo<T | null>(() => {
    const p = activeStructuredPart()
    return p && p.status === 'complete' ? ((p.data ?? null) as T | null) : null
  })

  // Kick off generation: `content` is the user message; `body` carries extras
  // (e.g. seedSummary, priorDraft) the server route reads.
  async function send(content: string, body?: Record<string, any>) {
    await client.sendMessage(content, body)
  }

  return { messages, isLoading, error, partial, final, send }
}
