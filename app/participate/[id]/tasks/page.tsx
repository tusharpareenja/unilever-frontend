"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useRef, useEffect, useLayoutEffect } from "react"
import Image from "next/image"
import { imageCacheManager } from "@/lib/utils/imageCacheManager"
import { getRespondentStudyDetails, submitTasksBulk } from "@/lib/api/ResponseAPI"

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
  type?: "grid" | "layer" | "text"
  leftImageUrl?: string
  rightImageUrl?: string
  leftLabel?: string
  rightLabel?: string
  layeredImages?: Array<{ url: string; z: number; layer_name?: string | null; transform?: { x: number; y: number; width: number; height: number } }>
  gridUrls?: string[]
  compositeLayerUrl?: string
  _elements_shown?: Record<string, unknown>
  _elements_shown_content?: Record<string, unknown>
}

export default function TasksPage() {
  const params = useParams<{ id: string }>()
  const studyIdFromParams = params.id
  const router = useRouter()

  const [tasks, setTasks] = useState<Task[]>([])
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [scaleLabels, setScaleLabels] = useState<{ left: string; right: string; middle: string }>({
    left: "",
    right: "",
    middle: "",
  })
  const [studyType, setStudyType] = useState<"grid" | "layer" | "text" | "hybrid" | undefined>(undefined)
  const [mainQuestion, setMainQuestion] = useState<string>("")
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)

  const hoverCountsRef = useRef<Record<number, number>>({})
  const clickCountsRef = useRef<Record<number, number>>({})
  const firstViewTimeRef = useRef<string | null>(null)
  const lastViewTimeRef = useRef<string | null>(null)

  // Background-fit overlay refs and state (mobile)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const bgImgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [bgFit, setBgFit] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const bgReadyRef = useRef(false)

  // Background-fit overlay refs and state (desktop)
  const previewContainerRefDesktop = useRef<HTMLDivElement>(null)
  const bgImgRefDesktop = useRef<HTMLImageElement>(null)
  const [containerSizeDesktop, setContainerSizeDesktop] = useState({ width: 0, height: 0 })
  const [bgFitDesktop, setBgFitDesktop] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const bgReadyRefDesktop = useRef(false)
  const [isBgLandscape, setIsBgLandscape] = useState(false)

  // Accumulate responses for bulk submission
  const pendingResponsesRef = useRef<any[]>([])

  useEffect(() => {
    firstViewTimeRef.current = new Date().toISOString()
  }, [])

  useEffect(() => {
    return () => {
      try {
        const cached = sessionStorage.getItem("task_img_cache")
        if (cached) {
          const cache = JSON.parse(cached)
          Object.values(cache).forEach((url) => {
            if (typeof url === "string" && url.startsWith("blob:")) {
              URL.revokeObjectURL(url)
            }
          })
        }
        sessionStorage.removeItem("task_img_cache")
      } catch {
        // best-effort cleanup
      }
    }
  }, [])

  useEffect(() => {
    firstViewTimeRef.current = new Date().toISOString()
    lastViewTimeRef.current = null
    hoverCountsRef.current = {}
    clickCountsRef.current = {}
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsFetching(true)
        setFetchError(null)

        // 1. Try to read from localStorage (hydrated by ParticipateIntroPage)
        const sessionRaw = localStorage.getItem('study_session')
        const detailsRaw = localStorage.getItem('current_study_details')

        if (!sessionRaw || !detailsRaw) {
          // If missing, try API fallback
          if (!studyIdFromParams) throw new Error("No study session found")

          console.log("[Participate] Missing local data, fetching from API...")
          // We need a respondent ID - if it's really missing we might have to redirect back to intro
          // But usually study_session should exist if they passed the intro
          const session = sessionRaw ? JSON.parse(sessionRaw) : null
          const rId = session?.respondentId

          if (!rId) {
            console.error("[Participate] No respondent ID found, redirecting to intro")
            router.push(`/participate/${studyIdFromParams}`)
            return
          }

          const respondentDetails = await getRespondentStudyDetails(String(rId), studyIdFromParams)
          localStorage.setItem('current_study_details', JSON.stringify(respondentDetails))
          // Re-run this effect
          loadData()
          return
        }

        const session = JSON.parse(sessionRaw)
        const details = JSON.parse(detailsRaw)

        const info = details.study_info || {}
        const normalizedType: any = String(info.study_type || "").toLowerCase()
        setStudyType(normalizedType)
        setMainQuestion(info.main_question || "")

        const rs = info.rating_scale || {}
        setScaleLabels({
          left: String(rs.min_label || ""),
          right: String(rs.max_label || ""),
          middle: String(rs.middle_label || "")
        })

        const metadata = info.metadata || {}
        setBackgroundUrl(metadata.background_image_url || null)

        // respondentTasks can be bucketed (for hybrid) or flat
        let respondentTasks: any[] = []
        const assigned = details.assigned_tasks
        if (Array.isArray(assigned)) {
          if (assigned.length > 0 && Array.isArray(assigned[0])) {
            // Bucketed structure (Hybrid)
            respondentTasks = assigned.flat()
          } else {
            respondentTasks = assigned
          }
        }

        const parsed: Task[] = (respondentTasks || []).map((t: any) => {
          const es = t?.elements_shown || {}
          const content = t?.elements_shown_content || {}

          // Determine specific task type (crucial for hybrid)
          let activeType: any = normalizedType
          if (normalizedType === 'hybrid' || (t?.phase_type)) {
            const hasText = Object.values(content).some((v: any) => (v?.element_type === 'text'))
            activeType = t.phase_type || (hasText ? 'text' : 'grid')
          }

          if (activeType === "layer") {
            const layers = Object.keys(es)
              .filter((k) => Number(es[k]) === 1)
              .map((k) => {
                const layerData = content[k] || {}
                const tf = layerData.transform || { x: 0, y: 0, width: 100, height: 100 }
                return {
                  url: String(layerData.url || ""),
                  z: Number(layerData.z_index || 0),
                  layer_name: String(layerData.layer_name || ""),
                  transform: {
                    x: Number(tf.x) || 0,
                    y: Number(tf.y) || 0,
                    width: Number(tf.width) || 100,
                    height: Number(tf.height) || 100,
                  }
                }
              })
              .sort((a, b) => a.z - b.z)
              .filter(l => l.url)

            return {
              id: String(t.task_id || t.task_index || Math.random()),
              type: "layer",
              layeredImages: layers,
              _elements_shown: es,
              _elements_shown_content: content
            }
          }

          const activeKeys = Object.keys(es).filter(k => Number(es[k]) === 1)
          const list: string[] = []
          activeKeys.forEach(k => {
            const val = content[k]?.url || content[k]?.content || (typeof content[k] === 'string' ? content[k] : undefined)
            if (val) list.push(val)
          })

          return {
            id: String(t.task_id || t.task_index || Math.random()),
            type: activeType === "text" ? "text" : "grid",
            leftImageUrl: activeType === "text" ? undefined : list[0],
            rightImageUrl: activeType === "text" ? undefined : list[1],
            gridUrls: list,
            _elements_shown: es,
            _elements_shown_content: content
          }
        })

        setTasks(parsed)
      } catch (err: any) {
        console.error("Failed to load live participation tasks:", err)
        setFetchError(err.message || "Failed to load tasks")
      } finally {
        setIsFetching(false)
      }
    }
    loadData()
  }, [])

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const taskStartRef = useRef<number>(Date.now())
  const [lastSelected, setLastSelected] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const totalTasks = tasks.length

  useEffect(() => {
    setIsInitialLoading(false)
  }, [])

  useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return
    try {
      const allLayerUrls: string[] = Array.from(
        new Set(
          tasks
            .flatMap((t: any) => (Array.isArray(t?.layeredImages) ? t.layeredImages : []))
            .map((li: any) => li?.url)
            .filter(Boolean),
        ),
      ) as string[]
      const allWithBg = backgroundUrl ? [...allLayerUrls, backgroundUrl] : allLayerUrls
      if (allWithBg.length > 0) {
        imageCacheManager.prewarmUrls(allWithBg, "high")
      }
    } catch { }
  }, [totalTasks, backgroundUrl])

  useEffect(() => {
    if (tasks.length === 0) return

    const currentTask = tasks[currentTaskIndex]
    if (!currentTask) return

    const preloadCurrentTask = async () => {
      const urls: string[] = []

      if (currentTask.layeredImages) {
        currentTask.layeredImages.forEach((img: any) => {
          if (img.url) urls.push(img.url)
        })
      }
      if (currentTask.gridUrls) {
        urls.push(...currentTask.gridUrls.filter(Boolean))
      }
      if (currentTask.leftImageUrl) urls.push(currentTask.leftImageUrl)
      if (currentTask.rightImageUrl) urls.push(currentTask.rightImageUrl)

      if (backgroundUrl) {
        urls.push(backgroundUrl)
      }

      await imageCacheManager.prewarmUrls(urls, "critical")
    }

    preloadCurrentTask()
  }, [currentTaskIndex, tasks])

  // ResizeObserver for container size (mobile)
  useEffect(() => {
    if (!previewContainerRef.current || studyType !== "layer") return

    const updateSize = () => {
      if (previewContainerRef.current) {
        setContainerSize({
          width: previewContainerRef.current.offsetWidth,
          height: previewContainerRef.current.offsetHeight,
        })
      }
    }

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateSize)
    })

    observer.observe(previewContainerRef.current)
    updateSize()

    // Also observe visualViewport for responsive mode changes
    if (typeof window !== "undefined" && window.visualViewport) {
      const handleResize = () => requestAnimationFrame(updateSize)
      window.visualViewport.addEventListener("resize", handleResize)
      return () => {
        observer.disconnect()
        window.visualViewport?.removeEventListener("resize", handleResize)
      }
    }

    return () => observer.disconnect()
  }, [studyType])

  // Compute background fit box using useLayoutEffect (mobile)
  useLayoutEffect(() => {
    if (!bgImgRef.current || !previewContainerRef.current || studyType !== "layer" || !backgroundUrl) {
      bgReadyRef.current = false
      return
    }

    const computeFit = () => {
      const img = bgImgRef.current
      const container = previewContainerRef.current
      if (!img || !container) return

      const cw = container.offsetWidth || 0
      const ch = container.offsetHeight || 0
      if (!cw || !ch) return

      const iw = img.naturalWidth || cw
      const ih = img.naturalHeight || ch
      const scale = Math.min(cw / iw, ch / ih)
      const w = iw * scale
      const h = ih * scale
      const left = (cw - w) / 2
      const top = (ch - h) / 2

      setBgFit({ left, top, width: w, height: h })
      setIsBgLandscape(iw > ih)
      bgReadyRef.current = true
    }

    requestAnimationFrame(() => {
      if (bgImgRef.current?.complete) {
        computeFit()
      } else {
        bgImgRef.current?.addEventListener("load", computeFit, { once: true })
      }
    })
  }, [containerSize, backgroundUrl, studyType, currentTaskIndex])

  // ResizeObserver for container size (desktop)
  useEffect(() => {
    if (!previewContainerRefDesktop.current || studyType !== "layer") return

    const updateSize = () => {
      if (previewContainerRefDesktop.current) {
        setContainerSizeDesktop({
          width: previewContainerRefDesktop.current.offsetWidth,
          height: previewContainerRefDesktop.current.offsetHeight,
        })
      }
    }

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateSize)
    })

    observer.observe(previewContainerRefDesktop.current)
    updateSize()

    if (typeof window !== "undefined" && window.visualViewport) {
      const handleResize = () => requestAnimationFrame(updateSize)
      window.visualViewport.addEventListener("resize", handleResize)
      return () => {
        observer.disconnect()
        window.visualViewport?.removeEventListener("resize", handleResize)
      }
    }

    return () => observer.disconnect()
  }, [studyType])

  // Compute background fit box using useLayoutEffect (desktop)
  useLayoutEffect(() => {
    if (!bgImgRefDesktop.current || !previewContainerRefDesktop.current || studyType !== "layer" || !backgroundUrl) {
      bgReadyRefDesktop.current = false
      return
    }

    const computeFit = () => {
      const img = bgImgRefDesktop.current
      const container = previewContainerRefDesktop.current
      if (!img || !container) return

      const cw = container.offsetWidth || 0
      const ch = container.offsetHeight || 0
      if (!cw || !ch) return

      const iw = img.naturalWidth || cw
      const ih = img.naturalHeight || ch
      const scale = Math.min(cw / iw, ch / ih)
      const w = iw * scale
      const h = ih * scale
      const left = (cw - w) / 2
      const top = (ch - h) / 2

      setBgFitDesktop({ left, top, width: w, height: h })
      bgReadyRefDesktop.current = true
    }

    requestAnimationFrame(() => {
      if (bgImgRefDesktop.current?.complete) {
        computeFit()
      } else {
        bgImgRefDesktop.current?.addEventListener("load", computeFit, { once: true })
      }
    })
  }, [containerSizeDesktop, backgroundUrl, studyType, currentTaskIndex])

  function getTaskImageCache() {
    try {
      const cached = sessionStorage.getItem("task_img_cache")
      return cached ? JSON.parse(cached) : {}
    } catch {
      return {}
    }
  }

  function setTaskImageCache(cache: Record<string, string>) {
    try {
      sessionStorage.setItem("task_img_cache", JSON.stringify(cache))
    } catch {
      // best-effort caching
    }
  }

  useEffect(() => {
    taskStartRef.current = Date.now()
    setLastSelected(null)
    firstViewTimeRef.current = new Date().toISOString()
    lastViewTimeRef.current = null
    hoverCountsRef.current = {}
    clickCountsRef.current = {}
  }, [currentTaskIndex])

  const handleSelect = async (value: number) => {
    clickCountsRef.current[value] = (clickCountsRef.current[value] || 0) + 1

    const elapsedMs = Date.now() - taskStartRef.current
    const seconds = Number((elapsedMs / 1000).toFixed(3))
    setLastSelected(value)
    lastViewTimeRef.current = new Date().toISOString()

    // 1. Calculate payload for this task
    const currentTask = tasks[currentTaskIndex]
    if (currentTask) {
      const interactionStats = Object.keys(hoverCountsRef.current).map(key => {
        const val = Number(key)
        return {
          element_id: String(val),
          view_time_seconds: 0,
          hover_count: hoverCountsRef.current[val] || 0,
          click_count: clickCountsRef.current[val] || 0,
          first_view_time: firstViewTimeRef.current || new Date().toISOString(),
          last_view_time: lastViewTimeRef.current || new Date().toISOString(),
        }
      })

      const payload = {
        task_id: currentTask.id,
        rating_given: value,
        task_duration_seconds: seconds,
        element_interactions: interactionStats,
        elements_shown_in_task: currentTask._elements_shown,
        elements_shown_content: currentTask._elements_shown_content
      }

      pendingResponsesRef.current.push(payload)
    }

    const isLastTask = currentTaskIndex === totalTasks - 1
    const shouldSendBulk = pendingResponsesRef.current.length >= 15 || isLastTask

    if (shouldSendBulk) {
      try {
        const sessionRaw = localStorage.getItem('study_session')
        if (sessionRaw) {
          const { sessionId } = JSON.parse(sessionRaw)
          if (sessionId) {
            const chunkToSend = [...pendingResponsesRef.current]
            pendingResponsesRef.current = [] // Clear pending
            submitTasksBulk(sessionId, chunkToSend).catch(err => {
              console.error("Failed to submit bulk tasks:", err)
              // Optionally: restore to pending if failed? 
              // But submitTasksBulk already handles internal errors.
            })
          }
        }
      } catch (e) {
        console.error("Error in bulk submission:", e)
      }
    }

    if (!isLastTask) {
      setTimeout(() => setCurrentTaskIndex((i) => i + 1), 80)
    } else {
      setIsLoading(true)
      setTimeout(() => {
        router.push(`/participate/${studyIdFromParams}/thank-you`)
      }, 600)
    }
  }

  const progressPct = Math.max(
    2,
    Math.min(
      100,
      Math.round(((Math.min(currentTaskIndex, Math.max(totalTasks - 1, 0)) + 1) / Math.max(totalTasks, 1)) * 100),
    ),
  )

  const task = tasks[currentTaskIndex]

  return (
    <div
      className="h-[100dvh] lg:min-h-screen lg:bg-white overflow-hidden lg:overflow-visible"
      style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
    >
      <div className={`max-w-6xl mx-auto ${isBgLandscape ? 'px-0 sm:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'} pt-2 sm:pt-12 md:pt-14 pb-16`}>
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
            {/* Mobile Layout */}
            <div
              className="lg:hidden flex flex-col h-[calc(100vh-140px)] overflow-hidden"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            >
              {/* Progress Section */}
              <div className={`mb-2 sm:mb-4 flex-shrink-0 ${isBgLandscape ? 'px-4 sm:px-0' : ''}`}>
                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden mb-5 sm:mb-5">
                  <div
                    className="h-full bg-[rgba(38,116,186,1)] rounded transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
                <div className="text-base font-medium text-gray-800 leading-tight break-words hyphens-auto">
                  {mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}
                </div>
              </div>

              {/* Main Content */}
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
                    <div className={`flex-1 flex items-center justify-center min-h-0 overflow-hidden ${(task?.type === 'layer') && isBgLandscape ? 'px-0' : 'px-2'}`}>
                      {task?.type === "layer" ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <div ref={previewContainerRef} className={`relative w-full aspect-square ${isBgLandscape ? '' : 'max-w-xs sm:max-w-sm md:max-w-md'}`} style={{ minHeight: 240 }}>
                            {backgroundUrl && (
                              <img
                                ref={bgImgRef}
                                src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                alt="Background"
                                decoding="async"
                                loading="eager"
                                fetchPriority="high"
                                width={600}
                                height={600}
                                className="absolute inset-0 m-auto h-full w-full object-contain"
                                style={{ zIndex: 0 }}
                                onLoad={() => {
                                  requestAnimationFrame(() => {
                                    const cw = previewContainerRef.current?.offsetWidth || 0
                                    const ch = previewContainerRef.current?.offsetHeight || 0
                                    if (!cw || !ch) return
                                    const iw = bgImgRef.current?.naturalWidth || cw
                                    const ih = bgImgRef.current?.naturalHeight || ch
                                    const scale = Math.min(cw / iw, ch / ih)
                                    const w = iw * scale
                                    const h = ih * scale
                                    const left = (cw - w) / 2
                                    const top = (ch - h) / 2
                                    setBgFit({ left, top, width: w, height: h })
                                    setIsBgLandscape(iw > ih)
                                    bgReadyRef.current = true
                                  })
                                }}
                              />
                            )}
                            {(() => {
                              const efwNum = bgFit.width || (previewContainerRef.current?.offsetWidth || 0)
                              const efhNum = bgFit.height || (previewContainerRef.current?.offsetHeight || 0)
                              const efl = bgFit.left ?? 0
                              const eft = bgFit.top ?? 0
                              const efw = efwNum || undefined
                              const efh = efhNum || undefined
                              const bgFitKey = `${efl}-${eft}-${efw}-${efh}-${currentTaskIndex}`
                              return (
                                <div
                                  className="absolute overflow-hidden"
                                  style={{ left: efl, top: eft, width: efw ?? '100%', height: efh ?? '100%', zIndex: 1 }}
                                  key={bgFitKey}
                                >
                                  {task?.layeredImages?.map((img: any, idx: number) => {
                                    const resolved = getCachedUrl(img.url) || "/placeholder.svg"
                                    const t = img.transform || { x: 0, y: 0, width: 100, height: 100 }
                                    const widthPct = Math.max(1, Math.min(100, Number(t.width) || 100))
                                    const heightPct = Math.max(1, Math.min(100, Number(t.height) || 100))
                                    const leftPct = Math.max(0, Math.min(100 - widthPct, Number(t.x) || 0))
                                    const topPct = Math.max(0, Math.min(100 - heightPct, Number(t.y) || 0))
                                    return (
                                      <img
                                        key={`${img.url}-${idx}`}
                                        src={resolved || "/placeholder.svg"}
                                        alt={String(img.z)}
                                        decoding="async"
                                        loading="eager"
                                        fetchPriority="high"
                                        className="absolute object-contain"
                                        style={{
                                          zIndex: (img.z ?? 0),
                                          position: 'absolute',
                                          top: `${topPct}%`,
                                          left: `${leftPct}%`,
                                          width: `calc(${widthPct}% + 1.5px)`,
                                          height: `calc(${heightPct}% + 1.5px)`,
                                        }}
                                        onError={() => {
                                          console.error("Layer image failed to load:", img.url)
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                              )
                            })()}
                            {(tasks[currentTaskIndex + 1]?.layeredImages || []).map((img: any, idx: number) => {
                              const resolved = getCachedUrl(img.url) || "/placeholder.svg"
                              return (
                                <img
                                  key={`next-${img.url}-${idx}`}
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
                      ) : task?.type === "text" ? (
                        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative gap-2 sm:gap-4 p-4">
                          {task?.gridUrls?.map((statement, idx) => (
                            <div
                              key={idx}
                              className="w-full flex-1 flex items-center justify-center text-center p-4 rounded-lg shadow-sm"
                              style={{
                                minHeight: '60px',
                                fontSize: 'clamp(16px, 2vw, 18px)',
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word'
                              }}
                            >
                              {statement}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
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
                            // Special layout for exactly 3 images on mobile
                            <div className="flex flex-col gap-1 xs:gap-2 sm:gap-3 relative" style={{ zIndex: 1 }}>
                              {/* Top row: 2 images side by side */}
                              <div className="grid grid-cols-2 gap-1 xs:gap-2 sm:gap-3">
                                {task.gridUrls.slice(0, 2).map((url: string, i: number) => (
                                  <div key={i} className="aspect-square w-full overflow-hidden">
                                    <Image
                                      src={getCachedUrl(url) || "/placeholder.svg"}
                                      alt={`element-${i + 1}`}
                                      width={299}
                                      height={299}
                                      className="h-full w-full object-contain"
                                      loading="eager"
                                      fetchPriority="high"
                                      unoptimized={url?.includes('blob.core.windows.net')}
                                    />
                                  </div>
                                ))}
                              </div>
                              {/* Bottom row: 1 centered image */}
                              <div className="w-full flex justify-center">
                                <div className="aspect-square w-1/2 overflow-hidden">
                                  <Image
                                    src={getCachedUrl(task.gridUrls[2]) || "/placeholder.svg"}
                                    alt="element-3"
                                    width={299}
                                    height={299}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={task.gridUrls[2]?.includes('blob.core.windows.net')}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : task?.gridUrls && task.gridUrls.length > 3 ? (
                            <div className="grid grid-cols-2 gap-1 xs:gap-2 sm:gap-3 w-full overflow-hidden place-items-center relative" style={{ zIndex: 1 }}>
                              {task.gridUrls.slice(0, 4).map((url: string, i: number) => (
                                <div key={i} className="aspect-square w-full overflow-hidden">
                                  <Image
                                    src={getCachedUrl(url) || "/placeholder.svg"}
                                    alt={`element-${i + 1}`}
                                    width={299}
                                    height={299}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={url?.includes('blob.core.windows.net')}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 xs:gap-2 sm:gap-3 relative items-center justify-center w-full h-full max-h-full overflow-hidden" style={{ zIndex: 1 }}>
                              <div className="aspect-square w-full max-w-[50%] overflow-hidden flex-shrink">
                                {task?.leftImageUrl ? (
                                  <Image
                                    src={getCachedUrl(task.leftImageUrl) || "/placeholder.svg"}
                                    alt="left"
                                    width={299}
                                    height={299}
                                    className="h-full w-full object-contain"
                                    loading="eager"
                                    fetchPriority="high"
                                    unoptimized={task.leftImageUrl?.includes("blob.core.windows.net")}
                                  />
                                ) : null}
                              </div>
                              <div className="aspect-square w-full max-w-[50%] overflow-hidden flex-shrink">
                                {task?.rightImageUrl ? (
                                  <Image
                                    src={getCachedUrl(task.rightImageUrl) || "/placeholder.svg"}
                                    alt="right"
                                    width={299}
                                    height={299}
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

                    {studyType === "grid" && (
                      <div className={`grid grid-cols-2 gap-4 text-xs sm:text-sm font-semibold text-gray-800 mb-2 flex-shrink-0 ${isBgLandscape ? 'px-6 sm:px-2' : 'px-2'}`}>
                        <div className="text-center text-balance">{task?.leftLabel ?? ""}</div>
                        <div className="text-center text-balance">{task?.rightLabel ?? ""}</div>
                      </div>
                    )}

                    <div className={`flex flex-col items-start mb-6 gap-3 mt-[1px] ${isBgLandscape ? 'px-8 sm:px-4' : 'px-4'}`}>
                      <div className="flex items-center gap-[9px]">
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                          1
                        </div>
                        {scaleLabels.left && (
                          <div className="text-xs font-medium text-gray-700 leading-tight">
                            {scaleLabels.left}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-[9px]">
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                          5
                        </div>
                        {scaleLabels.right && (
                          <div className="text-xs font-medium text-gray-700 leading-tight">
                            {scaleLabels.right}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rating Scale */}
                    <div
                      className={`mt-auto pb-2 flex-shrink-0 ${isBgLandscape ? 'px-6 sm:px-2' : 'px-2'}`}
                      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <div className="flex items-center justify-between w-full max-w-[320px] mx-auto">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            return (
                              <button
                                key={n}
                                onClick={() => handleSelect(n)}
                                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 transition-colors text-sm sm:text-base font-semibold flex-shrink-0 ${selected
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


                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:block">
              <div className="flex items-start justify-between text-sm text-gray-600 mb-4 gap-4">
                <div className="text-xl font-semibold text-gray-800 flex-1 leading-tight break-words hyphens-auto max-w-[calc(100%-5rem)]">
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
                ) : (
                  <div className="space-y-4">
                    {task?.type === "layer" ? (
                      <div className="flex justify-center">
                        <div ref={previewContainerRefDesktop} className="relative w-full max-w-lg aspect-square overflow-hidden">
                          <div className="relative w-full h-full">
                            {backgroundUrl && (
                              <img
                                ref={bgImgRefDesktop}
                                src={getCachedUrl(backgroundUrl) || "/placeholder.svg"}
                                alt="Background"
                                decoding="async"
                                loading="eager"
                                fetchPriority="high"
                                width={800}
                                height={800}
                                className="absolute inset-0 m-auto h-full w-full object-contain"
                                style={{ zIndex: 0 }}
                                onLoad={() => {
                                  requestAnimationFrame(() => {
                                    const cw = previewContainerRefDesktop.current?.offsetWidth || 0
                                    const ch = previewContainerRefDesktop.current?.offsetHeight || 0
                                    if (!cw || !ch) return
                                    const iw = bgImgRefDesktop.current?.naturalWidth || cw
                                    const ih = bgImgRefDesktop.current?.naturalHeight || ch
                                    const scale = Math.min(cw / iw, ch / ih)
                                    const w = iw * scale
                                    const h = ih * scale
                                    const left = (cw - w) / 2
                                    const top = (ch - h) / 2
                                    setBgFitDesktop({ left, top, width: w, height: h })
                                    bgReadyRefDesktop.current = true
                                  })
                                }}
                              />
                            )}
                            {(() => {
                              const efwNum = bgFitDesktop.width || (previewContainerRefDesktop.current?.offsetWidth || 0)
                              const efhNum = bgFitDesktop.height || (previewContainerRefDesktop.current?.offsetHeight || 0)
                              const efl = bgFitDesktop.left ?? 0
                              const eft = bgFitDesktop.top ?? 0
                              const efw = efwNum || undefined
                              const efh = efhNum || undefined
                              const bgFitKey = `${efl}-${eft}-${efw}-${efh}-${currentTaskIndex}-desktop`
                              return (
                                <div
                                  className="absolute overflow-hidden"
                                  style={{ left: efl, top: eft, width: efw ?? '100%', height: efh ?? '100%', zIndex: 1 }}
                                  key={bgFitKey}
                                >
                                  {task?.layeredImages?.map((img: any, idx: number) => {
                                    const resolved = getCachedUrl(img.url) || "/placeholder.svg"
                                    const t = img.transform || { x: 0, y: 0, width: 100, height: 100 }
                                    const widthPct = Math.max(1, Math.min(100, Number(t.width) || 100))
                                    const heightPct = Math.max(1, Math.min(100, Number(t.height) || 100))
                                    const leftPct = Math.max(0, Math.min(100 - widthPct, Number(t.x) || 0))
                                    const topPct = Math.max(0, Math.min(100 - heightPct, Number(t.y) || 0))
                                    return (
                                      <img
                                        key={`${img.url}-${idx}`}
                                        src={resolved || "/placeholder.svg"}
                                        alt={String(img.z)}
                                        decoding="async"
                                        loading="eager"
                                        fetchPriority="high"
                                        className="absolute object-contain"
                                        style={{
                                          zIndex: (img.z ?? 0),
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
                              )
                            })()}
                            {(tasks[currentTaskIndex + 1]?.layeredImages || []).map((img: any, idx: number) => {
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
                    ) : task?.type === "text" ? (
                      <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative gap-4 p-6 min-h-[400px]">
                        {task?.gridUrls?.map((statement, idx) => (
                          <div
                            key={idx}
                            className="w-full flex-1 flex items-center justify-center text-center p-6 rounded-xl shadow-sm transition-colors"
                            style={{
                              minHeight: '80px',
                              fontSize: 'clamp(16px, 1.5vw, 24px)',
                              overflowWrap: 'break-word',
                              wordBreak: 'break-word'
                            }}
                          >
                            {statement}
                          </div>
                        ))}
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
                            <div className="flex flex-col gap-4 relative max-w-lg mx-auto items-center">
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
                              <div className="aspect-square w-1/2 overflow-hidden" style={{ zIndex: 1 }}>
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
                              <div className="aspect-square w-1/2 overflow-hidden" style={{ zIndex: 1 }}>
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
                            <div className="relative max-w-lg mx-auto">
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
                                    <div key={i} className="aspect-square w-full overflow-hidden">
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
                                  <div className="aspect-square w-1/2 overflow-hidden">
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
                          <div className="grid grid-cols-2 gap-4 relative max-w-lg mx-auto">
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
                                className="aspect-square w-full overflow-hidden"
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

                    <div className="flex flex-col items-center justify-center gap-2 mt-[1px] px-2">
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

                    <div className="w-full max-w-2xl mx-auto mt-4">
                      <div className="flex items-center justify-center mb-3">
                        <div className="flex items-center justify-center gap-4">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            return (
                              <button
                                key={n}
                                onClick={() => handleSelect(n)}
                                className={`h-11 w-11 lg:h-12 lg:w-12 xl:h-14 xl:w-14 rounded-full border-2 transition-colors text-sm lg:text-base xl:text-lg font-semibold flex-shrink-0 ${selected
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


                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div >
  )
}