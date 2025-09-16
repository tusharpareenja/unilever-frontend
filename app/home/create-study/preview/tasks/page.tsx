"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Task = {
  id: string
  leftImageUrl?: string
  rightImageUrl?: string
  leftLabel?: string
  rightLabel?: string
  layeredImages?: Array<{ url: string; z: number }>
  gridUrls?: string[]
}

export default function TasksPage() {
  const router = useRouter()

  // Load tasks from localStorage study details using respondentId
  const [tasks, setTasks] = useState<Task[]>([])
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [scaleLabels, setScaleLabels] = useState<{ left: string; right: string; middle: string }>({ left: "", right: "", middle: "" })
  const [studyType, setStudyType] = useState<'grid' | 'layer' | undefined>(undefined)
  const [mainQuestion, setMainQuestion] = useState<string>("")

  // Interaction tracking
  const hoverCountsRef = useRef<Record<number, number>>({})
  const clickCountsRef = useRef<Record<number, number>>({})
  const firstViewTimeRef = useRef<string | null>(null)
  const lastViewTimeRef = useRef<string | null>(null)

  useEffect(() => {
    firstViewTimeRef.current = new Date().toISOString()
  }, [])

  useEffect(() => {
    try {
      setIsFetching(true)
      setFetchError(null)

      // Load from preview step caches
      const step2 = JSON.parse(localStorage.getItem('cs_step2') || '{}')
      const step3 = JSON.parse(localStorage.getItem('cs_step3') || '{}')
      const matrix = JSON.parse(localStorage.getItem('cs_step7_matrix') || 'null')

      setStudyType(step2?.type === 'layer' || (matrix?.metadata?.study_type || '').includes('layer') ? 'layer' : 'grid')
      setMainQuestion(String(step2?.mainQuestion || ''))
      setScaleLabels({ left: step3?.minLabel || '', right: step3?.maxLabel || '', middle: step3?.middleLabel || '' })

      // Normalize to single respondent bucket (robust across shapes)
      let raw: any[] = []
      const src = matrix?.tasks || matrix?.data?.tasks || matrix
      if (Array.isArray(src)) {
        raw = src
      } else if (src && typeof src === 'object') {
        const values = Object.values(src)
        // If values are arrays, pick the first non-empty; else if values are objects, look one level deeper
        let candidate: any[] | null = null
        for (const v of values) {
          if (Array.isArray(v) && v.length) { candidate = v; break }
        }
        if (!candidate) {
          for (const v of values) {
            if (v && typeof v === 'object') {
              const innerVals = Object.values(v as any)
              for (const iv of innerVals) { if (Array.isArray(iv) && iv.length) { candidate = iv; break } }
              if (candidate) break
            }
          }
        }
        raw = candidate || []
      }

      const parsed: Task[] = (raw || []).map((t: any) => {
        if ((step2?.type === 'layer') || (matrix?.metadata?.study_type || '').includes('layer')) {
          const shown = t?.elements_shown || {}
          const content = t?.elements_shown_content || {}
          const layers = Object.keys(shown)
            .filter((k) => Number(shown[k]) === 1 && content?.[k]?.url)
            .map((k) => ({ url: String(content[k].url), z: Number(content[k].z_index ?? 0) }))
            .sort((a, b) => a.z - b.z)
          return { id: String(t?.task_id ?? t?.task_index ?? Math.random()), layeredImages: layers }
        }
        // grid fallback
        const es = t?.elements_shown || {}
        const content = t?.elements_shown_content || {}
        const activeKeys = Object.keys(es).filter((k) => Number(es[k]) === 1)
        const getUrlForKey = (k: string): string | undefined => {
          const c1: any = (content as any)[k]; if (c1 && typeof c1 === 'object' && typeof c1.url === 'string') return c1.url
          const c2: any = (content as any)[`${k}_content`]; if (c2 && typeof c2 === 'object' && typeof c2.url === 'string') return c2.url
          const s1: any = (es as any)[`${k}_content`]; if (typeof s1 === 'string') return s1
          const s2: any = (content as any)[k]; if (typeof s2 === 'string') return s2
          return undefined
        }
        const list: string[] = []
        activeKeys.forEach((k) => { const url = getUrlForKey(k); if (typeof url === 'string' && url) list.push(url) })
        return { id: String(t?.task_id ?? t?.task_index ?? Math.random()), leftImageUrl: list[0], rightImageUrl: list[1], gridUrls: list }
      })

      setTasks(parsed)

      // Preload images
      try {
        const urls = new Set<string>()
        parsed.forEach((t) => {
          if (t.layeredImages) t.layeredImages.forEach((li) => li.url && urls.add(li.url))
          if (t.leftImageUrl) urls.add(t.leftImageUrl)
          if (t.rightImageUrl) urls.add(t.rightImageUrl)
        })
        const unique = Array.from(urls).filter((u) => !preloadedUrlsRef.current.has(u))
        unique.forEach((u) => preloadedUrlsRef.current.add(u))
        unique.forEach((src) => { const img = new Image(); img.decoding = 'async'; /* @ts-ignore */ img.referrerPolicy = 'no-referrer'; img.src = src })
      } catch {}
    } catch (err: any) {
      console.error('Failed to load preview tasks:', err)
      setFetchError(err?.message || 'Failed to load tasks')
    } finally {
      setIsFetching(false)
    }
  }, [])

  const totalTasks = tasks.length
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [responseTimesSec, setResponseTimesSec] = useState<number[]>([])
  const taskStartRef = useRef<number>(Date.now())
  const [lastSelected, setLastSelected] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const preloadedUrlsRef = useRef<Set<string>>(new Set())

  // Reset timer when task changes
  useEffect(() => {
    taskStartRef.current = Date.now()
    setLastSelected(null)
    firstViewTimeRef.current = new Date().toISOString()
    lastViewTimeRef.current = null
    hoverCountsRef.current = {}
    clickCountsRef.current = {}
  }, [currentTaskIndex])

  // Preview mode: no network or storage submission

  const handleSelect = (value: number) => {
    clickCountsRef.current[value] = (clickCountsRef.current[value] || 0) + 1

    const elapsedMs = Date.now() - taskStartRef.current
    const seconds = Number((elapsedMs / 1000).toFixed(3))
    setResponseTimesSec((prev) => {
      const next = [...prev]
      next[currentTaskIndex] = seconds
      return next
    })
    setLastSelected(value)

    if (currentTaskIndex < totalTasks - 1) {
      setTimeout(() => setCurrentTaskIndex((i) => i + 1), 80)
    } else {
      setIsLoading(false)
      router.push('/home/create-study/preview/thank-you')
    }
  }

  const progressPct = Math.max(
    2,
    Math.min(100, Math.round(((Math.min(currentTaskIndex, Math.max(totalTasks - 1, 0)) + 1) / Math.max(totalTasks, 1)) * 100))
  )

  const task = tasks[currentTaskIndex]

  const isFinished = totalTasks > 0 && currentTaskIndex >= totalTasks - 1 && lastSelected !== null

  return (
    <div className="min-h-screen lg:bg-white" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 md:pt-14 pb-16">
        {isFetching ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4" />
            <div className="text-sm text-gray-600">Loading tasks...</div>
          </div>
        ) : fetchError ? (
          <div className="p-6 text-center text-sm text-red-600">{fetchError}</div>
        ) : totalTasks === 0 ? (
          <div className="p-6 text-center text-sm text-gray-600">No tasks assigned.</div>
        ) : (
          <>
            {/* Mobile Layout - Exact copy of image */}
            <div className="lg:hidden flex flex-col h-[calc(100vh-150px)]" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              {/* Progress Section - Outside white card */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-base font-medium text-gray-800 truncate pr-3">{mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}</div>
                  <div className="text-base font-semibold text-[rgba(38,116,186,1)]">
                    {Math.min(currentTaskIndex + 1, totalTasks)} / {totalTasks}
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                  <div 
                    className="h-full bg-[rgba(38,116,186,1)] rounded transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
              </div>

              {/* Main Content - Full height layout */}
              <div className="flex-1 flex flex-col">
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                      <h2 className="text-xl font-semibold text-gray-900">Processing your responses...</h2>
                      <p className="mt-2 text-sm text-gray-600">Please wait while we save your study data.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Image Section - Centered in middle */}
                    <div className="flex-1 flex items-center justify-center">
                      {studyType === 'layer' ? (
                        <div className="relative w-full h-[65vh] max-w-none overflow-hidden rounded-md">
                          {task?.layeredImages?.map((img, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${img.url}-${idx}`}
                              src={img.url}
                              alt={String(img.z)}
                              className="absolute inset-0 m-auto h-full w-full object-contain"
                              style={{ zIndex: img.z }}
                            />
                          ))}
                        </div>
                      ) : (
                        (() => {
                          const urls = (task?.gridUrls && task.gridUrls.length ? task.gridUrls : [task?.leftImageUrl, task?.rightImageUrl].filter(Boolean)) as string[]
                          const count = urls.length
                          if (count <= 2) {
                            return (
                              <div className="flex flex-col gap-4 w-full max-w-sm">
                                <div className="aspect-[4/3] w-full overflow-hidden rounded-md border">
                                  {urls[0] && (<img src={urls[0]} alt="left" className="h-full w-full object-contain" />)}
                                </div>
                                <div className="aspect-[4/3] w-full overflow-hidden rounded-md border">
                                  {urls[1] && (<img src={urls[1]} alt="right" className="h-full w-full object-contain" />)}
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div className="grid grid-cols-2 gap-3 w-full max-w-md mx-auto">
                              {urls.slice(0,4).map((url, i) => (
                                <div key={i} className="aspect-square max-h-[42vw] w-full overflow-hidden rounded-md border bg-white flex items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url as string} alt={`element-${i+1}`} className="h-full w-full object-contain" />
                                </div>
                              ))}
                            </div>
                          )
                        })()
                      )}
                    </div>

                    {/* Labels for grid study */}
                    {studyType === 'grid' && (
                      <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-800 mb-6">
                        <div className="text-center">{task?.leftLabel ?? ""}</div>
                        <div className="text-center">{task?.rightLabel ?? ""}</div>
                      </div>
                    )}

                    {/* Rating Scale - Bottom with iOS safe area padding */}
                    <div className="mt-6 pb-6" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-5">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            let labelText = ""
                            if (n === 1) labelText = scaleLabels.left
                            if (n === 3) labelText = scaleLabels.middle
                            if (n === 5) labelText = scaleLabels.right

                            return (
                              <div
                                key={n}
                                className="flex flex-col items-center"
                                onMouseEnter={() => {
                                  hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                                  lastViewTimeRef.current = new Date().toISOString()
                                }}
                              >
                                <div className="h-5 flex items-end justify-center text-sm font-medium text-gray-800 mb-3">
                                  {labelText}
                                </div>
                                <button
                                  onClick={() => handleSelect(n)}
                                  className={`h-14 w-14 rounded-full border-2 transition-colors text-lg font-semibold ${
                                    selected
                                      ? "bg-white text-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)]"
                                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                                  }`}
                                >
                                  {n}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Desktop Layout - Keep original */}
            <div className="hidden lg:block">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <div className="text-base font-medium text-gray-800 truncate pr-3">{mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}</div>
                <span>
                  {Math.min(currentTaskIndex + 1, totalTasks)} / {totalTasks}
                </span>
              </div>
              <div className="h-1 rounded bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-[rgba(38,116,186,1)] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="mt-4 bg-white border rounded-xl shadow-sm p-3 sm:p-4">
              {isLoading ? (
                <div className="p-6 sm:p-10 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Processing your responses...</h2>
                  <p className="mt-2 text-sm text-gray-600">Please wait while we save your study data.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {studyType === 'layer' ? (
                    <div className="flex justify-center">
                      <div className="relative w-full max-w-lg aspect-square overflow-hidden rounded-md">
                        {task?.layeredImages?.map((img, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${img.url}-${idx}`}
                            src={img.url}
                            alt={String(img.z)}
                            className="absolute inset-0 m-auto h-full w-full object-contain"
                            style={{ zIndex: img.z }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const urls = (task?.gridUrls && task.gridUrls.length ? task.gridUrls : [task?.leftImageUrl, task?.rightImageUrl].filter(Boolean)) as string[]
                      if (urls.length <= 2) {
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="aspect-[4/3] w-full overflow-hidden rounded-md border">{urls[0] && (<img src={urls[0]} alt="left" className="h-full w-full object-contain" />)}</div>
                            <div className="aspect-[4/3] w-full overflow-hidden rounded-md border">{urls[1] && (<img src={urls[1]} alt="right" className="h-full w-full object-contain" />)}</div>
                          </div>
                        )
                      }
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {urls.slice(0,3).map((url, i) => (
                            <div key={i} className="aspect-[4/3] w-full overflow-hidden rounded-md border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url as string} alt={`element-${i+1}`} className="h-full w-full object-contain" />
                            </div>
                          ))}
                        </div>
                      )
                    })()
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-800">
                    <div className="text-center">{task?.leftLabel ?? ""}</div>
                    <div className="text-center">{task?.rightLabel ?? ""}</div>
                  </div>

                  {/* Labels and rating scale - Larger for desktop */}
                  <div className="w-fit mx-auto mt-6">
                    <div className="flex items-center justify-center gap-4 lg:gap-6">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const selected = lastSelected === n
                        let labelText = ""
                        if (n === 1) labelText = scaleLabels.left
                        if (n === 3) labelText = scaleLabels.middle
                        if (n === 5) labelText = scaleLabels.right

                        return (
                          <div
                            key={n}
                            className="flex flex-col items-center"
                            onMouseEnter={() => {
                              hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                              lastViewTimeRef.current = new Date().toISOString()
                            }}
                          >
                            <div className="h-6 lg:h-7 flex items-end justify-center text-[11px] sm:text-xs lg:text-sm font-medium text-gray-900 mb-1 lg:mb-2">
                              {labelText}
                            </div>
                            <button
                              onClick={() => handleSelect(n)}
                              className={`h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-full border-2 lg:border-2 transition-colors text-sm lg:text-base font-semibold ${
                                selected
                                  ? "border-[rgba(38,116,186,1)] text-[rgba(38,116,186,1)] bg-white"
                                  : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white"
                              }`}
                            >
                              {n}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}