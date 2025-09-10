"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { DashboardHeader } from "./components/dashboard-header"
import { OverviewCards } from "./components/overview-cards"
import { StudyFilters } from "./components/study-filters"
import { StudyGrid } from "./components/study-grid"
import { AuthGuard } from "@/components/auth/AuthGuard"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("All Studies")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All Types")
  const [selectedTime, setSelectedTime] = useState("All Time")

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
          <OverviewCards />

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
          />

          <StudyGrid />
        </div>
      </motion.div>
    </AuthGuard>
  )
}
