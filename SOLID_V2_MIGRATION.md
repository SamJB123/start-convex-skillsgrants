# Solid v2 compatibility notes

This app runs on the Solid **2.0 beta** line (`solid-js`, `@solidjs/web`,
`@solidjs/signals` `2.0.0-beta.x`) together with TanStack Start/Router v2 betas.
Solid 2 changed several core APIs and split packages, and a couple of beta
integration packages still target Solid 1. This file records everything that was
needed to get the app compiling, hydrating, and styled correctly.

> Note: the `build` script is intentionally a no-op (`"Skipped: waiting for
> dependency Solid 2.0 support"`) — several deps are still pre-Solid-2-stable.
> Everything below targets `vite dev`.

---

## 1. Solid 2 core API changes (app code)

### `Suspense` → `Loading` (and `ErrorBoundary` → `Errored`)
Solid 2 renamed the async/error boundaries. `@solidjs/web` no longer exports
`Suspense`.

- `src/routes/__root.tsx` — `import { Loading } from '@solidjs/web'`, `<Loading>…</Loading>`.

### `createEffect` is now two functions: `createEffect(compute, effect)`
The single-callback form is Solid 1. In Solid 2 the **first** function is the
tracking scope (do reactive reads here, return a value); the **second** is the
side effect (runs untracked, receives that value). Using the old single-callback
form trips `STRICT_READ_UNTRACKED` / `NO_OWNER_CLEANUP`.

```ts
createEffect(
  () => ({ args: getArgs(), enabled: getEnabled() }), // tracked reads
  (input) => { /* side effects */ },                  // untracked
)
```
- `src/library/convex-solid.tsx` (`useQuery`).

### `onCleanup` is forbidden inside an effect callback — **return** a cleanup
The effect (second) function of `createEffect` runs as a *leaf owner* where
`onCleanup` is not allowed. Return a cleanup function instead (React-`useEffect`
style); Solid runs it before the next effect run and on disposal.

```ts
(input) => {
  const unsubscribe = client.onUpdate(/* … */)
  return unsubscribe   // NOT onCleanup(unsubscribe)
}
```
- `src/library/convex-solid.tsx` (`useQuery`).

### Context object **is** the Provider
`<MyContext.Provider value={…}>` → `<MyContext value={…}>`.
- `src/library/convex-solid.tsx` (`ConvexProvider`).

### No writing signals during component setup (`SIGNAL_WRITE_IN_OWNED_SCOPE`)
Solid 2 forbids signal writes during a component body / computation. Anything
that writes synchronously during setup (e.g. a nanostore `subscribe` that fires
immediately) must be deferred. Use `onSettled` — it runs once after the first
render (client only) and returns its own cleanup.
- `src/library/use-session.ts`.

### Still single-function (unchanged): `createMemo(fn)`, `createSignal`
Only `createEffect`/`createRenderEffect` gained the two-arg form.

---

## 2. Split packages / removed subpaths

Solid 2 moved the web runtime and store API out of `solid-js` subpaths.

| Solid 1 import        | Solid 2 location                         |
| --------------------- | ---------------------------------------- |
| `solid-js/web`        | `@solidjs/web` (standalone package)      |
| `solid-js/store`      | folded into `solid-js` main entry        |
| `Suspense`            | `Loading` (from `@solidjs/web`/`solid-js`)|
| `ErrorBoundary`       | `Errored`                                |
| `on`, `createResource`, `batch` | removed                        |

### Vite alias for legacy deps still importing `solid-js/web`
- `vite.config.ts`:
  ```ts
  resolve: { alias: { 'solid-js/web': '@solidjs/web' } }
  ```
  Kept as a harmless forward-map in case a dependency still imports the old path.
  (`solid-js/store` no longer needs an alias — see §4, we stopped importing it.)

---

## 3. Vendored `convex-solidjs` → `src/library/convex-solid.tsx`

`convex-solidjs@0.0.3` is a Solid 1 package: it imports `on`, `createResource`,
`batch`, and `solid-js/web` — all removed/changed in Solid 2. It was replaced
with a small Solid-2-native module and the dependency removed from
`package.json`.

- Exposes `setupConvex`, `ConvexProvider`, `useConvexClient`, `useQuery`,
  `useMutation`.
- `useQuery` drops `createResource` entirely — Convex's `client.onUpdate` is
  already a live reactive subscription, so it just bridges that into signals via
  the two-arg `createEffect` (reads in compute, subscribe + return-cleanup in
  effect).
- Import sites repointed: `src/library/convex-client.ts`,
  `src/providers/convex.tsx`, `src/routes/_authed/dashboard.tsx`.

