"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useRef, useEffect, useLayoutEffect } from "react"
import Image from "next/image"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { imageCacheManager } from "@/lib/utils/imageCacheManager"
import { getRespondentStudyDetails, submitTasksBulk, getSessionStatus, startMergedStudy } from "@/lib/api/ResponseAPI"
import { API_BASE_URL } from "@/lib/api/LoginApi"
import { checkIsSpecialCreator } from "@/lib/config/specialCreators"
import {
  getMergedStudyConfig,
  isMergeStateActive,
  getMergeDoneById,
  clearMergeState,
  MERGE_STORAGE_KEYS,
} from "@/lib/config/mergedStudies"

const PENDING_TASKS_STORAGE_KEY = 'pending_task_responses'

// Save pending task payloads to localStorage as backup
const savePendingToStorage = (sessionId: string, tasks: any[]) => {
  try {
    localStorage.setItem(PENDING_TASKS_STORAGE_KEY, JSON.stringify({ sessionId, tasks }))
  } catch { /* quota exceeded or unavailable - best effort */ }
}

// Read pending task payloads from localStorage
const getPendingFromStorage = (): { sessionId: string; tasks: any[] } | null => {
  try {
    const raw = localStorage.getItem(PENDING_TASKS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.sessionId && Array.isArray(parsed?.tasks)) return parsed
    return null
  } catch { return null }
}

// Clear pending task payloads from localStorage
const clearPendingStorage = () => {
  try { localStorage.removeItem(PENDING_TASKS_STORAGE_KEY) } catch { /* best effort */ }
}

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

