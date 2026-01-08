"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAuth } from '@/lib/auth/AuthContext'
import { API_BASE_URL } from '@/lib/api/LoginApi'
import { useRouter } from 'next/navigation'

export function OAuthHandler() {
  const { data: session, status } = useSession()
  const { login, isAuthenticated } = useAuth()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasProcessed, setHasProcessed] = useState(false)

  useEffect(() => {
    console.log("=== OAUTH HANDLER TRIGGERED ===")
    console.log("Session status:", status)
    console.log("Session data:", session)
    console.log("Session backendTokens:", session?.backendTokens)
    console.log("Is authenticated:", isAuthenticated)
    console.log("Is processing:", isProcessing)
    console.log("Has processed:", hasProcessed)

    // Prevent multiple processing
    if (hasProcessed || isProcessing) {
      console.log("OAuth already processed or processing, skipping...")
      return
    }

    // Only process if we have a NextAuth session
    if (status === 'authenticated' && session) {
      setIsProcessing(true)
      console.log("🔄 Processing OAuth authentication...")

      // Check if we have backend tokens in the session
      if (session.backendTokens) {
        console.log("✅ Backend tokens found in session, syncing to AuthContext...")

        // Create user data from session
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

        // Store in localStorage
        localStorage.setItem('token', JSON.stringify([session.backendTokens]))
        localStorage.setItem('auth_user', JSON.stringify(userData))

        // Sync to AuthContext
        login(userData, session.backendTokens)

        setHasProcessed(true)
        setIsProcessing(false)

        console.log("✅ OAuth authentication complete, redirecting to /home...")
        router.push('/home')

      } else {
        console.log("⚠️ No backend tokens in session, making fallback API call...")

        // Make fallback API call
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
              console.log("✅ Fallback API call successful:", data)

              // Create user data from session
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

              // Store in localStorage
              localStorage.setItem('token', JSON.stringify([data.tokens]))
              localStorage.setItem('auth_user', JSON.stringify(userData))

              // Sync to AuthContext
              login(userData, data.tokens)

              setHasProcessed(true)
              setIsProcessing(false)

              console.log("✅ Fallback OAuth authentication complete, redirecting to /home...")
              router.push('/home')

            } else {
              console.error('❌ Fallback API call failed:', await response.text())
              setIsProcessing(false)
            }
          } catch (error) {
            console.error('❌ Fallback API call error:', error)
            setIsProcessing(false)
          }
        }

        makeFallbackCall()
      }
    }
  }, [session, status, login, isAuthenticated, isProcessing, hasProcessed, router])

  // Show loading state while processing
  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing Google sign-in...</p>
        </div>
      </div>
    )
  }

  return null
}
