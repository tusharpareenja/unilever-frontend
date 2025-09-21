"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronDown, Plus, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const isCreateStudyRoute = pathname?.startsWith('/home/create-study')

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
            <span className="text-green-600">Ui</span>
            <span className="text-gray-800">Study</span>
          </motion.div>
        </div>
        
        </Link>
       

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* {showBackToHome && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" className="px-3 py-2 rounded-lg flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <Link href="/home">
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Home</span>
                </Link>
              </Button>
            </motion.div>
          )} */}
          {!isCreateStudyRoute && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/home/create-study">
                <Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  
                  <span className="hidden sm:inline">Create New Study</span>
                  <span className="sm:hidden">Create</span>
                  
                  
                  
                </Button>
              </Link>
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
                className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
              >
                <div className="py-1">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    <div className="font-medium">{user?.name || 'User'}</div>
                    <div className="text-gray-500">{user?.email || ''}</div>
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
  )
}
