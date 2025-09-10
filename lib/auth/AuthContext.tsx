"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

  const login = (userData: User, tokenData: Tokens) => {
    setUser(userData)
    setTokens(tokenData)
    
    // Store in localStorage
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('tokens', JSON.stringify(tokenData))
  }

  const logout = () => {
    setUser(null)
    setTokens(null)
    
    // Clear from localStorage
    localStorage.removeItem('user')
    localStorage.removeItem('tokens')
    
    // Redirect to login
    router.push('/login')
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
