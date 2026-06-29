import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [tailwindcss(), tanstackStart(), viteSolid({ ssr: true })],
})