---

## 4. Better Auth (Solid 1 client + version pin)

### `better-auth`'s version is coupled to `@convex-dev/better-auth`
`@convex-dev/better-auth` declares an **exact** peer dependency on a specific
`better-auth` version, so the two must move together — `better-auth` is not free
to float on its own. To move `better-auth`, bump `@convex-dev/better-auth` in
lockstep; floating `better-auth` alone past what the installed integration
package peers is what breaks (e.g. `createAuthEndpoint` moved out of
`better-auth/plugins` between 1.3 and 1.6).

This repo is on **`@convex-dev/better-auth@^0.12.2` + `better-auth@^1.6.9`**
(0.12.2 peers `better-auth >=1.6.9 <1.7.0`; lockfile resolves `1.6.12`).

### The 0.9 → 0.12 integration rewrite
The `@convex-dev/better-auth` API changed substantially across 0.9 → 0.12:

- **`convex/auth.config.ts`** → `{ providers: [getAuthConfigProvider()] }`
  (from `@convex-dev/better-auth/auth-config`), replacing the manual
  `{ domain, applicationID }` provider.
- **`convex/auth.ts`** → `betterAuth` now imported from `better-auth/minimal`;
  the convex plugin takes `convex({ authConfig })` (reads the auth config to
  derive JWT issuer/audience) instead of `convex({ jwtExpirationSeconds })`.
  `createAuth` is now just `(ctx) => betterAuth({...})` (no `optionsOnly`).
- **`convex/http.ts`** is unchanged (`authComponent.registerRoutes(http, createAuth)`).
- **Server integration** is now a single factory,
  `convexBetterAuthReactStart({ convexUrl, convexSiteUrl, basePath })` →
  `{ handler, getToken, fetchAuthQuery/Mutation/Action }`, replacing the old
  `reactStartHandler` / `fetchSession` / `getCookieName` / `setupFetchClient`.

### `auth-server.ts` is a vendored Solid adapter (the factory is React-coupled)
`convexBetterAuthReactStart` dynamically imports `getRequestHeaders` from
**`@tanstack/react-start/server`**, which isn't installed in a Solid app. Its
other pieces — the `getToken` util (`@convex-dev/better-auth/utils`),
`ConvexHttpClient`, and the proxy `handler` — are framework-agnostic. So
`src/library/auth-server.ts` rebuilds the same surface
(`getToken` / `fetchAuthQuery` / `fetchAuthMutation` / `handler`) reading request
headers via Solid Start's `getRequest()`. `src/library/server.ts` and
`src/routes/api/auth/$.ts` consume it; `fetchAuth` now returns just `{ token }`.

### Client: `better-auth/client` + empty `convexClient()`
We still use the framework-agnostic `better-auth/client` (not `better-auth/solid`
— it pulls the removed Solid 1 `solid-js/store`). Note that in 0.12 the
`convexClient()` client plugin is an **empty marker** — the session is a normal
first-party cookie (`better-auth.session_token`, HttpOnly) set via the same-origin
`/api/auth` proxy, which the server reads to mint the Convex JWT. (The app only
calls imperative methods anyway; for a reactive session see the vendored
`useSession` below.)

### Vendored `useSession` → `src/library/use-session.ts`
For a Solid-2 reactive session, we bridge the vanilla client's session
**nanostore atom** (`authClient.useSession` — `.get()`/`.subscribe()`) into a
signal. `subscribe` fires synchronously, so the bridge runs inside `onSettled`
(post-render, client-only) to avoid `SIGNAL_WRITE_IN_OWNED_SCOPE`; the seeded
`atom.get()` covers SSR and first render. Wired into the dashboard header
(`src/routes/_authed/dashboard.tsx`).

---

## 5. Hydration & styling fix (`<HeadContent>` wipes the stylesheet)

**Symptom:** the page rendered correctly from SSR, then went **completely
unstyled the moment the client hydrated** (content intact, all CSS gone).

**Cause:** under Solid 2, `@tanstack/solid-router`'s `<HeadContent>` re-renders
empty on the client, and hydration removes the head's stylesheet `<link>`s that
were rendered through the route `head()` API (a DOM dump after hydration showed
**zero** `<link>`/`<style>` in `<head>`). A side-effect CSS import didn't survive
either — the head clear was indiscriminate.

**Fix:** render the stylesheet as a **static `<link>` child of the shell
`<head>`** in `RootDocument` instead of via `head()`/`<HeadContent>`. A static
link is rendered identically on server and client, so hydration *matches* it
rather than removing it.

