"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Tokens, User } from '@/lib/api/LoginApi'

interface AuthContextType {
  user: User | null
  tokens: Tokens | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: User, tokens: Tokens) => void
  logout: () => void
  refreshToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<Tokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  const isAuthenticated = !!user && !!tokens?.access_token

  // Load tokens from localStorage on mount
  useEffect(() => {
    const loadAuthData = () => {
      try {
        const storedUser = localStorage.getItem('user')
        const storedTokens = localStorage.getItem('tokens')

        if (storedUser && storedTokens) {
          const parsedUser = JSON.parse(storedUser)
          const parsedTokens = JSON.parse(storedTokens)

          // Check if access token is still valid (basic check)
          if (parsedTokens.access_token) {
            setUser(parsedUser)
            setTokens(parsedTokens)
          } else {
            // Clear invalid tokens
            localStorage.removeItem('user')
            localStorage.removeItem('tokens')
          }
        }
      } catch (error) {
        console.error('Error loading auth data:', error)
        // Clear corrupted data
        localStorage.removeItem('user')
        localStorage.removeItem('tokens')
      } finally {
        setIsLoading(false)
      }
    }

    loadAuthData()
  }, [])

  const clearCaches = () => {
    try {
      // Clear home page caches
      localStorage.removeItem('home_stats_cache')
      localStorage.removeItem('home_studies_cache')

      // Clear all create-study related localStorage items
      const keysToRemove = [
        'cs_step1',
        'cs_step2',
        'cs_step3',
        'cs_step4',
        'cs_step5_grid',
        'cs_step5_layer',
        'cs_step5_layer_background',
        'cs_step5_layer_preview_aspect',
        'cs_step6',
        'cs_step7_tasks',
        'cs_step7_matrix',
        'cs_step7_job_state',
        'cs_step7_timer_state',
        'cs_current_step',
        'cs_backup_steps',
        'cs_flash_message',
        'cs_resuming_draft',
        'cs_study_id',
        'cs_is_fresh_start'
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      // Also clear sessionStorage to remove study tracking
      sessionStorage.removeItem('cs_previous_study_id')
      sessionStorage.removeItem('auth_redirecting')

    } catch (error) {
      console.error('Error clearing caches:', error)
    }
  }

  const login = (userData: User, tokenData: Tokens) => {
    // Clear any existing caches before logging in with new user
    clearCaches()

    setUser(userData)
    setTokens(tokenData)

    // Store in localStorage
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('tokens', JSON.stringify(tokenData))
  }

  const logout = async () => {
    // Prevent multiple logout calls
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    // Clear state immediately
    setUser(null)
    setTokens(null)

    // Clear from localStorage (handle both regular login and OAuth login)
    localStorage.removeItem('user')
    localStorage.removeItem('tokens')
    localStorage.removeItem('auth_user')  // OAuth login
    localStorage.removeItem('token')      // OAuth login

    // Also sign out from NextAuth.js if user was logged in via OAuth
    try {
      await signOut({ redirect: false }) // Don't redirect, we'll handle it
    } catch (error) {
      // Handle error silently
    }

    // Reset logout state
    setIsLoggingOut(false)

    // Clear caches on logout
    clearCaches()

    // Force redirect to login
    window.location.href = '/login'
  }

  const refreshToken = async (): Promise<boolean> => {
    if (!tokens?.refresh_token) {
      return false
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refresh_token
        })
      })

      if (response.ok) {
        const newTokens = await response.json()
        setTokens(newTokens)
        localStorage.setItem('tokens', JSON.stringify(newTokens))
        return true
      } else {
        // Refresh failed, logout user
        logout()
        return false
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
