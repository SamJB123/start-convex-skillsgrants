import { createFileRoute } from '@tanstack/solid-router'
import { realtimeToken } from '@tanstack/ai'

// Mints a short-lived ephemeral realtime token on the Worker, so the real
// provider API key never reaches the browser. The browser uses the returned
// token to open the WebRTC/WS voice session directly with the provider.
//
// Provider is selectable (?provider=openai|elevenlabs):
//   - openai     → reads OPENAI_API_KEY        (model bound into the token)
//   - elevenlabs → reads ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID
// Lazy-load the provider adapters (each pulls a heavy CommonJS SDK) only when
// minting, keeping them out of the eager worker graph that the route tree
// evaluates on every request.
async function mintToken(provider: string) {
  if (provider === 'elevenlabs') {
    const { elevenlabsRealtimeToken } = await import('@tanstack/ai-elevenlabs')
    return realtimeToken({ adapter: elevenlabsRealtimeToken() })
  }
  const { openaiRealtimeToken } = await import('@tanstack/ai-openai')
  return realtimeToken({ adapter: openaiRealtimeToken({ model: 'gpt-realtime' }) })
}

export const Route = createFileRoute('/api/realtime-token')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const provider = new URL(request.url).searchParams.get('provider') ?? 'openai'
        try {
          const token = await mintToken(provider)
          return new Response(JSON.stringify(token), {
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        }
      },
    },
  },
})
