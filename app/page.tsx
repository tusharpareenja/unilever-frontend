"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return // Wait for auth state to load

    if (isAuthenticated) {
      // User has valid tokens, redirect to home page
      router.push('/home')
    } else {
      // User doesn't have valid tokens, redirect to login
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading state while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  )
}
