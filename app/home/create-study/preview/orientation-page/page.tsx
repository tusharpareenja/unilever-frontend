"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"

export default function OrientationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [isChecked, setIsChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orientationText, setOrientationText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const orientationStartRef = useRef<number>(Date.now())

  useEffect(() => {
    // Load orientation text from localStorage (preview mode)
    try {
      // Try to get orientation text from step2 (study creation)
      const step2Data = localStorage.getItem('cs_step2')
      if (step2Data) {
        const step2 = JSON.parse(step2Data)
        const text = step2?.orientationText || step2?.orientation_text || ""
        setOrientationText(text)
      }
    } catch (error) {
      console.error('Error loading orientation text:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleStartSurvey = async () => {
    if (!isChecked) return

    setIsSubmitting(true)

    // Navigate to tasks page (preview mode)
    setTimeout(() => {
      router.push(`/home/create-study/preview/tasks`)
    }, 500)
  }

  useEffect(() => {
    // Initialize orientation page start time
    orientationStartRef.current = Date.now()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        {/* Header Section */}
        <div className="text-center mb-8">
          {/* <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div> */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Study Orientation</h1>
          <p className="text-gray-600 text-lg">Please read the instructions carefully before proceeding</p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Study Instructions Section */}
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              {/* <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div> */}
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Study Instructions</h2>
                <div className="prose prose-gray max-w-none">
                  {orientationText ? (
                    <div className="text-black font-bold leading-relaxed whitespace-pre-wrap text-base">
                      {orientationText}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-gray-700 leading-relaxed text-base">
                        Thank you for participating in this study. This research aims to understand your preferences and opinions about various visual elements. Your participation is voluntary and your responses will be kept completely anonymous.
                      </p>
                      <p className="text-gray-700 leading-relaxed text-base">
                        During this study, you will be shown different combinations of visual elements and asked to rate them using a scale. There are no right or wrong answers - we simply want to understand your honest opinions and preferences.
                      </p>
                      <p className="text-gray-700 leading-relaxed text-base">
                        Please complete the study in one session and take your time to provide thoughtful responses. The study should take approximately 10-15 minutes to complete.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100"></div>

          {/* Checkbox Section */}
          <div className="p-6 sm:p-8 bg-gray-50">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  id="understand-checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="understand-checkbox" className="text-gray-700 cursor-pointer text-base leading-relaxed">
                  <span className="font-medium">I understood the instructions, and I am ready to take the survey</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Section */}
          <div className="p-6 sm:p-8 bg-white">
            <div className="flex justify-center">
              <button
                onClick={handleStartSurvey}
                disabled={!isChecked || isSubmitting}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Starting Survey...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>Start Survey</span>
                    <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Your responses are confidential and will be used for research purposes only.
          </p>
        </div>
      </div>
    </div>
  )
}
