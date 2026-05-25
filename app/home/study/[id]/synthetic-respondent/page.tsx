"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { useAuth } from "@/lib/auth/AuthContext"
import { checkIsSpecialCreator } from "@/lib/config/specialCreators"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { getStudyBasicDetails, getStudyBasicDetails2, simulateAIRespondents, getSimulateAIStatus, subscribeSimulateAIWebSocket, type StudyDetails, type StudyBasicDetails2 } from "@/lib/api/StudyAPI"
import {
  ArrowLeft,
  Bot,
  Sparkles,
  Users,
  Link2,
  Play,
  CheckCircle2,
  Loader2,
  Zap,
  ChevronRight,
  Activity,
} from "lucide-react"
import { CountUp } from "../analytics/components/CountUp"

const BRAND = "#2674BA"

const STORAGE_KEY = (studyId: string) => `synthetic_respondent_job_${studyId}`

interface StoredJob {
  jobId: string
  respondentCount: number
  studyId: string
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
}

/* ─── Animated background orbs ─────────────────────────────────────────── */
function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #5ba3e8 0%, #2674BA 60%, transparent 100%)" }}
      />
      <div
        className="absolute top-12 right-0 w-[320px] h-[320px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #60c3ff 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[160px] opacity-15 blur-3xl"
        style={{ background: "radial-gradient(ellipse, #1a4f80 0%, transparent 70%)" }}
      />
    </div>
  )
}

/* ─── Stat chip ─────────────────────────────────────────────────────────── */
function StatChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
      <Icon className="w-4 h-4 text-blue-200 shrink-0" />
      <span className="text-white/70 text-xs">{label}</span>
      <span className="text-white font-semibold text-xs">{value}</span>
    </div>
  )
}

