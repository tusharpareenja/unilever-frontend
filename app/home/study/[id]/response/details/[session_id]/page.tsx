"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { DashboardHeader } from "../../../../../components/dashboard-header"
import { getResponseSessionDetails, type ResponseSessionDetails, type SessionTaskItem } from "@/lib/api/ResponseAPI"

export default function ResponseDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const studyId = params.id as string
  const sessionId = params.session_id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ResponseSessionDetails | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancel = false
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getResponseSessionDetails(sessionId)
        if (!cancel) setData(res)
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Failed to load session details")
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    run()
    return () => { cancel = true }
  }, [sessionId])

  const tasks: SessionTaskItem[] = useMemo(() => data?.completed_tasks || [], [data])

  const StatRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <div className="grid grid-cols-[130px_1fr] gap-3 text-sm">
      <div className="text-gray-600 uppercase tracking-wide">{label}</div>
      <div className="text-gray-900">{value ?? '-'}</div>
    </div>
  )

  const fmtDate = (iso?: string) => {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      return `${date}, ${time}`
    } catch {
      return iso
    }
  }

  const fmtDur = (sec?: number) => {
    if (!sec || sec <= 0) return '-'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}m ${s.toString().padStart(2,'0')}s`
  }

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="text-white" style={{ backgroundColor: '#2674BA' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Response Details</h1>
            <button onClick={() => router.push(`/home/study/${studyId}/response`)} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white">Back</button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {loading && (
            <div className="bg-white border rounded-lg p-10 text-center text-gray-600">Loading…</div>
          )}
          {!loading && error && (
            <div className="bg-white border rounded-lg p-10 text-center text-red-600">{error}</div>
          )}
          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Overview */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div className="text-[15px] font-semibold" style={{ color: '#2674BA' }}>Response Overview</div>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                  <StatRow label="RESPONSE ID" value={data.id} />
                  <StatRow label="RESPONDENT ID" value={data.respondent_id} />
                  <StatRow label="SESSION ID" value={data.session_id} />
                  <StatRow label="STATUS" value={data.is_completed ? 'Completed' : (data.is_abandoned ? 'Abandoned' : 'In Progress')} />
                  <StatRow label="COMPLETION" value={`${data.completion_percentage ?? 0}%`} />
                  <StatRow label="TOTAL DURATION" value={fmtDur(data.total_study_duration)} />
                  <StatRow label="START TIME" value={fmtDate(data.session_start_time)} />
                  <StatRow label="END TIME" value={fmtDate(data.session_end_time)} />
                </div>
              </div>

              {/* Tasks */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div className="text-[15px] font-semibold" style={{ color: '#2674BA' }}>Task Details ({tasks.length} Task)</div>
                </div>
                <div className="p-4">
                  <div className="max-h-[420px] overflow-auto pr-2 space-y-4">
                    {tasks.map((t, idx) => (
                      <div key={`${t.task_id || 'task'}_${idx}`} className="border rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-4 p-4">
                          {/* Left: meta */}
                          <div className="space-y-2">
                            <div className="text-sm text-gray-700">Task {idx + 1}</div>
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-gray-500">START TIME :</div>
                                <div className="text-base font-medium text-[#2674BA]">{fmtDate(t.task_start_time)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">COMPLETION TIME :</div>
                                <div className="text-base font-medium text-[#2674BA]">{fmtDate(t.task_completion_time)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">DURATION :</div>
                                <div className="text-base font-semibold">{fmtDur(t.task_duration_seconds)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">RATING :</div>
                                <div className="text-base font-semibold">{t.rating_given ?? '-'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Right: images/elements */}
                          <div className="grid grid-cols-2 gap-4 items-center">
                            {t.task_type === 'grid' && (
                              (() => {
                                // Prefer explicit content map; else derive from *_content + flags
                                let list: any[] = []
                                if (t.elements_shown_content && typeof t.elements_shown_content === 'object') {
                                  list = Object.values(t.elements_shown_content).filter((e: any) => e?.url)
                                } else if (t.elements_shown_in_task && typeof t.elements_shown_in_task === 'object') {
                                  const map: Record<string, any> = t.elements_shown_in_task as any
                                  const candidates: string[] = Object.keys(map).filter(k => k.endsWith('_content'))
                                  list = candidates
                                    .map((k) => {
                                      const base = k.replace(/_content$/, '')
                                      const shown = Number(map[base]) === 1
                                      const url = String(map[k] || '')
                                      return shown && url ? { url, name: base } : null
                                    })
                                    .filter(Boolean) as any[]
                                } else if (t.elements_shown && typeof t.elements_shown === 'object') {
                                  const map: Record<string, any> = t.elements_shown as any
                                  const candidates: string[] = Object.keys(map).filter(k => k.endsWith('_content'))
                                  list = candidates
                                    .map((k) => {
                                      const base = k.replace(/_content$/, '')
                                      const shown = Number(map[base]) === 1
                                      const url = String(map[k] || '')
                                      return shown && url ? { url, name: base } : null
                                    })
                                    .filter(Boolean) as any[]
                                }
                                return list.map((e: any, i: number) => (
                                  <div key={i} className="aspect-[4/5] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={e.url} alt={e?.alt_text || e?.name || ''} className="object-contain w-full h-full" />
                                  </div>
                                ))
                              })()
                            )}
                            {t.task_type === 'layer' && t.elements_shown_content && (
                              Object.values(t.elements_shown_content).filter((e: any) => e?.url).map((e: any, i) => (
                                <div key={i} className="aspect-[4/5] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={e.url} alt={e?.alt_text || e?.name || ''} className="object-contain w-full h-full" />
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Classification Questions */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div className="text-[15px] font-semibold" style={{ color: '#2674BA' }}>Classification Questions</div>
                </div>
                <div className="p-5 text-sm text-gray-800">
                  {data.classification_answers && data.classification_answers.length > 0 ? (
                    <div className="space-y-4">
                      {data.classification_answers.map((ans, idx) => (
                        <div key={ans.id || idx} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 p-3 border rounded-lg">
                          <div>
                            <div className="text-gray-600">{ans.question_text || ans.question_id}</div>
                            <div className="font-medium">{ans.answer}</div>
                          </div>
                          <div className="text-xs text-gray-500 md:text-right">
                            <div>Answered: {fmtDate(ans.answer_timestamp)}</div>
                            {typeof ans.time_spent_seconds === 'number' && (
                              <div>Time: {ans.time_spent_seconds}s</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">No classification answers</div>
                  )}
                </div>
              </div>

              {/* Personal Info */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div className="text-[15px] font-semibold" style={{ color: '#2674BA' }}>Personal Information</div>
                </div>
                <div className="p-5 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="text-gray-600">AGE</div>
                      <div className="font-medium">{data.personal_info?.date_of_birth ? `${Math.max(0, new Date().getFullYear() - new Date(data.personal_info.date_of_birth).getFullYear())}` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">DATE OF BIRTH</div>
                      <div className="font-medium">{data.personal_info?.date_of_birth ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">GENDER</div>
                      <div className="font-medium uppercase">{data.personal_info?.gender ?? '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}


