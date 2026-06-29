import { createSignal, onSettled } from 'solid-js'
import { authClient } from '~/library/auth-client'

// `better-auth/solid`'s `useSession` is built for Solid 1 (it wraps the session
// nanostore with `solid-js/store`, a subpath removed in Solid 2). We use the
// framework-agnostic `better-auth/client`, where `authClient.useSession` is the
// raw nanostore atom: `.get()` returns the current state and `.subscribe(cb)`
// fires immediately with the current value and again on every change.
//
// This is the Solid 2 equivalent — it bridges that atom into a signal. Call it
// inside a component; it returns an accessor to
// `{ data: { user, session } | null, error, isPending, isRefetching }`.
type SessionAtom = typeof authClient.useSession
type SessionState = ReturnType<SessionAtom['get']>

export function useSession(): () => SessionState {
  const atom = authClient.useSession
  const [session, setSession] = createSignal<SessionState>(atom.get())

  // `subscribe` fires synchronously, and Solid 2 forbids signal writes during
  // component setup (SIGNAL_WRITE_IN_OWNED_SCOPE). `onSettled` runs the bridge
  // after the first render (client only), where writes are allowed; the
  // returned function unsubscribes on disposal. The seeded `atom.get()` above
  // covers SSR and the first render before this runs.
  onSettled(() => {
    const unsubscribe = atom.subscribe((value) => setSession(() => value))
    return unsubscribe
  })

  return session
}