const flattenAssignedTasksForPreload = (assignedTasks: unknown): any[] => {
  if (!Array.isArray(assignedTasks)) return []

  return assignedTasks.flatMap((taskOrBucket) => {
    if (Array.isArray(taskOrBucket)) {
      return taskOrBucket.filter(Boolean)
    }
    return taskOrBucket ? [taskOrBucket] : []
  })
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
  const [isSpecialCreator, setIsSpecialCreator] = useState(false)
  const [isMergeTransitioning, setIsMergeTransitioning] = useState(false)
  const [mergePreloadProgress, setMergePreloadProgress] = useState(0)

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
  const gridPreviewContainerRef = useRef<HTMLDivElement>(null)
  const [gridPreviewSize, setGridPreviewSize] = useState({ width: 0, height: 0 })

  // Accumulate responses for bulk submission
  const pendingResponsesRef = useRef<any[]>([])
  // Track ALL task payloads ever created (for localStorage backup, never cleared until finalize)
  const allTaskPayloadsRef = useRef<any[]>([])
  // Track if a bulk send is currently in progress to prevent race conditions
  const isSendingRef = useRef<boolean>(false)
  // Track all in-flight batch promises so we can wait for them before redirect
  const pendingBatchPromisesRef = useRef<Promise<boolean>[]>([])
  // Guard against double-clicks on the same task (prevents duplicate submissions)
  const processedTaskRef = useRef<number>(-1)

  useEffect(() => {
    firstViewTimeRef.current = new Date().toISOString()
  }, [])

  // sendBeacon safety net: if user closes tab, send any pending data
  useEffect(() => {
    const handleBeforeUnload = () => {
      const stored = getPendingFromStorage()
      if (stored && stored.tasks.length > 0) {
        try {
          const q = encodeURIComponent(stored.sessionId)
          const url = `${API_BASE_URL}/responses/submit-tasks-bulk?session_id=${q}`
          const body = JSON.stringify({ tasks: stored.tasks })
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
        } catch { /* best effort */ }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
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

  // Special creator: only from localStorage (show rating scale 1 and 5 only)
  useEffect(() => {
    const email = typeof window !== "undefined" ? localStorage.getItem("current_study_creator_email") : null
    setIsSpecialCreator(checkIsSpecialCreator(email ?? ""))
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

        // API returns background at root metadata; merge may add study_info.metadata — read both
        const metadata = info.metadata || details.metadata || {}
        setBackgroundUrl(metadata.background_image_url || info.background_image_url || details.background_image_url || null)

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
          // Shuffle elements within the task (grid/text/hybrid) so display order varies per respondent
          const displayList = list.length > 0 ? [...list].sort(() => Math.random() - 0.5) : list

          return {
            id: String(t.task_id || t.task_index || Math.random()),
            type: activeType === "text" ? "text" : "grid",
            leftImageUrl: activeType === "text" ? undefined : displayList[0],
            rightImageUrl: activeType === "text" ? undefined : displayList[1],
            gridUrls: displayList,
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

  // Keep mobile grid cells square without stretching row gaps on taller screens.
  useEffect(() => {
    if (!gridPreviewContainerRef.current) return

    const updateSize = () => {
      if (gridPreviewContainerRef.current) {
        setGridPreviewSize({
          width: gridPreviewContainerRef.current.offsetWidth,
          height: gridPreviewContainerRef.current.offsetHeight,
        })
      }
    }

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateSize)
    })

    observer.observe(gridPreviewContainerRef.current)
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
  }, [currentTaskIndex, studyType, isInitialLoading])

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
    // Guard against double-clicks on same task - silently ignore if already processed
    if (processedTaskRef.current === currentTaskIndex) return
    processedTaskRef.current = currentTaskIndex

    clickCountsRef.current[value] = (clickCountsRef.current[value] || 0) + 1

    const elapsedMs = Date.now() - taskStartRef.current
    const seconds = Number((elapsedMs / 1000).toFixed(3))
    setLastSelected(value)
    lastViewTimeRef.current = new Date().toISOString()

    // Get session info once
    const sessionRaw = localStorage.getItem('study_session')
    const sessionId = sessionRaw ? (JSON.parse(sessionRaw).sessionId as string | undefined) : undefined

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
      allTaskPayloadsRef.current.push(payload)

      // Save ALL task payloads to localStorage as backup (never cleared until finalize)
      if (sessionId) {
        savePendingToStorage(sessionId, allTaskPayloadsRef.current)
      }
    }

    const isLastTask = currentTaskIndex === totalTasks - 1
    const shouldSendMiddleBatch = pendingResponsesRef.current.length >= 15 && !isLastTask

    // Handle middle batch (every 15 tasks) - only if not already sending
    if (shouldSendMiddleBatch && !isSendingRef.current && sessionRaw && sessionId) {
      const chunkToSend = [...pendingResponsesRef.current]
      isSendingRef.current = true
      pendingResponsesRef.current = []
      
      const batchPromise = (async (): Promise<boolean> => {
        try {
          let attempts = 0
          const maxAttempts = 5
          let success = false
          
          while (attempts < maxAttempts && !success) {
            attempts++
            try {
              const result = await submitTasksBulk(sessionId, chunkToSend)
              const failed = result && typeof result === "object" && result.ok === false
              if (!failed) {
                success = true
              } else {
                await new Promise((r) => setTimeout(r, 1000 * attempts))
              }
            } catch (err) {
              console.error(`Bulk submit attempt ${attempts} failed:`, err)
              if (attempts < maxAttempts) {
                await new Promise((r) => setTimeout(r, 1000 * attempts))
              }
            }
          }
          
          if (!success) {
            console.error("All retry attempts failed, re-queuing responses for final batch")
            pendingResponsesRef.current = [...chunkToSend, ...pendingResponsesRef.current]
          }
          
          return success
        } finally {
          isSendingRef.current = false
        }
      })()
      
      pendingBatchPromisesRef.current.push(batchPromise)
    }

    // Handle last task - ALWAYS process, wait for everything, finalize, then redirect
    if (isLastTask) {
      if (sessionRaw && sessionId) {
        setIsLoading(true)
        
        try {
          // Wait for any in-flight background batches to complete
          if (pendingBatchPromisesRef.current.length > 0) {
            await Promise.all(pendingBatchPromisesRef.current)
            pendingBatchPromisesRef.current = []
          }
          
          // Collect all pending responses (current + any re-queued from failed batches)
          const finalChunk = [...pendingResponsesRef.current]
          pendingResponsesRef.current = []
          
          // Send final batch with infinite retry until success
          if (finalChunk.length > 0) {
            while (true) {
              const lastResult = await submitTasksBulk(sessionId, finalChunk)
              const failed = lastResult && typeof lastResult === "object" && lastResult.ok === false
              if (!failed) break
              await new Promise((r) => setTimeout(r, 1000))
            }
          }
          
          // Finalize: verify all tasks were received by the backend
          const status = await getSessionStatus(sessionId)
          
          if (!status.is_completed) {
            // Some tasks missing - resend ALL from localStorage (backend dedup handles duplicates)
            const stored = getPendingFromStorage()
            if (stored && stored.tasks.length > 0) {
              let recoverySuccess = false
              for (let attempt = 0; attempt < 3 && !recoverySuccess; attempt++) {
                const result = await submitTasksBulk(sessionId, stored.tasks)
                const failed = result && typeof result === "object" && result.ok === false
                if (!failed) {
                  recoverySuccess = true
                } else {
                  await new Promise((r) => setTimeout(r, 1000))
                }
              }
            }
          }
          
          // Clear localStorage - session is done
          clearPendingStorage()
          
          // Check for merged study transition - ONLY proceed if all tasks confirmed submitted
          const mergeConfig = getMergedStudyConfig(studyIdFromParams)
          const isMerged = isMergeStateActive()
          const doneById = getMergeDoneById()
          
          // Re-verify final completion status before merge transition
          const finalStatus = await getSessionStatus(sessionId)
          const allTasksSubmitted = finalStatus.is_completed
          
          if (isMerged && mergeConfig && doneById && allTasksSubmitted) {
            // Transition to second study
            setIsMergeTransitioning(true)
            setMergePreloadProgress(5)
            setIsLoading(false)
            
            const nextStudyId = mergeConfig.secondStudyId
            let transitionSuccess = false
            const maxRetries = 5
            let personalInfo: Record<string, any> = {}

            try {
              const personalInfoRaw = localStorage.getItem('personal_info')
              const parsed = personalInfoRaw ? JSON.parse(personalInfoRaw) : null
              personalInfo = parsed?.user_details && typeof parsed.user_details === 'object'
                ? parsed.user_details
                : (parsed && typeof parsed === 'object' ? parsed : {})
            } catch {
              personalInfo = {}
            }
            
            for (let attempt = 0; attempt < maxRetries && !transitionSuccess; attempt++) {
              try {
                setMergePreloadProgress(10)
                // 1. Start new session for second study with same Done By ID and demographics
                const response = await startMergedStudy(nextStudyId, doneById, personalInfo)
                setMergePreloadProgress(20)
                
                // 2. Store new session data
                localStorage.setItem('study_session', JSON.stringify({
                  sessionId: response.session_id,
                  respondentId: response.respondent_id,
                  studyId: nextStudyId,
                  totalTasks: response.total_tasks_assigned,
                  doneById: response.done_by_id || doneById,
                }))

                // 3. Mark transition as pending (for recovery)
                localStorage.setItem(MERGE_STORAGE_KEYS.MERGE_PENDING_TRANSITION, nextStudyId)
                
                // 4. Get respondent study details for second study
                const respondentDetails = await getRespondentStudyDetails(
                  String(response.respondent_id),
                  nextStudyId
                )
                setMergePreloadProgress(35)
                
                // 5. Store study details (same logic as intro page)
                const normalizedInfo = respondentDetails?.study_info || {}
                const backgroundUrl = normalizedInfo?.metadata?.background_image_url ||
                  normalizedInfo?.background_image_url ||
                  respondentDetails?.metadata?.background_image_url || null
                  
                const essentialData = {
                  study_info: {
                    ...normalizedInfo,
                    ...(backgroundUrl ? { metadata: { ...(normalizedInfo.metadata || {}), background_image_url: backgroundUrl } } : {}),
                  },
                  assigned_tasks: respondentDetails?.assigned_tasks || [],
                  classification_questions: respondentDetails?.classification_questions || [],
                  layers: respondentDetails?.layers || [],
                  ...(respondentDetails?.metadata ? { metadata: respondentDetails.metadata } : {}),
                }
                localStorage.setItem('current_study_details', JSON.stringify(essentialData))
                setMergePreloadProgress(40)

                // The second study skips the normal intro/personal-info warmup, so reset
                // the first study cache and preload the second study assets before routing.
                try {
                  imageCacheManager.clearCache()
                  setMergePreloadProgress(45)

                  const secondStudyTasks = flattenAssignedTasksForPreload(respondentDetails?.assigned_tasks)
                  if (secondStudyTasks.length > 0) {
                    let progressInterval: ReturnType<typeof setInterval> | undefined
                    const updatePreloadProgress = () => {
                      const progress = imageCacheManager.getPreloadProgress()
                      if (progress.total <= 0) return

                      const completed = progress.loaded + progress.failed
                      const pct = 45 + Math.round((completed / progress.total) * 45)
                      setMergePreloadProgress(Math.max(45, Math.min(90, pct)))
                    }

                    try {
                      progressInterval = setInterval(updatePreloadProgress, 250)
                      await imageCacheManager.preloadAllTaskImages(secondStudyTasks)
                      updatePreloadProgress()
                    } finally {
                      if (progressInterval) clearInterval(progressInterval)
                    }
                    setMergePreloadProgress((prev) => Math.max(prev, 90))
                  } else {
                    setMergePreloadProgress(90)
                  }

                  if (backgroundUrl && typeof backgroundUrl === 'string') {
                    await imageCacheManager.prewarmUrls([backgroundUrl], "high")
                  }
                  setMergePreloadProgress(98)
                } catch (preloadError) {
                  console.warn("Second merged study image preload failed:", preloadError)
                  setMergePreloadProgress((prev) => Math.max(prev, 90))
                }
                
                // 6. Clear merge state (transition complete)
                clearMergeState()
                localStorage.removeItem(MERGE_STORAGE_KEYS.MERGE_PENDING_TRANSITION)
                
                transitionSuccess = true
                setMergePreloadProgress(100)
                
                // 7. General merged studies skip fragrance and start at classification questions.
                router.push(`/participate/${nextStudyId}/classification-questions`)
                return
              } catch (err) {
                console.error(`Merge transition attempt ${attempt + 1} failed:`, err)
                if (attempt < maxRetries - 1) {
                  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                  await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
                }
              }
            }
            
            // All attempts failed - clear merge state and go to thank you
            if (!transitionSuccess) {
              console.error('All merge transition attempts failed, proceeding to thank you page')
              clearMergeState()
              setIsMergeTransitioning(false)
            }
          } else if (isMerged && mergeConfig && doneById && !allTasksSubmitted) {
            // Tasks not confirmed submitted - don't transition, clear merge state
            console.error('Cannot transition to merged study: tasks not confirmed submitted')
            clearMergeState()
          }
          
          // Default: go to thank you page
          router.push(`/participate/${studyIdFromParams}/thank-you`)
        } catch (finalError) {
          console.error('Error in last task handling:', finalError)
          router.push(`/participate/${studyIdFromParams}/thank-you`)
        }
      } else {
        router.push(`/participate/${studyIdFromParams}/thank-you`)
      }
    } else {
      setTimeout(() => setCurrentTaskIndex((i) => i + 1), 30)
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
  const ratingScaleValues = isSpecialCreator ? [1, 5] : [1, 2, 3, 4, 5]
  const mobileGridFrameSize = Math.max(0, Math.min(gridPreviewSize.width, gridPreviewSize.height)) || undefined
  const mobileGridFrameStyle = mobileGridFrameSize
    ? { width: mobileGridFrameSize, height: mobileGridFrameSize, zIndex: 1 }
    : { zIndex: 1 }

  return (
    <div
      className="h-[100dvh] lg:h-screen lg:bg-white overflow-hidden"
      style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
    >
      {/* Merge Transition Loading Overlay */}
      {isMergeTransitioning && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[rgba(38,116,186,1)] mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Preparing next part...
            </h2>
            <div className="mx-auto mb-4 w-64 max-w-full">
              <div className="mb-2 text-sm font-semibold text-[rgba(38,116,186,1)]">
                {mergePreloadProgress}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[rgba(38,116,186,1)] transition-all duration-300"
                  style={{ width: `${mergePreloadProgress}%` }}
                />
              </div>
            </div>
            <p className="text-gray-600 mb-2">
              Please wait while we set up the next part of your session.
            </p>
            <p className="text-sm text-gray-500 font-medium">
              Please don&apos;t close this tab.
            </p>
          </div>
        </div>
      )}

      <div className={`max-w-6xl mx-auto h-full flex flex-col ${isBgLandscape ? 'px-0 sm:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'} pt-2 sm:pt-12 md:pt-14 lg:pt-2 pb-2 lg:flex lg:flex-col`}>
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
              className="lg:hidden flex flex-col flex-1 min-h-0 overflow-hidden"
              style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
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
                      <p className="mt-1 text-sm font-medium text-gray-700">Please don&apos;t close your tab.</p>
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
                          <div ref={previewContainerRef} className={`relative aspect-square h-full max-h-full w-auto max-w-full min-h-0 ${isBgLandscape ? '' : 'sm:max-w-sm md:max-w-md'}`}>
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
                        <div ref={gridPreviewContainerRef} className="w-full h-full flex items-center justify-center overflow-hidden relative">
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
                            // Keep a consistent minimal gap without forcing square cells
                            <div className="relative mx-auto grid max-w-full grid-cols-2 grid-rows-2 gap-2" style={mobileGridFrameStyle}>
                              <div className="contents">
                                {task.gridUrls.slice(0, 2).map((url: string, i: number) => (
                                  <div key={i} className="flex h-full w-full items-center justify-center overflow-hidden">
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
                              <div className="col-span-2 flex h-full w-full justify-center">
                                <div className="flex h-full w-[calc((100%-0.5rem)/2)] items-center justify-center overflow-hidden">
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
                            <div className="grid max-w-full grid-cols-2 grid-rows-2 gap-2 overflow-hidden place-items-center relative" style={mobileGridFrameStyle}>
                              {task.gridUrls.slice(0, 4).map((url: string, i: number) => (
                                <div key={i} className="flex h-full w-full items-center justify-center overflow-hidden">
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
                            <div className="grid max-w-full grid-cols-2 gap-2 overflow-hidden place-items-center relative min-w-0" style={mobileGridFrameStyle}>
                              <div className="flex h-full w-full min-w-0 items-center justify-center overflow-hidden">
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
                              <div className="flex h-full w-full min-w-0 items-center justify-center overflow-hidden">
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

                    {/* Rating scale labels - hidden for special creators */}
                    {!isSpecialCreator && (
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
                    )}

                    {/* Rating Scale */}
                    <div
                      className={`mt-auto pb-2 flex-shrink-0 ${isBgLandscape ? 'px-6 sm:px-2' : 'px-2'}`}
                      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
                    >
                      <div className="flex items-center justify-center mb-2">
                        {isSpecialCreator ? (
                          /* Thumbs up/down for special creators */
                          <div className="flex items-center justify-center gap-4">
                            <button
                              onClick={() => handleSelect(1)}
                              className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 transition-colors flex items-center justify-center flex-shrink-0 ${lastSelected === 1
                                ? "bg-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)]"
                                : "bg-white border-gray-300 hover:border-[rgba(38,116,186,1)]"
                                }`}
                              onMouseEnter={() => {
                                hoverCountsRef.current[1] = (hoverCountsRef.current[1] || 0) + 1
                                lastViewTimeRef.current = new Date().toISOString()
                              }}
                            >
                              <ThumbsDown 
                                className={`h-6 w-6 sm:h-7 sm:w-7 ${lastSelected === 1 ? "text-white" : "text-[rgba(38,116,186,1)]"}`} 
                              />
                            </button>
                            <button
                              onClick={() => handleSelect(5)}
                              className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 transition-colors flex items-center justify-center flex-shrink-0 ${lastSelected === 5
                                ? "bg-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)]"
                                : "bg-white border-gray-300 hover:border-[rgba(38,116,186,1)]"
                                }`}
                              onMouseEnter={() => {
                                hoverCountsRef.current[5] = (hoverCountsRef.current[5] || 0) + 1
                                lastViewTimeRef.current = new Date().toISOString()
                              }}
                            >
                              <ThumbsUp 
                                className={`h-6 w-6 sm:h-7 sm:w-7 ${lastSelected === 5 ? "text-white" : "text-[rgba(38,116,186,1)]"}`} 
                              />
                            </button>
                          </div>
                        ) : (
                          /* Regular rating scale for non-special creators */
                          <div className={`flex items-center mx-auto ${ratingScaleValues.length === 2 ? 'justify-center gap-6' : 'justify-between w-full max-w-[320px]'}`}>
                            {ratingScaleValues.map((n) => {
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
                        )}
                      </div>


                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              <div className="flex items-start justify-between text-sm text-gray-600 mb-2 gap-4 flex-shrink-0">
                <div className="text-lg font-semibold text-gray-800 flex-1 leading-tight break-words hyphens-auto max-w-[calc(100%-5rem)] line-clamp-2">
                  {mainQuestion || `Question ${Math.min(currentTaskIndex + 1, totalTasks)}`}
                </div>
              </div>
              <div className="h-1 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                <div className="h-full bg-[rgba(38,116,186,1)] transition-all" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="mt-2 bg-white border rounded-xl shadow-sm p-3 flex-1 min-h-0 flex flex-col overflow-hidden xl:max-h-[780px]">
                {isLoading ? (
                  <div className="p-6 text-center flex-1 flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-gray-900">Processing your responses...</h2>
                    <p className="mt-2 text-sm text-gray-600">Please wait while we save your study data.</p>
                    <p className="mt-1 text-sm font-medium text-gray-700">Please don&apos;t close your tab.</p>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0">
                    {task?.type === "layer" ? (
                      <div className="flex justify-center flex-1 min-h-0 overflow-hidden">
                        <div ref={previewContainerRefDesktop} className="relative w-full max-w-lg h-full max-h-[45vh] lg:max-h-[55vh] xl:max-h-[60vh] overflow-hidden" style={{ aspectRatio: '1/1' }}>
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
                      <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden relative gap-2 p-4 max-h-[45vh] lg:max-h-[55vh] xl:max-h-[60vh]">
                        {task?.gridUrls?.map((statement, idx) => (
                          <div
                            key={idx}
                            className="w-full flex items-center justify-center text-center px-4 py-3 rounded-xl shadow-sm transition-colors bg-gray-50"
                            style={{
                              height: `${100 / (task?.gridUrls?.length || 1)}%`,
                              maxHeight: '120px',
                              fontSize: 'clamp(14px, 1.2vw, 20px)',
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
                            <div className="flex justify-center items-center w-full flex-1 min-h-0 max-w-lg mx-auto relative max-h-[45vh] lg:max-h-[55vh] xl:max-h-[60vh]" style={{ aspectRatio: '1/1' }}>
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
                              <div className="grid grid-cols-2 gap-2 w-full h-full relative" style={{ zIndex: 1 }}>
                                <div className="w-full h-full min-w-0 overflow-hidden flex items-center justify-center">
                                  {urls[0] && (
                                    <Image
                                      src={getCachedUrl(urls[0]) || "/placeholder.svg"}
                                      alt="left"
                                      width={300}
                                      height={300}
                                      className="max-h-full max-w-full object-contain"
                                      loading="eager"
                                      unoptimized={urls[0]?.includes("blob.core.windows.net")}
                                    />
                                  )}
                                </div>
                                <div className="w-full h-full min-w-0 overflow-hidden flex items-center justify-center">
                                  {urls[1] && (
                                    <Image
                                      src={getCachedUrl(urls[1]) || "/placeholder.svg"}
                                      alt="right"
                                      width={300}
                                      height={300}
                                      className="max-h-full max-w-full object-contain"
                                      loading="eager"
                                      unoptimized={urls[1]?.includes("blob.core.windows.net")}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }

                        if (urls.length === 3) {
                          return (
                            <div className="relative max-w-lg mx-auto flex-1 min-h-0 w-full">
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
                              <div className="flex w-full flex-col gap-2" style={{ zIndex: 1 }}>
                                <div className="grid grid-cols-2 gap-2 items-start">
                                  {urls.slice(0, 2).map((url, i) => (
                                    <div key={i} className="w-full overflow-hidden">
                                      <Image
                                        src={getCachedUrl(url as string) || "/placeholder.svg"}
                                        alt={`element-${i + 1}`}
                                        width={300}
                                        height={300}
                                        className="h-auto w-full object-contain"
                                        unoptimized={(url as string)?.includes("blob.core.windows.net")}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex w-full justify-center">
                                  <div className="w-[calc((100%-0.5rem)/2)] overflow-hidden">
                                    <Image
                                      src={getCachedUrl(urls[2] as string) || "/placeholder.svg"}
                                      alt="element-3"
                                      width={300}
                                      height={300}
                                      className="h-auto w-full object-contain"
                                      unoptimized={(urls[2] as string)?.includes("blob.core.windows.net")}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div className="grid grid-cols-2 gap-2 relative max-w-lg mx-auto w-full items-start">
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
                                className="w-full overflow-hidden flex items-start justify-center"
                                style={{ zIndex: 1 }}
                              >
                                <Image
                                  src={getCachedUrl(url as string) || "/placeholder.svg"}
                                  alt={`element-${i + 1}`}
                                  width={300}
                                  height={300}
                                  className="h-auto w-full object-contain"
                                  unoptimized={(url as string)?.includes("blob.core.windows.net")}
                                />
                              </div>
                            ))}
                          </div>
                        )
                      })()
                    )}

                    <div className="w-full flex-shrink-0 mt-auto">
                      {/* Labels - fixed section */}
                      <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-800 flex-shrink-0 mt-2">
                        <div className="text-center text-balance">{task?.leftLabel ?? ""}</div>
                        <div className="text-center text-balance">{task?.rightLabel ?? ""}</div>
                      </div>

                      {/* Scale labels - fixed section - hidden for special creators */}
                      {!isSpecialCreator && (
                        <div className="flex flex-col items-center justify-center gap-1 px-2 flex-shrink-0 mt-1">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="h-7 w-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                              1
                            </div>
                            {scaleLabels.left && (
                              <div className="text-sm font-medium text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                                {scaleLabels.left}
                              </div>
                            )}
                          </div>

                          {scaleLabels.middle && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="h-7 w-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                                3
                              </div>
                              <div className="text-sm font-medium text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                                {scaleLabels.middle}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="h-7 w-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                              5
                            </div>
                            {scaleLabels.right && (
                              <div className="text-sm font-medium text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0">
                                {scaleLabels.right}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rating buttons - keep fixed bottom anchoring */}
                      <div className="w-full max-w-2xl mx-auto flex-shrink-0 pt-2">
                        <div className="flex items-center justify-center">
                          {isSpecialCreator ? (
                          /* Thumbs up/down for special creators */
                          <div className="flex items-center justify-center gap-4">
                            <button
                              onClick={() => handleSelect(1)}
                              className={`h-12 w-12 lg:h-14 lg:w-14 rounded-full border-2 transition-colors flex items-center justify-center flex-shrink-0 ${lastSelected === 1
                                ? "bg-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)]"
                                : "bg-white border-gray-300 hover:border-[rgba(38,116,186,1)]"
                                }`}
                              onMouseEnter={() => {
                                hoverCountsRef.current[1] = (hoverCountsRef.current[1] || 0) + 1
                                lastViewTimeRef.current = new Date().toISOString()
                              }}
                            >
                              <ThumbsDown 
                                className={`h-6 w-6 lg:h-7 lg:w-7 ${lastSelected === 1 ? "text-white" : "text-[rgba(38,116,186,1)]"}`} 
                              />
                            </button>
                            <button
                              onClick={() => handleSelect(5)}
                              className={`h-12 w-12 lg:h-14 lg:w-14 rounded-full border-2 transition-colors flex items-center justify-center flex-shrink-0 ${lastSelected === 5
                                ? "bg-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)]"
                                : "bg-white border-gray-300 hover:border-[rgba(38,116,186,1)]"
                                }`}
                              onMouseEnter={() => {
                                hoverCountsRef.current[5] = (hoverCountsRef.current[5] || 0) + 1
                                lastViewTimeRef.current = new Date().toISOString()
                              }}
                            >
                              <ThumbsUp 
                                className={`h-6 w-6 lg:h-7 lg:w-7 ${lastSelected === 5 ? "text-white" : "text-[rgba(38,116,186,1)]"}`} 
                              />
                            </button>
                          </div>
                          ) : (
                          /* Regular rating scale for non-special creators */
                          <div className="flex items-center justify-center gap-3">
                            {ratingScaleValues.map((n) => {
                              const selected = lastSelected === n
                              return (
                                <button
                                  key={n}
                                  onClick={() => handleSelect(n)}
                                  className={`h-10 w-10 lg:h-11 lg:w-11 rounded-full border-2 transition-colors text-sm font-semibold flex-shrink-0 ${selected
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
    </div >
  )
}