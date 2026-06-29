// A small Solid 2 compatible replacement for the `convex-solidjs` package.
//
// `convex-solidjs@0.0.3` targets Solid 1 — it pulls in `createResource`, `on`,
// `batch`, and the `solid-js/web` subpath, all of which were removed/changed in
// Solid 2. Convex's `ConvexClient.onUpdate` is already a live, reactive
// subscription, so the v1 `createResource` plumbing is unnecessary: we just
// bridge `onUpdate` into Solid signals inside a `createEffect`.
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  useContext,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { isServer } from '@solidjs/web'
import { ConvexClient } from 'convex/browser'
import type { ConvexClientOptions } from 'convex/browser'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

type MaybeAccessor<T> = T | (() => T)

function resolve<T>(value: MaybeAccessor<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value
}

const ConvexContext = createContext<ConvexClient>()

export function ConvexProvider(props: {
  client: ConvexClient
  children: JSX.Element
}) {
  // In Solid 2 the Context object is itself the provider component.
  return (
    <ConvexContext value={props.client}>{props.children}</ConvexContext>
  )
}

export function useConvexClient(): ConvexClient | undefined {
  return useContext(ConvexContext)
}

export function setupConvex(url: string, options: ConvexClientOptions = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('setupConvex requires a valid URL string')
  }
  const client = new ConvexClient(url, { disabled: isServer, ...options })
  // Only register cleanup when called inside a reactive owner; `setupConvex` is
  // often invoked at module scope, where there is no owner to clean up.
  if (getOwner()) {
    onCleanup(() => client.close())
  }
  return client
}

export interface UseQueryOptions<T> {
  enabled?: boolean
  initialData?: T
  keepPreviousData?: boolean
}

export function useQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args?: MaybeAccessor<FunctionArgs<Query>>,
  options?: MaybeAccessor<UseQueryOptions<FunctionReturnType<Query>>>,
) {
  const client = useConvexClient()
  if (!client) {
    throw new Error('useQuery must be used within ConvexProvider')
  }

  const getArgs = createMemo(() => resolve(args ?? ({} as FunctionArgs<Query>)))
  const getOptions = createMemo(
    () => resolve(options ?? {}) as UseQueryOptions<FunctionReturnType<Query>>,
  )

  const [data, setData] = createSignal<FunctionReturnType<Query> | undefined>(
    resolve(options ?? {})?.initialData,
  )
  const [error, setError] = createSignal<Error | undefined>()
  const [isLoading, setIsLoading] = createSignal(true)

  // Solid 2's `createEffect(compute, effect)` splits tracking from the side
  // effect: reactive reads happen in the first function (tracking scope) and
  // its return is handed to the second. The effect callback runs as a leaf
  // owner where `onCleanup` is forbidden — it must instead *return* a cleanup
  // function (replacing the 1.x onCleanup), which Solid runs before the next
  // effect run and on disposal.
  createEffect(
    () => {
      const opts = getOptions()
      return {
        args: getArgs(),
        enabled: opts.enabled !== false,
        keepPreviousData: Boolean(opts.keepPreviousData),
      }
    },
    (input) => {
      if (!input.enabled) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      if (!input.keepPreviousData) {
        setData(() => undefined)
      }

      const unsubscribe = client.onUpdate(
        query,
        input.args,
        (result) => {
          setData(() => result)
          setError(undefined)
          setIsLoading(false)
        },
        (err) => {
          setError(() => err)
          setData(() => undefined)
          setIsLoading(false)
        },
      )

      return unsubscribe
    },
  )

  return { data, error, isLoading }
}

export function useMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
) {
  const client = useConvexClient()
  if (!client) {
    throw new Error('useMutation must be used within ConvexProvider')
  }

  const [data, setData] = createSignal<FunctionReturnType<Mutation>>()
  const [error, setError] = createSignal<Error | undefined>()
  const [isLoading, setIsLoading] = createSignal(false)

  const mutateAsync = async (args: FunctionArgs<Mutation>) => {
    setIsLoading(true)
    try {
      const result = await client.mutation(mutation, args)
      setData(() => result)
      setError(undefined)
      return result
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(() => e)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setData(() => undefined)
    setError(undefined)
    setIsLoading(false)
  }

  return { mutate: mutateAsync, mutateAsync, data, error, isLoading, reset }
}
