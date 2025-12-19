"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { DashboardHeader } from "../../../components/dashboard-header"
import { getStudyResponses, type StudyResponseItem, downloadStudyResponsesCsv } from "@/lib/api/ResponseAPI"
import { getStudyBasicDetails, type StudyDetails } from "@/lib/api/StudyAPI"
import Link from "next/link"
import { Download } from "lucide-react"

const PAGE_SIZE = 10

export default function StudyResponsesPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const studyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<StudyResponseItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("completed")
  const [page, setPage] = useState<number>(Number(searchParams.get("page") || 1))
  const [exporting, setExporting] = useState(false)
  const [exportStage, setExportStage] = useState(0)
  const [study, setStudy] = useState<StudyDetails | null>(null)
  const hasFetchedRef = useRef(false)

  const fetchResponses = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getStudyResponses(studyId, 100, 0)
      setItems(res.results || [])
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to load responses")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!studyId || hasFetchedRef.current) return
    hasFetchedRef.current = true

    // Fetch both responses and study details
    fetchResponses()

    const fetchStudy = async () => {
      try {
        const data = await getStudyBasicDetails(studyId)
        setStudy(data)
      } catch (e) {
        console.error("Failed to fetch study details:", e)
      }
    }
    fetchStudy()
  }, [studyId])

  // Fallback: if first attempt loaded no items (e.g., auth not ready), retry once on visibility/focus
  useEffect(() => {
    const onFocus = () => { if (!loading && items.length === 0) fetchResponses() }
    const onVisibility = () => { if (document.visibilityState === 'visible' && !loading && items.length === 0) fetchResponses() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loading, items.length, studyId])

  // Filter in-memory for snappy UX
  const filtered = useMemo(() => {
    let list = items
    if (statusFilter !== "all") {
      if (statusFilter === "completed") list = list.filter(i => i.is_completed)
      if (statusFilter === "abandoned") list = list.filter(i => i.is_abandoned)
    }
    // sort by respondent_id (ascending)
    return [...list].sort((a, b) => {
      const ar = typeof a.respondent_id === 'number' ? a.respondent_id : Number(a.respondent_id || 0)
      const br = typeof b.respondent_id === 'number' ? b.respondent_id : Number(b.respondent_id || 0)
      return ar - br
    })
  }, [items, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const goToPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages)
    setPage(next)
    const usp = new URLSearchParams(searchParams.toString())
    usp.set("page", String(next))
    router.replace(`?${usp.toString()}`)
  }

  const formatDate = (iso?: string) => {
    if (!iso) return "-"
    try {
      const d = new Date(iso)
      const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      return `${date} ${time}`
    } catch {
      return iso
    }
  }

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "-"
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}m ${s}s`
  }

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null
    try {
      const birthDate = new Date(dateOfBirth)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      return age
    } catch {
      return null
    }
  }

  const exportCsv = async () => {
    try {
      setExporting(true)
      setExportStage(0)

      // Stage 1: Creating CSV
      setExportStage(1)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Stage 2: Extracting your responses
      setExportStage(2)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Stage 3: Processing data
      setExportStage(3)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Actually download the CSV
      const blob = await downloadStudyResponsesCsv(studyId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `study-${studyId}-responses.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert("Export failed")
    } finally {
      setExporting(false)
      setExportStage(0)
    }
  }

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="text-white" style={{ backgroundColor: '#2674BA' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm text-blue-200">

                  <Link href="/home" className="text-blue-200"><span className="text-blue-200">Dashboard</span></Link>
                  <span className="mx-2">/</span>
                  <Link href={`/home/study/${studyId}`} className="text-blue-200"><span className="text-blue-200">Studies</span></Link>
                  <span className="mx-2">/</span>
                  <span className="text-white">
                    {study?.study_type === "grid" ? "Grid Study" : study?.study_type === "text" ? "Text Study" : study?.study_type === "layer" ? "Layer Study" : "Loading..."}
                  </span>
                </div>
                <h1 className="text-2xl font-bold">Study Responses</h1>
                <p className="text-blue-100 text-sm">Analyze and export response data</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => router.push(`/home/study/${studyId}`)} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white">Back to Study</button>
                <button
                  onClick={exportCsv}
                  disabled={exporting}
                  className="px-4 py-2 rounded-md bg-white text-[#2674BA] hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2674BA]"></div>
                      <span>
                        {exportStage === 1 && "Creating CSV..."}
                        {exportStage === 2 && "Extracting your responses..."}
                        {exportStage === 3 && "Processing data..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">Total Responses</div>
              <span className="px-3 py-1 rounded-full text-white text-sm" style={{ backgroundColor: '#2674BA' }}>{items.length}</span>
            </div>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2 border rounded-md bg-white flex-1 sm:flex-none">
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Respondent ID</th>
                    <th className="px-4 py-3 text-left">Start Time</th>
                    <th className="px-4 py-3 text-left">End Time</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">Loading responses…</td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-red-600">{error}</td>
                    </tr>
                  )}
                  {!loading && !error && pageItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No responses found</td>
                    </tr>
                  )}
                  {!loading && !error && pageItems.map((r) => {
                    const status = r.is_abandoned ? 'Abandoned' : (r.is_completed ? 'Complete' : 'In Progress')
                    const statusColor = r.is_abandoned ? 'text-red-600' : (r.is_completed ? 'text-green-600' : 'text-gray-600')
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{r.respondent_id}</div>
                          <div className="text-xs text-gray-500">
                            {(() => {
                              const age = calculateAge(r.personal_info?.date_of_birth)
                              const gender = r.personal_info?.gender
                              if (age && gender) {
                                return `${age}Y, ${gender.charAt(0).toUpperCase() + gender.slice(1)}`
                              }
                              return (gender || '-').replace(/^./, c => c.toUpperCase())
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(r.session_start_time)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(r.session_end_time)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDuration(r.total_study_duration)}</td>
                        <td className={`px-4 py-3 font-medium ${statusColor}`}>{status}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => router.push(`/home/study/${studyId}/response/details/${encodeURIComponent(r.session_id)}`)} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Details</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2 p-4 border-t">
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 rounded border disabled:opacity-50">Prev</button>
              {Array.from({ length: totalPages }).slice(0, 5).map((_, idx) => {
                const p = idx + 1
                return (
                  <button key={p} onClick={() => goToPage(p)} className={`px-3 py-1 rounded border ${p === currentPage ? 'bg-[#2674BA] text-white border-[#2674BA]' : ''}`}>{p}</button>
                )
              })}
              {totalPages > 5 && <span className="px-2">…</span>}
              {totalPages > 5 && (
                <button onClick={() => goToPage(totalPages)} className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-[#2674BA] text-white border-[#2674BA]' : ''}`}>{totalPages}</button>
              )}
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 rounded border disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}


