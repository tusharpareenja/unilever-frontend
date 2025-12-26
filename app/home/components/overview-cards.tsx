"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { FileText, Activity, Edit, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

interface Stats {
  total: number
  active: number
  draft: number
  completed: number
}

interface OverviewCardsProps {
  stats: Stats
  loading: boolean
}

export function OverviewCards({ stats, loading }: OverviewCardsProps) {
  const router = useRouter()

  const handleCreateStudy = () => {
    router.push('/home/create-study')
  }

  const cardsData = [
    {
      title: "Total Studies",
      count: stats.total,
      icon: FileText,
      color: stats.total > 0 ? "bg-[rgba(38,116,186,1)]" : "bg-gray-100",
      textColor: stats.total > 0 ? "text-white" : "text-gray-500"
    },
    {
      title: "Active Studies",
      count: stats.active,
      icon: Activity,
      color: stats.active > 0 ? "bg-green-100" : "bg-[rgba(209,223,235,1)]",
      textColor: stats.active > 0 ? "text-green-800" : "text-gray-800",
    },
    {
      title: "Draft Studies",
      count: stats.draft,
      icon: Edit,
      color: stats.draft > 0 ? "bg-yellow-100" : "bg-[rgba(209,223,235,1)]",
      textColor: stats.draft > 0 ? "text-yellow-800" : "text-gray-800"
    },
    {
      title: "Completed Studies",
      count: stats.completed,
      icon: Edit,
      color: stats.completed > 0 ? "bg-blue-100" : "bg-[rgba(209,223,235,1)]",
      textColor: stats.completed > 0 ? "text-blue-800" : "text-gray-800"
    },
  ]
  return (
    <div className="mb-8 ">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Overviews</h1>
          {!loading && stats.total === 0 && (
            <p className="text-sm text-gray-500">Get started by creating your first study</p>
          )}
        </div>
        {/* <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button 
            onClick={handleCreateStudy}
            className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span className="cursor-pointer">{stats.total === 0 ? 'Create Your First Study' : 'Create New Study'}</span>
          </Button>
        </motion.div> */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardsData.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`${stat.color} ${stat.textColor} p-6 rounded-lg shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${stat.textColor === "text-white" ? "opacity-90" : "opacity-70"}`}>
                  {stat.title}
                </p>
                <div className="text-3xl font-bold mt-1">
                  {loading ? (
                    <div className="animate-pulse bg-gray-300 h-8 w-16 rounded"></div>
                  ) : (
                    stat.count
                  )}
                </div>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.textColor === "text-white" ? "opacity-80" : "opacity-60"}`} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
