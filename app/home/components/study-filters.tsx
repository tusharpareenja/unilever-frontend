"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ChevronDown } from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface Stats {
  total: number
  active: number
  draft: number
  completed: number
}

interface StudyFiltersProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedType: string
  setSelectedType: (type: string) => void
  selectedTime: string
  setSelectedTime: (time: string) => void
  onClearFilters: () => void
  stats: Stats
}

export function StudyFilters({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  selectedType,
  setSelectedType,
  selectedTime,
  setSelectedTime,
  onClearFilters,
  stats,
}: StudyFiltersProps) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const typeDropdownRef = useRef<HTMLDivElement>(null)
  const timeDropdownRef = useRef<HTMLDivElement>(null)

  const tabs = [
    { name: "All Studies", count: stats.total },
    { name: "Active Studies", count: stats.active },
    { name: "Draft Studies", count: stats.draft },
    { name: "Complete", count: stats.completed },
  ]

  const typeOptions = ["All Types", "Grid", "Layer"]
  const timeOptions = ["All Time", "Last 7 days", "Last 30 days", "Last 3 months", "Last year"]

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false)
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setShowTimeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  return (
    <div className="mb-8">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[rgba(209,223,235,1)]">
        {tabs.map((tab) => (
          <motion.button
            key={tab.name}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab.name)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.name
                ? "border-[rgba(38,116,186,1)] text-[rgba(38,116,186,1)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.name}
            {tab.count !== null && tab.count !== undefined && (
              <span className="ml-2 bg-[rgba(38,116,186,1)] text-white text-xs px-2 py-1 rounded-full">
                {tab.count}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 sm:relative w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <Input
              placeholder="Search Studies By Title, Type And Descriptions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 sm:pr-28 py-2 w-full"
            />
          </div>
          <Button className="w-full sm:w-auto mt-2 sm:mt-0 sm:absolute sm:right-2 sm:top-1/2 sm:-translate-y-1/2 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-2 text-sm">
            Search
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Type Filter Dropdown */}
          <div className="relative" ref={typeDropdownRef}>
            <motion.div whileHover={{ scale: 1.02 }}>
              <Button 
                variant="outline" 
                className="flex items-center space-x-1 bg-transparent min-w-[120px]"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              >
                <span className="truncate">{selectedType}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </Button>
            </motion.div>
            
            {showTypeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                {typeOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedType(option)
                      setShowTypeDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedType === option ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time Filter Dropdown */}
          <div className="relative" ref={timeDropdownRef}>
            <motion.div whileHover={{ scale: 1.02 }}>
              <Button 
                variant="outline" 
                className="flex items-center space-x-1 bg-transparent min-w-[120px]"
                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
              >
                <span className="truncate">{selectedTime}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </Button>
            </motion.div>
            
            {showTimeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                {timeOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedTime(option)
                      setShowTimeDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedTime === option ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant="outline" onClick={onClearFilters}>
              Clear Filters
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
