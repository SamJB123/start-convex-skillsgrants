import { For, Show, createSignal } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Link } from '@tanstack/solid-router'
import { useSession } from '~/library/use-session'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/check', label: 'Eligibility check' },
  { to: '/coach', label: 'Draft with the coach' },
  { to: '/glossary', label: 'Guide & glossary' },
]

// The nav links + auth link, shared by the desktop bar and the mobile panel so
// they never drift. `isAuthed` is passed as an accessor to stay reactive;
// `onNavigate` lets the mobile panel close itself on selection.
function NavItems(props: {
  isAuthed: () => boolean
  itemClass: string
  authClass: string
  onNavigate?: () => void
}) {
  return (
    <>
      <For each={NAV}>
        {(item) => (
          <Link
            to={item.to}
            class={props.itemClass}
            activeProps={{ class: 'bg-[var(--gov-navy-700)] text-white' }}
            activeOptions={{ exact: item.to === '/' }}
            onClick={props.onNavigate}
          >
            {item.label}
          </Link>
        )}
      </For>
      <Show
        when={props.isAuthed()}
        fallback={
          <Link to="/signin" class={props.authClass} onClick={props.onNavigate}>
            Sign in
          </Link>
        }
      >
        <Link to="/dashboard" class={props.authClass} onClick={props.onNavigate}>
          My account
        </Link>
      </Show>
    </>
  )
}

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
  const [menuOpen, setMenuOpen] = createSignal(false)

  const DESKTOP_ITEM =
    'rounded-md px-3 py-2 font-medium text-blue-50 hover:bg-[var(--gov-navy-700)]'
  const DESKTOP_AUTH =
    'rounded-md border border-blue-200 px-3 py-2 font-medium text-white hover:bg-[var(--gov-navy-700)]'
  // Mobile rows: full-width tap targets, a touch taller.
  const MOBILE_ITEM =
    'block rounded-md px-3 py-2.5 font-medium text-blue-50 hover:bg-[var(--gov-navy-700)]'
  const MOBILE_AUTH =
    'block rounded-md border border-blue-200 px-3 py-2.5 font-medium text-white hover:bg-[var(--gov-navy-700)]'

  return (
    <div class="min-h-screen bg-[var(--gov-bg)]">
      <a href="#main" class="skip-link">
        Skip to main content
      </a>

      {/* Gold top stripe */}
      <div class="h-1.5 w-full bg-[var(--gov-gold-bright)]" aria-hidden="true" />

      <header class="bg-[var(--gov-navy)] text-white">
        <div class="mx-auto max-w-5xl px-4 py-4">
          <div class="flex items-center justify-between gap-3">
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

            {/* Desktop nav (inline) */}
            <nav aria-label="Main" class="hidden items-center gap-2 text-sm sm:flex">
              <NavItems isAuthed={isAuthed} itemClass={DESKTOP_ITEM} authClass={DESKTOP_AUTH} />
            </nav>

            {/* Mobile toggle */}
            <button
              type="button"
              class="-mr-1 inline-flex items-center justify-center rounded-md p-2 text-blue-50 hover:bg-[var(--gov-navy-700)] sm:hidden"
              aria-label={menuOpen() ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen() ? 'true' : 'false'}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen(!menuOpen())}
            >
              <Show
                when={menuOpen()}
                fallback={
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                }
              >
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18 18 6" />
                </svg>
              </Show>
            </button>
          </div>

          {/* Mobile menu panel */}
          <Show when={menuOpen()}>
            <nav id="mobile-menu" aria-label="Main" class="mt-3 flex flex-col gap-1 text-sm sm:hidden">
              <NavItems
                isAuthed={isAuthed}
                itemClass={MOBILE_ITEM}
                authClass={MOBILE_AUTH}
                onNavigate={() => setMenuOpen(false)}
              />
            </nav>
          </Show>
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
