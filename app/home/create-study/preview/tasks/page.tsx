"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { imageCacheManager } from "@/lib/utils/imageCacheManager"
// Preview mode: no API calls, no persistence

// Helper function to get cached URLs for display
const getCachedUrl = (url: string | undefined): string => {
  if (!url) {
    return "/placeholder.svg"
  }

  const cachedUrl = imageCacheManager.getCachedUrl(url)
  return cachedUrl
}

type Task = {
  id: string
  leftImageUrl?: string
  rightImageUrl?: string
  leftLabel?: string
  rightLabel?: string
  layeredImages?: Array<{ url: string; z: number }>
  gridUrls?: string[]
  // Source maps from backend to echo on submit
  _elements_shown?: Record<string, unknown>
  _elements_shown_content?: Record<string, unknown>
}

export default function TasksPage() {
  // const params = useParams<{ id: string }>()
  const router = useRouter()

  // Load tasks from localStorage (preview-only) and DO NOT write anything back
  const [tasks, setTasks] = useState<Task[]>([])
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [scaleLabels, setScaleLabels] = useState<{ left: string; right: string; middle: string }>({ left: "", right: "", middle: "" })
  const [studyType, setStudyType] = useState<'grid' | 'layer' | undefined>(undefined)
  const [mainQuestion, setMainQuestion] = useState<string>("")
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)

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
      const layerBgRaw = typeof window !== 'undefined' ? localStorage.getItem('cs_step5_layer_background') : null

      if (!matrixRaw) throw new Error('Missing tasks in localStorage (cs_step7_matrix)')

      const s2 = step2Raw ? JSON.parse(step2Raw) : {}
      const s3 = step3Raw ? JSON.parse(step3Raw) : {}
      const matrix = JSON.parse(matrixRaw)
      const layerBg = layerBgRaw ? JSON.parse(layerBgRaw) : null

      const typeNorm = (matrix?.metadata?.study_type || s2?.study_type || s2?.metadata?.study_type || s2?.type || '')
        .toString()
        .toLowerCase()
      const normalizedType: 'grid' | 'layer' | undefined = typeNorm.includes('layer') ? 'layer' : (typeNorm.includes('grid') ? 'grid' : undefined)
      setStudyType(normalizedType)

      setMainQuestion(String(s2?.mainQuestion || s2?.main_question || s2?.question || ''))

      // Background for layer preview (optional)
      try {
        const bg = layerBg?.secureUrl || layerBg?.previewUrl || null
        setBackgroundUrl(bg || null)
      } catch { setBackgroundUrl(null) }

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
            console.log('[Preview Tasks] Task elements_shown:', shown)
            console.log('[Preview Tasks] Task elements_shown_content:', content)
            const layers = Object.keys(shown)
              .filter((k) => Number(shown[k]) === 1 && content?.[k]?.url)
              .map((k) => ({ url: String(content[k].url), z: Number(content[k].z_index ?? 0) }))
              .sort((a, b) => a.z - b.z)
            console.log('[Preview Tasks] Parsed layers:', layers)
            return { 
              id: String(t?.task_id ?? t?.task_index ?? Math.random()),
              layeredImages: layers,
              _elements_shown: shown,
              _elements_shown_content: content,
            }
          } else {
            const es = t?.elements_shown || {}
            const content = t?.elements_shown_content || {}
            console.log('[Preview Tasks] Grid task elements_shown:', es)
            console.log('[Preview Tasks] Grid task elements_shown_content:', content)
            const activeKeys = Object.keys(es).filter((k) => Number(es[k]) === 1)
            console.log('[Preview Tasks] Active keys:', activeKeys)

            const getUrlForKey = (k: string): string | undefined => {
              // 1) elements_shown may embed direct URL under k_content
              const directUrl = (es as any)[`${k}_content`]
              if (typeof directUrl === 'string' && directUrl) return directUrl
              
              // 2) content object: prefer url, then content
              const c1: any = (content as any)[k]
              if (c1 && typeof c1 === 'object') {
                if (typeof c1.url === 'string' && c1.url) return c1.url
                if (typeof c1.content === 'string' && c1.content) return c1.content
              }
              
              const c2: any = (content as any)[`${k}_content`]
              if (c2 && typeof c2 === 'object') {
                if (typeof c2.url === 'string' && c2.url) return c2.url
                if (typeof c2.content === 'string' && c2.content) return c2.content
              }
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
                if (v && typeof v === 'object') {
                  if (typeof v.url === 'string' && v.url) list.push(v.url)
                  if (typeof v.content === 'string' && v.content) list.push(v.content)
                }
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
          const img = document.createElement('img')
          ;(img as any).decoding = 'async'
          ;(img as any).referrerPolicy = 'no-referrer'
          img.src = src
        })
      } catch {}
    } catch (err: unknown) {
      console.error('Failed to load tasks from localStorage:', err)
      setFetchError((err as Error)?.message || 'Failed to load tasks')
    } finally {
      setIsFetching(false)
    }
  }, [])

  const totalTasks = tasks.length
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  // const [responseTimesSec, setResponseTimesSec] = useState<number[]>([])
  const taskStartRef = useRef<number>(Date.now())
  const [lastSelected, setLastSelected] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const preloadedUrlsRef = useRef<Set<string>>(new Set())

  // Hide initial loading after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

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
    // Preview mode - no actual submission
    // Preview mode: no-op (do not store or send anything)
  }

  // Preview mode: no background submission

  // Preview mode: no session submission

  const handleSelect = (value: number) => {
    clickCountsRef.current[value] = (clickCountsRef.current[value] || 0) + 1

    const elapsedMs = Date.now() - taskStartRef.current
    const seconds = Number((elapsedMs / 1000).toFixed(3))
    // setResponseTimesSec((prev) => {
    //   const next = [...prev]
    //   next[currentTaskIndex] = seconds
    //   return next
    // })
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

  // const isFinished = totalTasks > 0 && currentTaskIndex >= totalTasks - 1 && lastSelected !== null

  return (
    <div
      className="h-[100dvh] lg:min-h-screen lg:bg-white overflow-hidden lg:overflow-visible"
      style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
    >
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
            <div
              className="lg:hidden flex flex-col h-[calc(100vh-150px)] overflow-hidden"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            >
              {/* Progress Section */}
              <div className="mb-4 flex-shrink-0">
                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden mb-3">
                  <div
                    className="h-full bg-[rgba(38,116,186,1)] rounded transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
                <div className="text-sm sm:text-base font-medium text-gray-800 leading-tight break-words hyphens-auto">
                  {mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}
                </div>
              </div>

              {/* Main Content - Full height layout */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                      <h2 className="text-xl font-semibold text-gray-900">Processing your responses...</h2>
                      <p className="mt-2 text-sm text-gray-600">Please wait while we save your study data.</p>
                    </div>
                  </div>
                ) : isInitialLoading ? (
                  <div className="flex-1 flex items-center justify-center pb-2 min-h-0">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                      <h2 className="text-xl font-semibold text-gray-900">Loading images...</h2>
                      <p className="mt-2 text-sm text-gray-600">Preparing task images for optimal display.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Image Section - Flexible responsive layout */}
                    <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-2">
                      {studyType === "layer" ? (
                        <div className="relative w-full max-w-md sm:max-w-lg overflow-hidden aspect-square">
                          {/* Always use individual layers for both mobile and desktop */}
                          <div className="relative w-full h-full">
                            {backgroundUrl && (
                              <img
                                src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                alt="Background"
                                decoding="async"
                                loading="eager"
                                fetchPriority="high"
                                width={600}
                                height={600}
                                className="absolute inset-0 m-auto h-full w-full object-contain"
                                style={{ zIndex: 0 }}
                              />
                            )}
                            {task?.layeredImages?.map((img, idx) => {
                              const resolved = getCachedUrl(img.url) || "/placeholder.svg"
                              return (
                                <img
                                  key={`${img.url}-${idx}`}
                                  src={resolved || "/placeholder.svg"}
                                  alt={String(img.z)}
                                  decoding="async"
                                  loading="eager"
                                  fetchPriority="high"
                                  width={600}
                                  height={600}
                                  className="absolute inset-0 m-auto h-full w-full object-contain"
                                  style={{ zIndex: (img.z ?? 0) + 1 }}
                                  onError={() => {
                                    console.error("Layer image failed to load:", img.url)
                                  }}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-md sm:max-w-lg overflow-hidden relative">
                          {backgroundUrl && (
                            <img
                              src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                              alt="Background"
                              decoding="async"
                              loading="eager"
                              fetchPriority="high"
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ zIndex: 0 }}
                            />
                          )}
                          {task?.gridUrls && task.gridUrls.length === 3 ? (
                            // Special layout for exactly 3 images - all same size
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 relative" style={{ zIndex: 1 }}>
                              {/* First two images in top row */}
                              {task.gridUrls.slice(0, 2).map((url, i) => (
                                <div key={i} className="aspect-square w-full overflow-hidden">
                                  <Image
                                    src={getCachedUrl(url) || "/placeholder.svg"}
                                    alt={`element-${i + 1}`}
                                    width={300}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={url?.includes("blob.core.windows.net")}
                                  />
                                </div>
                              ))}
                              {/* Third image - same size as others, centered */}
                              <div className="col-span-2 flex justify-center">
                                <div className="aspect-square w-1/2 overflow-hidden">
                                  <Image
                                    src={getCachedUrl(task.gridUrls[2]) || "/placeholder.svg"}
                                    alt="element-3"
                                    width={300}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={task.gridUrls[2]?.includes("blob.core.windows.net")}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : task?.gridUrls && task.gridUrls.length > 3 ? (
                            <div
                              className="grid grid-cols-2 gap-2 sm:gap-3 w-full overflow-hidden place-items-center relative"
                              style={{ zIndex: 1 }}
                            >
                              {task.gridUrls.slice(0, 4).map((url, i) => (
                                <div key={i} className="aspect-square w-full overflow-hidden">
                                  <Image
                                    src={getCachedUrl(url) || "/placeholder.svg"}
                                    alt={`element-${i + 1}`}
                                    width={300}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={url?.includes("blob.core.windows.net")}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 sm:gap-3 relative" style={{ zIndex: 1 }}>
                              <div className="aspect-[4/3] w-full overflow-hidden max-h-[22vh]">
                                {task?.leftImageUrl ? (
                                  <Image
                                    src={getCachedUrl(task.leftImageUrl) || "/placeholder.svg"}
                                    alt="left"
                                    width={400}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={task.leftImageUrl?.includes("blob.core.windows.net")}
                                  />
                                ) : null}
                              </div>
                              <div className="aspect-[4/3] w-full overflow-hidden max-h-[22vh]">
                                {task?.rightImageUrl ? (
                                  <Image
                                    src={getCachedUrl(task.rightImageUrl) || "/placeholder.svg"}
                                    alt="right"
                                    width={400}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={task.rightImageUrl?.includes("blob.core.windows.net")}
                                  />
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Labels for grid study */}
                    {studyType === "grid" && (
                      <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm font-semibold text-gray-800 mb-2 px-2 flex-shrink-0">
                        <div className="text-center text-balance">{task?.leftLabel ?? ""}</div>
                        <div className="text-center text-balance">{task?.rightLabel ?? ""}</div>
                      </div>
                    )}

                    {/* Rating Scale - Bottom with iOS safe area padding */}
                    <div
                      className="mt-auto pb-2 px-2 flex-shrink-0"
                      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
                    >
                      {/* Horizontal scale buttons (1-5) */}
                      <div className="flex items-center justify-center mb-2">
                        <div className="flex items-center justify-between w-full max-w-sm gap-1">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            return (
                              <button
                                key={n}
                                onClick={() => handleSelect(n)}
                                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 transition-colors text-sm sm:text-base font-semibold flex-shrink-0 ${
                                  selected
                                    ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                                }`}
                                onMouseEnter={() => {
                                  hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                                  lastViewTimeRef.current = new Date().toISOString()
                                }}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col items-start justify-center gap-2 px-2">
                        {/* Label for 1 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs sm:text-sm font-semibold text-gray-700 flex-shrink-0">
                            1
                          </div>
                          {scaleLabels.left && (
                            <div className="text-xs sm:text-sm font-medium text-gray-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                              {scaleLabels.left}
                            </div>
                          )}
                        </div>

                        {/* Label for 3 (optional) */}
                        {scaleLabels.middle && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs sm:text-sm font-semibold text-gray-700 flex-shrink-0">
                              3
                            </div>
                            <div className="text-xs sm:text-sm font-medium text-gray-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                              {scaleLabels.middle}
                            </div>
                          </div>
                        )}

                        {/* Label for 5 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs sm:text-sm font-semibold text-gray-700 flex-shrink-0">
                            5
                          </div>
                          {scaleLabels.right && (
                            <div className="text-xs sm:text-sm font-medium text-gray-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                              {scaleLabels.right}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:block">
              <div className="flex items-start justify-between text-sm text-gray-600 mb-1 gap-4">
                <div className="text-base font-medium text-gray-800 flex-1 leading-tight break-words hyphens-auto max-w-[calc(100%-5rem)]">
                  {mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}
                </div>
              </div>
              <div className="h-1 rounded bg-gray-200 overflow-hidden">
                <div className="h-full bg-[rgba(38,116,186,1)] transition-all" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="mt-4 bg-white border rounded-xl shadow-sm p-3 sm:p-4">
                {isLoading ? (
                  <div className="p-6 sm:p-10 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Processing your responses...</h2>
                    <p className="mt-2 text-sm text-gray-600">Please wait while we save your study data.</p>
                  </div>
                ) : isInitialLoading ? (
                  <div className="p-6 sm:p-10 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Loading images...</h2>
                    <p className="mt-2 text-sm text-gray-600">Preparing task images for optimal display.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studyType === "layer" ? (
                      <div className="flex justify-center">
                        <div className="relative w-full max-w-lg aspect-square overflow-hidden">
                          <div className="relative w-full h-full">
                            {backgroundUrl && (
                              <img
                                src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                alt="Background"
                                decoding="async"
                                loading="eager"
                                fetchPriority="high"
                                width={800}
                                height={800}
                                className="absolute inset-0 m-auto h-full w-full object-contain"
                                style={{ zIndex: 0 }}
                              />
                            )}
                            {task?.layeredImages?.map((img, idx) => {
                              const resolved = getCachedUrl(img.url) || "/placeholder.svg"
                              return (
                                <img
                                  key={`${img.url}-${idx}`}
                                  src={resolved || "/placeholder.svg"}
                                  alt={String(img.z)}
                                  decoding="async"
                                  loading="eager"
                                  fetchPriority="high"
                                  width={600}
                                  height={600}
                                  className="absolute inset-0 m-auto h-full w-full object-contain"
                                  style={{ zIndex: (img.z ?? 0) + 1 }}
                                />
                              )
                            })}
                            {(tasks[currentTaskIndex + 1]?.layeredImages || []).map((img, idx) => {
                              const resolved = getCachedUrl(img.url) || "/placeholder.svg"
                              return (
                                <img
                                  key={`next-desktop-${img.url}-${idx}`}
                                  src={resolved || "/placeholder.svg"}
                                  alt={String(img.z)}
                                  decoding="async"
                                  loading="eager"
                                  fetchPriority="high"
                                  style={{
                                    position: "absolute",
                                    top: -99999,
                                    left: -99999,
                                    width: 1,
                                    height: 1,
                                    visibility: "hidden",
                                  }}
                                />
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const urls = (
                          task?.gridUrls && task.gridUrls.length
                            ? task.gridUrls
                            : [task?.leftImageUrl, task?.rightImageUrl].filter(Boolean)
                        ) as string[]

                        if (urls.length <= 2) {
                          return (
                            <div className="grid grid-cols-2 gap-4 relative max-w-2xl mx-auto">
                              {backgroundUrl && (
                                <img
                                  src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                  alt="Background"
                                  decoding="async"
                                  loading="eager"
                                  fetchPriority="high"
                                  className="absolute inset-0 w-full h-full object-cover"
                                  style={{ zIndex: 0 }}
                                />
                              )}
                              <div className="aspect-square w-full overflow-hidden border" style={{ zIndex: 1 }}>
                                {urls[0] && (
                                  <Image
                                    src={getCachedUrl(urls[0]) || "/placeholder.svg"}
                                    alt="left"
                                    width={300}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    unoptimized={urls[0]?.includes("blob.core.windows.net")}
                                  />
                                )}
                              </div>
                              <div className="aspect-square w-full overflow-hidden border" style={{ zIndex: 1 }}>
                                {urls[1] && (
                                  <Image
                                    src={getCachedUrl(urls[1]) || "/placeholder.svg"}
                                    alt="right"
                                    width={300}
                                    height={300}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    unoptimized={urls[1]?.includes("blob.core.windows.net")}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        }

                        if (urls.length === 3) {
                          return (
                            <div className="relative max-w-2xl mx-auto">
                              {backgroundUrl && (
                                <img
                                  src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                  alt="Background"
                                  decoding="async"
                                  loading="eager"
                                  fetchPriority="high"
                                  className="absolute inset-0 w-full h-full object-cover"
                                  style={{ zIndex: 0 }}
                                />
                              )}
                              <div className="flex flex-col gap-4" style={{ zIndex: 1 }}>
                                <div className="grid grid-cols-2 gap-4">
                                  {urls.slice(0, 2).map((url, i) => (
                                    <div key={i} className="aspect-square w-full overflow-hidden border">
                                      <Image
                                        src={getCachedUrl(url as string) || "/placeholder.svg"}
                                        alt={`element-${i + 1}`}
                                        width={300}
                                        height={300}
                                        className="h-full w-full object-contain"
                                        unoptimized={(url as string)?.includes("blob.core.windows.net")}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="w-full flex justify-center">
                                  <div className="aspect-square w-1/2 overflow-hidden border">
                                    <Image
                                      src={getCachedUrl(urls[2] as string) || "/placeholder.svg"}
                                      alt="element-3"
                                      width={300}
                                      height={300}
                                      className="h-full w-full object-contain"
                                      unoptimized={(urls[2] as string)?.includes("blob.core.windows.net")}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div className="grid grid-cols-2 gap-4 relative max-w-2xl mx-auto">
                            {backgroundUrl && (
                              <img
                                src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                alt="Background"
                                decoding="async"
                                loading="eager"
                                fetchPriority="high"
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ zIndex: 0 }}
                              />
                            )}
                            {urls.slice(0, 4).map((url, i) => (
                              <div
                                key={i}
                                className="aspect-square w-full overflow-hidden border"
                                style={{ zIndex: 1 }}
                              >
                                <Image
                                  src={getCachedUrl(url as string) || "/placeholder.svg"}
                                  alt={`element-${i + 1}`}
                                  width={300}
                                  height={300}
                                  className="h-full w-full object-contain"
                                  unoptimized={(url as string)?.includes("blob.core.windows.net")}
                                />
                              </div>
                            ))}
                          </div>
                        )
                      })()
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-800">
                      <div className="text-center text-balance">{task?.leftLabel ?? ""}</div>
                      <div className="text-center text-balance">{task?.rightLabel ?? ""}</div>
                    </div>

                    <div className="w-full max-w-2xl mx-auto mt-4">
                      <div className="flex items-center justify-center mb-3">
                        <div className="flex items-center justify-between w-full max-w-lg gap-2">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            return (
                              <button
                                key={n}
                                onClick={() => handleSelect(n)}
                                className={`h-11 w-11 lg:h-12 lg:w-12 xl:h-14 xl:w-14 rounded-full border-2 transition-colors text-sm lg:text-base xl:text-lg font-semibold flex-shrink-0 ${
                                  selected
                                    ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                                }`}
                                onMouseEnter={() => {
                                  hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                                  lastViewTimeRef.current = new Date().toISOString()
                                }}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col items-start justify-center gap-2 px-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs lg:text-sm font-semibold text-gray-700 flex-shrink-0">
                            1
                          </div>
                          {scaleLabels.left && (
                            <div className="text-sm lg:text-base xl:text-lg font-medium text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                              {scaleLabels.left}
                            </div>
                          )}
                        </div>

                        {scaleLabels.middle && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs lg:text-sm font-semibold text-gray-700 flex-shrink-0">
                              3
                            </div>
                            <div className="text-sm lg:text-base xl:text-lg font-medium text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                              {scaleLabels.middle}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs lg:text-sm font-semibold text-gray-700 flex-shrink-0">
                            5
                          </div>
                          {scaleLabels.right && (
                            <div className="text-sm lg:text-base xl:text-lg font-medium text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                              {scaleLabels.right}
                            </div>
                          )}
                        </div>
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