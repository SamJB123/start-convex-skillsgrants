// A Solid 2 bridge for @tanstack/db live queries / collections.
//
// The official `@tanstack/solid-db` `useLiveQuery` targets Solid 1 (it imports
// `createResource`, `batch`, and `solid-js/store`, all changed/removed in Solid
// 2). This is the Solid-2 equivalent — it bridges a collection's
// `subscribeChanges` into a Solid signal, mirroring the approach used for
// Convex in `~/library/convex-solid.tsx`.
//
// Pass an ACCESSOR that returns a collection (a base collection or a
// `createLiveQueryCollection(...)` result), or null/undefined while it isn't
// ready yet (our on-device OPFS collections initialise asynchronously).

import { createEffect, createSignal } from 'solid-js'

type ChangeType = 'insert' | 'update' | 'delete'

export type LiveCollectionLike<T> = {
  status: string
  subscribeChanges: (
    cb: (changes: Array<{ type: ChangeType; key: unknown; value: T }>) => void,
    opts?: { includeInitialState?: boolean },
  ) => { unsubscribe: () => void }
  startSyncImmediate?: () => void
}

export function useLiveQuery<T>(
  source: () => LiveCollectionLike<T> | null | undefined,
) {
  const [items, setItems] = createSignal<T[]>([])
  const [status, setStatus] = createSignal<string>('disabled')

  // Solid 2 two-arg effect: the compute tracks `source()`; the apply re-subscribes
  // whenever the collection changes and returns an unsubscribe for cleanup.
  createEffect(
    () => source(),
    (coll) => {
      if (!coll) {
        setStatus('disabled')
        setItems([])
        return
      }
      coll.startSyncImmediate?.()
      const map = new Map<unknown, T>()
      const sub = coll.subscribeChanges(
        (changes) => {
          for (const change of changes) {
            if (change.type === 'delete') map.delete(change.key)
            else map.set(change.key, change.value)
          }
          setItems(Array.from(map.values()))
          setStatus(coll.status)
        },
        { includeInitialState: true },
      )
      setStatus(coll.status)
      return () => sub.unsubscribe()
    },
  )

  return {
    items,
    status,
    isReady: () => status() === 'ready' || status() === 'disabled',
  }
}