export default function SyntheticRespondentPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const studyId = params.id as string
  const projId = searchParams.get('proj_id') || searchParams.get('projectId')
  const projectQuery = projId ? `?proj_id=${encodeURIComponent(projId)}` : ''
  const homeHref = `/home${projectQuery}`
  const studyHref = `/home/study/${studyId}${projectQuery}`
  const { user } = useAuth()
  const isSpecialCreator = checkIsSpecialCreator(user?.email ?? null)

  const [study, setStudy] = useState<StudyDetails | null>(null)
  const [studyBasic2, setStudyBasic2] = useState<StudyBasicDetails2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [respondentCountInput, setRespondentCountInput] = useState("")
  const [randomizeRespondent, setRandomizeRespondent] = useState(false)
  const [apiAttached, setApiAttached] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [simulateJobId, setSimulateJobId] = useState<string | null>(null)
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [simulateError, setSimulateError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Initial load: basic details for header/breadcrumbs
  useEffect(() => {
    if (!studyId) return
    getStudyBasicDetails(studyId)
      .then(setStudy)
      .catch((e) => setError((e as Error)?.message ?? "Failed to load study"))
      .finally(() => setLoading(false))
  }, [studyId])

  // Background: basic-2 for max combinations + total_responses (validation)
  useEffect(() => {
    if (!studyId) return
    getStudyBasicDetails2(studyId)
      .then(setStudyBasic2)
      .catch(() => {})
  }, [studyId])

  // Restore in-progress job from localStorage on mount (keyed by studyId so other studies don't show this)
  useEffect(() => {
    if (!studyId || typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY(studyId))
      if (!raw) return
      const data = JSON.parse(raw) as StoredJob
      if (data?.jobId && typeof data.respondentCount === "number" && data.studyId === studyId) {
        setRespondentCountInput(String(data.respondentCount))
        setSimulateJobId(data.jobId)
        setIsRunning(true)
        setCompletedCount(0)
      }
    } catch { /* ignore */ }
  }, [studyId])

  const maxPanelists = studyBasic2 ? (() => {
    const qs = studyBasic2.classification_questions
    if (!qs?.length) return 10000
    let product = 1
    for (const q of qs) {
      const n = q.answer_options?.length ?? 0
      product *= n > 0 ? n : 1
    }
    return product
  })() : null
  const totalResponses = (studyBasic2?.total_responses ?? 0)
  const configuredRespondents = studyBasic2?.study_config?.number_of_respondents
  const effectiveMax = maxPanelists != null
    ? Math.min(maxPanelists, configuredRespondents ?? Infinity)
    : null
  const availableSlots = effectiveMax != null ? Math.max(0, effectiveMax - totalResponses) : null

  const respondentCount = Math.min(10000, Math.max(0, parseInt(respondentCountInput, 10) || 0))

  const validationError = ((): string | null => {
    if (respondentCount < 1) return "Enter at least 1 panelist."
    if (maxPanelists != null && respondentCount > maxPanelists)
      return `AI can create max ${maxPanelists} unique panelists based on your classification questions.`
    if (availableSlots != null && respondentCount > availableSlots && totalResponses > 0)
      return `You already have ${totalResponses} respondents. AI can add max ${availableSlots} more panelists.`
    return null
  })()

  const targetCompletedRef = useRef(0)
  const displayedCountRef = useRef(0)
  const animateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsCleanupRef = useRef<(() => void) | null>(null)
  const jobCompletedRef = useRef(false)
  const lastStatusRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isResumingRef = useRef(false)

  displayedCountRef.current = completedCount

  // Smooth animation helper
  const startAnimation = useCallback(() => {
    if (animateTimerRef.current) return
    animateTimerRef.current = setInterval(() => {
      setCompletedCount((cur) => {
        const target = targetCompletedRef.current
        if (cur >= target) {
          if (animateTimerRef.current) {
            clearInterval(animateTimerRef.current)
            animateTimerRef.current = null
          }
          if (jobCompletedRef.current) {
            setIsRunning(false)
            if (lastStatusRef.current === "completed") setShowSuccess(true)
          }
          return target
        }
        return cur + 1
      })
    }, 80)
  }, [])

  // WebSocket subscription with fallback and reconnection
  const startWebSocketSubscription = useCallback((jobId: string, totalRespondents: number) => {
    if (jobCompletedRef.current) return

    // Create abort controller for cleanup
    const ac = new AbortController()
    abortControllerRef.current = ac

    const cleanup = subscribeSimulateAIWebSocket(
      jobId,
      totalRespondents,
      // onProgress
      (completed, progress, message) => {
        console.log(`[Synthetic] Progress: ${completed}/${totalRespondents} (${progress.toFixed(1)}%) - ${message}`)
        targetCompletedRef.current = completed
        const displayed = displayedCountRef.current
        if (completed > displayed) startAnimation()
      },
      // onComplete
      (totalCompleted) => {
        console.log(`[Synthetic] Completed: ${totalCompleted} respondents`)
        jobCompletedRef.current = true
        lastStatusRef.current = "completed"
        targetCompletedRef.current = totalCompleted
        
        // Animate to final count then show success
        const displayed = displayedCountRef.current
        if (totalCompleted > displayed) {
          startAnimation()
        } else {
          setIsRunning(false)
          setShowSuccess(true)
        }
        
        // Clear localStorage
        try {
          localStorage.removeItem(STORAGE_KEY(studyId))
        } catch { /* ignore */ }
      },
      // onError
      (error) => {
        console.error(`[Synthetic] Error:`, error)
        jobCompletedRef.current = true
        lastStatusRef.current = "failed"
        setSimulateError(error)
        setIsRunning(false)
        
        // Clear localStorage
        try {
          localStorage.removeItem(STORAGE_KEY(studyId))
        } catch { /* ignore */ }
      },
      ac.signal
    )

    wsCleanupRef.current = cleanup
  }, [studyId, startAnimation])

  // Check job status and resume WebSocket if needed (for page refresh/return scenarios)
  const checkAndResumeJob = useCallback(async (jobId: string, totalRespondents: number) => {
    if (isResumingRef.current || jobCompletedRef.current) return
    isResumingRef.current = true

    try {
      console.log(`[Synthetic] Checking job status: ${jobId}`)
      const status = await getSimulateAIStatus(jobId)
      
      if (status.status === "completed") {
        console.log(`[Synthetic] Job already completed`)
        jobCompletedRef.current = true
        lastStatusRef.current = "completed"
        const finalCount = status.respondents_requested ?? totalRespondents
        targetCompletedRef.current = finalCount
        setCompletedCount(finalCount)
        setIsRunning(false)
        setShowSuccess(true)
        try { localStorage.removeItem(STORAGE_KEY(studyId)) } catch { /* ignore */ }
        return
      }
      
      if (status.status === "failed" || status.status === "cancelled") {
        console.log(`[Synthetic] Job failed/cancelled`)
        jobCompletedRef.current = true
        lastStatusRef.current = status.status
        if (status.error) setSimulateError(status.error)
        setIsRunning(false)
        try { localStorage.removeItem(STORAGE_KEY(studyId)) } catch { /* ignore */ }
        return
      }

      // Job still running - get current progress and start WebSocket
      const requested = status.respondents_requested ?? totalRespondents
      const progressPct = status.progress ?? 0
      const currentCompleted = requested > 0 ? Math.round((progressPct / 100) * requested) : 0
      
      console.log(`[Synthetic] Job in progress: ${currentCompleted}/${requested} (${progressPct}%)`)
      targetCompletedRef.current = currentCompleted
      setCompletedCount(currentCompleted)
      
      // Start WebSocket subscription
      startWebSocketSubscription(jobId, requested)
      
    } catch (error) {
      console.error(`[Synthetic] Error checking job status:`, error)
      // Try starting WebSocket anyway - it will handle errors
      startWebSocketSubscription(jobId, totalRespondents)
    } finally {
      isResumingRef.current = false
    }
  }, [studyId, startWebSocketSubscription])

  // Main effect: handle job subscription when running
  useEffect(() => {
    if (!isRunning || !simulateJobId) return

    jobCompletedRef.current = false
    lastStatusRef.current = null
    isResumingRef.current = false

    // Check current status and start WebSocket
    checkAndResumeJob(simulateJobId, respondentCount)

    return () => {
      // Cleanup on unmount or when job changes
      if (wsCleanupRef.current) {
        wsCleanupRef.current()
        wsCleanupRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (animateTimerRef.current) {
        clearInterval(animateTimerRef.current)
        animateTimerRef.current = null
      }
    }
  }, [isRunning, simulateJobId, respondentCount, checkAndResumeJob])

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    if (!isRunning || !simulateJobId) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (jobCompletedRef.current) return
      
      console.log('[Synthetic] Tab became visible, checking job status...')
      
      // Re-check job status when tab becomes visible
      checkAndResumeJob(simulateJobId, respondentCount)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRunning, simulateJobId, respondentCount, checkAndResumeJob])

  const handleStartStudy = async () => {
    if (validationError) return
    try {
      setSimulateLoading(true)
      setSimulateError(null)
      const res = await simulateAIRespondents(studyId, {
        max_respondents: respondentCount,
        is_special_creator: isSpecialCreator,
        randomize: randomizeRespondent,
      })
      const jobId = res?.job_id
      if (!jobId) {
        setSimulateError("No job_id returned from simulation")
        return
      }
      setCompletedCount(0)
      setShowSuccess(false)
      setSimulateJobId(jobId)
      setIsRunning(true)
      try {
        localStorage.setItem(
          STORAGE_KEY(studyId),
          JSON.stringify({ jobId, respondentCount, studyId })
        )
      } catch { /* ignore */ }
    } catch (e) {
      setSimulateError((e as Error)?.message ?? "Failed to start AI simulation")
    } finally {
      setSimulateLoading(false)
    }
  }

  const progressPercent = respondentCount > 0 ? (completedCount / respondentCount) * 100 : 0
  const isDone = completedCount >= respondentCount

  if (loading) {
    return (
      <AuthGuard requireAuth={true}>
        <div className="min-h-screen" style={{ background: "#F0F5FB" }}>
          <DashboardHeader />
          <div className="flex items-center justify-center py-32">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="w-14 h-14 rounded-full border-[3px] border-t-transparent"
                style={{ borderColor: `${BRAND}40`, borderTopColor: BRAND }}
              />
              <Bot className="absolute inset-0 m-auto w-6 h-6" style={{ color: BRAND }} />
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (error || !study) {
    return (
      <AuthGuard requireAuth={true}>
        <div className="min-h-screen" style={{ background: "#F0F5FB" }}>
          <DashboardHeader />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p className="text-red-600">{error || "Study not found"}</p>
              <button onClick={() => router.push(homeHref)} className="cursor-pointer mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  const studyLabel =
    study.study_type === "grid"
      ? "Grid Study"
      : study.study_type === "hybrid"
        ? "Hybrid Study"
        : study.study_type === "text"
          ? "Text Study"
          : "Layer Study"

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen" style={{ background: "#EFF5FB" }}>
        <DashboardHeader />

        {/* ── Top Banner ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a5fa8 0%, #2674BA 40%, #1d6db5 70%, #134e8a 100%)" }}>
          <BackgroundOrbs />

          {/* subtle grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm mb-5">
              <Link href={homeHref} className="text-blue-200/70 hover:text-white transition-colors">Dashboard</Link>
              <ChevronRight className="w-3.5 h-3.5 text-blue-300/50" />
              <Link href={studyHref} className="text-blue-200/70 hover:text-white transition-colors">{studyLabel}</Link>
              <ChevronRight className="w-3.5 h-3.5 text-blue-300/50" />
              <span className="text-white/90 font-medium">AI Agentic Respondents</span>
            </nav>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-3xl font-bold text-white tracking-tight"
                >
                  AI Agentic Respondents
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08, duration: 0.5 }}
                  className="text-blue-200/80 text-sm mt-1"
                >
                  Run AI-powered panelists at scale — no waiting for real users.
                </motion.p>
              </div>

              <motion.button
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.03, backgroundColor: "rgba(255,255,255,0.18)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => (window.history.length > 1 ? router.back() : router.push(studyHref))}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm text-white text-sm font-medium transition-colors w-fit"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── Page body ───────────────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-7">

            {/* ── Hero card ─────────────────────────────────────────────── */}
            <motion.section variants={item} className="relative overflow-hidden rounded-3xl shadow-xl" style={{ background: "linear-gradient(135deg, #1d6db5 0%, #2674BA 35%, #1a5898 65%, #0f3d70 100%)" }}>
              {/* Orbs inside card */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #7ec8ff, transparent)" }} />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #60a0e0, transparent)" }} />
                {/* dot grid */}
                <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              </div>

              <div className="relative p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row sm:items-start gap-7">
                  {/* Icon box */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 220 }}
                    className="shrink-0 relative"
                  >
                    <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center border border-white/25 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.14)" }}>
                      <Bot className="w-9 h-9 text-white" strokeWidth={1.4} />
                    </div>
                    {/* pulse ring */}
                    <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 border border-white/50" style={{ animationDuration: "2.5s" }} />
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-white/25 bg-white/15 text-white backdrop-blur-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI-Powered
                      </span>
                      
                    </div>

                    <h2 className="text-2xl sm:text-[1.75rem] font-bold text-white leading-tight tracking-tight mb-3">
                      Don&apos;t have respondents?&nbsp;
                      <span className="text-blue-200">We&apos;ve got you.</span>
                    </h2>
                    <p className="text-white/75 text-base leading-relaxed max-w-xl">
                      Our AI agentic respondents create panelists and participate in your study — so you can run studies at scale without waiting for real users.
                    </p>

                    <div className="flex flex-wrap gap-2.5 mt-6">
                      
                      <StatChip icon={Users} label="Max" value="10 000 panelists" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ── Config / Progress card ─────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {!isRunning && !showSuccess ? (
                <motion.section
                  key="config"
                  variants={item}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
                  className="bg-white rounded-3xl shadow-sm border border-[#dce8f4] overflow-hidden"
                >
                  {/* Card header */}
                  <div className="px-7 sm:px-8 py-5 border-b border-[#e8f0f8] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E5EEF6" }}>
                      <Zap className="w-4 h-4" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base">Configure AI agentic run</h3>
                      <p className="text-gray-400 text-xs">Set how many AI panelists should complete your study.</p>
                    </div>
                  </div>

                  <div className="px-7 sm:px-8 py-8 space-y-7">
                    {/* Respondent count */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2.5">
                        Number of respondents
                      </label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-colors" style={{ background: "#E5EEF6" }}>
                          <Users className="w-4.5 h-4.5" style={{ color: BRAND }} />
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="e.g. 200"
                          value={respondentCountInput}
                          onChange={(e) => setRespondentCountInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                          className="w-full pl-16 pr-24 py-3.5 rounded-xl border border-[#dce8f4] bg-[#f7fafd] focus:bg-white focus:border-[#2674BA] focus:ring-2 focus:ring-[#2674BA]/15 outline-none text-gray-800 font-medium text-lg transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                          panelists
                        </span>
                      </div>

                      {validationError && (
                        <p className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1.5">
                          <span className="inline-block w-1 h-4 rounded-full bg-red-500" />
                          {validationError}
                        </p>
                      )}
                      {maxPanelists != null && maxPanelists < 10000 && !validationError && (
                        <p className="mt-2 text-xs text-gray-500">
                          Max unique panelists from classification: {maxPanelists}
                          {totalResponses > 0 && ` · ${totalResponses} respondents already · ${availableSlots} available`}
                        </p>
                      )}
                      {/* Quick-pick chips */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {[10, 25, 50, 100, 200, 500, 1000].filter((n) => maxPanelists == null || n <= (availableSlots ?? maxPanelists)).map((n) => (
                          <motion.button
                            key={n}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setRespondentCountInput(String(n))}
                            className="cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
                            style={
                              respondentCount === n && respondentCountInput !== ""
                                ? { background: BRAND, borderColor: BRAND, color: "#fff" }
                                : { background: "#f0f5fb", borderColor: "#dce8f4", color: "#2674BA" }
                            }
                          >
                            {n}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Randomize respondent toggle */}
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-[#dce8f4] bg-[#f7fafd]">
                      <input
                        type="checkbox"
                        id="randomize-respondent"
                        checked={randomizeRespondent}
                        onChange={(e) => setRandomizeRespondent(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#2674BA]"
                      />
                      <div className="flex-1">
                        <label htmlFor="randomize-respondent" className="cursor-pointer block">
                          <span className="font-medium text-gray-700 text-sm">Randomize respondent</span>
                        </label>
                        
                      </div>
                    </div>

                    {/* API attach (disabled) */}
                    {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2.5">
                        Attach API <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-[#dce8f4] bg-[#f7fafd] cursor-not-allowed opacity-70 select-none">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#E5EEF6" }}>
                          <Link2 className="w-5 h-5" style={{ color: BRAND }} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-700 text-sm">API integration</p>
                          <p className="text-xs text-gray-400 mt-0.5">Connect your panel or data source — coming soon.</p>
                        </div>
                        <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Soon</span>
                      </div>
                    </div> */}

                    {simulateError && (
                      <p className="text-sm font-medium text-red-600 flex items-center gap-1.5">
                        <span className="inline-block w-1 h-4 rounded-full bg-red-500" />
                        {simulateError}
                      </p>
                    )}
                    {/* CTA */}
                    <motion.button
                      whileHover={!validationError && !simulateLoading ? { scale: 1.015, boxShadow: "0 8px 28px rgba(38,116,186,0.38)" } : {}}
                      whileTap={!validationError && !simulateLoading ? { scale: 0.975 } : {}}
                      onClick={() => handleStartStudy()}
                      disabled={respondentCount < 1 || !!validationError || simulateLoading}
                      className="cursor-pointer inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ background: `linear-gradient(135deg, #3486cc 0%, ${BRAND} 50%, #1a5898 100%)`, boxShadow: "0 4px 20px rgba(38,116,186,0.35)" }}
                    >
                      {simulateLoading ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin" />
                          Starting…
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Play className="w-4 h-4 fill-white text-white" />
                          </div>
                          Start study with AI agentic respondents
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="progress"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl shadow-sm border border-[#dce8f4] overflow-hidden"
                >
                  {/* Card header */}
                  <div
                    className="px-7 sm:px-8 py-5 border-b border-[#e8f0f8] flex items-center justify-between flex-wrap gap-4"
                    style={{ background: isDone ? "linear-gradient(90deg,#f0faf4,#ffffff)" : "white" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: isDone ? "#dcf5e7" : "#E5EEF6" }}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin" style={{ color: BRAND }} />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-base">
                          {isDone ? "Study complete 🎉" : "AI agentic respondents in progress"}
                        </h3>
                        <p className="text-gray-400 text-xs">{isDone ? "All panelists have finished." : "AI panelists are completing your study..."}</p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <CountUp
                        value={completedCount}
                        className={`text-3xl font-black tabular-nums ${isDone ? "text-green-600" : "text-[#2674BA]"}`}
                      />
                      <span className="text-gray-300 font-light text-xl">/</span>
                      <span className="text-xl font-bold text-gray-600">{respondentCount}</span>
                    </div>
                  </div>

                  <div className="px-7 sm:px-8 py-8">
                    {/* Progress track */}
                    <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "#EAF1FA" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ type: "spring", stiffness: 45, damping: 22 }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: isDone
                            ? "linear-gradient(90deg, #22c55e, #16a34a)"
                            : `linear-gradient(90deg, #5ba8e8, ${BRAND}, #1a5898)`,
                          boxShadow: isDone ? "0 0 12px rgba(34,197,94,0.4)" : "0 0 12px rgba(38,116,186,0.45)",
                        }}
                      />
                      {/* shimmer */}
                      {!isDone && (
                        <motion.div
                          animate={{ x: ["-100%", "400%"] }}
                          transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                          className="absolute inset-y-0 w-1/4 rounded-full"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
                        />
                      )}
                    </div>

                    {/* Percentage */}
                    <div className="flex items-center justify-between mt-2.5">
                      <p className="text-xs text-gray-400">
                        {isDone ? "All done!" : "Completing responses..."}
                      </p>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: isDone ? "#16a34a" : BRAND }}>
                        {Math.round(progressPercent)}%
                      </span>
                    </div>

                    {/* Completion block */}
                    {isDone && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-8"
                      >
                        {/* Success banner */}
                        <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 mb-6">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                          <div>
                            <p className="font-semibold text-emerald-800 text-sm">
                              <CountUp value={respondentCount} className="font-black" /> panelists completed successfully
                            </p>
                            <p className="text-emerald-600/80 text-xs mt-0.5">Check Responses or Analytics to explore results.</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <motion.button
                            whileHover={{ scale: 1.02, boxShadow: "0 6px 22px rgba(38,116,186,0.35)" }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => router.push(studyHref)}
                            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all text-sm"
                            style={{ background: `linear-gradient(135deg, #3486cc, ${BRAND})` }}
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Back to study
                          </motion.button>
                     
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Trust line */}
            <motion.p variants={item} className="text-center text-xs text-gray-400 leading-relaxed">
              AI agentic responses are generated by AI and can be used for testing and scaling.
              <br className="hidden sm:block" />
              Real respondent data is collected when you share your study link.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </AuthGuard>
  )
}