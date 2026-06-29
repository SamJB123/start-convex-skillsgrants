import { createFileRoute, redirect } from '@tanstack/solid-router'
import LoginSignupForm from '~/components/login-signup-form'

export const Route = createFileRoute('/signin')({
  beforeLoad: (ctx) => {
    // Already signed in → go to the account dashboard.
    if (ctx.context.token) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: () => <LoginSignupForm />,
})
