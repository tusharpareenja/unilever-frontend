"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSession } from 'next-auth/react'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function AuthGuardDebug({ children, requireAuth = true }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user, tokens } = useAuth()
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Wait for both AuthContext and NextAuth to load
    if (isLoading || status === 'loading') {
      return
    }

    // If we have a NextAuth session but no AuthContext authentication, wait a bit for SessionHandler to sync
    if (status === 'authenticated' && session && !isAuthenticated) {
      const timer = setTimeout(() => {
        if (!isAuthenticated) {
          router.push('/login')
        }
      }, 2000) // Wait 2 seconds for SessionHandler to sync

      return () => clearTimeout(timer)
    }

    if (requireAuth && !isAuthenticated) {
      router.push('/login')
    } else if (!requireAuth && isAuthenticated) {
      router.push('/home')
    }
  }, [isAuthenticated, isLoading, requireAuth, router, user, tokens, session, status])

  // Show loading state while checking authentication
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Don't render children if auth requirements aren't met
  if (requireAuth && !isAuthenticated) {
    return null
  }

  if (!requireAuth && isAuthenticated) {
    return null
  }

  return <>{children}</>
}
