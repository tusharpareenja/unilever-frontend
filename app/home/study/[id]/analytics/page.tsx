"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { getStudyBasicDetails, StudyDetails } from "@/lib/api/StudyAPI"
import { downloadStudyResponsesCsv, getStudyAnalysisJson } from "@/lib/api/ResponseAPI"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, BarChart3, Download, Filter, LayoutDashboard, Sparkles } from "lucide-react"
import Link from "next/link"
import { AnalyticsToolbar } from "./components/AnalyticsToolbar"
import { AnalyticsTable } from "./components/AnalyticsTable"
import { AnalyticsHeatmap } from "./components/AnalyticsHeatmap"
import { AnalyticsGraph } from "./components/AnalyticsGraph"
import { AnalyticsKPICards } from "./components/AnalyticsKPICards"
import { AnalyticsResponseTimeSection } from "./components/AnalyticsResponseTimeSection"
import { AnalyticsPieCharts } from "./components/AnalyticsPieCharts"
import { AnalyticsTopBottomPerformers } from "./components/AnalyticsTopBottomPerformers"
import { AnalyticsFatiguePredictor } from "./components/AnalyticsFatiguePredictor"
import { AnalyticsPersonaBlueprints } from "./components/AnalyticsPersonaBlueprints"
import { AnalyticsFilterAnalysis } from "./components/AnalyticsFilterAnalysis"
import { AnalyticsDesignConfigurator } from "./components/AnalyticsDesignConfigurator"

