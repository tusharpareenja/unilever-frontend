"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const { data: session, status } = useSession()
  const { login, isAuthenticated } = useAuth()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasProcessed, setHasProcessed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Prevent multiple processing
    if (hasProcessed || isProcessing) {
      return
    }
    
    // Wait for session to load
    if (status === 'loading') {
      return
    }
    
    // Check if authentication failed
    if (status === 'unauthenticated') {
      setError("Authentication failed. Please try again.")
      setTimeout(() => router.push('/login'), 2000)
      return
    }
    
    // Only process if we have a NextAuth session
    if (status === 'authenticated' && session) {
      setIsProcessing(true)
      
      // Check if we have backend tokens in the session
      if (session.backendTokens) {
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
        
        router.push('/home')
        
      } else {
        // Make fallback API call
        const makeFallbackCall = async () => {
          try {
            // Determine provider from session (check account info or default to google for backward compatibility)
            // Note: For Microsoft Entra ID, provider might be 'microsoft-entra-id' or 'azure-ad'
            const provider = (session as any)?.provider || (session.user?.email?.includes('@microsoft') ? 'microsoft-entra-id' : 'google')
            
            const response = await fetch('http://127.0.0.1:8000/api/v1/auth/oauth-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: session.user?.email,
                name: session.user?.name,
                provider: provider,
                provider_id: session.user?.email,
                profile_picture: session.user?.image
              })
            });

            if (response.ok) {
              const data = await response.json();
              
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
              
              router.push('/home')
              
            } else {
              setError("Authentication failed. Please try again.")
              setIsProcessing(false)
            }
          } catch (error) {
            setError("Authentication failed. Please try again.")
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
            <p className="text-gray-600">Completing authentication...</p>
          </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login page...</p>
        </div>
      </div>
    )
  }

  // Default loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  )
}
