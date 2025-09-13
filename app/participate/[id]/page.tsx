"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo, useRef, useState, useEffect } from "react"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { startStudy } from "@/lib/api/ResponseAPI"
import { getStudyDetailsWithoutAuth } from "@/lib/api/StudyAPI"

export default function ParticipateIntroPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [studyDetails, setStudyDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Track orientation page time
  const orientStartRef = useRef<number>(Date.now())

  // Fetch study details on component mount
  useEffect(() => {
    const fetchStudyDetails = async () => {
      if (!params?.id) return
      
      try {
        const details = await getStudyDetailsWithoutAuth(params.id)
        setStudyDetails(details)
      } catch (error) {
        console.error('Failed to fetch study details:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStudyDetails()
  }, [params?.id])

  // Use real data from API or fallback values
  const studyTitle = studyDetails?.title || "Study Title"
  const estimatedTime = "3-5 minutes" // Keep as requested
  const studyType = studyDetails?.study_type === "grid" ? "Grid Study" : "Layer Study"
  const totalVignettes = studyDetails?.audience_segmentation?.number_of_respondents || 3

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

    // Store full study details in localStorage for use in subsequent pages
    if (studyDetails) {
      console.log('Storing study details in localStorage:', studyDetails)
      localStorage.setItem('current_study_details', JSON.stringify(studyDetails))
      console.log('Study details stored successfully')
    } else {
      console.log('No study details to store')
    }
    
    // Call API in background without waiting for response
    startStudy(params.id)
      .then((response) => {
        console.log('Study session started:', response)
        
        // Store session data in localStorage for use in subsequent pages
        localStorage.setItem('study_session', JSON.stringify({
          sessionId: response.session_id,
          respondentId: response.respondent_id,
          studyId: params.id,
          totalTasks: response.total_tasks_assigned
        }))
      })
      .catch((error) => {
        console.error('Failed to start study:', error)
        // Don't show alert to user since they're already on next page
      })
    
    // Immediately navigate to next page
    router.push(startHref)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-28 sm:pb-12">
        <DashboardHeader />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-28 sm:pb-12">
      <DashboardHeader />
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
              <Section title="Welcome to the Study!">
                <p className="text-sm text-gray-700">
                  You’re about to participate in an important research study. This study will help researchers understand how people evaluate different visual elements.
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
      <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 border-b pb-2 border-blue-200/70">{title}</h3>
      {children}
    </div>
  )
}


