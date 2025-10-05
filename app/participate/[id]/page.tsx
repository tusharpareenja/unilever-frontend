"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo, useRef, useState, useEffect } from "react"
// import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { startStudy, getRespondentStudyDetails } from "@/lib/api/ResponseAPI"
import { getStudyDetailsWithoutAuth, getStudyDetailsForStart } from "@/lib/api/StudyAPI"

export default function ParticipateIntroPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [studyDetails, setStudyDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Track orientation page time
  const orientStartRef = useRef<number>(Date.now())

  // Fetch study details on component mount
  useEffect(() => {
    // Capture rid query once and store in localStorage for post-completion redirect
    try {
      const search = typeof window !== 'undefined' ? window.location.search : ''
      if (search) {
        const params = new URLSearchParams(search)
        const rid = params.get('rid')
        if (rid) {
          localStorage.setItem('redirect_rid', rid)
        }
      }
    } catch {}

    const fetchStudyDetails = async () => {
      if (!params?.id) return
      
      try {
        const details = await getStudyDetailsWithoutAuth(params.id)
        setStudyDetails(details)
        // Proactively preload study assets to avoid first-task lag
        try {
          const urls = new Set<string>()
          if (details?.study_type === 'grid' && Array.isArray(details?.elements)) {
            details.elements.forEach((el: any) => el?.content && urls.add(String(el.content)))
          } else if (details?.study_type === 'layer' && Array.isArray(details?.study_layers)) {
            details.study_layers.forEach((layer: any) => {
              (layer?.images || []).forEach((img: any) => img?.url && urls.add(String(img.url)))
            })
          }
          // Fallback: scan tasks map if present
          const tasksObj: any = (details as any)?.tasks || {}
          if (tasksObj && typeof tasksObj === 'object') {
            const arrays = Array.isArray(tasksObj) ? tasksObj : Object.values(tasksObj).flat?.() || []
            arrays.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                if (v && typeof v === 'object' && v.url) urls.add(String(v.url))
                if (typeof v === 'string') urls.add(String(v))
              })
            })
          }
          Array.from(urls).forEach((src) => { try { const img = new Image(); (img as any).decoding = 'async'; (img as any).referrerPolicy = 'no-referrer'; img.src = src } catch {} })
        } catch {}
      } catch (error: unknown) {
        console.error('Failed to fetch study details:', error)
        
        // Handle specific error messages from backend
        if (error && typeof error === 'object') {
          const errorObj = error as any
          const errorMessage = errorObj?.message || errorObj?.data?.detail || errorObj?.data?.message
          
         
          
          // Check for specific status error messages
          if (errorMessage?.includes('paused') || errorMessage?.includes('draft')) {
            setStatusError('Sorry, the study is paused. Please ask the owner to activate the study.')
          } else if (errorMessage?.includes('completed')) {
            setStatusError('Sorry, the study is completed.')
          } else if (errorMessage?.includes('not found') || errorMessage?.includes('not publicly accessible')) {
            setStatusError('Sorry, this study is not found or not publicly accessible.')
          } else {
            setStatusError('Sorry, there was an error loading the study. Please try again later.')
          }
        } else {
          setStatusError('Sorry, there was an error loading the study. Please try again later.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchStudyDetails()
  }, [params?.id])

  // Use real data from API or fallback values
  const studyTitle = studyDetails?.title || "Study Title"
  const estimatedTime = "1-2 minutes" // Keep as requested
  const studyType = studyDetails?.study_type === "grid" ? "Grid Study" : "Layer Study"
  const orientationText = studyDetails?.orientation_text || "Welcome to the study!"
  const totalVignettes = studyDetails?.respondents_target || 3

  const startHref = useMemo(() => `/participate/${params?.id}/personal-information`, [params?.id])

  const handleStartStudy = async () => {
    if (!params?.id || isStarting) return
    setIsStarting(true)

    // Store orientation page time
    try {
      const elapsed = Math.round((Date.now() - orientStartRef.current) / 1000)
      const metrics = JSON.parse(localStorage.getItem('session_metrics') || '{}')
      metrics.orientation_page_time = elapsed
      localStorage.setItem('session_metrics', JSON.stringify(metrics))
    } catch {}

    try {
      // Ensure study details request is at least triggered
      if (!studyDetails && !isLoading) {
        console.warn('Study details missing; proceeding with session start only')
      }

      const response = await startStudy(params.id)
      

      // Store session data
      localStorage.setItem('study_session', JSON.stringify({
        sessionId: response.session_id,
        respondentId: response.respondent_id,
        studyId: params.id,
        totalTasks: response.total_tasks_assigned
      }))

      // Get respondent-specific study details using the new API
      try {
        const respondentDetails = await getRespondentStudyDetails(String(response.respondent_id), params.id)
        
        
        // Store only the essential data to avoid localStorage quota issues
        const essentialData = {
          study_info: respondentDetails?.study_info || respondentDetails,
          assigned_tasks: respondentDetails?.assigned_tasks || [],
          classification_questions: respondentDetails?.classification_questions || []
        }
        
          
        
        localStorage.setItem('current_study_details', JSON.stringify(essentialData))
      } catch (e) {
      
        // Fallback to old method if new API fails
        if (studyDetails) {
          const tasksSrc: any = studyDetails?.tasks || studyDetails?.data?.tasks || studyDetails?.task_map || studyDetails?.task || {}
          let userTasks: any[] = []
          if (Array.isArray(tasksSrc)) {
            userTasks = tasksSrc
          } else if (tasksSrc && typeof tasksSrc === 'object') {
            const rk = String(response.respondent_id ?? 0)
            userTasks = tasksSrc?.[rk] || tasksSrc?.[Number(rk)] || []
            if (!Array.isArray(userTasks) || userTasks.length === 0) {
              // pick first non-empty bucket (backend may not index by respondent id)
              for (const v of Object.values(tasksSrc)) { if (Array.isArray(v) && v.length) { userTasks = v; break } }
            }
          }
          
          // Store only essential data to avoid localStorage quota issues
          // Preserve existing classification_questions if they exist
          const existingData = localStorage.getItem('current_study_details')
          const existingClassificationQuestions = existingData ? JSON.parse(existingData)?.classification_questions || [] : []
          
          const essentialData = {
            study_info: {
              study_type: studyDetails?.study_type,
              main_question: studyDetails?.main_question,
              orientation_text: studyDetails?.orientation_text,
              rating_scale: studyDetails?.rating_scale
            },
            assigned_tasks: userTasks,
            classification_questions: existingClassificationQuestions
          }
          
          try {
            localStorage.setItem('current_study_details', JSON.stringify(essentialData))
          } catch (e) {
            
          }
        }
      }

      // Navigate only after session and (if present) details are stored
      router.push(startHref)

      // Background: fetch study details using new API endpoint
      ;(async () => {
        try {
          const details: any = await getStudyDetailsForStart(params.id)
          if (!details) return
          
          const tasksSrc: any = details?.tasks || details?.data?.tasks || details?.task_map || details?.task || {}
          let userTasks: any[] = []
          
          if (Array.isArray(tasksSrc)) {
            userTasks = tasksSrc
          } else if (tasksSrc && typeof tasksSrc === 'object') {
            const rk = String(response.respondent_id ?? 0)
            userTasks = tasksSrc?.[rk] || tasksSrc?.[Number(rk)] || []
            if (!Array.isArray(userTasks) || userTasks.length === 0) {
              for (const v of Object.values(tasksSrc)) { 
                if (Array.isArray(v) && v.length) { 
                  userTasks = v; 
                  break 
                } 
              }
            }
          }
          
          // Store only essential data to avoid localStorage quota issues
          // Preserve existing classification_questions if they exist
          const existingData = localStorage.getItem('current_study_details')
          const existingClassificationQuestions = existingData ? JSON.parse(existingData)?.classification_questions || [] : []
          
          const essentialData = {
            study_info: {
              study_type: details?.study_type,
              main_question: details?.main_question,
              orientation_text: details?.orientation_text,
              rating_scale: details?.rating_scale
            },
            assigned_tasks: userTasks,
            classification_questions: existingClassificationQuestions
          }
          
          try {
            localStorage.setItem('current_study_details', JSON.stringify(essentialData))
          } catch (e) {
            
          }
        } catch (e) {
          
        }
      })()
    } catch (error) {
      
      alert('Failed to start the study. Please try again in a moment.')
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-28 sm:pb-12">
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
          </div>
        </div>
      </div>
    )
  }

  // Show status error message if study is not active
  if (statusError) {
    return (
      <div className="min-h-screen bg-white pb-28 sm:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Study Not Available</h1>
            <p className="text-lg text-gray-600 mb-6">{statusError}</p>
            <div className="mt-6">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-28 sm:pb-12">
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">{studyTitle}</h1>
        <p className="mt-2 text-center text-sm sm:text-base text-gray-600">Thank you for participating in this research study.</p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleStartStudy}
            disabled={isStarting}
            className="inline-flex items-center justify-center px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm shadow-sm"
          >
            {isStarting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting...
              </>
            ) : (
              <>
                Start Study
                <span className="ml-2">↗</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-8">
          <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoCard label="Estimated Time:" value={estimatedTime} />
              <InfoCard label="Study Type:" value={studyType} />
              <InfoCard label="Total Vignettes:" value={String(totalVignettes)} />
            </div>

            <div className="mt-8 border-t pt-6">
              <Section title={orientationText}>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  You're about to participate in an important research study. This study will help researchers understand how people evaluate different visual elements.
                </p>
              </Section>

              <Section title="What to Expect:">
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  <li><span className="font-semibold">Personal Information:</span> Brief demographic questions</li>
                  <li><span className="font-semibold">Classification Questions:</span> A few questions about your preferences</li>
                  <li><span className="font-semibold">Rating Tasks:</span> Rate different combinations of visual elements</li>
                </ul>
              </Section>

              <Section title="Important Notes:">
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  <li>Your responses are completely anonymous</li>
                  <li>There are no right or wrong answers</li>
                  <li>Please complete the study in one session</li>
                  <li>You can withdraw at any time</li>
                </ul>
              </Section>

              <div className="mt-6 text-[11px] sm:text-xs text-gray-500">
                This study has been approved by our research ethics board. Your participation is voluntary and appreciated.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removed bottom fixed button as main CTA is centered under subtitle */}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border shadow-sm p-4 text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-[rgba(38,116,186,1)]">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 border-b pb-2 border-blue-200/70 whitespace-pre-wrap break-words">{title}</h3>
      {children}
    </div>
  )
}


