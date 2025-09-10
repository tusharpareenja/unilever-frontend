"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ChevronDown } from "lucide-react"

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
}

const tabs = [
  { name: "All Studies", count: null },
  { name: "Active Studies", count: 2 },
  { name: "Draft Studies", count: null },
  { name: "Complete", count: null },
]

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
}: StudyFiltersProps) {
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
            {tab.count && (
              <span className="ml-2 bg-[rgba(38,116,186,1)] text-white text-xs px-2 py-1 rounded-full">
                {tab.count}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search Studies By Title, Type And Descriptions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full"
          />
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-1 text-sm">
              Search
            </Button>
          </motion.div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <motion.div whileHover={{ scale: 1.02 }}>
            <Button variant="outline" className="flex items-center space-x-1 bg-transparent">
              <span>{selectedType}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }}>
            <Button variant="outline" className="flex items-center space-x-1 bg-transparent">
              <span>{selectedTime}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </motion.div>

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
