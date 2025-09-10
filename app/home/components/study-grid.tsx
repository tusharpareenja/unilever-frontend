"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Calendar, Share2, Eye } from "lucide-react"

const studies = [
  {
    id: 1,
    title: "Tea Cups",
    date: "27 May 2025 - 8:30pm",
    description: "this is to see what type...",
    status: "Active",
    layout: "Grid",
    totalResponse: 97.5,
    completed: 87.5,
  },
  {
    id: 2,
    title: "Tea Cups",
    date: "27 May 2025 - 8:30pm",
    description: "this is to see what type...",
    status: "Active",
    layout: "Layer",
    totalResponse: 97.5,
    completed: 87.5,
  },
  {
    id: 3,
    title: "Tea Cups",
    date: "27 May 2025 - 8:30pm",
    description: "this is to see what type...",
    status: "Active",
    layout: "Grid",
    totalResponse: 97.5,
    completed: 87.5,
  },
  {
    id: 4,
    title: "Tea Cups",
    date: "27 May 2025 - 8:30pm",
    description: "this is to see what type...",
    status: "Active",
    layout: "Layer",
    totalResponse: 97.5,
    completed: 87.5,
  },
  {
    id: 5,
    title: "Tea Cups",
    date: "27 May 2025 - 8:30pm",
    description: "this is to see what type...",
    status: "Active",
    layout: "Grid",
    totalResponse: 97.5,
    completed: 87.5,
  },
  {
    id: 6,
    title: "Tea Cups",
    date: "27 May 2025 - 8:30pm",
    description: "this is to see what type...",
    status: "Active",
    layout: "Layer",
    totalResponse: 97.5,
    completed: 87.5,
  },
]

export function StudyGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {studies.map((study, index) => (
        <motion.div
          key={study.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className={`bg-white rounded-lg shadow-sm border-2 p-6 ${
            study.id === 5 ? "border-[rgba(38,116,186,0.6)]" : "border-[rgba(209,223,235,1)]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 text-sm font-medium">{study.status}</span>
              <span className="text-[rgba(38,116,186,1)] text-sm font-medium">{study.layout}</span>
            </div>
          </div>

          {/* Title and Date */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{study.title}</h3>
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            {study.date}
          </div>
          <p className="text-sm text-gray-600 mb-4">{study.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* First row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded-full flex items-center justify-center text-white text-xs font-medium">
                  3
                </div>
                <span className="text-sm text-gray-600">Total Response</span>
              </div>
              <div className="bg-[rgba(38,116,186,1)] text-white px-3 py-1 rounded text-sm font-medium">
                {study.totalResponse}%
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded-full flex items-center justify-center text-white text-xs font-medium">
                  2
                </div>
                <span className="text-sm text-gray-600">Completed</span>
              </div>
              <div className="bg-[rgba(38,116,186,1)] text-white px-3 py-1 rounded text-sm font-medium">
                {study.completed}%
              </div>
            </div>

            {/* Second row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded-full flex items-center justify-center text-white text-xs font-medium">
                  3
                </div>
                <span className="text-sm text-gray-600">Total Response</span>
              </div>
              <div className="bg-[rgba(38,116,186,1)] text-white px-3 py-1 rounded text-sm font-medium">
                {study.totalResponse}%
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[rgba(38,116,186,1)] rounded-full flex items-center justify-center text-white text-xs font-medium">
                  2
                </div>
                <span className="text-sm text-gray-600">Completed</span>
              </div>
              <div className="bg-[rgba(38,116,186,1)] text-white px-3 py-1 rounded text-sm font-medium">
                {study.completed}%
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-6 py-2 rounded-lg flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>View Details</span>
              </Button>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
