/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute } from '@tanstack/solid-router'
import { Loading } from '@solidjs/web'
import type { JSX } from '@solidjs/web'
import appCss from '~/styles/app.css?url'
import AppConvexProvider from '~/providers/convex'
import { fetchAuth } from '~/library/server'

export const Route = createRootRoute({
  beforeLoad: async () => {
    const { token } = await fetchAuth()
    return { token }
  },
  shellComponent: RootDocument,
})

function RootDocument(props: { children: JSX.Element }) {
  return (
    <html>
      <head>
        {/*
          Render the stylesheet as a static child of the shell `<head>` rather
          than via the route's `head()`/`<HeadContent>`. Under Solid 2,
          `<HeadContent>` re-renders empty on the client and hydration removes
          the head's stylesheet links. A static link is rendered identically on
          server and client, so hydration matches it and it survives.
        */}
        <link rel="stylesheet" href={appCss} />
        <HeadContent />
      </head>
      <body>
        <Loading>
          <AppConvexProvider>{props.children}</AppConvexProvider>
        </Loading>
        <Scripts />
      </body>
    </html>
  )
}
