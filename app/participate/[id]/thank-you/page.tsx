"use client"

import { useRouter } from "next/navigation"
// import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useEffect, useRef, useState } from "react"
import { CheckCircle, X } from "lucide-react"
import { imageCacheManager } from "@/lib/utils/imageCacheManager"
import { checkIsSpecialCreator } from "@/lib/config/specialCreators"
import { API_BASE_URL } from "@/lib/api/LoginApi"
import {
  clearParticipateProjectReturn,
  readParticipateProjectReturn,
} from "@/lib/participate/projectReturnUrl"
import { clearMergeState } from "@/lib/config/mergedStudies"

export default function ThankYouPage() {
  const router = useRouter()
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({})
  const [completionTime, setCompletionTime] = useState<string>("")

  const [isHydrated, setIsHydrated] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [totalTasks, setTotalTasks] = useState<number>(0)
  const [isSpecialCreatorStudy, setIsSpecialCreatorStudy] = useState(false)
  const [restartCountdown, setRestartCountdown] = useState<number | null>(null)
  const [currentStudyId, setCurrentStudyId] = useState<string>("")

  const completedStorageProcessedRef = useRef(false)

  useEffect(() => {
    // Mark as hydrated to prevent hydration mismatches
    setIsHydrated(true)

    // Get study ID from URL
    const pathParts = window.location.pathname.split('/')
    const studyId = pathParts[pathParts.indexOf('participate') + 1]
    setCurrentStudyId(studyId)

    try {
      const queryKeys = ['rid', 'frid', 'firid', 'RID', 'FRID', 'FIRID']
      const urlParams = new URLSearchParams(window.location.search)
      const ridFromQuery = queryKeys
        .map((key) => urlParams.get(key))
        .find((value) => !!value)

      if (ridFromQuery) {
        localStorage.setItem('redirect_rid', ridFromQuery)
      }
    } catch (error) {
      console.error('Error capturing redirect query parameter:', error)
    }

    // For studies created by special creators: do not store in completed_studies so participants can go back.
    // Run only once so we don't double-store if effect runs again (e.g. Strict Mode) after removing the flag.
    let specialCreatorStudy = false
    try {
      const skipStorageFlag = localStorage.getItem('current_study_skip_completed_storage')
      if (skipStorageFlag === studyId) {
        specialCreatorStudy = true
      } else {
        // Fallback: if flag was cleared before we ran (e.g. by another tab or navigation), check creator from storage before we remove it
        const creatorEmail =
          localStorage.getItem('current_study_creator_email') ||
          (() => {
            try {
              const raw = localStorage.getItem('current_study_details')
              const d = raw ? JSON.parse(raw) : {}
              return d?.study_info?.creator_email || ''
            } catch { return '' }
          })()
        specialCreatorStudy = checkIsSpecialCreator(creatorEmail)
      }

      setIsSpecialCreatorStudy(specialCreatorStudy)

      if (!completedStorageProcessedRef.current) {
        completedStorageProcessedRef.current = true

        if (specialCreatorStudy) {
          localStorage.removeItem('current_study_skip_completed_storage')
        }
        
        // COMMENTED OUT: For now, allow users to retake the study (do not store in completed_studies)
        // if (!specialCreatorStudy) {
        //   const completedStudies = JSON.parse(localStorage.getItem('completed_studies') || '{}')
        //   completedStudies[studyId] = {
        //     completedAt: new Date().toISOString(),
        //     responseId: Math.random().toString(36).substring(2, 8).toUpperCase()
        //   }
        //   localStorage.setItem('completed_studies', JSON.stringify(completedStudies))
        // }
        
        localStorage.removeItem('current_study_creator_email')
      }
    } catch (error) {
      console.error('Error marking study as completed:', error)
    }

    // Clear merge-related localStorage items
    try {
      clearMergeState()
      localStorage.removeItem('current_panelist_id')
    } catch {
      // Best effort cleanup
    }

    // Clear image cache on thank-you page
    imageCacheManager.clearCache()


    // Background: attempt to flush any remaining queued task submissions (non-blocking)
    const flushOnce = async () => {
      try {
        const sessionRaw = localStorage.getItem('study_session')
        const queueRaw = localStorage.getItem('task_submit_queue')
        if (!sessionRaw || !queueRaw) return
        const { sessionId } = JSON.parse(sessionRaw)
        const q: unknown[] = JSON.parse(queueRaw)
        if (!sessionId || !Array.isArray(q) || q.length === 0) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tasks = q.map((it: any) => ({
          task_id: it.task_id,
          rating_given: it.rating_given,
          task_duration_seconds: it.task_duration_seconds,
          element_interactions: Array.isArray(it.element_interactions) ? it.element_interactions.slice(0, 10) : [],
          elements_shown_in_task: it.elements_shown_in_task || undefined,
          elements_shown_content: it.elements_shown_content || undefined,
        }))

        const base = API_BASE_URL?.replace(/\/$/, "")
        if (!base) return
        const url = `${base}/responses/submit-tasks-bulk?session_id=${encodeURIComponent(String(sessionId))}`
        const data = JSON.stringify({ tasks })

        // Try sendBeacon first
        let sent = false
        try {
          if (navigator.sendBeacon) {
            sent = navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }))
          }
        } catch { }

        if (!sent) {
          const controller = new AbortController()
          const timeout = window.setTimeout(() => controller.abort(), 12000)
          try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true, signal: controller.signal })
            if (res.ok) sent = true
          } catch { }
          window.clearTimeout(timeout)
        }

        if (sent) {
          try { localStorage.removeItem('task_submit_queue') } catch { }
        }
      } catch { }
    }

    // Run one flush immediately and a few retries for a short window
    flushOnce()
    const flushInterval = window.setInterval(flushOnce, 3000)
    const timeoutStop = window.setTimeout(() => { try { window.clearInterval(flushInterval) } catch { } }, 15000)

    // Get response times from localStorage
    const times = localStorage.getItem('study_response_times')
    if (times) {
      setResponseTimes(JSON.parse(times))
    }

    // Get study name from localStorage
    const studyDetails = localStorage.getItem('current_study_details')
    if (studyDetails) {
      try {
        // const parsed = JSON.parse(studyDetails)
        // setStudyName(parsed.title || 'Study')
      } catch (error) {
        console.error('Error parsing study details:', error)
        // setStudyName('Study')
      }
    } else {
      // setStudyName('Study')
    }

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

    // Get total tasks from study_session
    try {
      const sessionRaw = localStorage.getItem('study_session')
      if (sessionRaw) {
        const { totalTasks: count } = JSON.parse(sessionRaw)
        if (typeof count === 'number') {
          setTotalTasks(count)
        }
      }
    } catch { }

    // Post-completion redirect: only automatic for rid (panel) redirects
    // Project return URL redirects are manual (via Close Tab button)
    let ridInterval: ReturnType<typeof setInterval> | undefined
    try {
      const rid = localStorage.getItem('redirect_rid')
      console.log('Thank you page - checking for rid:', rid) // Debug log
      if (rid) {
        console.log('Found rid in localStorage, setting up redirect:', rid) // Debug log
        setRedirecting(true)
        setCountdown(3)
        ridInterval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null) return null
            if (prev <= 1) {
              clearInterval(ridInterval)
              try { localStorage.removeItem('redirect_rid') } catch { }
              const cintRid = encodeURIComponent(rid)
              console.log('Redirecting to:', `https://notch.insights.supply/cb?token=446a1929-7cfa-4ee3-9778-a9e9dae498ac&RID=${cintRid}`) // Debug log
              window.location.href = `https://notch.insights.supply/cb?token=446a1929-7cfa-4ee3-9778-a9e9dae498ac&RID=${cintRid}`
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        console.log('No rid found in localStorage') // Debug log
        // Project return URL redirect is now manual only (via Close Tab button)
        // No automatic redirect for project return or default study intro
      }
    } catch (error) {
      console.error('Error handling post-thank-you redirect:', error)
    }
    
    const handlePopState = (event: PopStateEvent) => {
      // If user tries to go back using browser back button, redirect to thank you page
      event.preventDefault()
      router.push(`/participate/${studyId}/thank-you`)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      try {
        window.clearInterval(flushInterval);
        window.clearTimeout(timeoutStop);
        if (ridInterval) window.clearInterval(ridInterval);
        window.removeEventListener('popstate', handlePopState);
      } catch { }
    }
  }, [router])

  // Auto-redirect for special creator studies - 5 seconds countdown to restart study
  useEffect(() => {
    if (!isHydrated || !isSpecialCreatorStudy || !currentStudyId) return
    
    // Don't start restart countdown if there's already a rid redirect or return-to-project URL
    const rid = localStorage.getItem('redirect_rid')
    if (rid) return
    if (readParticipateProjectReturn(currentStudyId)) return

    setRestartCountdown(5)
    const restartInterval = setInterval(() => {
      setRestartCountdown((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(restartInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(restartInterval)
    }
  }, [isHydrated, isSpecialCreatorStudy, currentStudyId])

  // Separate effect to handle the redirect when countdown reaches 0
  useEffect(() => {
    if (restartCountdown === 0 && isSpecialCreatorStudy && currentStudyId) {
      router.push(`/participate/${currentStudyId}`)
    }
  }, [restartCountdown, isSpecialCreatorStudy, currentStudyId, router])

  const handleCloseTab = () => {
    const projectUrl = currentStudyId ? readParticipateProjectReturn(currentStudyId) : null
    if (projectUrl) {
      clearParticipateProjectReturn()
      window.location.href = projectUrl
      return
    }

    // For special creator studies, redirect back to the beginning of the study
    if (isSpecialCreatorStudy && currentStudyId) {
      router.push(`/participate/${currentStudyId}`)
      return
    }

    // Browsers may block closing tabs not opened by script, so redirect if it stays open.
    window.close()
    window.setTimeout(() => {
      window.location.href = 'https://www.google.com'
    }, 300)
  }

  // No longer use responseTimes for total count as it might be volatile
  // const totalTasks = Object.keys(responseTimes).length

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
              {isSpecialCreatorStudy && !redirecting && restartCountdown !== null && restartCountdown > 0 && (
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  <span className="font-medium text-green-700">
                    Restarting study in {restartCountdown} seconds...
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
