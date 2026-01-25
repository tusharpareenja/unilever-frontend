"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

interface ClassificationQuestion {
  id: string
  text: string
  options: Array<{ id: string; text: string }>
  selected: string | null
  required: boolean
}

export default function PreviewClassificationQuestions() {
  const router = useRouter()
  const [questions, setQuestions] = useState<ClassificationQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadQuestions = () => {
      try {
        const raw = localStorage.getItem('cs_step4')
        const arr = raw ? JSON.parse(raw) : []
        let mapped: ClassificationQuestion[] = Array.isArray(arr)
          ? arr.map((q: any) => ({
            id: q.id,
            text: q.title || q.text,
            required: q.required !== false,
            options: (q.options || []).map((o: any) => ({ id: o.id, text: o.text })),
            selected: null
          }))
          : []

        // Shuffle if enabled in localStorage
        const shouldShuffle = localStorage.getItem('cs_step4_shuffle') === 'true'
        if (shouldShuffle) {
          mapped = [...mapped].sort(() => Math.random() - 0.5)
        }

        setQuestions(mapped)
      } catch (error) {
        setQuestions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestions()
  }, [])

  const handleOptionSelect = (questionId: string, optionId: string) => {
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, selected: optionId } : q))
  }

  const handleContinue = () => {
    router.push('/home/create-study/preview/orientation-page')
  }

  const canProceed = questions.every(q => !q.required || q.selected !== null)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Classification Questions</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            No classification questions found for this study.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => router.push('/home/create-study/preview/orientation-page')}
              className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white text-sm"
            >
              Continue to Orientation
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Classification Questions</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please answer the following questions to help us understand your preferences and background.
        </p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6 lg:p-8">
          <div className="mt-2 space-y-8">
            {questions.map((question) => (
              <div key={question.id} className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">
                  {question.text}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {question.options.map((option) => (
                    <Toggle
                      key={option.id}
                      value={option.id}
                      selected={question.selected}
                      onSelect={(value) => handleOptionSelect(question.id, value)}
                      label={option.text}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleContinue}
              disabled={!canProceed}
              className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  value,
  selected,
  onSelect,
  label,
}: {
  value: string
  selected: string | null
  onSelect: (v: string) => void
  label: string
}) {
  const active = selected === value
  return (
    <button
      onClick={() => onSelect(value)}
      className={`w-full min-h-11 py-2.5 px-3 rounded-md border text-sm transition-colors whitespace-normal break-words text-center ${active
          ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]"
          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
        }`}
    >
      {label}
    </button>
  )
}
