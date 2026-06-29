import { createFileRoute } from '@tanstack/solid-router'
import { handler } from '~/library/auth-server'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
})