export default function StudyAnalyticsPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const studyId = params.id as string
    const projId = searchParams.get('proj_id') || searchParams.get('projectId')
    const projectQuery = projId ? `?proj_id=${encodeURIComponent(projId)}` : ''
    const homeHref = `/home${projectQuery}`
    const studyHref = `/home/study/${studyId}${projectQuery}`

    const [study, setStudy] = useState<StudyDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [exporting, setExporting] = useState(false)
    const [exportStage, setExportStage] = useState(0)
    const [analysisData, setAnalysisData] = useState<any>(null)
    const [analysisLoading, setAnalysisLoading] = useState(true)
    const [analysisError, setAnalysisError] = useState<string | null>(null)

    useEffect(() => {
        if (!studyId) return
        loadStudyDetails()
    }, [studyId])

    useEffect(() => {
        if (!studyId) return
        setAnalysisLoading(true)
        setAnalysisError(null)
        getStudyAnalysisJson(studyId)
            .then(setAnalysisData)
            .catch((e) => {
                console.warn("Failed to load analysis:", e)
                setAnalysisError((e as Error)?.message ?? "Failed to load analysis")
            })
            .finally(() => setAnalysisLoading(false))
    }, [studyId])

    const loadStudyDetails = async () => {
        try {
            setLoading(true)
            setError(null)
            const studyData = await getStudyBasicDetails(studyId)
            setStudy(studyData)
        } catch (err: unknown) {
            console.error("Failed to load study details:", err)
            setError((err as Error)?.message || "Failed to load study details")
        } finally {
            setLoading(false)
        }
    }

    const buildCsvAndDownload = async () => {
        if (!study) return

        try {
            setExporting(true)
            setExportStage(1)
            await new Promise(resolve => setTimeout(resolve, 1000))
            setExportStage(2)
            await new Promise(resolve => setTimeout(resolve, 1000))
            setExportStage(3)
            await new Promise(resolve => setTimeout(resolve, 500))

            const blob = await downloadStudyResponsesCsv(studyId)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${study?.title || 'study'}-analytics.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) {
            console.error('Export CSV failed:', e)
            alert('Failed to export CSV')
        } finally {
            setExporting(false)
            setExportStage(0)
        }
    }

    const [analyticsView, setAnalyticsView] = useState<"overview" | "configurator" | "filter" | "detail">("overview")
    const [activeView, setActiveView] = useState("table")

    // Smooth scroll to top when switching tabs to prevent jarring layout shift (Overview/Detail have scroll, Filter is shorter)
    useEffect(() => {
        if (!analysisData) return
        window.scrollTo({ top: 0, behavior: "smooth" })
    }, [analyticsView, analysisData])
    const [activeMetric, setActiveMetric] = useState("Top Down")
    const [activeTab, setActiveTab] = useState("Overall")

    // Smooth scroll to top when switching tabs to prevent jarring layout shift
    useEffect(() => {
        if (!analysisData) return
        window.scrollTo({ top: 0, behavior: "smooth" })
    }, [analyticsView, analysisData])

    const loadingMessages = useMemo(
        () => [
            "Getting your responses...",
            "Crunching the numbers...",
            "Building your analysis...",
            "Creating insights...",
            "Almost there...",
        ],
        []
    )
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
    useEffect(() => {
        if (!analysisLoading || analysisData) return
        const id = setInterval(() => {
            setLoadingMessageIndex((i) => (i + 1) % loadingMessages.length)
        }, 2200)
        return () => clearInterval(id)
    }, [analysisLoading, analysisData, loadingMessages.length])

    if (loading) {
        return (
            <AuthGuard requireAuth={true}>
                <div className="min-h-screen bg-gray-50">
                    <DashboardHeader />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    </div>
                </div>
            </AuthGuard>
        )
    }

    const pageTitle = study?.title || analysisData?.["Information Block"]?.["Study Title"] || "Study Analytics"
    const rawStudyType = study?.study_type || analysisData?.["Information Block"]?.["Study Type"] || "text"
    const studyType = typeof rawStudyType === "string" ? rawStudyType.toLowerCase() : "text"

    if (error && !analysisData) {
        return (
            <AuthGuard requireAuth={true}>
                <div className="min-h-screen bg-gray-50">
                    <DashboardHeader />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
                            <p className="text-red-600">{error || "Study not found"}</p>
                            <button
                                onClick={() => router.push(homeHref)}
                                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </AuthGuard>
        )
    }

    return (
        <AuthGuard requireAuth={true}>
            <div className="min-h-screen bg-gray-50">
                <DashboardHeader />

                {/* Header Section */}
                <div className="text-white" style={{ backgroundColor: '#2674BA' }}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        {/* Breadcrumbs */}
                        <nav className="text-[10px] sm:text-xs md:text-sm mb-4">
                            <Link href={homeHref} className="text-blue-200 hover:text-white transition-colors">Dashboard</Link>
                            <span className="mx-2 text-blue-300 opacity-50">/</span>
                            <Link href={homeHref} className="text-blue-200 hover:text-white transition-colors">Studies</Link>
                            <span className="mx-2 text-blue-300 opacity-50">/</span>
                            <span className="text-white font-medium">
                                {studyType === "grid" ? "Grid Study" : studyType === "hybrid" ? "Hybrid Study" : studyType === "text" ? "Text Study" : "Layer Study"} Analytics
                            </span>
                        </nav>

                        {/* Title and Actions */}
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{pageTitle}</h1>
                            <div className="flex items-center gap-3 w-full lg:w-auto">
                                <button
                                    onClick={() => router.push(studyHref)}
                                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg transition-all duration-200 hover:bg-white/10 active:scale-95 text-xs sm:text-sm font-semibold"
                                    style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' }}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="whitespace-nowrap">Back to Study</span>
                                </button>

                                <button
                                    onClick={buildCsvAndDownload}
                                    disabled={exporting || !study}
                                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white rounded-lg transition-all duration-200 hover:shadow-lg active:scale-95 font-bold text-xs sm:text-sm whitespace-nowrap"
                                    style={{ color: '#2674BA' }}
                                >
                                    {exporting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                            <span>
                                                {exportStage === 1 && "Extracting..."}
                                                {exportStage === 2 && "Processing..."}
                                                {exportStage === 3 && "Generating..."}
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

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {analysisError && (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                            <p className="font-medium">Analysis could not be loaded</p>
                            <p className="text-sm mt-1">{analysisError}</p>
                        </div>
                    )}

                    {analysisLoading && !analysisData ? (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50/80 rounded-xl border border-gray-100">
                            <div className="animate-spin rounded-full h-14 w-14 border-2 border-[#2674BA] border-t-transparent" />
                            <p className="mt-5 text-lg font-medium text-gray-700 transition-opacity duration-300">
                                {loadingMessages[loadingMessageIndex]}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Something good is cooking…
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Overview / Filter Analysis / Detail Analysis toggle */}
                            {analysisData && (
                                <div className="flex flex-wrap gap-2 mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("overview")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "overview"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "overview" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Overview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("filter")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "filter"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "filter" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <Filter className="w-4 h-4" />
                                        Filter Analysis
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("configurator")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "configurator"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "configurator" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Design Configurator
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("detail")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "detail"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "detail" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        Detail Analysis
                                    </button>
                                </div>
                            )}

                            <div className="min-h-[50vh]">
                            <AnimatePresence mode="wait">
                                {analyticsView === "overview" && analysisData && (
                                    <motion.div
                                        key="overview"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        transition={{ duration: 0.25 }}
                                        className="space-y-0"
                                    >
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.4 }}>
                                            <AnalyticsKPICards analysisData={analysisData} studyType={studyType} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
                                            <AnalyticsResponseTimeSection analysisData={analysisData} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
                                            <AnalyticsPieCharts analysisData={analysisData} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.4 }}>
                                            <AnalyticsTopBottomPerformers analysisData={analysisData} studyType={studyType} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.4 }} className="mt-10">
                                            <AnalyticsPersonaBlueprints
                                                analysisData={analysisData}
                                                studyType={studyType as "text" | "grid" | "layer" | "hybrid"}
                                            />
                                        </motion.div>
                                    </motion.div>
                                )}
                                {analyticsView === "detail" && analysisData && (
                                    <motion.div
                                        key="detail"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        transition={{ duration: 0.25 }}
                                    >
                                        <AnalyticsToolbar
                                            activeView={activeView}
                                            setActiveView={setActiveView}
                                            activeMetric={activeMetric}
                                            setActiveMetric={setActiveMetric}
                                            activeTab={activeTab}
                                            setActiveTab={setActiveTab}
                                        />
                                        {activeView === "table" ? (
                                            <AnalyticsTable analysisData={analysisData} activeMetric={activeMetric} activeTab={activeTab} studyType={studyType} />
                                        ) : activeView === "heatmap" ? (
                                            <AnalyticsHeatmap analysisData={analysisData} activeMetric={activeMetric} activeTab={activeTab} studyType={studyType} />
                                        ) : activeView === "graph" ? (
                                            <AnalyticsGraph analysisData={analysisData} activeMetric={activeMetric} activeTab={activeTab} studyType={studyType} />
                                        ) : (
                                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center text-gray-500">
                                                <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: "#2674BA" }} />
                                                <h3 className="text-xl font-semibold text-gray-700">Analytics Content for {activeTab}</h3>
                                                <p>Displaying {activeMetric} in {activeView} view.</p>
                                                <p className="mt-2 text-sm italic">We are currently building the detailed visualizations for this section.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Keep mounted when not active so configurator selections persist when switching tabs */}
                            <div className={analyticsView !== "configurator" ? "hidden" : undefined}>
                                <AnalyticsDesignConfigurator analysisData={analysisData} studyType={studyType} />
                            </div>

                            {/* Keep mounted when not active so filter state and results persist when switching tabs */}
                            <div className={analyticsView !== "filter" ? "hidden" : undefined}>
                                <AnalyticsFilterAnalysis
                                    studyId={studyId}
                                    studyType={studyType}
                                    classificationQuestions={
                                        (study as any)?.classification_questions ??
                                        (analysisData as any)?.classification_questions ??
                                        (analysisData as any)?.meta?.classification_questions
                                    }
                                />
                            </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AuthGuard>
    )
}
