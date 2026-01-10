"use client"

import { useRouter } from "next/navigation"
// import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useEffect, useState } from "react"
import { CheckCircle, Home, X } from "lucide-react"

export default function ThankYouPage() {
  // const params = useParams<{ id: string }>()
  const router = useRouter()
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({})
  const [completionTime, setCompletionTime] = useState<string>("")
  // const [studyName, setStudyName] = useState<string>("")
  const [responseId, setResponseId] = useState<string>("")
  const [isHydrated, setIsHydrated] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    // Mark as hydrated to prevent hydration mismatches
    setIsHydrated(true)

    // Get response times from localStorage
    const times = localStorage.getItem('study_response_times')
    if (times) {
      setResponseTimes(JSON.parse(times))
    }

    // Get study name from create-study steps (preview mode)
    // const step1 = JSON.parse(localStorage.getItem('cs_step1') || '{}')
    // setStudyName(step1?.title || 'Study')

    // Set completion time
    const now = new Date()
    const formattedTime = now.toLocaleString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    setCompletionTime(formattedTime)

    // Generate a lightweight preview response id (not stored)
    try { setResponseId(Math.random().toString(36).substring(2, 8).toUpperCase()) } catch { }

    // If redirected id exists, schedule redirect 2s after thank-you shows
    try {
      const rid = localStorage.getItem('redirect_rid')
      if (rid) {
        setRedirecting(true)
        setCountdown(3)
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null) return null
            if (prev <= 1) {
              clearInterval(interval)
              try { localStorage.removeItem('redirect_rid') } catch { }
              const cintRid = encodeURIComponent(rid)
              window.location.href = `https://notch.insights.supply/cb?token=446a1929-7cfa-4ee3-9778-a9e9dae498ac&RID=${cintRid}`
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch { }
  }, [])

  const handleReturnHome = () => {
    router.push('/')
  }

  const handleCloseTab = () => {
    window.close()
  }

  const totalTasks = (() => {
    try {
      const matrixRaw = localStorage.getItem('cs_step7_matrix')
      if (!matrixRaw) return Object.keys(responseTimes).length

      const matrix = JSON.parse(matrixRaw)

      // Extract tasks array from matrix (similar logic to tasks page)
      let tasksArray: any[] = []
      if (Array.isArray(matrix)) {
        tasksArray = matrix
      } else if (matrix && typeof matrix === 'object') {
        if (Array.isArray(matrix.preview_tasks)) {
          tasksArray = matrix.preview_tasks
        } else if (Array.isArray(matrix.tasks)) {
          tasksArray = matrix.tasks
        } else if (matrix.tasks && typeof matrix.tasks === 'object') {
          const buckets = matrix.tasks as Record<string, any>
          // Try bucket "0" first
          if (Array.isArray(buckets["0"]) && buckets["0"].length) {
            tasksArray = buckets["0"]
          } else {
            // Try first available bucket
            for (const v of Object.values(buckets)) {
              if (Array.isArray(v) && v.length) {
                tasksArray = v
                break
              }
            }
          }
        }
      }

      return tasksArray.length || Object.keys(responseTimes).length
    } catch {
      return Object.keys(responseTimes).length
    }
  })()

  // Show loading state until hydrated to prevent hydration mismatches
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50">

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
          <div className="bg-white border rounded-xl shadow-sm p-6 sm:p-8 lg:p-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:h-screen bg-gray-50 lg:overflow-hidden">

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-8 lg:pb-4 lg:h-full lg:flex lg:flex-col lg:justify-center">
        <div className="bg-white border rounded-xl shadow-sm p-4 sm:p-6 lg:p-8">
          {/* Completion Header */}
          <div className="text-center mb-4 lg:mb-6">
            <div className="flex justify-center mb-2 lg:mb-3">
              <CheckCircle className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-green-500" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
              Study Completed!
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Thank you for participating in our research study.
            </p>
          </div>

          {/* Your Response Has Been Recorded */}
          <div className="mb-4 lg:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              Your Response Has Been Recorded
            </h2>
            <ul className="space-y-1 text-xs sm:text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span>
                  We have successfully received your responses. Your participation is greatly appreciated.
                </span>
              </li>
              {redirecting && (
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  <span className="font-medium text-blue-700">
                    Redirecting in {countdown ?? 3}...
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Response Summary */}
          <div className="mb-4 lg:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
              Response Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-blue-100 rounded-full px-4 py-2 text-center">
                <div className="text-xs text-blue-600 font-medium">Response ID</div>
                <div className="text-sm font-semibold text-blue-800">{responseId}</div>
              </div>
              <div className="bg-blue-100 rounded-full px-4 py-2 text-center">
                <div className="text-xs text-blue-600 font-medium">Completed At</div>
                <div className="text-sm font-semibold text-blue-800">{completionTime}</div>
              </div>
              <div className="bg-blue-100 rounded-full px-4 py-2 text-center">
                <div className="text-xs text-blue-600 font-medium">Tasks Completed</div>
                <div className="text-sm font-semibold text-blue-800">{totalTasks}</div>
              </div>
            </div>
          </div>

          {/* Important Information */}
          <div className="mb-4 lg:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              Important Information
            </h2>
            <ul className="space-y-1 text-xs sm:text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span><span className="font-semibold">Anonymous:</span> Your responses are completely anonymous.</span>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span><span className="font-semibold">Data Usage:</span> Used only for research purposes.</span>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span><span className="font-semibold">No Personal Info:</span> We do not collect personally identifiable information.</span>
              </li>
            </ul>
          </div>

          {/* What Happens Next? */}
          <div className="mb-4 lg:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              What Happens Next?
            </h2>
            <p className="text-xs sm:text-sm text-gray-700">
              You can now close this browser tab. Your responses have been securely stored.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center">
            <button
              onClick={handleCloseTab}
              className="flex items-center justify-center gap-2 px-6 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Close Tab
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
