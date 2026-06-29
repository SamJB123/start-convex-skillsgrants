/**
 * Cloudflare Worker entry (production).
 *
 * Everything is handed to TanStack Start's Solid server-entry handler, which
 * owns SSR, routing, and server-function execution (the same handler the Node
 * dev server uses, so behaviour is identical). The `@cloudflare/vite-plugin`
 * wraps this file as the deployed Worker and serves the client build as static
 * assets alongside it — see vite.config.ts and wrangler.jsonc.
 */
import handler from '@tanstack/solid-start/server-entry'

export default {
  fetch(request: Request): Response | Promise<Response> {
    return handler.fetch(request, { context: {} })
  },
}
