import { For, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Link } from '@tanstack/solid-router'
import { useSession } from '~/library/use-session'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/check', label: 'Eligibility check' },
  { to: '/coach', label: 'Draft with the coach' },
  { to: '/glossary', label: 'Guide & glossary' },
]

// Shared page shell with ACT-Government-aligned styling. Includes a skip link,
// an unmissable "independent tool" disclaimer (we use a government look but are
// NOT an official service), and accessible navigation/footer.
export default function GrantShell(props: { children: JSX.Element }) {
  // Auth state for the nav comes from the live, client-reactive session (the
  // same `useSession` the dashboard uses). It seeds `null` on the server AND on
  // the first client paint, so SSR and hydration render identically (no
  // mismatch); then it subscribes post-hydration and flips the instant
  // sign-in/sign-out resolves — no navigation, invalidation, or reload needed.
  // (The route-context `token` is server-resolved and only changes when the
  // root beforeLoad re-runs, so it can't reflect a client-side sign-in.)
  const session = useSession()
  const isAuthed = () => Boolean(session().data?.user)

  return (
    <div class="min-h-screen bg-[var(--gov-bg)]">
      <a href="#main" class="skip-link">
        Skip to main content
      </a>

      {/* Gold top stripe */}
      <div class="h-1.5 w-full bg-[var(--gov-gold-bright)]" aria-hidden="true" />

      <header class="bg-[var(--gov-navy)] text-white">
        <div class="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" class="group flex items-center gap-3">
            <span
              class="grid h-10 w-10 place-items-center rounded-md bg-white font-extrabold text-[var(--gov-navy)]"
              aria-hidden="true"
            >
              ACT
            </span>
            <span class="leading-tight">
              <span class="block text-base font-bold">VET Completions Grants 2026</span>
              <span class="block text-sm text-blue-100">Application Helper</span>
            </span>
          </Link>
          <nav aria-label="Main" class="flex flex-wrap items-center gap-1 text-sm">
            <For each={NAV}>
              {(item) => (
                <Link
                  to={item.to}
                  class="rounded-md px-3 py-2 font-medium text-blue-50 hover:bg-[var(--gov-navy-700)]"
                  activeProps={{ class: 'bg-[var(--gov-navy-700)] text-white' }}
                  activeOptions={{ exact: item.to === '/' }}
                >
                  {item.label}
                </Link>
              )}
            </For>
            <Show
              when={isAuthed()}
              fallback={
                <Link
                  to="/signin"
                  class="rounded-md border border-blue-200 px-3 py-2 font-medium text-white hover:bg-[var(--gov-navy-700)]"
                >
                  Sign in
                </Link>
              }
            >
              <Link
                to="/dashboard"
                class="rounded-md border border-blue-200 px-3 py-2 font-medium text-white hover:bg-[var(--gov-navy-700)]"
              >
                My account
              </Link>
            </Show>
          </nav>
        </div>
      </header>

      {/* Independent-tool disclaimer — always visible. */}
      <div class="border-b border-amber-300 bg-[var(--gov-warn-bg)] text-[var(--gov-warn)]">
        <p class="mx-auto max-w-5xl px-4 py-2 text-xs sm:text-sm">
          <strong>Independent demonstration tool.</strong> This helper is not an
          official ACT Government service and is not affiliated with or endorsed
          by Skills Canberra. Always check the official{' '}
          <a
            href="https://www.act.gov.au/grants"
            class="underline"
            target="_blank"
            rel="noreferrer"
          >
            Program Guidelines
          </a>{' '}
          and apply via SmartyGrants. It does not provide legal or financial advice.
        </p>
      </div>

      <main id="main" class="mx-auto max-w-5xl px-4 py-8">
        {props.children}
      </main>

      <footer class="mt-12 border-t border-gray-200 bg-white">
        <div class="mx-auto max-w-5xl px-4 py-8 text-sm text-[var(--gov-muted)]">
          <p class="font-semibold text-[var(--gov-navy)]">Need help?</p>
          <p class="mt-1">
            Skills Canberra, Grants and Projects: 6205 4006 ·{' '}
            <a class="underline" href="mailto:skills.projects@act.gov.au">
              skills.projects@act.gov.au
            </a>
          </p>
          <p class="mt-1">
            Translating &amp; Interpreting Service: 131 450 · National Relay
            Service: 131 677
          </p>
          <p class="mt-4 text-xs">
            Built to respect Aboriginal and Torres Strait Islander data
            sovereignty and self-determination. We acknowledge the Ngunnawal
            people as the Traditional Custodians of the Canberra region.
          </p>
        </div>
      </footer>
    </div>
  )
}
