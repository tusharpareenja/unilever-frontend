"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { DashboardHeader } from "./components/dashboard-header"
import { OverviewCards } from "./components/overview-cards"
import { StudyFilters } from "./components/study-filters"
import { StudyGrid } from "./components/study-grid"
import { AuthGuardDebug as AuthGuard } from "@/components/auth/AuthGuardDebug"
import { getStudies, StudyListItem } from "@/lib/api/StudyAPI"
import { API_BASE_URL } from "@/lib/api/LoginApi"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("All Studies")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All Types")
  const [selectedTime, setSelectedTime] = useState("All Time")
  const [studies, setStudies] = useState<StudyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isValidatingToken, setIsValidatingToken] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    draft: 0,
    completed: 0
  })

  // Check token validity BEFORE rendering anything
  useEffect(() => {
    const validateTokenBeforeRender = async () => {
      try {
        // Check if token exists in localStorage
        const storedTokens = localStorage.getItem('tokens')
        if (!storedTokens) {
          // No token, redirect immediately
          sessionStorage.setItem('auth_redirecting', 'true')
          localStorage.removeItem('user')
          localStorage.removeItem('tokens')
          localStorage.removeItem('auth_user')
          localStorage.removeItem('token')
          window.location.replace('/login')
          return
        }

        const tokens = JSON.parse(storedTokens)
        if (!tokens?.access_token) {
          // Invalid token format, redirect immediately
          sessionStorage.setItem('auth_redirecting', 'true')
          localStorage.removeItem('user')
          localStorage.removeItem('tokens')
          localStorage.removeItem('auth_user')
          localStorage.removeItem('token')
          window.location.replace('/login')
          return
        }

        // Make a lightweight API call to verify token is still valid
        // Use a minimal endpoint that requires auth
        const response = await fetch(`${API_BASE_URL}/studies?page=1&per_page=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokens.access_token}`
          },
        })

        // If token is invalid (401/403), redirect immediately
        if (response.status === 401 || response.status === 403) {
          sessionStorage.setItem('auth_redirecting', 'true')
          localStorage.removeItem('user')
          localStorage.removeItem('tokens')
          localStorage.removeItem('auth_user')
          localStorage.removeItem('token')
          window.location.replace('/login')
          return
        }

        // Token is valid, proceed with page rendering
        setIsValidatingToken(false)
      } catch (error) {
        // Network error or other issue - redirect to login to be safe
        console.error('Token validation error:', error)
        sessionStorage.setItem('auth_redirecting', 'true')
        localStorage.removeItem('user')
        localStorage.removeItem('tokens')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('token')
        window.location.replace('/login')
      }
    }

    validateTokenBeforeRender()
  }, [])

  // Hydrate studies list from cache for instant render on refresh (only if token is valid)
  useEffect(() => {
    if (isValidatingToken) return // Wait for token validation

    try {
      const cached = localStorage.getItem('home_studies_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) {
          setStudies(parsed as StudyListItem[])
          setLoading(false)
        }
      }
    } catch { }
  }, [isValidatingToken])

  // Hydrate cards from cache immediately for instant paint (only if token is valid)
  useEffect(() => {
    if (isValidatingToken) return // Wait for token validation

    try {
      const cached = localStorage.getItem('home_stats_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object') {
          setStats({
            total: Number(parsed.total || 0),
            active: Number(parsed.active || 0),
            draft: Number(parsed.draft || 0),
            completed: Number(parsed.completed || 0),
          })
          setCardsLoading(false)
        }
      }
    } catch { }
  }, [isValidatingToken])

  // Fetch studies data (only if token is valid)
  useEffect(() => {
    if (isValidatingToken) return // Wait for token validation

    const fetchStudies = async () => {
      try {
        setLoading((prev) => prev && studies.length === 0)
        setError(null)
        const studiesArray = await getStudies(1, 200) // Get more studies for filtering

        // Ensure we have an array
        const safeStudiesArray = Array.isArray(studiesArray) ? studiesArray : []
        setStudies(safeStudiesArray)
        // Cache list for next load
        try { localStorage.setItem('home_studies_cache', JSON.stringify(safeStudiesArray)) } catch { }

        // Calculate stats
        const total = safeStudiesArray.length
        const active = safeStudiesArray.filter(s => s.status === 'active').length
        const draft = safeStudiesArray.filter(s => s.status === 'draft').length
        const completed = safeStudiesArray.filter(s => s.status === 'completed').length

        const nextStats = { total, active, draft, completed }
        setStats(nextStats)
        setCardsLoading(false)
        // Cache for next load to render instantly
        try { localStorage.setItem('home_stats_cache', JSON.stringify(nextStats)) } catch { }

        // Log for debugging
        // console.log(`Loaded ${total} studies: ${active} active, ${draft} draft, ${completed} completed`)
      } catch (err) {
        // Check if error is due to redirect (token expired)
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch studies'
        const isRedirecting = typeof window !== 'undefined' && (
          sessionStorage.getItem('auth_redirecting') === 'true' ||
          window.location.pathname === '/login' ||
          errorMessage === 'REDIRECTING' ||
          errorMessage.includes('204')
        )

        if (!isRedirecting) {
          console.error('Failed to fetch studies:', err)
          setError(errorMessage)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchStudies()
  }, [isValidatingToken, studies.length])

  const handleClearFilters = () => {
    setSearchQuery("")
    setSelectedType("All Types")
    setSelectedTime("All Time")
  }

  // Don't render anything until token is validated
  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <AuthGuard requireAuth={true}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-slate-100"
      >
        <DashboardHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <OverviewCards stats={stats} loading={cardsLoading} />

          <StudyFilters
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            onClearFilters={handleClearFilters}
            stats={stats}
          />

          <StudyGrid
            studies={studies}
            activeTab={activeTab}
            searchQuery={searchQuery}
            selectedType={selectedType}
            selectedTime={selectedTime}
            loading={loading}
            error={error}
          />
        </div>
      </motion.div>
    </AuthGuard>
  )
}
