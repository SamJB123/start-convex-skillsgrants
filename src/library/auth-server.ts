import { ConvexHttpClient } from 'convex/browser'
import { getToken as getConvexToken } from '@convex-dev/better-auth/utils'
import { getRequest } from '@tanstack/solid-start/server'
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server'

// Solid adaptation of `@convex-dev/better-auth`'s `convexBetterAuthReactStart`.
// That official factory is React-coupled — it imports `getRequestHeaders` from
// `@tanstack/react-start/server`, which isn't installed in a Solid Start app.
// Everything else it does (the `getToken` util, `ConvexHttpClient`, and the
// proxy `handler`) is framework-agnostic, so this rebuilds the same behaviour
// reading request headers via Solid Start's `getRequest()`.
const convexUrl = process.env.VITE_CONVEX_URL as string
const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL as string
const basePath = '/api/auth'

// Exchange the incoming request's auth cookies for a fresh Convex JWT.
async function fetchToken() {
  const headers = new Headers(getRequest().headers)
  headers.delete('content-length')
  headers.delete('transfer-encoding')
  headers.set('accept-encoding', 'identity')
  return getConvexToken(convexSiteUrl, headers, { basePath })
}

export async function getToken(): Promise<string | undefined> {
  const { token } = await fetchToken()
  return token
}

function authedClient(token?: string) {
  const client = new ConvexHttpClient(convexUrl)
  if (token !== undefined) client.setAuth(token)
  return client
}

export async function fetchAuthQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: OptionalRestArgs<Query>
): Promise<FunctionReturnType<Query>> {
  const { token } = await fetchToken()
  return authedClient(token).query(query, ...args)
}

export async function fetchAuthMutation<
  Mutation extends FunctionReference<'mutation'>,
>(
  mutation: Mutation,
  ...args: OptionalRestArgs<Mutation>
): Promise<FunctionReturnType<Mutation>> {
  const { token } = await fetchToken()
  return authedClient(token).mutation(mutation, ...args)
}

export async function fetchAuthAction<
  Action extends FunctionReference<'action'>,
>(
  action: Action,
  ...args: OptionalRestArgs<Action>
): Promise<FunctionReturnType<Action>> {
  const { token } = await fetchToken()
  return authedClient(token).action(action, ...args)
}

// Proxy Better Auth API requests through to the Convex backend's HTTP routes.
// (Verbatim from the package's `handler`, which is framework-agnostic.)
export function handler(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`
  const headers = new Headers(request.headers)
  headers.delete('transfer-encoding')
  headers.delete('content-length')
  headers.delete('connection')
  headers.set('accept-encoding', 'application/json')
  headers.set('host', new URL(convexSiteUrl).host)
  headers.set('x-forwarded-host', requestUrl.host)
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(/:$/, ''))
  headers.set('x-better-auth-forwarded-host', requestUrl.host)
  headers.set('x-better-auth-forwarded-proto', requestUrl.protocol.replace(/:$/, ''))
  return fetch(nextUrl, {
    method: request.method,
    headers,
    redirect: 'manual',
    body: request.body,
    // @ts-expect-error - duplex is required for streaming request bodies
    duplex: 'half',
  })
}
