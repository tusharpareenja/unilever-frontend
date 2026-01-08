"use client"

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAuth } from '@/lib/auth/AuthContext'
import { API_BASE_URL } from '@/lib/api/LoginApi'

export function SessionHandler() {
  const { data: session, status } = useSession()
  const { login, isAuthenticated } = useAuth()
  const hasSynced = useRef(false)

  useEffect(() => {
    // Prevent double sync
    if (hasSynced.current) {
      return
    }

    // Check if we have a NextAuth session but no backend tokens (fallback case)
    if (status === 'authenticated' && session && !session.backendTokens) {
      // Try to call the backend OAuth endpoint directly as a fallback
      const makeFallbackCall = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/oauth-login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: session.user?.email,
              name: session.user?.name,
              provider: 'google',
              provider_id: session.user?.email,
              profile_picture: session.user?.image
            })
          });

          if (response.ok) {
            const data = await response.json();

            hasSynced.current = true

            // Create a user object from the session data
            const userData = {
              id: session.user?.id || session.user?.email || '',
              email: session.user?.email || '',
              name: session.user?.name || '',
              phone: '',
              date_of_birth: '',
              is_active: true,
              is_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_login: new Date().toISOString(),
            }

            // Store tokens in localStorage
            localStorage.setItem('token', JSON.stringify([data.tokens]))
            localStorage.setItem('auth_user', JSON.stringify(userData))

            // Use the backend tokens from the API response
            login(userData, data.tokens)
          }
        } catch {
          // Handle error silently
        }
      }

      makeFallbackCall()
      return
    }

    // Only process if we have a session with backend tokens and user is not already authenticated
    if (status === 'authenticated' && session?.backendTokens && !isAuthenticated) {
      hasSynced.current = true

      // Create a user object from the session data
      const userData = {
        id: session.user?.id || session.user?.email || '',
        email: session.user?.email || '',
        name: session.user?.name || '',
        phone: '',
        date_of_birth: '',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      }

      // Store tokens in localStorage for useAuth context
      localStorage.setItem('token', JSON.stringify([session.backendTokens]))
      localStorage.setItem('auth_user', JSON.stringify(userData))

      // Use the backend tokens from the session
      login(userData, session.backendTokens)
    }
  }, [session, status, login, isAuthenticated])

  return null // This component doesn't render anything
}
