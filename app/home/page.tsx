"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { DashboardHeader } from "./components/dashboard-header"
import { OverviewCards } from "./components/overview-cards"
import { StudyFilters } from "./components/study-filters"
import { StudyGrid } from "./components/study-grid"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { getStudies, StudyListItem } from "@/lib/api/StudyAPI"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("All Studies")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All Types")
  const [selectedTime, setSelectedTime] = useState("All Time")
  const [studies, setStudies] = useState<StudyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    draft: 0,
    completed: 0
  })

  // Hydrate cards from cache immediately for instant paint
  useEffect(() => {
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
    } catch {}
  }, [])

  // Fetch studies data
  useEffect(() => {
    const fetchStudies = async () => {
      try {
        setLoading(true)
        setError(null)
        const studiesArray = await getStudies(1, 100) // Get more studies for filtering
        
        // Ensure we have an array
        const safeStudiesArray = Array.isArray(studiesArray) ? studiesArray : []
        setStudies(safeStudiesArray)
        
        // Calculate stats
        const total = safeStudiesArray.length
        const active = safeStudiesArray.filter(s => s.status === 'active').length
        const draft = safeStudiesArray.filter(s => s.status === 'draft').length
        const completed = safeStudiesArray.filter(s => s.status === 'completed').length
        
        const nextStats = { total, active, draft, completed }
        setStats(nextStats)
        setCardsLoading(false)
        // Cache for next load to render instantly
        try { localStorage.setItem('home_stats_cache', JSON.stringify(nextStats)) } catch {}
        
        // Log for debugging
        console.log(`Loaded ${total} studies: ${active} active, ${draft} draft, ${completed} completed`)
      } catch (err) {
        console.error('Failed to fetch studies:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch studies')
      } finally {
        setLoading(false)
      }
    }

    fetchStudies()
  }, [])

  const handleClearFilters = () => {
    setSearchQuery("")
    setSelectedType("All Types")
    setSelectedTime("All Time")
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
