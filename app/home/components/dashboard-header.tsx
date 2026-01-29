"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronDown, Plus, LogOut, Share2 } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ShareStudyModal } from "@/components/create-study/ShareStudyModal"

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [studyId, setStudyId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('admin')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isCreateStudyRoute = pathname?.startsWith('/home/create-study')

  // Effect to track cs_study_id and user_role in localStorage
  useEffect(() => {
    const checkStudyInfo = () => {
      const storedId = localStorage.getItem('cs_study_id')
      const role = localStorage.getItem('user_role')

      if (role) setUserRole(role)

      if (storedId) {
        // Handle both plain string and JSON-stringified format
        try {
          const parsed = JSON.parse(storedId)
          if (typeof parsed === 'string') {
            setStudyId(parsed)
          } else {
            setStudyId(storedId)
          }
        } catch {
          setStudyId(storedId)
        }
      } else {
        setStudyId(null)
      }
    }

    // Check periodically since Step 1 might update it
    const interval = setInterval(checkStudyInfo, 1000)
    checkStudyInfo() // Initial check

    return () => clearInterval(interval)
  }, [])

  const handleCreateNewStudy = () => {
    // Clear all create-study related localStorage items to start fresh from Step 1
    const keysToRemove = [
      'cs_step1',
      'cs_step2',
      'cs_step3',
      'cs_step4',
      'cs_step5_grid',
      'cs_step5_text',
      'cs_step5_hybrid',
      'cs_step5_hybrid_grid',
      'cs_step5_hybrid_text',
      'cs_step5_hybrid_phase_order',
      'cs_step5_layer',
      'cs_step5_layer_background',
      'cs_step5_layer_preview_aspect',
      'cs_step6',
      'cs_step7_tasks',
      'cs_step7_matrix',
      'cs_step7_job_state',
      'cs_step7_timer_state',
      'cs_current_step',
      'cs_backup_steps',
      'cs_flash_message',
      'cs_resuming_draft',
      'cs_study_id',
      'cs_is_fresh_start',
      'cs_step8',
      'user_role'
    ]

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch { }
    })

    // Also clear sessionStorage to remove study tracking
    try {
      sessionStorage.removeItem('cs_previous_study_id')
    } catch { }

    // Set flag to indicate this is a fresh start (no resuming)
    try {
      localStorage.setItem('cs_is_fresh_start', 'true')
    } catch { }

    // Navigate to create-study page
    router.push('/home/create-study')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white border-b border-[rgba(209,223,235,1)] px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">

          <Link href="/home">
            {/* Logo */}
            <div className="flex items-center">
              <motion.div whileHover={{ scale: 1.05 }} className="text-2xl font-bold">
                <span className="text-green-600">Mind</span>
                <span className="text-gray-800">Surve</span>
              </motion.div>
            </div>

          </Link>


          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Share Button (Create Study Route Only) */}
            {isCreateStudyRoute && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mr-2"
              >
                <Button
                  onClick={() => setIsShareModalOpen(true)}
                  disabled={!studyId || (userRole !== 'admin' && userRole !== 'editor')}
                  variant="outline"
                  className={`${studyId && (userRole === 'admin' || userRole === 'editor')
                    ? "border-blue-200 text-blue-600 hover:bg-blue-50"
                    : "opacity-50 cursor-not-allowed text-gray-400 border-gray-200"
                    } px-4 py-2 rounded-lg flex items-center space-x-2 transition-all`}
                  title={(userRole !== 'admin' && userRole !== 'editor') ? "Only admins and editors can share the study" : "Share study"}
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </motion.div>
            )}

            {!isCreateStudyRoute && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleCreateNewStudy}
                  className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline cursor-pointer">Create New Study</span>
                  <span className="sm:hidden cursor-pointer">Create</span>
                </Button>
              </motion.div>
            )}

            <div className="relative" ref={dropdownRef}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src="/professional-headshot.png" />
                  <AvatarFallback>
                    {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium text-gray-700">
                  {user?.name || 'User'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </motion.div>

              {/* Dropdown Menu */}
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-50 bg-white rounded-md shadow-lg border border-gray-200 z-100"
                >
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium">{user?.name || 'User'}</div>
                      <div className="text-gray-500 break-all whitespace-normal">{user?.email || ''}</div>
                    </div>
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        logout()
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Share Modal */}
      {studyId && (
        <ShareStudyModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          studyId={studyId}
          userRole={userRole}
        />
      )}
    </>
  )
}
