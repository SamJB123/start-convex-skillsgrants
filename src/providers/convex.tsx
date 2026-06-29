import { ConvexProvider } from '~/library/convex-solid'
import type { JSX } from '@solidjs/web'
import { convexClient } from '~/library/convex-client'

export default function AppConvexProvider(props: { children: JSX.Element }) {
  return <ConvexProvider client={convexClient}>{props.children}</ConvexProvider>
}
