"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { DashboardHeader } from "../../../../../components/dashboard-header"
import { getResponseSessionDetails, type ResponseSessionDetails, type SessionTaskItem } from "@/lib/api/ResponseAPI"

export default function ResponseDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const studyId = params.id as string
  const sessionId = params.session_id as string
  const projId = searchParams.get('proj_id') || searchParams.get('projectId')
  const projectQuery = projId ? `?proj_id=${encodeURIComponent(projId)}` : ''
  const responseHref = `/home/study/${studyId}/response${projectQuery}`

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ResponseSessionDetails | null>(null)
  const [layerBgFit, setLayerBgFit] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const layerPreviewContainerRef = useRef<HTMLDivElement>(null)
  const layerBgImgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancel = false
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getResponseSessionDetails(sessionId)
        if (!cancel) setData(res)
      } catch (e: unknown) {
        if (!cancel) setError((e as Error)?.message || "Failed to load session details")
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    run()
    return () => { cancel = true }
  }, [sessionId])

  const tasks: SessionTaskItem[] = useMemo(() => data?.completed_tasks || [], [data])

  const measureLayerBgFit = useRef(() => {
    const cont = layerPreviewContainerRef.current
    const imgEl = layerBgImgRef.current
    if (!cont || !imgEl) return
    const cw = cont.offsetWidth
    const ch = cont.offsetHeight
    if (!cw || !ch) return
    const iw = imgEl.naturalWidth || cw
    const ih = imgEl.naturalHeight || ch
    if (!iw || !ih) return
    const scale = Math.min(cw / iw, ch / ih)
    const w = iw * scale
    const h = ih * scale
    const left = (cw - w) / 2
    const top = (ch - h) / 2
    setLayerBgFit({ left, top, width: w, height: h })
  })

  useEffect(() => {
    if (!data?.background_image_url || !tasks.some(tt => (tt.task_type || (tt as any).phase_type) === 'layer')) return
    const run = () => { measureLayerBgFit.current() }
    const t1 = setTimeout(run, 0)
    const t2 = setTimeout(run, 100)
    const t3 = setTimeout(run, 350)
    const t4 = setTimeout(run, 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [data, tasks])

  useEffect(() => {
    if (!layerBgFit) return
    const onResize = () => { measureLayerBgFit.current() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [layerBgFit])

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

  const fmtDur = (sec?: number) => {
    if (!sec || sec <= 0) return '-'
    return `${sec.toFixed(1)}s`
  }

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="text-white" style={{ backgroundColor: '#2674BA' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Response Details</h1>
            <button onClick={() => router.push(responseHref)} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white">Back</button>
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
                  <StatRow label="STUDY TYPE" value={(data as any).study_type || (tasks.length > 0 && tasks.every(t => t.task_type === tasks[0].task_type) ? (tasks[0].task_type === 'grid' ? 'Grid' : tasks[0].task_type === 'text' ? 'Texts' : 'Layer') : 'Hybrid')} />
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
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <div className="text-xs text-gray-500 uppercase">TASK TYPE :</div>
                                <div className="text-sm font-medium text-gray-700 capitalize">
                                  {t.task_type === 'grid' ? 'Grid' : t.task_type === 'text' ? 'Texts' : t.task_type === 'layer' ? 'Layer' : (t as any).phase_type || 'Grid'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: images/elements */}
                          <div className={(t.task_type || (t as any).phase_type) === 'layer' || (t.task_type || (t as any).phase_type) === 'text' ? "flex justify-center w-full" : "grid grid-cols-2 gap-4 items-center"}>
                            {((t.task_type || (t as any).phase_type) === 'layer') && (t.elements_shown_content || t.elements_shown) && (
                              (() => {
                                // Process layer elements from elements_shown_content
                                const layerElements: Array<{ url: string, z: number, alt: string, transform?: { x: number, y: number, width: number, height: number } }> = []

                                // Try elements_shown first (preferred), fallback to elements_shown_in_task
                                const shownElements = t.elements_shown || t.elements_shown_in_task || {}
                                const content = t.elements_shown_content || {}

                                // Process each layer element
                                Object.keys(shownElements).forEach(key => {
                                  const element = shownElements[key]
                                  const isShown = element && element.visible === 1
                                  const raw = content?.[key]
                                  const hasContent = raw !== undefined && raw !== null
                                  // Skip background layer — it's already rendered via data.background_image_url; including it here would draw it on top and hide foreground layers
                                  const isBackground = key.startsWith('Background Image') || (raw && typeof raw === 'object' && (raw as any).layer_name === 'Background Image')
                                  if (isBackground) return

                                  // Layer study API returns objects { url, name, z_index, transform, layer_name }, not URL strings
                                  const url = hasContent && typeof raw === 'object' && typeof (raw as any).url === 'string'
                                    ? (raw as any).url
                                    : typeof raw === 'string' && raw
                                      ? raw
                                      : ''
                                  const tForm = (raw as any)?.transform
                                  const transform = tForm && typeof tForm === 'object' && [tForm.x, tForm.y, tForm.width, tForm.height].every(n => typeof n === 'number')
                                    ? { x: tForm.x, y: tForm.y, width: tForm.width, height: tForm.height }
                                    : undefined

                                  if (isShown && hasContent && url) {
                                    layerElements.push({
                                      url,
                                      z: Number(element.z_index ?? (raw as any)?.z_index ?? 0),
                                      alt: (raw as any)?.name ?? key,
                                      transform
                                    })
                                  }
                                })

                                // Sort by z-index (layer number) - higher z-index should be on top
                                layerElements.sort((a, b) => b.z - a.z)

                                if (layerElements.length === 0) {
                                  return (
                                    <div className="text-sm text-gray-500">No layer elements to display</div>
                                  )
                                }

                                const isFirstLayerTask = tasks.findIndex(tt => (tt.task_type || (tt as any).phase_type) === 'layer') === idx
                                const overlayStyle = layerBgFit
                                  ? { left: layerBgFit.left, top: layerBgFit.top, width: layerBgFit.width, height: layerBgFit.height, zIndex: 1 as const }
                                  : { left: 0, top: 0, right: 0, bottom: 0, zIndex: 1 as const }

                                return (
                                  <div
                                    ref={isFirstLayerTask ? layerPreviewContainerRef : undefined}
                                    className="relative w-full max-w-lg aspect-square overflow-hidden rounded-md"
                                  >
                                    {/* Optional background image behind all layers */}
                                    {data?.background_image_url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        ref={isFirstLayerTask ? layerBgImgRef : undefined}
                                        src={data.background_image_url}
                                        alt="Background"
                                        className="absolute inset-0 m-auto h-full w-full object-contain"
                                        style={{ zIndex: 0 }}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                        onLoad={isFirstLayerTask ? () => {
                                          requestAnimationFrame(() => { measureLayerBgFit.current() })
                                        } : undefined}
                                      />
                                    )}
                                    <div className="absolute overflow-hidden" style={overlayStyle}>
                                      {layerElements.map((img, imgIdx) => {
                                        const tForm = img.transform ?? { x: 0, y: 0, width: 100, height: 100 }
                                        const widthPct = Math.max(1, Math.min(100, Number(tForm.width) || 100))
                                        const heightPct = Math.max(1, Math.min(100, Number(tForm.height) || 100))
                                        const leftPct = Math.max(0, Math.min(100 - widthPct, Number(tForm.x) || 0))
                                        const topPct = Math.max(0, Math.min(100 - heightPct, Number(tForm.y) || 0))
                                        return (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            key={`${img.url}-${imgIdx}`}
                                            src={img.url}
                                            alt={img.alt}
                                            className="absolute object-contain"
                                            style={{
                                              zIndex: Math.max(1, img.z),
                                              position: 'absolute',
                                              top: `${topPct}%`,
                                              left: `${leftPct}%`,
                                              width: `${widthPct}%`,
                                              height: `${heightPct}%`,
                                            }}
                                          />
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })()
                            )}
                            {((t.task_type || (t as any).phase_type) === 'text') && (
                              (() => {
                                // Process text elements from elements_shown_content
                                const textElements: Array<{ text: string, name: string }> = []

                                // Try elements_shown first (preferred), fallback to elements_shown_in_task
                                const shownElements = t.elements_shown || t.elements_shown_in_task || {}
                                const content = t.elements_shown_content || {}

                                // Process each element
                                if (content && typeof content === 'object') {
                                  Object.entries(content).forEach(([key, val]) => {
                                    if (val && typeof val === 'object' && typeof (val as any).visible !== 'undefined') {
                                      if (Number((val as any).visible) === 1) {
                                        textElements.push({
                                          text: (val as any).name || (val as any).url || key, // For text study, url/name usually holds the text
                                          name: key
                                        })
                                      }
                                    }
                                  })
                                }

                                // Fallback if regular parsing yielded nothing but we have raw content
                                if (textElements.length === 0 && shownElements) {
                                  Object.keys(shownElements).forEach(key => {
                                    // Check if visible
                                    const visible = Number(shownElements[key]) === 1 || (shownElements[key] as any)?.visible === 1;
                                    if (visible) {
                                      // Try to find content
                                      let text = key;
                                      if (content && content[key]) {
                                        text = typeof content[key] === 'string' ? content[key] : (content[key] as any).name || (content[key] as any).url || key;
                                      }
                                      textElements.push({ text, name: key })
                                    }
                                  })
                                }

                                if (textElements.length === 0) {
                                  return (
                                    <div className="text-sm text-gray-500">No text elements to display</div>
                                  )
                                }

                                return (
                                  <div className="space-y-3 w-full">
                                    {textElements.map((el, idx) => (
                                      <div
                                        key={`${el.name}-${idx}`}
                                        className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 break-words shadow-sm"
                                        style={{
                                          minHeight: '40px',
                                          display: 'flex',
                                          alignItems: 'center'
                                        }}
                                      >
                                        {el.text}
                                      </div>
                                    ))}
                                  </div>
                                )
                              })()
                            )}
                            {((t.task_type || (t as any).phase_type) !== 'layer' && (t.task_type || (t as any).phase_type) !== 'text') && (
                              (() => {
                                // Build list of URLs for grid tasks
                                const list: Array<{ url: string; name?: string; alt_text?: string }> = []

                                // Case 1: elements_shown_content is an object of strings or objects
                                if (t.elements_shown_content && typeof t.elements_shown_content === 'object') {
                                  const contentObj: Record<string, any> = t.elements_shown_content as any
                                  const shownMap: Record<string, any> = t.elements_shown_in_task || t.elements_shown || {}

                                  Object.entries(contentObj).forEach(([key, val]) => {
                                    const isVisible = Number(shownMap[key]) === 1 || (val && typeof val === 'object' && Number((val as any).visible) === 1)

                                    if (isVisible) {
                                      if (val && typeof val === 'object') {
                                        const url = (val as any).url || (val as any).content
                                        if (typeof url === 'string' && url) {
                                          list.push({ url, name: key })
                                        }
                                      } else if (typeof val === 'string' && val) {
                                        list.push({ url: val, name: key })
                                      }
                                    }
                                  })
                                }

                                // Case 2: derive from *_content keys inside elements_shown_in_task
                                if (list.length === 0 && t.elements_shown_in_task && typeof t.elements_shown_in_task === 'object') {
                                  const map: Record<string, any> = t.elements_shown_in_task as any
                                  Object.keys(map)
                                    .filter((k) => k.endsWith('_content'))
                                    .forEach((k) => {
                                      const base = k.replace(/_content$/, '')
                                      const shown = Number(map[base]) === 1
                                      const url = String(map[k] || '')
                                      if (shown && url) list.push({ url, name: base })
                                    })
                                }

                                // Case 3: legacy: derive from *_content inside elements_shown
                                if (list.length === 0 && t.elements_shown && typeof t.elements_shown === 'object') {
                                  const map: Record<string, any> = t.elements_shown as any
                                  Object.keys(map)
                                    .filter((k) => k.endsWith('_content'))
                                    .forEach((k) => {
                                      const base = k.replace(/_content$/, '')
                                      const shown = Number(map[base]) === 1
                                      const url = String(map[k] || '')
                                      if (shown && url) list.push({ url, name: base })
                                    })
                                }

                                if (list.length === 0) {
                                  return (
                                    <div className="col-span-2 text-sm text-gray-500">No elements to display</div>
                                  )
                                }

                                return list.map((e, i) => (
                                  <div key={i} className="aspect-[4/5] rounded-md overflow-hidden flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={e.url} alt={e?.alt_text || e?.name || ''} className="object-contain w-full h-full" />
                                  </div>
                                ))
                              })()
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
                  <div className="flex justify-between items-center">
                    <div className="text-[15px] font-semibold" style={{ color: '#2674BA' }}>Classification Questions</div>
                    {data.classification_answers && data.classification_answers.length > 0 && (
                      <div className="text-sm text-gray-500">
                        Total Time: {(() => {
                          // Calculate total time spent on classification questions
                          const totalTime = data.classification_answers.reduce((sum, ans) => {
                            return sum + (ans.time_spent_seconds || 0)
                          }, 0)
                          return `${totalTime}s`
                        })()}
                      </div>
                    )}
                  </div>
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
                      <div className="text-gray-600 uppercase tracking-wide">AGE</div>
                      <div className="font-medium">
                        {data.personal_info?.age ||
                          (data.personal_info?.date_of_birth ? calculateAge(data.personal_info.date_of_birth) : '-')}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-600 uppercase tracking-wide">GENDER</div>
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


