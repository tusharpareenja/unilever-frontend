"use client"

import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useEffect, useState } from "react"
import { CheckCircle, Home, X } from "lucide-react"

export default function ThankYouPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({})
  const [completionTime, setCompletionTime] = useState<string>("")

  useEffect(() => {
    // Get response times from localStorage
    const times = localStorage.getItem('study_response_times')
    if (times) {
      setResponseTimes(JSON.parse(times))
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

    // Generate a simple response ID
    const responseId = Math.random().toString(36).substring(2, 8).toUpperCase()
    localStorage.setItem('study_response_id', responseId)
  }, [])

  const handleReturnHome = () => {
    router.push('/')
  }

  const handleCloseTab = () => {
    window.close()
  }

  const responseId = typeof window !== 'undefined' ? localStorage.getItem('study_response_id') || 'De13e0b' : 'De13e0b'
  const totalTasks = Object.keys(responseTimes).length

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <div className="bg-white border rounded-xl shadow-sm p-6 sm:p-8 lg:p-10">
          {/* Completion Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 sm:h-20 sm:w-20 text-green-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              Study Completed!
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Thank you for participating in our research study.
            </p>
          </div>

          {/* Your Response Has Been Recorded */}
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">
              Your Response Has Been Recorded
            </h2>
            <ul className="space-y-2 text-sm sm:text-base text-gray-700">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span>
                  We have successfully received your responses for the study "aaaaaaaa". 
                  Your participation is greatly appreciated and will contribute valuable insights to our research.
                </span>
              </li>
            </ul>
          </div>

          {/* Response Summary */}
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Response Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-blue-100 rounded-full px-4 py-2">
                <div className="text-xs text-blue-600 font-medium">Response ID</div>
                <div className="text-sm font-semibold text-blue-800">{responseId}</div>
              </div>
              <div className="bg-blue-100 rounded-full px-4 py-2">
                <div className="text-xs text-blue-600 font-medium">Completed At</div>
                <div className="text-sm font-semibold text-blue-800">{completionTime}</div>
              </div>
              <div className="bg-blue-100 rounded-full px-4 py-2">
                <div className="text-xs text-blue-600 font-medium">Tasks Completed</div>
                <div className="text-sm font-semibold text-blue-800">{totalTasks}</div>
              </div>
            </div>
          </div>

          {/* Important Information */}
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Important Information
            </h2>
            <ul className="space-y-3 text-sm sm:text-base text-gray-700">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <div>
                  <span className="font-semibold">Anonymous Response:</span> Your responses are completely anonymous and cannot be traced back to you.
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <div>
                  <span className="font-semibold">Data Usage:</span> Your data will be used only for research purposes and in accordance with our privacy policy.
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <div>
                  <span className="font-semibold">No Personal Information:</span> We do not collect any personally identifiable information.
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <div>
                  <span className="font-semibold">Research Impact:</span> Your participation helps advance our understanding in this field.
                </div>
              </li>
            </ul>
          </div>

          {/* What Happens Next? */}
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              What Happens Next?
            </h2>
            <ul className="space-y-2 text-sm sm:text-base text-gray-700">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span>
                  You can now close this browser tab. Your responses have been securely stored and will be analyzed as part of our research study. If you have any questions about this study, please contact our research team.
                </span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button
              onClick={handleReturnHome}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Home className="h-4 w-4" />
              Return to home
            </button>
            <button
              onClick={handleCloseTab}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
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
