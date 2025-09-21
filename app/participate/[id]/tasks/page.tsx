"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { submitTaskSession, submitTasksBulk } from "@/lib/api/ResponseAPI"

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
  const params = useParams<{ id: string }>()
  const router = useRouter()

  // Load tasks from localStorage study details using respondentId
  const [tasks, setTasks] = useState<Task[]>([])
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [scaleLabels, setScaleLabels] = useState<{ left: string; right: string; middle: string }>({
    left: "",
    right: "",
    middle: "",
  })
  const [studyType, setStudyType] = useState<"grid" | "layer" | undefined>(undefined)
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

      const sessionRaw = typeof window !== "undefined" ? localStorage.getItem("study_session") : null
      const detailsRaw = typeof window !== "undefined" ? localStorage.getItem("current_study_details") : null

      if (!sessionRaw || !detailsRaw) {
        throw new Error("Missing session or study details in localStorage")
      }

      const { respondentId } = JSON.parse(sessionRaw || "{}")
      const study = JSON.parse(detailsRaw || "{}")

      // Handle new API response format
      const studyInfo = study?.study_info || study
      const assignedTasks = study?.assigned_tasks || []

      console.log("Tasks page - assignedTasks length:", assignedTasks.length)
      console.log("Tasks page - assignedTasks:", assignedTasks)

      const detectedStudyType = studyInfo?.study_type || study?.study_type
      console.log("Study type detection:", detectedStudyType)
      setStudyType(detectedStudyType)
      setMainQuestion(String(studyInfo?.main_question || study?.main_question || ""))

      if (studyInfo?.rating_scale || study?.rating_scale) {
        const rs = studyInfo?.rating_scale || study?.rating_scale || {}
        const left = rs.min_label ? `${rs.min_label}` : ""
        const right = rs.max_label ? `${rs.max_label}` : ""
        const middle = rs.middle_label ? `${rs.middle_label}` : ""
        setScaleLabels({ left, right, middle })
      } else {
        setScaleLabels({ left: "", right: "", middle: "" })
      }

      // Use assigned_tasks directly from new API response
      let userTasks: any[] = []
      if (Array.isArray(assignedTasks) && assignedTasks.length > 0) {
        userTasks = assignedTasks
      } else {
        // Fallback to old format for backward compatibility
        const tasksObj = study?.tasks || study?.data?.tasks || study?.task_map || study?.task || {}
        const respondentKey = String(respondentId ?? 0)
        let respondentTasks: any[] = tasksObj?.[respondentKey] || tasksObj?.[Number(respondentKey)] || []
        if (!Array.isArray(respondentTasks) || respondentTasks.length === 0) {
          if (Array.isArray(tasksObj)) {
            respondentTasks = tasksObj
          } else if (tasksObj && typeof tasksObj === "object") {
            // Pick the first non-empty respondent bucket instead of flattening all
            for (const [k, v] of Object.entries(tasksObj)) {
              if (Array.isArray(v) && v.length) {
                respondentTasks = v as any[]
                break
              }
            }
          }
        }
        userTasks = respondentTasks
      }

      const parsed: Task[] = (Array.isArray(userTasks) ? userTasks : []).map((t: any) => {
        if ((studyInfo?.study_type as string) === "layer") {
          const shown = t?.elements_shown || {}
          const content = t?.elements_shown_content || {}

          console.log("Layer task parsing - shown:", shown)
          console.log("Layer task parsing - content:", content)

          const layers = Object.keys(shown)
            .filter((k) => {
              const isShown = Number(shown[k]) === 1
              const hasContent = content?.[k] && content[k] !== null
              const hasUrl = hasContent && content[k].url
              console.log(`Layer ${k}: isShown=${isShown}, hasContent=${hasContent}, hasUrl=${hasUrl}`)
              return isShown && hasContent && hasUrl
            })
            .map((k) => {
              const layerData = content[k]
              console.log(`Processing layer ${k}:`, layerData)
              return {
                url: String(layerData.url),
                z: Number(layerData.z_index ?? 0),
              }
            })
            .sort((a, b) => a.z - b.z)

          console.log("Layer task parsing - layers:", layers)
          const taskResult = {
            id: String(t?.task_id ?? t?.task_index ?? Math.random()),
            layeredImages: layers,
            _elements_shown: shown,
            _elements_shown_content: content,
          }
          console.log("Layer task result:", taskResult)
          return taskResult
        } else {
          const es = t?.elements_shown || {}
          const content = t?.elements_shown_content || {}
          const activeKeys = Object.keys(es).filter((k) => Number(es[k]) === 1)

          const getUrlForKey = (k: string): string | undefined => {
            // FIRST: Check directly in elements_shown for k_content (this is where your URLs are!)
            const directUrl = (es as any)[`${k}_content`]
            if (typeof directUrl === "string" && directUrl) return directUrl

            // Then check the content object if it exists
            const c1: any = (content as any)[k]
            if (c1 && typeof c1 === "object" && typeof c1.url === "string") return c1.url

            const c2: any = (content as any)[`${k}_content`]
            if (c2 && typeof c2 === "object" && typeof c2.url === "string") return c2.url
            if (typeof c2 === "string") return c2

            const s2: any = (content as any)[k]
            if (typeof s2 === "string") return s2

            return undefined
          }

          const list: string[] = []
          activeKeys.forEach((k) => {
            const url = getUrlForKey(k)
            if (typeof url === "string" && url) list.push(url)
          })

          // As a last resort, scan content object for any url fields when no activeKeys resolved
          if (list.length === 0 && content && typeof content === "object") {
            Object.values(content).forEach((v: any) => {
              if (v && typeof v === "object" && typeof v.url === "string") list.push(v.url)
              if (typeof v === "string") list.push(v)
            })
          }

          // Fallback: if we still have fewer than 4 images, try to pull any *_content string URLs from elements_shown itself
          try {
            if (list.length < 4 && es && typeof es === "object") {
              const seen = new Set(list)
              Object.entries(es as Record<string, any>).forEach(([key, val]) => {
                if (list.length >= 4) return
                if (typeof val === "string" && key.endsWith("_content") && val.startsWith("http") && !seen.has(val)) {
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
            leftLabel: "",
            rightLabel: "",
            gridUrls: list, // Store all URLs for grid display
            _elements_shown: es,
            _elements_shown_content: content,
          }
        }
      })

      console.log("Tasks page - parsed tasks length:", parsed.length)
      console.log("Tasks page - parsed tasks:", parsed)

      // Debug layer tasks specifically
      if (studyType === "layer") {
        console.log("Layer study - checking first task:", parsed[0])
        console.log("Layer study - first task layeredImages:", parsed[0]?.layeredImages)
      }

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
          ;(img as any).decoding = "async"
          ;(img as any).referrerPolicy = "no-referrer"
          img.src = src
        })
      } catch {}
    } catch (err: unknown) {
      console.error("Failed to load tasks from localStorage:", err)
      setFetchError((err as Error)?.message || "Failed to load tasks")
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

  const enqueueTask = (rating: number) => {
    try {
      const sessionRaw = localStorage.getItem("study_session")
      if (!sessionRaw) return
      const { sessionId } = JSON.parse(sessionRaw)
      if (!sessionId) return

      const task = tasks[currentTaskIndex]
      const elapsedMs = Date.now() - taskStartRef.current
      const seconds = Number((elapsedMs / 1000).toFixed(3))

      const interactions = [1, 2, 3, 4, 5].map((n) => ({
        element_id: `R${n}`,
        view_time_seconds: seconds,
        hover_count: hoverCountsRef.current[n] || 0,
        click_count: clickCountsRef.current[n] || 0,
        first_view_time: firstViewTimeRef.current || new Date().toISOString(),
        last_view_time: new Date().toISOString(),
      }))

      // Build a flat elements_shown_content map with URL strings if available
      let payloadShownContent: Record<string, string> | undefined = undefined
      try {
        const es: any = task?._elements_shown || {}
        const content: any = task?._elements_shown_content || {}
        const result: Record<string, string> = {}
        if (es && typeof es === "object") {
          Object.keys(es).forEach((k) => {
            const s1 = (es as any)[`${k}_content`]
            if (typeof s1 === "string" && s1.startsWith("http")) {
              result[k] = s1
            }
          })
        }
        if (content && typeof content === "object") {
          Object.keys(content).forEach((k) => {
            const cv = (content as any)[k]
            if (typeof cv === "string" && cv.startsWith("http")) {
              result[k] = cv
            } else if (cv && typeof cv === "object" && typeof cv.url === "string") {
              result[k] = cv.url
            }
          })
        }
        if (Object.keys(result).length > 0) payloadShownContent = result
      } catch {}

      const item = {
        task_id: task?.id || String(currentTaskIndex),
        rating_given: rating,
        task_duration_seconds: seconds,
        element_interactions: interactions,
        elements_shown_in_task: task?._elements_shown,
        elements_shown_content: payloadShownContent,
        _idemp: `${sessionId}:${task?.id || String(currentTaskIndex)}`,
      }
      const qRaw = localStorage.getItem("task_submit_queue")
      const q: any[] = qRaw ? JSON.parse(qRaw) : []
      q.push(item)
      localStorage.setItem("task_submit_queue", JSON.stringify(q))
    } catch (e) {
      console.error("Failed to enqueue task:", e)
    }
  }

  // Periodic/background flush using bulk endpoint
  useEffect(() => {
    // Send-everything-at-end mode: skip periodic background flush
    return () => {}
  }, [])

  // Periodic/background flush using bulk endpoint (disabled when sending all at end)
  /*
  useEffect(() => {
    const flush = async () => {
      try {
        const sessionRaw = localStorage.getItem('study_session')
        if (!sessionRaw) return
        const { sessionId } = JSON.parse(sessionRaw)
        if (!sessionId) return

        const qRaw = localStorage.getItem('task_submit_queue')
        const q: any[] = qRaw ? JSON.parse(qRaw) : []
        if (!Array.isArray(q) || q.length === 0) return

        // Process queue in batches to avoid losing tasks
        const batchSize = 10 // Send max 10 tasks per batch
        const tasksToSend = q.slice(0, batchSize).map((it) => ({
          task_id: it.task_id,
          rating_given: it.rating_given,
          task_duration_seconds: it.task_duration_seconds,
          element_interactions: Array.isArray(it.element_interactions) ? it.element_interactions.slice(0, 10) : [],
          elements_shown_in_task: it.elements_shown_in_task || undefined,
          elements_shown_content: it.elements_shown_content || undefined,
        }))

        if (tasksToSend.length === 0) return

        // Try sendBeacon first
        let sent = false
        try {
          const url = `http://127.0.0.1:8000/api/v1/responses/submit-tasks-bulk?session_id=${encodeURIComponent(sessionId)}`
          const data = JSON.stringify({ tasks: tasksToSend })
          if (navigator.sendBeacon) {
            const ok = navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }))
            if (ok) sent = true
          }
        } catch {}

        if (!sent) {
          try {
            await submitTasksBulk(String(sessionId), tasksToSend)
          } catch (e) {
            console.error('submitTasksBulk failed, trying individual submissions:', e)
            // Fallback: try submitting tasks individually
            for (const task of tasksToSend) {
              try {
                await submitTaskResponse(String(sessionId), task)
              } catch (individualError) {
                console.error('Individual task submission failed:', individualError)
              }
            }
          }
        }

        // On success, remove only the sent tasks from queue
        const remaining = q.slice(batchSize)
        if (remaining.length > 0) {
          localStorage.setItem('task_submit_queue', JSON.stringify(remaining))
        } else {
          localStorage.removeItem('task_submit_queue')
        }
      } catch (e: any) {
        // Retry only on transient; keep queue
        const msg = String(e?.message || '')
        if (/\b(429|408|5\d\d|NetworkError|timeout|aborted)\b/i.test(msg)) {
          // keep queue
        } else {
          // drop malformed items to avoid permanent blockage
          console.warn('Dropping queue due to non-retryable error:', e)
          // Keep only the most recent 5 items on error
          try {
            const qRaw = localStorage.getItem('task_submit_queue')
            const q: any[] = qRaw ? JSON.parse(qRaw) : []
            localStorage.setItem('task_submit_queue', JSON.stringify(q.slice(-5)))
          } catch {}
        }
      }
    }

    const interval = window.setInterval(flush, 3000)
    const onVis = () => { if (document.visibilityState !== 'visible') flush() }
    const onHide = () => flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [])
  */

  const submitSessionInBackground = () => {
    try {
      const sessionRaw = localStorage.getItem("study_session")
      if (!sessionRaw) return
      const { sessionId } = JSON.parse(sessionRaw)
      if (!sessionId) return

      const metrics = JSON.parse(localStorage.getItem("session_metrics") || "{}")
      const timesMap = JSON.parse(localStorage.getItem("study_response_times") || "{}") as Record<string, number>
      const individual = Object.keys(timesMap)
        .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
        .map((k) => Number(timesMap[k] || 0))

      const payload = {
        session_id: String(sessionId),
        task_id: tasks?.[tasks.length - 1]?.id || String(tasks.length - 1),
        classification_page_time: Number(metrics.classification_page_time || 0),
        orientation_page_time: Number(metrics.orientation_page_time || 0),
        individual_task_page_times: individual,
        page_transitions: [],
        is_completed: true,
        abandonment_timestamp: null,
        abandonment_reason: null,
        recovery_attempts: 0,
        browser_performance: {},
        page_load_times: [],
        device_info: {},
        screen_resolution: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "",
      }

      submitTaskSession(payload).catch((e) => console.error("submitTaskSession error:", e))
    } catch (e) {
      console.error("Failed to submit task session:", e)
    }
  }

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

    const updatedTimes = [...responseTimesSec]
    updatedTimes[currentTaskIndex] = seconds
    const localStorageData: Record<string, number> = {}
    updatedTimes.forEach((time, index) => {
      localStorageData[`task${index + 1}`] = time
    })
    localStorage.setItem("study_response_times", JSON.stringify(localStorageData))

    enqueueTask(value)

    if (currentTaskIndex < totalTasks - 1) {
      setTimeout(() => setCurrentTaskIndex((i) => i + 1), 80)
    } else {
      setIsLoading(true)
      // Final flush: send ALL tasks in one bulk call
      const doFinish = async () => {
        try {
          const sessionRaw = localStorage.getItem("study_session")
          const { sessionId } = sessionRaw ? JSON.parse(sessionRaw) : { sessionId: null }
          if (sessionId) {
            const qRaw = localStorage.getItem("task_submit_queue")
            const q: any[] = qRaw ? JSON.parse(qRaw) : []
            if (Array.isArray(q) && q.length) {
              // Build single bulk payload with ALL remaining tasks
              const tasksToSend = q.map((it) => ({
                task_id: it.task_id,
                rating_given: it.rating_given,
                task_duration_seconds: it.task_duration_seconds,
                element_interactions: Array.isArray(it.element_interactions)
                  ? it.element_interactions.slice(0, 10)
                  : [],
                elements_shown_in_task: it.elements_shown_in_task || undefined,
                elements_shown_content: it.elements_shown_content || undefined,
              }))

              console.log(`Final flush (single bulk): sending ${tasksToSend.length} tasks`)

              try {
                await submitTasksBulk(String(sessionId), tasksToSend)
                localStorage.removeItem("task_submit_queue")
                console.log("Final flush (single bulk) completed successfully")
              } catch (e) {
                console.error("Final flush failed:", e)
                // Keep queue for retry on thank-you page
              }
            }
          }
        } catch {}
        submitSessionInBackground()
      }
      // Run final flush, but still navigate quickly
      try {
        void doFinish()
      } catch {}
      setTimeout(() => router.push(`/participate/${params.id}/thank-you`), 200)
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
              {/* Progress Section - Outside white card */}
              <div className="mb-0">
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="text-sm sm:text-base font-medium text-gray-800 flex-1 leading-tight text-balance">
                    {mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}
                  </div>
                  <div className="text-base font-semibold text-[rgba(38,116,186,1)] flex-shrink-0">
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
              <div className="flex-1 flex flex-col min-h-0">
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
                    <div className="flex-1 flex items-center justify-center pb-2 min-h-0">
                      {studyType === "layer" ? (
                        <div className="relative w-full max-w-none overflow-hidden rounded-md h-[50vh] max-h-[400px]">
                          {task?.layeredImages?.map((img, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${img.url}-${idx}`}
                              src={img.url || "/placeholder.svg"}
                              alt={String(img.z)}
                              className="absolute inset-0 m-auto h-full w-full object-contain"
                              style={{ zIndex: img.z }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="w-full max-w-full overflow-hidden max-h-[50vh]">
                          {task?.gridUrls && task.gridUrls.length > 2 ? (
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full overflow-hidden place-items-center">
                              {task.gridUrls.slice(0, 4).map((url, i) => (
                                <div key={i} className="aspect-square w-full overflow-hidden rounded-md">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url || "/placeholder.svg"}
                                    alt={`element-${i + 1}`}
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 sm:gap-3">
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-md max-h-[22vh]">
                                {task?.leftImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={task.leftImageUrl || "/placeholder.svg"}
                                    alt="left"
                                    className="h-full w-full object-contain"
                                  />
                                ) : null}
                              </div>
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-md max-h-[22vh]">
                                {task?.rightImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={task.rightImageUrl || "/placeholder.svg"}
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
                    {studyType === "grid" && (
                      <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm font-semibold text-gray-800 mb-4 px-2">
                        <div className="text-center text-balance">{task?.leftLabel ?? ""}</div>
                        <div className="text-center text-balance">{task?.rightLabel ?? ""}</div>
                      </div>
                    )}

                    {/* Rating Scale - Bottom with iOS safe area padding */}
                    <div className="mt-1 pb-4 px-2" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
                      <div className="flex items-end justify-center">
                        <div className="flex items-end justify-between w-full max-w-sm">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            let labelText = ""
                            if (n === 1) labelText = scaleLabels.left
                            if (n === 3) labelText = scaleLabels.middle
                            if (n === 5) labelText = scaleLabels.right

                            return (
                              <div
                                key={n}
                                className="relative flex flex-col items-center w-[60px]"
                                onMouseEnter={() => {
                                  hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                                  lastViewTimeRef.current = new Date().toISOString()
                                }}
                              >
                                <div className="mb-2 w-full text-[10px] sm:text-xs font-medium text-gray-800 text-center leading-tight text-balance px-1 min-h-[2.5rem] flex items-end justify-center">
                                  <span className="break-words hyphens-auto">{labelText}</span>
                                </div>
                                <button
                                  onClick={() => handleSelect(n)}
                                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 transition-colors text-base sm:text-lg font-semibold flex-shrink-0 ${
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
              <div className="flex items-start justify-between text-sm text-gray-600 mb-1 gap-4">
                <div className="text-base font-medium text-gray-800 flex-1 leading-tight text-balance">
                  {mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}
                </div>
                <span className="flex-shrink-0">
                  {Math.min(currentTaskIndex + 1, totalTasks)} / {totalTasks}
                </span>
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
                    {studyType === "layer" ? (
                      <div className="flex justify-center">
                        <div className="relative w-full max-w-lg aspect-square overflow-hidden rounded-md">
                          {task?.layeredImages?.map((img, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${img.url}-${idx}`}
                              src={img.url || "/placeholder.svg"}
                              alt={String(img.z)}
                              className="absolute inset-0 m-auto h-full w-full object-contain"
                              style={{ zIndex: img.z }}
                            />
                          ))}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-md border">
                                {urls[0] && (
                                  <img
                                    src={urls[0] || "/placeholder.svg"}
                                    alt="left"
                                    className="h-full w-full object-contain"
                                  />
                                )}
                              </div>
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-md border">
                                {urls[1] && (
                                  <img
                                    src={urls[1] || "/placeholder.svg"}
                                    alt="right"
                                    className="h-full w-full object-contain"
                                  />
                                )}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div className={`grid grid-cols-2 gap-4`}>
                            {urls.slice(0, 4).map((url, i) => (
                              <div
                                key={i}
                                className="aspect-[4/3] w-full md:h-[24vh] lg:h-[26vh] overflow-hidden rounded-md border"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={(url as string) || "/placeholder.svg"}
                                  alt={`element-${i + 1}`}
                                  className="h-full w-full object-contain"
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

                    {/* Labels and rating scale - Larger for desktop */}
                    <div className="w-full max-w-2xl mx-auto mt-6">
                      <div className="flex items-end justify-center">
                        <div className="flex items-end justify-between w-full max-w-lg">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = lastSelected === n
                            let labelText = ""
                            if (n === 1) labelText = scaleLabels.left
                            if (n === 3) labelText = scaleLabels.middle
                            if (n === 5) labelText = scaleLabels.right

                            return (
                              <div
                                key={n}
                                className="relative flex flex-col items-center w-[90px]"
                                onMouseEnter={() => {
                                  hoverCountsRef.current[n] = (hoverCountsRef.current[n] || 0) + 1
                                  lastViewTimeRef.current = new Date().toISOString()
                                }}
                              >
                                <div className="mb-3 w-full text-xs lg:text-sm xl:text-base font-medium text-gray-900 text-center leading-tight text-balance px-1 min-h-[3rem] flex items-end justify-center">
                                  <span className="break-words hyphens-auto">{labelText}</span>
                                </div>
                                <button
                                  onClick={() => handleSelect(n)}
                                  className={`h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 xl:h-14 xl:w-14 rounded-full border-2 lg:border-2 transition-colors text-sm lg:text-base xl:text-lg font-semibold flex-shrink-0 ${
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