```tsx
// src/routes/__root.tsx
<head>
  <link rel="stylesheet" href={appCss} />  {/* survives hydration */}
  <HeadContent />
</head>
```
The route's `head()` `links` entry for the stylesheet was removed.

How it was diagnosed: headless Chrome (`--screenshot` + `--dump-dom` with a
virtual-time budget) to observe the *post-hydration* DOM, since the breakage is
client-only and invisible to `curl`.

---

## 6. TanStack Router Devtools — intentionally NOT mounted

`@tanstack/router-devtools-core` **inlines its own Solid runtime** (no
`import 'solid-js'`; it renders in a shadow DOM). Running it alongside the app is
a second Solid runtime, which causes:

- **Double-fired delegated events (dealbreaker):** both runtimes register a
  `document`-level delegated listener using Solid's shared `$$click` node-property
  convention, so every `onClick` fires once per runtime = twice. This made the
  dashboard's `addNumber` insert two numbers per click, and affects every
  delegated handler app-wide.
- Dev-only `STRICT_READ_UNTRACKED` (foreign runtime reads our router state
  cross-runtime) and `NO_OWNER_CLEANUP` (a bug in the `@tanstack/solid-router-devtools`
  wrapper itself).

There is no alias/dedupe fix (Solid is compiled into the bundle) and a custom
bridge can't preserve fine-grained reactivity across the boundary. Leave devtools
out until `@tanstack/router-devtools-core` imports Solid as a **peer**.

---

## 7. Convex deployment notes (not Solid, but needed to run)

These are environment/config, set on the Convex deployment (`npx convex env …`),
not in app code:

- `convex/tsconfig.json` — added `"types": ["node"]` so `process.env` typechecks
  (`convex dev` runs `tsc`).
- `SITE_URL=http://localhost:3000` — required. Without it Better Auth's `baseURL`
  is undefined, so the dev origin isn't trusted and **sign-out returns 403**. It
  also gates trusted origins, so the app must run on this exact origin (port 3000).
- `BETTER_AUTH_SECRET` — **mandatory** on better-auth 1.6.x: the default secret is
  now a fatal error (`BetterAuthError: You are using the default secret`), unlike
  1.3.x where it was only a warning. Set it with
  `npx convex env set BETTER_AUTH_SECRET $(openssl rand -base64 32)`.

  ⚠️ **Rotating the secret requires clearing the JWKS keypair.** The JWT signing
  keypair is stored in the Better Auth component **encrypted with the secret**, so
  changing the secret after a keypair exists breaks JWT minting —
  `/api/auth/convex/token` returns 500 with `Failed to decrypt private key`, and
  every authed request fails (sessions work, but the dashboard bounces to login).
  Fix: delete the `jwks` rows so a fresh keypair regenerates under the new secret.
  A one-off internal mutation does it:
  ```ts
  // convex/cleanup.ts (run `npx convex run cleanup:clearJwks`, then delete)
  import { internalMutation } from './_generated/server'
  import { components } from './_generated/api'
  export const clearJwks = internalMutation({
    args: {},
    handler: async (ctx) => {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: 'jwks' },
        paginationOpts: { cursor: null, numItems: 1000 },
      })
    },
  })
  ```

---

## Touched files (quick index)

- `src/routes/__root.tsx` — `Loading`; static stylesheet `<link>`.
- `src/library/convex-solid.tsx` — vendored Convex Solid client (new).
- `src/library/use-session.ts` — vendored Solid 2 `useSession` (new).
- `src/library/auth-server.ts` — vendored Solid adapter for the 0.12 react-start factory.
- `src/library/server.ts`, `src/routes/api/auth/$.ts` — updated to the 0.12 API
  (`getToken`/`fetchAuthQuery`/`handler`); `fetchAuth` returns `{ token }`.
- `convex/auth.ts`, `convex/auth.config.ts` — 0.12 setup (`better-auth/minimal`,
  `convex({ authConfig })`, `getAuthConfigProvider()`).
- `src/library/auth-client.ts` — `better-auth/client`.
- `src/library/convex-client.ts`, `src/providers/convex.tsx`,
  `src/routes/_authed/dashboard.tsx` — repointed imports; dashboard uses `useSession`.
- `vite.config.ts` — `solid-js/web` → `@solidjs/web` alias.
- `package.json` — removed `convex-solidjs`; `@convex-dev/better-auth@^0.12.2` +
  `better-auth@^1.6.9` (lockfile resolves `1.6.12`).
- `convex/tsconfig.json` — `types: ["node"]`.
