"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Calendar, Share2, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { StudyListItem } from "@/lib/api/StudyAPI"
import { format } from "date-fns"

interface StudyGridProps {
  studies: StudyListItem[]
  activeTab: string
  searchQuery: string
  selectedType: string
  selectedTime: string
  loading: boolean
  error: string | null
}

export function StudyGrid({ 
  studies, 
  activeTab, 
  searchQuery, 
  selectedType, 
  selectedTime, 
  loading, 
  error 
}: StudyGridProps) {
  const router = useRouter()

  const handleViewDetails = (studyId: string) => {
    router.push(`/home/study/${studyId}`)
  }

  const handleShare = (studyId: string) => {
    router.push(`/home/study/${studyId}/share`)
  }

  // Filter studies based on active tab, search query, and filters
  const filteredStudies = studies.filter((study) => {
    // Tab filtering
    if (activeTab === "Active Studies" && study.status !== "active") return false
    if (activeTab === "Draft Studies" && study.status !== "draft") return false
    if (activeTab === "Complete" && study.status !== "completed") return false

    // Search filtering
    if (searchQuery && !study.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    // Type filtering
    if (selectedType !== "All Types") {
      if (selectedType === "Grid" && study.study_type !== "grid") return false
      if (selectedType === "Layer" && study.study_type !== "layer") return false
    }

    // Time filtering (simplified - you can implement more sophisticated date filtering)
    if (selectedTime !== "All Time") {
      const studyDate = new Date(study.created_at)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - studyDate.getTime()) / (1000 * 60 * 60 * 24))
      
      switch (selectedTime) {
        case "Last 7 days":
          if (daysDiff > 7) return false
          break
        case "Last 30 days":
          if (daysDiff > 30) return false
          break
        case "Last 3 months":
          if (daysDiff > 90) return false
          break
        case "Last year":
          if (daysDiff > 365) return false
          break
      }
    }

    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600"
      case "draft":
        return "text-yellow-600"
      case "completed":
        return "text-blue-600"
      case "paused":
        return "text-gray-600"
      default:
        return "text-gray-600"
    }
  }

  const getCompletionRate = (study: StudyListItem) => {
    if (study.total_responses === 0) return 0
    return Math.round((study.completed_responses / study.total_responses) * 100)
  }

  const getAbandonmentRate = (study: StudyListItem) => {
    if (study.total_responses === 0) return 0
    return Math.round((study.abandoned_responses / study.total_responses) * 100)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border-2 border-[rgba(209,223,235,1)] p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
              <div className="flex justify-between">
                <div className="h-8 bg-gray-200 rounded w-24"></div>
                <div className="h-8 bg-gray-200 rounded w-8"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error loading studies: {error}</div>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    )
  }

  if (filteredStudies.length === 0) {
    // Check if there are no studies at all vs no studies matching filters
    const hasFilters = searchQuery || selectedType !== "All Types" || selectedTime !== "All Time" || activeTab !== "All Studies"
    
    return (
      <div className="text-center py-12">
        {studies.length === 0 ? (
          // No studies at all
          <div className="max-w-md mx-auto">
            <div className="text-gray-500 mb-4">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Studies Yet</h3>
              <p className="text-sm text-gray-500 mb-6">
                You haven't created any studies yet. Create your first study to get started with research and data collection.
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/home/create-study'}
              className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-6 py-2 rounded-lg"
            >
              Create Your First Study
            </Button>
          </div>
        ) : (
          // Studies exist but don't match filters
          <div className="max-w-md mx-auto">
            <div className="text-gray-500 mb-4">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Studies Found</h3>
              <p className="text-sm text-gray-500 mb-6">
                {hasFilters 
                  ? "No studies match your current filters. Try adjusting your search criteria or clearing the filters."
                  : "No studies found in this category."
                }
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              {hasFilters && (
                <Button 
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2"
                >
                  Clear Filters
                </Button>
              )}
              <Button 
                onClick={() => window.location.href = '/home/create-study'}
                className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-2 rounded-lg"
              >
                Create New Study
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {filteredStudies.map((study, index) => (
        <motion.div
          key={study.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-white rounded-lg shadow-sm border-2 border-[rgba(209,223,235,1)] p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm font-medium ${getStatusColor(study.status)}`}>
              {study.status.charAt(0).toUpperCase() + study.status.slice(1)}
            </span>
            <span className="text-[rgba(38,116,186,1)] text-sm font-medium">
              {study.study_type.charAt(0).toUpperCase() + study.study_type.slice(1)}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{study.title}</h3>
          
          {/* Date */}
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            {format(new Date(study.created_at), 'dd MMM yyyy - h:mm a')}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-4">this is to se what type...</p>

          {/* Three metric cards in a row */}
          <div className="flex gap-4 mb-6">
            {/* Total Response */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded flex items-center justify-center text-white text-xs font-medium">
                {study.total_responses}
              </div>
              <span className="text-sm text-gray-600">Total Response</span>
            </div>

            {/* Completed */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded flex items-center justify-center text-white text-xs font-medium">
                {study.completed_responses}
              </div>
              <span className="text-sm text-gray-600">Completed</span>
            </div>

            {/* Success Rate */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded flex items-center justify-center text-white text-xs font-medium">
                {getCompletionRate(study)}%
              </div>
              <span className="text-sm text-gray-600">Total Response</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={() => handleViewDetails(study.id)}
                className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-6 py-2 rounded-lg flex items-center space-x-2 flex-1 mr-3"
              >
                <Eye className="w-4 h-4" />
                <span>View Details</span>
              </Button>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleShare(study.id)}
              className="w-10 h-10 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] rounded-full flex items-center justify-center transition-colors"
            >
              <Share2 className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
