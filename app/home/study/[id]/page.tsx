"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "../../components/dashboard-header"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { getPrivateStudyDetails, updateStudyStatus, putUpdateStudy, StudyDetails } from "@/lib/api/StudyAPI"
import { getStudyAnalytics, StudyAnalytics, downloadStudyResponsesCsv } from "@/lib/api/ResponseAPI"
import { Pause, Play, CheckCircle, Share, Eye, Download, BarChart3 } from "lucide-react"

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

  useEffect(() => {
    if (studyId) {
      loadStudyDetails()
    }
  }, [studyId])

  // Load analytics separately to not interfere with main page speed
  useEffect(() => {
    if (studyId && study) {
      loadAnalytics()
    }
  }, [studyId, study])

  const loadStudyDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const studyData = await getPrivateStudyDetails(studyId)
      setStudy(studyData)
    } catch (err: any) {
      console.error("Failed to load study details:", err)
      if (err.status === 403) {
        setError("You don't have permission to view this study")
        router.push('/home/studies')
      } else {
        setError(err.message || "Failed to load study details")
      }
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true)
      const analyticsData = await getStudyAnalytics(studyId)
      setAnalytics(analyticsData)
    } catch (err: any) {
      console.error("Failed to load analytics:", err)
      // Don't show error to user, analytics is optional
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: "active" | "paused" | "completed") => {
    if (!study) return

    try {
      setUpdating(true)
      // Optimistic UI: update immediately
      const oldStatus = study.status
      setStudy({ ...study, status: newStatus })

      // Use PUT endpoint as requested for status changes (activate/pause)
      try {
        const updatedStudy = await putUpdateStudy(studyId, { status: newStatus })
        setStudy(updatedStudy)
      } catch (err: any) {
        // Fallback: some servers disallow PUT when active; try PATCH status update
        try {
          const patched = await updateStudyStatus(studyId, newStatus)
          setStudy(patched)
        } catch (err2: any) {
          console.error("PUT then PATCH status update failed:", err, err2)
          // Revert optimistic change on failure
          setStudy((prev) => (prev ? { ...prev, status: oldStatus } : prev))
          setError((err2 && err2.message) || (err && err.message) || "Failed to update study status")
        }
        return
      }
    } catch (err: any) {
      console.error("Failed to update study status:", err)
      // Revert optimistic change on failure
      setStudy((prev) => (prev ? { ...prev, status: study.status } : prev))
      setError(err.message || "Failed to update study status")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-600"
      case "paused": return "text-orange-600"
      case "completed": return "text-blue-600"
      case "draft": return "text-gray-600"
      default: return "text-gray-600"
    }
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "draft": return "Paused"
      case "active": return "Active"
      case "paused": return "Paused"
      case "completed": return "Completed"
      default: return status
    }
  }

  const getActionButton = () => {
    if (!study) return null

    const isDraftOrPaused = study.status === "draft" || study.status === "paused"
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
    if (!study || study.total_responses === 0) return "0.0%"
    return ((study.completed_responses / study.total_responses) * 100).toFixed(1) + "%"
  }

  const getAbandonmentRate = () => {
    if (analytics) {
      return analytics.abandonment_rate.toFixed(1) + "%"
    }
    return "0.0%"
  }

  const getAverageDuration = () => {
    if (analytics && analytics.average_duration > 0) {
      const minutes = Math.floor(analytics.average_duration / 60)
      const seconds = Math.floor(analytics.average_duration % 60)
      return `${minutes}m ${seconds}s`
    }
    return "0m 0s"
  }

  const buildCsvAndDownload = async () => {
    try {
      setExporting(true)
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
  const createdDisplay = new Date(study.created_at)
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .replace(", ", ",")

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        
        {/* Header Section */}
        <div className="text-white" style={{ backgroundColor: '#2674BA' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumbs */}
            <nav className="text-sm mb-2">
              <span className="text-blue-200">Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-blue-200">Studies</span>
              <span className="mx-2">/</span>
              <span className="text-white">{study.study_type === "grid" ? "Grid Study" : "Layer Study"}</span>
            </nav>
            
            {/* Title and Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-2xl font-bold">{study.title}</h1>
              <div className="flex items-center gap-3">
                {getActionButton()}
                <button
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={updating || study.status === "completed"}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Complete
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
                {study.study_type === "layer" ? "Layer Study" : "Grid Study"}
              </div>
              <div className="flex items-center gap-5 text-sm" style={{ color: '#2674BA' }}>
                <div className="relative group">
                  <button 
                    onClick={() => study.status === 'active' && router.push(`/home/study/${studyId}/share`)} 
                    disabled={study.status !== 'active'}
                    className={`flex items-center gap-2 transition-all duration-200 ${
                      study.status === 'active' 
                        ? 'hover:opacity-80 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    title={study.status !== 'active' ? 'Activate study to share' : ''}
                  >
                    <Share className="w-4 h-4" />
                    <span>Share</span>
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
                <span className="text-gray-700">{study.study_type === 'layer' ? 'Layer - Based' : 'Grid - Based'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Created :</span>
                <span className="text-gray-700">{createdDisplay}</span>
              </div>
            </div>
          </div>

          {/* Study Configuration */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 
              className="text-lg font-semibold border-b pb-2 mb-4"
              style={{ color: '#2674BA', borderColor: '#2674BA' }}
            >
              Study Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                <input
                  type="text"
                  value={study.background}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Questions</label>
                <input
                  type="text"
                  value={study.main_question}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orientation Text</label>
                <input
                  type="text"
                  value={study.orientation_text}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
              </div>
            </div>
          </div>

          {/* Response Statistics */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 
              className="text-lg font-semibold mb-4"
              style={{ color: '#2674BA' }}
            >
              Response Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.total_responses ?? study.total_responses
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Responses</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.in_progress_responses ?? Math.max(0, (study.total_responses - study.completed_responses - study.abandoned_responses))
                  )}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.completed_responses ?? study.completed_responses
                  )}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center p-4 border rounded-lg" style={{ borderColor: '#2674BA' }}>
                <div className="text-2xl font-bold" style={{ color: '#2674BA' }}>
                  {analyticsLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#2674BA' }}></div>
                  ) : (
                    analytics?.abandoned_responses ?? study.abandoned_responses
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

          {/* Study Configuration Details */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 
              className="text-lg font-semibold border-b pb-2 mb-4"
              style={{ color: '#2674BA', borderColor: '#2674BA' }}
            >
              Study Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scale</label>
                <input
                  type="text"
                  value={`${study.rating_scale.min_value} to ${study.rating_scale.max_value} ${study.rating_scale.min_label}-${study.rating_scale.max_label}`}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Questions</label>
                <input
                  type="text"
                  value={`${study.elements?.length || study.study_layers?.length || 0} Elements ${study.study_type === "grid" ? "Grid" : "Layer"} Based`}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Classification Questions</label>
                <input
                  type="text"
                  value="2 Questions"
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
              </div>
            </div>
          </div>

          {/* Study Response */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
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
                    analytics?.total_responses ?? study.total_responses
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
                    analytics?.completed_responses ?? study.completed_responses
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
                    analytics?.abandoned_responses ?? study.abandoned_responses
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
            <div className="flex gap-3">
              <button 
                onClick={() => router.push(`/home/study/${studyId}/response`)}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: '#2674BA' }}
              >
                <BarChart3 className="w-4 h-4" />
                View All Response
              </button>
              <button 
                onClick={buildCsvAndDownload}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:opacity-80 disabled:opacity-60"
                style={{ borderColor: '#2674BA', color: '#2674BA' }}
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
