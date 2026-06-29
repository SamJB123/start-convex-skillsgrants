import { createServerFn } from '@tanstack/solid-start'
import { redirect } from '@tanstack/solid-router'
import { api } from 'convex/_generated/api'
import { fetchAuthMutation, fetchAuthQuery, getToken } from './auth-server'

// Get the Convex auth token for SSR from the request's auth cookies.
export const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const token = await getToken()
  return { token }
})

export const fetchUser = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const user = await fetchAuthQuery(api.auth.getCurrentUser, {})
    return user
  } catch (error) {
    throw redirect({ to: '/' })
  }
})

// example of calling Convex functions using server functions
export const addNumber = createServerFn({ method: 'POST' }).handler(
  async () => {
    const number = await fetchAuthMutation(api.myFunctions.addNumber, {
      value: Math.floor(Math.random() * 100),
    })
    return number
  },
)
