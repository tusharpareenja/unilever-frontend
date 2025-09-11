"use client"

import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useState } from "react"

export default function ClassificationQuestionsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  // Sample questions - in real app, these would come from the study data
  const [questions, setQuestions] = useState([
    {
      id: 1,
      text: "Question 1",
      options: [
        { id: "q1_opt1", text: "Option 1" },
        { id: "q1_opt2", text: "Option 2" }
      ],
      selected: "q1_opt1"
    },
    {
      id: 2,
      text: "Question 2", 
      options: [
        { id: "q2_opt1", text: "Option 1" },
        { id: "q2_opt2", text: "Option 2" }
      ],
      selected: "q2_opt2"
    }
  ])

  const handleOptionSelect = (questionId: number, optionId: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, selected: optionId } : q
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Classification Questions</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please answer the following questions to help us understand your preferences and background.
        </p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6 lg:p-8">
          <div className="text-right text-xs text-gray-500">2 / 4</div>

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
              onClick={() => router.push(`/participate/${params?.id}/tasks`)}
              className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white text-sm transition-colors"
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
      className={`w-full h-11 rounded-md border text-sm transition-colors ${
        active 
          ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]" 
          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  )
}
