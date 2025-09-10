"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { FileText, Activity, Edit, Plus } from "lucide-react"

const stats = [
  { title: "Total Studies", count: "120", icon: FileText, color: "bg-[rgba(38,116,186,1)]", textColor: "text-white" },
  {
    title: "Active Studies",
    count: "120",
    icon: Activity,
    color: "bg-[rgba(209,223,235,1)]",
    textColor: "text-gray-800",
  },
  { title: "Draft Studies", count: "120", icon: Edit, color: "bg-[rgba(209,223,235,1)]", textColor: "text-gray-800" },
  { title: "Draft Studies", count: "120", icon: Edit, color: "bg-[rgba(209,223,235,1)]", textColor: "text-gray-800" },
]

export function OverviewCards() {
  return (
    <div className="mb-8 ">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">Overviews</h1>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-2 rounded-lg flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create New Study</span>
          </Button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
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
                <p className="text-3xl font-bold mt-1">{stat.count}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.textColor === "text-white" ? "opacity-80" : "opacity-60"}`} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
