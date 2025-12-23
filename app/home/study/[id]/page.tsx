"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "../../components/dashboard-header"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { updateStudyStatus, putUpdateStudy, StudyDetails, getStudyBasicDetails } from "@/lib/api/StudyAPI"
import { StudyAnalytics, downloadStudyResponsesCsv, subscribeStudyAnalytics } from "@/lib/api/ResponseAPI"
import { Pause, Play, CheckCircle, Share, Download, BarChart3, ArrowLeft, ChevronDown } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

interface AccordionSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

const AccordionSection = ({ title, children, defaultOpen = true }: AccordionSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 border-b group"
        style={{ borderColor: isOpen ? '#2674BA' : '#e5e7eb' }}
      >
        <h3
          className="text-lg font-semibold transition-colors duration-200"
          style={{ color: '#2674BA' }}
        >
          {title}
        </h3>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function StudyManagementPage() {
  const params = useParams()
  const router = useRouter()
  const studyId = params.id as string

  const [study, setStudy] = useState<StudyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<StudyAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportStage, setExportStage] = useState(0)

  // Cache keys
  const STUDY_CACHE_KEY = `study_details_cache_${studyId}`
  const ANALYTICS_CACHE_KEY = `study_analytics_cache_${studyId}`

  // Hydrate from cache immediately, then fetch fresh in background
  useEffect(() => {
    if (!studyId) return
    try {
      const cachedStudy = localStorage.getItem(STUDY_CACHE_KEY)
      if (cachedStudy) {
        setStudy(JSON.parse(cachedStudy))
        setLoading(false)
      }
      const cachedAnalytics = localStorage.getItem(ANALYTICS_CACHE_KEY)
      if (cachedAnalytics) {
        setAnalytics(JSON.parse(cachedAnalytics))
        setAnalyticsLoading(false)
      }
    } catch { }
    loadStudyDetails()
  }, [studyId])

  // Live analytics subscription (SSE with fallback)
  useEffect(() => {
    if (!studyId || !study) return
    setAnalyticsLoading(true)
    const unsubscribe = subscribeStudyAnalytics(
      studyId,
      (data) => {
        setAnalytics(data);
        setAnalyticsLoading(false);
        try { localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(data)) } catch { }
      },
      () => { /* keep silent */ },
      5
    )
    return () => { unsubscribe() }
  }, [studyId, study])

  const loadStudyDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      // Use the new basic API endpoint that doesn't require authentication
      const studyData = await getStudyBasicDetails(studyId)
      setStudy(studyData)
      try { localStorage.setItem(STUDY_CACHE_KEY, JSON.stringify(studyData)) } catch { }
    } catch (err: unknown) {
      console.error("Failed to load study details:", err)
      if ((err as any)?.status === 403) {
        setError("You don't have permission to view this study")
        router.push('/home/studies')
      } else {
        setError((err as Error)?.message || "Failed to load study details")
      }
    } finally {
      setLoading(false)
    }
  }

  // const loadAnalytics = async () => {
  //   try {
  //     setAnalyticsLoading(true)
  //     const analyticsData = await getStudyAnalytics(studyId)
  //     setAnalytics(analyticsData)
  //   } catch (err: unknown) {
  //     console.error("Failed to load analytics:", err)
  //     // Don't show error to user, analytics is optional
  //   } finally {
  //     setAnalyticsLoading(false)
  //   }
  // }

  const handleStatusUpdate = async (newStatus: "active" | "paused" | "completed") => {
    if (!study) return

    try {
      setUpdating(true)
      // Optimistic UI: update immediately
      const oldStatus = study.status
      setStudy({ ...study, status: newStatus })

      // Use PUT endpoint as requested for status changes (activate/pause)
      try {
        const updatedStudy = await putUpdateStudy(studyId, { status: newStatus }, 8)
        setStudy(updatedStudy)
      } catch (err: unknown) {
        // Fallback: some servers disallow PUT when active; try PATCH status update
        try {
          const patched = await updateStudyStatus(studyId, newStatus)
          setStudy(patched)
        } catch (err2: any) {
          console.error("PUT then PATCH status update failed:", err, err2)
          // Revert optimistic change on failure
          setStudy((prev) => (prev ? { ...prev, status: oldStatus } : prev))
          setError((err2 && (err2 as any).message) || ((err as any) && (err as any).message) || "Failed to update study status")
        }
        return
      }
    } catch (err: unknown) {
      console.error("Failed to update study status:", err)
      // Revert optimistic change on failure
      setStudy((prev) => (prev ? { ...prev, status: study.status } : prev))
      setError((err as Error)?.message || "Failed to update study status")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "active": return "text-green-600"
      case "paused": return "text-orange-600"
      case "completed": return "text-blue-600"
      case "draft": return "text-gray-600"
      default: return "text-gray-600"
    }
  }

  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case "draft": return "Paused"
      case "active": return "Active"
      case "paused": return "Paused"
      case "completed": return "Completed"
      default: return status || "Unknown"
    }
  }

  const getActionButton = () => {
    if (!study) return null

    // const isDraftOrPaused = study.status === "draft" || study.status === "paused"
    const isActive = study.status === "active"
    const isCompleted = study.status === "completed"

    if (isCompleted) {
      return (
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Study Completed
        </button>
      )
    }

    if (isActive) {
      return (
        <button
          onClick={() => handleStatusUpdate("paused")}
          disabled={updating}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#FF6B35' }}
        >
          <Pause className="w-4 h-4" />
          {updating ? "Updating..." : "Pause Study"}
        </button>
      )
    }

    return (
      <button
        onClick={() => handleStatusUpdate("active")}
        disabled={updating}
        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
      >
        <Play className="w-4 h-4" />
        {updating ? "Updating..." : "Activate Study"}
      </button>
    )
  }

  const getCompletionRate = () => {
    if (analytics) {
      return analytics.completion_rate.toFixed(1) + "%"
    }
    // New API doesn't include response counts, so show analytics only
    return "0.0%"
  }

  // const getAbandonmentRate = () => {
  //   if (analytics) {
  //     return analytics.abandonment_rate.toFixed(1) + "%"
  //   }
  //   return "0.0%"
  // }

  const getAverageDuration = () => {
    if (analytics && analytics.average_duration > 0) {
      const minutes = Math.floor(analytics.average_duration / 60)
      const seconds = Math.floor(analytics.average_duration % 60)
      return `${minutes}m ${seconds}s`
    }
    return "0m 0s"
  }

  const buildCsvAndDownload = async () => {
    if (!analytics || (analytics.total_responses ?? 0) === 0) {
      alert('There are no responses to export yet.')
      return
    }

    try {
      setExporting(true)
      setExportStage(0)

      // Stage 1: Extracting data
      setExportStage(1)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Stage 2: Processing responses
      setExportStage(2)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Stage 3: Generating CSV
      setExportStage(3)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Actually download the CSV
      const blob = await downloadStudyResponsesCsv(studyId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${study?.title || 'study'}-responses.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export CSV failed:', e)
      alert('Failed to export CSV')
    } finally {
      setExporting(false)
      setExportStage(0)
    }
  }

  if (loading) {
    return (
      <AuthGuard requireAuth={true}>
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (error || !study) {
    return (
      <AuthGuard requireAuth={true}>
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p className="text-red-600">{error || "Study not found"}</p>
              <button
                onClick={() => router.push("/home")}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  // Display helpers
  const createdDisplay = study.created_at ? new Date(study.created_at)
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : 'N/A'

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        {/* Header Section */}
        <div className="text-white" style={{ backgroundColor: '#2674BA' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumbs */}
            <nav className="text-sm mb-2">
              <Link href="/home" className="text-blue-200"><span className="text-blue-200">Dashboard</span></Link>

              <span className="mx-2">/</span>
              <Link href="/home" className="text-blue-200"><span className="text-blue-200">Studies</span></Link>
              <span className="mx-2">/</span>
              <span className="text-white">{study.study_type === "grid" ? "Grid Study" : study.study_type === "text" ? "Text Study" : "Layer Study"}</span>
            </nav>

            {/* Title and Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-2xl font-bold">{study.title}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => (typeof window !== 'undefined' && window.history.length > 1) ? router.back() : router.push('/home')}
                  className="flex cursor-pointer items-center gap-2 px-4 py-2 border rounded-lg hover:opacity-80"
                  style={{ borderColor: '#FFFFFF', color: '#FFFFFF' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  onClick={() => router.push(`/home/study/${studyId}/response`)}
                  className="flex cursor-pointer items-center gap-2 px-4 py-2 bg-white rounded-lg hover:opacity-90 font-medium whitespace-nowrap"
                  style={{ color: '#2674BA' }}
                >
                  <BarChart3 className="w-4 h-4" />
                  View All Response
                </button>

                <button
                  onClick={buildCsvAndDownload}
                  disabled={exporting}
                  className="flex cursor-pointer items-center gap-2 px-4 py-2 border rounded-lg hover:opacity-80 disabled:opacity-60 whitespace-nowrap"
                  style={{ borderColor: '#FFFFFF', color: '#FFFFFF' }}
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>
                        {exportStage === 1 && "Extracting data..."}
                        {exportStage === 2 && "Processing responses..."}
                        {exportStage === 3 && "Generating CSV..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </>
                  )}
                </button>

                {getActionButton()}
                <button
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={updating || study.status === "completed"}
                  className="flex cursor-pointer items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Study
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Study Overview */}
          <div className="bg-white rounded-lg shadow-sm border p-0 mb-6 overflow-hidden">
            {/* Top row: title + actions */}
            <div className="px-6 pt-4 pb-3 flex items-center justify-between">
              <div className="text-[16px] font-semibold" style={{ color: '#2674BA' }}>
                {study.study_type === "layer" ? "Layer Study" : study.study_type === "text" ? "Text Study" : "Grid Study"}
              </div>
              <div className="flex items-center gap-5 text-sm" style={{ color: '#2674BA' }}>
                <div className="relative group">
                  <button
                    onClick={() => study.status === 'active' && router.push(`/home/study/${studyId}/share`)}
                    disabled={study.status !== 'active'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${study.status === 'active'
                      ? 'hover:opacity-80 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                      }`}
                    title={study.status !== 'active' ? 'Activate study to share' : ''}
                  >
                    <Share className="w-6 h-6" />
                    <span className="font-medium text-lg">Share</span>
                  </button>
                  {/* {study.status !== 'active' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  )} */}
                </div>
                {/* <button className="flex items-center gap-2 hover:opacity-80">
                  <Eye className="w-4 h-4" />
                  <span>Preview</span>
                </button> */}
              </div>
            </div>
            <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }} />
            {/* Meta row */}
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Status :</span>
                <span className={getStatusColor(study.status)}>{getStatusDisplay(study.status)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Type :</span>
                <span className="text-gray-700">{study.study_type === 'layer' ? 'Layer - Based' : study.study_type === 'text' ? 'Text - Based' : 'Grid - Based'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Created :</span>
                <span className="text-gray-700">{createdDisplay}</span>
              </div>
            </div>
          </div>

          {/* Response Statistics */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3
              className="text-lg font-semibold border-b pb-2 mb-4"
              style={{ color: '#2674BA', borderColor: '#2674BA' }}
            >
              Response Statistics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.total_responses ?? 0
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Responses</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.in_progress_responses ?? 0
                  )}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.completed_responses ?? 0
                  )}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.abandoned_responses ?? 0
                  )}
                </div>
                <div className="text-sm text-gray-600">Abandoned</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    getCompletionRate()
                  )}
                </div>
                <div className="text-sm text-gray-600">Completion Rate</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    getAverageDuration()
                  )}
                </div>
                <div className="text-sm text-gray-600">Avg Duration</div>
              </div>
            </div>
          </div>

          {/* Study Configuration */}
          <AccordionSection title="Study Configuration">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                <div className="w-full py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                  {study.background}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Question</label>
                <div className="w-full py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                  {study.main_question || ''}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orientation Text</label>
                <div className="w-full py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                  {study.orientation_text}
                </div>
              </div>
            </div>
          </AccordionSection>



          {/* Study Configuration Details */}
          <AccordionSection title="Study Metadata">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scale</label>
                <div className="w-full py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                  {`${study.rating_scale.min_value} to ${study.rating_scale.max_value} ${study.rating_scale.min_label}-${study.rating_scale.max_label}`}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Study Elements Content</label>
                <div className="w-full py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                  {`${(study as any).element_count || 0}`} Elements
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Classification Questions</label>
                <div className="w-full py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                  {`${(study as any).classification_questions?.length || 0} Question${((study as any).classification_questions?.length || 0) !== 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
          </AccordionSection>

          {/* Classification Questions */}
          {(study as any).classification_questions && (study as any).classification_questions.length > 0 && (
            <AccordionSection title="Classification Questions">
              <div className="space-y-4">
                {(study as any).classification_questions.map((question: any, index: number) => (
                  <div key={question.id || index} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm font-medium text-gray-800">{question.question_text}</div>
                      <div className="text-xs text-gray-500 ml-2">Q{index + 1}</div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <div className="mb-1">Type: {question.question_type.replace('_', ' ').toUpperCase()}</div>
                      <div className="mb-1">Required: {question.is_required ? 'Yes' : 'No'}</div>
                    </div>
                    {question.answer_options && question.answer_options.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">Answer Options:</div>
                        <div className="flex flex-wrap gap-2">
                          {question.answer_options.map((option: any, optIndex: number) => (
                            <span key={option.id || optIndex} className="px-3 py-1 bg-white border rounded text-sm">
                              {option.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* Audience Segmentation */}
          {(study as any).study_config && (
            <AccordionSection title="Audience Segmentation">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Country</label>
                  <div className="py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                    {(study as any).study_config.country || 'Not specified'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Respondents</label>
                  <div className="py-2 bg-white text-gray-700 whitespace-pre-wrap break-words">
                    {(study as any).study_config.number_of_respondents || 0}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender Distribution</label>
                  <div className="space-y-2">
                    {Object.entries((study as any).study_config.gender_distribution || {}).map(([gender, percentage]: [string, any]) => (
                      percentage > 0 && (
                        <div key={gender} className="flex items-center gap-4 py-1">
                          <span className="text-sm text-gray-600 capitalize w-16">{gender}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${percentage}%`, backgroundColor: '#2674BA' }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-10 text-right">{percentage}%</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age Distribution</label>
                  <div className="space-y-1">
                    {Object.entries((study as any).study_config.age_distribution || {}).map(([ageGroup, percentage]: [string, any]) => (
                      percentage > 0 && (
                        <div key={ageGroup} className="flex items-center gap-4 py-1">
                          <span className="text-sm text-gray-600 w-16">{ageGroup}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${percentage}%`, backgroundColor: '#2674BA' }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-10 text-right">{percentage}%</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            </AccordionSection>
          )}

          {/* Orientation Text */}
          {study.orientation_text && (
            <AccordionSection title="Orientation Text">
              <div className="bg-white p-4">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{study.orientation_text}</p>
              </div>
            </AccordionSection>
          )}

          {/* Study Response */}
          {/* <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3
              className="text-lg font-semibold border-b pb-2 mb-4"
              style={{ color: '#2674BA', borderColor: '#2674BA' }}
            >
              Study Response
            </h3>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Total Response</span>
                <span
                  className="px-3 py-1 text-white rounded-full text-sm font-medium"
                  style={{ backgroundColor: '#2674BA' }}
                >
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    analytics?.total_responses ?? 0
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Completed</span>
                <span
                  className="px-3 py-1 text-white rounded-full text-sm font-medium"
                  style={{ backgroundColor: '#2674BA' }}
                >
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    analytics?.completed_responses ?? 0
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Abandoned</span>
                <span
                  className="px-3 py-1 text-white rounded-full text-sm font-medium"
                  style={{ backgroundColor: '#2674BA' }}
                >
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    analytics?.abandoned_responses ?? 0
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: '#2674BA' }}
                >
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    getCompletionRate()
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Avg Duration</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: '#2674BA' }}
                >
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    getAverageDuration()
                  )}
                </span>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </AuthGuard>
  )
}
