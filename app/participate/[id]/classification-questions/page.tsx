"use client"

import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useState, useEffect, useRef } from "react"
import { submitClassificationAnswers } from "@/lib/api/ResponseAPI"

interface ClassificationQuestion {
  id: string
  text: string
  options: Array<{ id: string; text: string }>
  selected: string | null
  required: boolean
}

export default function ClassificationQuestionsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [questions, setQuestions] = useState<ClassificationQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const preloadedUrlsRef = useRef<Set<string>>(new Set())

  // Track time spent on classification page
  const classStartRef = useRef<number>(Date.now())

  // Track time per question; reset when answer submitted
  const questionStartRef = useRef<Record<string, number>>({})

  // Load classification questions from localStorage
  useEffect(() => {
    const loadQuestions = () => {
      try {
        const studyDetails = localStorage.getItem('current_study_details')
        if (studyDetails) {
          const study = JSON.parse(studyDetails)
          if (study.classification_questions && Array.isArray(study.classification_questions)) {
            const formattedQuestions: ClassificationQuestion[] = study.classification_questions.map((q: any) => ({
              id: q.question_id || q.id,
              text: q.question_text || q.text,
              options: q.answer_options?.map((opt: any) => ({ id: opt.id, text: opt.text })) || [],
              selected: null,
              required: q.is_required === "Y" || q.is_required === true || q.is_required === "true"
            }))
            setQuestions(formattedQuestions)
            const timers: Record<string, number> = {}
            formattedQuestions.forEach(q => { timers[q.id] = Date.now() })
            questionStartRef.current = timers
          } else {
            setQuestions([])
          }
        } else {
          setQuestions([])
        }
      } catch (error) {
        console.error('Error loading classification questions:', error)
        setQuestions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestions()
  }, [])

  // Preload first task images while on classification page so tasks render instantly
  useEffect(() => {
    try {
      const detailsRaw = localStorage.getItem('current_study_details')
      const sessionRaw = localStorage.getItem('study_session')
      if (!detailsRaw) return
      const study = JSON.parse(detailsRaw || '{}')
      const { respondentId } = sessionRaw ? JSON.parse(sessionRaw) : { respondentId: 0 }

      const studyInfo = study?.study_info || study
      const assignedTasks = study?.assigned_tasks || []

      let userTasks: any[] = []
      if (Array.isArray(assignedTasks) && assignedTasks.length > 0) {
        userTasks = assignedTasks
      } else {
        const tasksObj = study?.tasks || study?.data?.tasks || study?.task_map || study?.task || {}
        const respondentKey = String(respondentId ?? 0)
        let respondentTasks: any[] = tasksObj?.[respondentKey] || tasksObj?.[Number(respondentKey)] || []
        if (!Array.isArray(respondentTasks) || respondentTasks.length === 0) {
          if (Array.isArray(tasksObj)) {
            respondentTasks = tasksObj
          } else if (tasksObj && typeof tasksObj === 'object') {
            for (const [k, v] of Object.entries(tasksObj)) {
              if (Array.isArray(v) && v.length) { respondentTasks = v as any[]; break }
            }
          }
        }
        userTasks = respondentTasks
      }

      const first = Array.isArray(userTasks) ? userTasks[0] : undefined
      if (!first) return

      const type = (studyInfo?.study_type || study?.study_type || '').toString()

      const urls = new Set<string>()
      if (type === 'layer') {
        const shown = first?.elements_shown || {}
        const content = first?.elements_shown_content || {}
        Object.keys(shown).forEach((k) => {
          if (Number(shown[k]) === 1) {
            const c = content?.[k]
            if (c && typeof c === 'object' && typeof c.url === 'string') urls.add(String(c.url))
          }
        })
      } else {
        const es = first?.elements_shown || {}
        const content = first?.elements_shown_content || {}
        const activeKeys = Object.keys(es).filter((k) => Number(es[k]) === 1)
        const getUrlForKey = (k: string): string | undefined => {
          const directUrl = (es as any)[`${k}_content`]
          if (typeof directUrl === 'string' && directUrl) return directUrl
          const c1: any = (content as any)[k]
          if (c1 && typeof c1 === 'object' && typeof c1.url === 'string') return c1.url
          const c2: any = (content as any)[`${k}_content`]
          if (c2 && typeof c2 === 'object' && typeof c2.url === 'string') return c2.url
          if (typeof c2 === 'string') return c2
          const s2: any = (content as any)[k]
          if (typeof s2 === 'string') return s2
          return undefined
        }
        activeKeys.forEach((k) => { const u = getUrlForKey(k); if (u) urls.add(u) })
        if (urls.size === 0 && content && typeof content === 'object') {
          Object.values(content).forEach((v: any) => {
            if (v && typeof v === 'object' && typeof v.url === 'string') urls.add(v.url)
            if (typeof v === 'string') urls.add(v)
          })
        }
      }

      const unique = Array.from(urls).filter((u) => !preloadedUrlsRef.current.has(u))
      unique.forEach((u) => preloadedUrlsRef.current.add(u))
      unique.forEach((src) => {
        const img = new Image()
        img.decoding = 'async'
        // @ts-ignore
        img.referrerPolicy = 'no-referrer'
        img.src = src
      })
    } catch (e) {
      // best-effort preload
    }
  }, [])

  const submitAnswerInBackground = (questionId: string, answerOptionId: string) => {
    try {
      const sessionData = localStorage.getItem('study_session')
      if (!sessionData) return
      const { sessionId } = JSON.parse(sessionData)
      if (!sessionId) return

      const q = questions.find(q => q.id === questionId)
      if (!q) return

      const startedAt = questionStartRef.current[questionId] || Date.now()
      const timeSpent = Math.max(0, Math.round((Date.now() - startedAt) / 1000))

      const payload = {
        answers: [
          {
            question_id: q.id,
            question_text: q.text,
            answer: answerOptionId,
            answer_timestamp: new Date().toISOString(),
            time_spent_seconds: timeSpent,
          }
        ]
      }

      submitClassificationAnswers(String(sessionId), payload).catch((err) => {
        console.error('submitClassificationAnswers error:', err)
      })

      questionStartRef.current[questionId] = Date.now()
    } catch (e) {
      console.error('Failed to submit classification answer:', e)
    }
  }

  const handleOptionSelect = (questionId: string, optionId: string) => {
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, selected: optionId } : q))
    submitAnswerInBackground(questionId, optionId)
  }

  const handleContinue = () => {
    // Save classification page time
    try {
      const elapsed = Math.round((Date.now() - classStartRef.current) / 1000)
      const metrics = JSON.parse(localStorage.getItem('session_metrics') || '{}')
      metrics.classification_page_time = elapsed
      localStorage.setItem('session_metrics', JSON.stringify(metrics))
    } catch {}

    const answers: Record<string, string> = {}
    questions.forEach(q => { if (q.selected) answers[q.id] = q.selected })
    localStorage.setItem('classification_answers', JSON.stringify(answers))
    router.push(`/participate/${params?.id}/tasks`)
  }

  const canProceed = questions.every(q => !q.required || q.selected !== null)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
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
        <DashboardHeader />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Classification Questions</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            No classification questions found for this study.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => router.push(`/participate/${params?.id}/tasks`)}
              className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white text-sm"
            >
              Continue to Tasks
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
          {/* <div className="text-right text-xs text-gray-500">2 / 4</div> */}

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
