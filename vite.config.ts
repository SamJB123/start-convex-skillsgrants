import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// Run BOTH dev and build in the Cloudflare Workers runtime (workerd) via
// @cloudflare/vite-plugin, so local dev matches production and Workers-only
// features are available locally: `cloudflare:` runtime imports, bindings
// (e.g. Worker Loaders for Code Mode), and `env.*`. Local secrets/vars come
// from `.dev.vars` and the `vars` block in wrangler.jsonc.
export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Solid 2 dropped the `solid-js/web` subpath in favor of the standalone
      // `@solidjs/web` package; map the old path forward in case any dep still
      // imports it.
      'solid-js/web': '@solidjs/web',
    },
  },
  plugins: [
    // viteEnvironment 'ssr' = where TanStack Start does request handling, so the
    // server entry (src/worker.ts) runs in workerd in dev and prod alike.
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    // Must come AFTER tanstackStart() so the route files it generates compile.
    viteSolid({ ssr: true }),
  ],
})
