"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { getPublicShareDetails } from "@/lib/api/StudyAPI"
import { Copy, Download, Mail, X, Facebook, Share2, ArrowLeft } from "lucide-react"

const BRAND = "#2674BA"

export default function StudySharePage() {
  const params = useParams()
  const router = useRouter()
  const studyId = params.id as string

  const [shareDetails, setShareDetails] = useState<{ id: string; title: string; study_type: string; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<"link" | "embed" | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studyId) return
    
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch share details using the new public API
        const details = await getPublicShareDetails(studyId)
        // Remove share_url from details if it exists to prevent localhost URLs
        const { share_url, ...cleanDetails } = details as any
        setShareDetails(cleanDetails)
        
        // Don't use backend share_url, we'll generate it dynamically from current domain
        
      } catch (e: unknown) {
        console.error("Error loading share page:", e)
        setError((e as Error)?.message || "Failed to load study")
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [studyId, router])

  const shareUrl = useMemo(() => {
    if (!studyId) return ""
    if (typeof window !== 'undefined') {
      // Always use current domain + study ID (ignore backend share_url)
      const url = `${window.location.origin}/participate/${studyId}`
      // console.log('Generated share URL:', url, 'from origin:', window.location.origin)
      return url
    }
    return ""
  }, [studyId])

  const embedCode = useMemo(() => {
    const url = shareUrl || ""
    return `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`
  }, [shareUrl])

  const qrSrc = useMemo(() => {
    const url = shareUrl || ""
    // Using a public QR service to avoid extra deps
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`
  }, [shareUrl])

  const handleCopy = async (text: string, which: "link" | "embed") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  if (loading) {
    return (
      <AuthGuard requireAuth={true}>
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: BRAND }}></div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (error) {
    return (
      <AuthGuard requireAuth={true}>
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p className="text-red-600">{error}</p>
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

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-5 sm:px-8 py-5 border-b flex items-center justify-between" style={{ borderColor: "#E5EEF6" }}>
              <h1 className="text-xl font-semibold" style={{ color: BRAND }}>
                Share Study{shareDetails?.title ? `: ${shareDetails.title}` : ''}
              </h1>
              <button
                onClick={() => window.history.length > 1 ? window.history.back() : router.push('/home')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: BRAND, color: BRAND }}
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>

            {/* Study Link */}
            <div className="px-5 sm:px-8 py-6 space-y-6">
              <section>
                <div className="text-sm font-semibold mb-2" style={{ color: BRAND }}>Study Link</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-gray-700"
                  />
                  <button
                    onClick={() => handleCopy(shareUrl, "link")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border"
                    style={{ borderColor: BRAND, color: BRAND }}
                  >
                    <Copy className="w-4 h-4" />
                    {copied === "link" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Anyone with this link can participate in your study</p>
              </section>

              {/* QR + Download */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <img src={qrSrc} alt="QR Code" className="w-36 h-36 rounded-md border" />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: BRAND }}>QR Code</div>
                    <p className="text-xs text-gray-500 mb-3">Scan to participate
                      <br />Perfect for in-person studies or printed materials
                    </p>
                    <a
                      href={qrSrc}
                      download={`study-${studyId}-qr.png`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: BRAND }}
                    >
                      <Download className="w-4 h-4" />
                      Download QR Code
                    </a>
                  </div>
                </div>

                {/* Other Sharing Options */}
                <div>
                  <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>Other Sharing Options</div>
                  <div className="flex items-center gap-4">
                    <button className="w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: "#E5EEF6" }}>
                      <Mail className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: "#E5EEF6" }}>
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: "#E5EEF6" }}>
                      <Facebook className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: "#E5EEF6" }}>
                      <Share2 className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Embed Link */}
              <section>
                <div className="text-sm font-semibold mb-2" style={{ color: BRAND }}>Embed Link</div>
                <textarea
                  readOnly
                  value={embedCode}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 h-28"
                />
                <div className="mt-3">
                  <button
                    onClick={() => handleCopy(embedCode, "embed")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border"
                    style={{ borderColor: BRAND, color: BRAND }}
                  >
                    <Copy className="w-4 h-4" />
                    {copied === "embed" ? "Copied Embed Code" : "Copy Embed Code"}
                  </button>
                </div>
              </section>

              {/* Study Status Card */}
              <section>
                <div className="text-sm font-semibold mb-2" style={{ color: BRAND }}>Study Status</div>
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Study Title</div>
                      <div className="text-sm text-gray-800">{shareDetails?.title || "—"}</div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-xs text-gray-500 mb-1">&nbsp;</div>
                      <div className="text-sm font-medium" style={{ color: "#0BA84F" }}>{shareDetails?.status || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Study Type</div>
                      <div className="text-sm text-gray-800">{shareDetails?.study_type === "layer" ? "Layer - Based Study" : "Grid - Based Study"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Expected Duration</div>
                      <div className="text-sm text-gray-800">1 - 2 Minutes</div>
                    </div>
                  </div>
                  <div className="px-4 sm:px-6 py-3 text-center text-xs text-blue-600" style={{ color: BRAND, background: "#F6FAFF" }}>
                    Your study is currently active and collecting responses
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}


