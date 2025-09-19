"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
// Preview mode: no API calls, no persistence

type Task = {
  id: string
  leftImageUrl?: string
  rightImageUrl?: string
  leftLabel?: string
  rightLabel?: string
  layeredImages?: Array<{ url: string; z: number }>
  gridUrls?: string[]
  // Source maps from backend to echo on submit
  _elements_shown?: Record<string, any>
  _elements_shown_content?: Record<string, any>
}

export default function TasksPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  // Load tasks from localStorage (preview-only) and DO NOT write anything back
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
    firstViewTimeRef.current = new Date().toISOString()
    lastViewTimeRef.current = null
    hoverCountsRef.current = {}
    clickCountsRef.current = {}
  }, [])

  useEffect(() => {
    try {
      setIsFetching(true)
      setFetchError(null)

      const step2Raw = typeof window !== 'undefined' ? localStorage.getItem('cs_step2') : null
      const step3Raw = typeof window !== 'undefined' ? localStorage.getItem('cs_step3') : null
      const matrixRaw = typeof window !== 'undefined' ? localStorage.getItem('cs_step7_matrix') : null

      if (!matrixRaw) throw new Error('Missing tasks in localStorage (cs_step7_matrix)')

      const s2 = step2Raw ? JSON.parse(step2Raw) : {}
      const s3 = step3Raw ? JSON.parse(step3Raw) : {}
      const matrix = JSON.parse(matrixRaw)

      const typeNorm = (s2?.study_type || s2?.metadata?.study_type || s2?.type || '').toString().toLowerCase()
      const normalizedType: 'grid' | 'layer' | undefined = typeNorm.includes('layer') ? 'layer' : (typeNorm.includes('grid') ? 'grid' : undefined)
      setStudyType(normalizedType)

      setMainQuestion(String(s2?.main_question || s2?.question || ''))

      // Rating labels can live in various shapes in cs_step3
      const rsSrc = (s3 && typeof s3 === 'object') ? s3 : {}
      const rs = (rsSrc as any).rating ?? (rsSrc as any).rating_scale ?? rsSrc
      const left = (rs?.minLabel ?? rs?.min_label ?? rs?.leftLabel ?? rs?.left_label ?? rs?.left ?? rs?.min) ?? ""
      const right = (rs?.maxLabel ?? rs?.max_label ?? rs?.rightLabel ?? rs?.right_label ?? rs?.right ?? rs?.max) ?? ""
      const middle = (rs?.middleLabel ?? rs?.middle_label ?? rs?.middle ?? rs?.midLabel ?? rs?.mid_label) ?? ""
      setScaleLabels({ left: String(left ?? ''), right: String(right ?? ''), middle: String(middle ?? '') })

      // Use preview data (1 respondent only) for display
      let respondentTasks: any[] = []
      if (Array.isArray(matrix)) {
        respondentTasks = matrix
      } else if (matrix && typeof matrix === 'object') {
        // Check for new preview format first
        if (Array.isArray((matrix as any).preview_tasks)) {
          respondentTasks = (matrix as any).preview_tasks
        } else if (Array.isArray((matrix as any).tasks)) {
          respondentTasks = (matrix as any).tasks
        } else if ((matrix as any).tasks && typeof (matrix as any).tasks === 'object') {
          const buckets = (matrix as any).tasks as Record<string, any>
          // Prefer bucket "0" if present; otherwise pick the first non-empty array
          if (Array.isArray((buckets as any)['0']) && (buckets as any)['0'].length) {
            respondentTasks = (buckets as any)['0']
          } else {
            for (const v of Object.values(buckets)) {
              if (Array.isArray(v) && v.length) { respondentTasks = v; break }
            }
          }
        }
      }

      const parsed: Task[] = (Array.isArray(respondentTasks) ? respondentTasks : [])
        .map((t: any) => {
          if (normalizedType === 'layer') {
            const shown = t?.elements_shown || {}
            const content = t?.elements_shown_content || {}
            const layers = Object.keys(shown)
              .filter((k) => Number(shown[k]) === 1 && content?.[k]?.url)
              .map((k) => ({ url: String(content[k].url), z: Number(content[k].z_index ?? 0) }))
              .sort((a, b) => a.z - b.z)
            return {
              id: String(t?.task_id ?? t?.task_index ?? Math.random()),
              layeredImages: layers,
              _elements_shown: shown,
              _elements_shown_content: content,
            }
          } else {
            const es = t?.elements_shown || {}
            const content = t?.elements_shown_content || {}
            const activeKeys = Object.keys(es).filter((k) => Number(es[k]) === 1)

            const getUrlForKey = (k: string): string | undefined => {
              // FIRST: Check directly in elements_shown for k_content (this is where your URLs are!)
              const directUrl = (es as any)[`${k}_content`]
              if (typeof directUrl === 'string' && directUrl) return directUrl
              
              // Then check the content object if it exists
              const c1: any = (content as any)[k]
              if (c1 && typeof c1 === 'object' && typeof c1.url === 'string') return c1.url
              
              const c2: any = (content as any)[`${k}_content`]
              if (c2 && typeof c2 === 'object' && typeof c2.url === 'string') return c2.url
              if (typeof c2 === 'string') return c2
              
              const s2: any = (content as any)[k]
              if (typeof s2 === 'string') return s2
              
              return undefined
            }

            const list: string[] = []
            activeKeys.forEach((k) => {
              const url = getUrlForKey(k)
              if (typeof url === 'string' && url) list.push(url)
            })

            // As a last resort, scan content object for any url fields when no activeKeys resolved
            if (list.length === 0 && content && typeof content === 'object') {
              Object.values(content).forEach((v: any) => {
                if (v && typeof v === 'object' && typeof v.url === 'string') list.push(v.url)
                if (typeof v === 'string') list.push(v)
              })
            }

            // Fallback: if we still have fewer than 4 images, try to pull any *_content string URLs from elements_shown itself
            try {
              if (list.length < 4 && es && typeof es === 'object') {
                const seen = new Set(list)
                Object.entries(es as Record<string, any>).forEach(([key, val]) => {
                  if (list.length >= 4) return
                  if (typeof val === 'string' && key.endsWith('_content') && val.startsWith('http') && !seen.has(val)) {
                    list.push(val)
                    seen.add(val)
                  }
                })
              }
            } catch {}

            return {
              id: String(t?.task_id ?? t?.task_index ?? Math.random()),
              leftImageUrl: list[0],
              rightImageUrl: list[1],
              leftLabel: '',
              rightLabel: '',
              gridUrls: list, // Store all URLs for grid display
              _elements_shown: es,
              _elements_shown_content: content,
            }
          }
        })

      setTasks(parsed)
      // Preload all task images in background to avoid display jitter
      try {
        const urls = new Set<string>()
        parsed.forEach((t) => {
          if (t.layeredImages && t.layeredImages.length > 0) {
            t.layeredImages.forEach((li) => li.url && urls.add(li.url))
          } else {
            if (t.gridUrls) {
              t.gridUrls.forEach((url) => urls.add(url))
            } else {
              if (t.leftImageUrl) urls.add(t.leftImageUrl)
              if (t.rightImageUrl) urls.add(t.rightImageUrl)
            }
          }
        })
        const unique = Array.from(urls).filter((u) => !preloadedUrlsRef.current.has(u))
        unique.forEach((u) => preloadedUrlsRef.current.add(u))
        unique.forEach((src) => {
          const img = new Image()
          img.decoding = 'async'
          // @ts-ignore
          img.referrerPolicy = 'no-referrer'
          img.src = src
        })
      } catch {}
    } catch (err: any) {
      console.error('Failed to load tasks from localStorage:', err)
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

  const enqueueTask = (_rating: number) => {
    // Preview mode: no-op (do not store or send anything)
  }

  // Preview mode: no background submission

  // Preview mode: no session submission

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

    // Do not persist any timing info in preview

    enqueueTask(value)

    if (currentTaskIndex < totalTasks - 1) {
      setTimeout(() => setCurrentTaskIndex((i) => i + 1), 80)
    } else {
      setIsLoading(true)
      // Preview: no flush or submit; navigate to preview thank-you
      setTimeout(() => router.push(`/home/create-study/preview/thank-you`), 600)
    }
  }

  const progressPct = Math.max(
    2,
    Math.min(100, Math.round(((Math.min(currentTaskIndex, Math.max(totalTasks - 1, 0)) + 1) / Math.max(totalTasks, 1)) * 100))
  )

  const task = tasks[currentTaskIndex]

  const isFinished = totalTasks > 0 && currentTaskIndex >= totalTasks - 1 && lastSelected !== null

  return (
    <div className="h-[100dvh] lg:min-h-screen lg:bg-white overflow-hidden lg:overflow-visible" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-12 md:pt-14 pb-16">
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
            <div className="lg:hidden flex flex-col h-[calc(100vh-150px)] overflow-hidden" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              {/* Progress Section - Outside white card */}
              <div className="mb-0">
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
                        <div className="relative w-full max-w-none overflow-hidden rounded-md h-[60vh]">
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
                        <div className="w-full max-w-full overflow-hidden max-h-[60vh]">
                          {task?.gridUrls && task.gridUrls.length > 2 ? (
                            <div className="grid grid-cols-2 gap-3 w-full overflow-hidden">
                              {task.gridUrls.slice(0, 4).map((url, i) => (
                                <div key={i} className="aspect-square w-full overflow-hidden rounded-md">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`element-${i+1}`}
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-md max-h-[25vh]">
                                {task?.leftImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={task.leftImageUrl}
                                    alt="left"
                                    className="h-full w-full object-contain"
                                  />
                                ) : null}
                              </div>
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-md max-h-[30vh]">
                                {task?.rightImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={task.rightImageUrl}
                                    alt="right"
                                    className="h-full w-full object-contain"
                                  />
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
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
                    <div className="mt-1 pb-4" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
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
                                className="relative flex flex-col items-center pt-7"
                                onMouseEnter={() => {
                                  hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                                  lastViewTimeRef.current = new Date().toISOString()
                                }}
                              >
                                <div className="absolute top-0 w-[120px] text-xs font-medium text-gray-800 text-center whitespace-nowrap truncate">{labelText}</div>
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

            {/* Desktop Layout */}
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
                            <div className="aspect-[4/3] w-full overflow-hidden rounded-md">{urls[0] && (<img src={urls[0]} alt="left" className="h-full w-full object-contain" />)}</div>
                            <div className="aspect-[4/3] w-full overflow-hidden rounded-md">{urls[1] && (<img src={urls[1]} alt="right" className="h-full w-full object-contain" />)}</div>
                          </div>
                        )
                      }
                      return (
                        <div className={`grid grid-cols-2 gap-4`}>
                          {urls.slice(0,4).map((url, i) => (
                            <div key={i} className="aspect-[4/3] w-full md:h-[24vh] lg:h-[26vh] overflow-hidden rounded-md">
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
                            className="relative flex flex-col items-center pt-7"
                            onMouseEnter={() => {
                              hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                              lastViewTimeRef.current = new Date().toISOString()
                            }}
                          >
                            <div className="absolute top-0 w-[160px] text-[11px] sm:text-xs lg:text-sm font-medium text-gray-900 text-center whitespace-nowrap truncate">{labelText}</div>
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