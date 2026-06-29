// The framework-agnostic client. We only use imperative methods (signIn,
// signUp, signOut), not the reactive `useSession` store, so we avoid
// `better-auth/solid` and its Solid 1 `solid-js/store` dependency. If a
// reactive session is ever needed, vendor a Solid 2 `useSession` instead.
import { createAuthClient } from 'better-auth/client'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [convexClient()],
})
