"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { submitClassificationAnswers } from "@/lib/api/ResponseAPI"
import { FRAGRANCE_QUESTION_ID, FRAGRANCE_QUESTION_TEXT } from "@/lib/config/specialCreators"
import { MERGE_STORAGE_KEYS } from "@/lib/config/mergedStudies"

export default function FragranceLikePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<"Yes" | "No" | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [guardChecked, setGuardChecked] = useState(false)

  useEffect(() => {
    // Check for pending merge transition recovery
    // If we successfully arrived at this page from a merge transition, clear the pending flag
    try {
      const pendingTransition = localStorage.getItem(MERGE_STORAGE_KEYS.MERGE_PENDING_TRANSITION)
      if (pendingTransition && pendingTransition === params.id) {
        // Successfully arrived at second study - clear the pending flag
        localStorage.removeItem(MERGE_STORAGE_KEYS.MERGE_PENDING_TRANSITION)
        console.log('[MergedStudy] Successfully transitioned to second study:', params.id)
      }
    } catch (e) {
      console.warn('Failed to check merge transition state:', e)
    }
    
    try {
      const completedStudies = JSON.parse(localStorage.getItem("completed_studies") || "{}")
      if (completedStudies[params.id]) {
        router.push(`/participate/${params.id}/thank-you`)
        return
      }
    } catch { }

    try {
      const s = localStorage.getItem("study_session")
      if (s) {
        const { sessionId: sid } = JSON.parse(s)
        if (sid) setSessionId(sid)
      }
    } catch { }
    setGuardChecked(true)
  }, [params.id, router])

  const handleContinue = async () => {
    if (selected === null || !sessionId) return
    setIsSubmitting(true)
    try {
      await submitClassificationAnswers(sessionId, {
        answers: [
          {
            question_id: FRAGRANCE_QUESTION_ID,
            question_text: FRAGRANCE_QUESTION_TEXT,
            answer: selected,
            answer_timestamp: new Date().toISOString(),
            time_spent_seconds: 0,
          },
        ],
      })
      const existing = JSON.parse(localStorage.getItem("classification_answers") || "{}")
      existing[FRAGRANCE_QUESTION_ID] = selected
      localStorage.setItem("classification_answers", JSON.stringify(existing))
      router.push(`/participate/${params?.id}/classification-questions`)
    } catch (e) {
      console.error(e)
      alert("Failed to save. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (!guardChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]" />
      </div>
    )
  }

  if (!sessionId) {
    if (typeof window !== "undefined" && params?.id) {
      router.replace(`/participate/${params.id}`)
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">
          {FRAGRANCE_QUESTION_TEXT}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please select one option and tap Continue.
        </p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setSelected("Yes")}
              className={`min-h-12 rounded-md border text-sm font-medium transition-colors ${
                selected === "Yes"
                  ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setSelected("No")}
              className={`min-h-12 rounded-md border text-sm font-medium transition-colors ${
                selected === "No"
                  ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              No
            </button>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={handleContinue}
              disabled={selected === null || isSubmitting}
              className="inline-flex items-center justify-center px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm transition-colors"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Continuing...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
