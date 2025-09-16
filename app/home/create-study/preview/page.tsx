"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useEffect } from "react"

export default function ParticipateIntroPage() {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Track orientation page time
  const orientStartRef = useRef<number>(Date.now())

  // Fetch study details on component mount
  useEffect(() => {
    try {
      // Build from Step localStorage only
      const step1 = JSON.parse(localStorage.getItem('cs_step1') || '{}')
      const step2 = JSON.parse(localStorage.getItem('cs_step2') || '{}')
      const step5grid = JSON.parse(localStorage.getItem('cs_step5_grid') || '[]')
      const step5layer = JSON.parse(localStorage.getItem('cs_step5_layer') || '[]')
      // Preload some assets to smooth preview
      const urls = new Set<string>()
      if (step2?.type === 'grid') {
        (Array.isArray(step5grid) ? step5grid : []).forEach((e: any) => e?.secureUrl && urls.add(String(e.secureUrl)))
      } else if (step2?.type === 'layer') {
        (Array.isArray(step5layer) ? step5layer : []).forEach((l: any) => (l?.images||[]).forEach((img: any) => img?.secureUrl && urls.add(String(img.secureUrl))))
      }
      Array.from(urls).forEach((src) => { try { const img = new Image(); img.decoding = 'async'; /* @ts-ignore */ img.referrerPolicy = 'no-referrer'; img.src = src } catch {} })
    } catch {}
    setIsLoading(false)
  }, [])

  // Derive UI strings from steps
  const step1 = (()=>{ try{ return JSON.parse(localStorage.getItem('cs_step1')||'{}') }catch{return {}} })()
  const step2 = (()=>{ try{ return JSON.parse(localStorage.getItem('cs_step2')||'{}') }catch{return {}} })()
  const step6 = (()=>{ try{ return JSON.parse(localStorage.getItem('cs_step6')||'{}') }catch{return {}} })()
  const studyTitle = step1?.title || "Study Title"
  const estimatedTime = "3-5 minutes"
  const studyType = step2?.type === "layer" ? "Layer Study" : "Grid Study"
  const totalVignettes = step6?.respondents || 3
  const startHref = '/home/create-study/preview/personal-information'

  const handleStartStudy = async () => {
    if (isStarting) return
    
    setIsStarting(true)
    // Preview mode: do not store anything and just navigate within preview flow
    router.push(startHref)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-28 sm:pb-12">
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-28 sm:pb-12">
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">{studyTitle}</h1>
        <p className="mt-2 text-center text-sm sm:text-base text-gray-600">Thank you for participating in this research study.</p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleStartStudy}
            disabled={isStarting}
            className="inline-flex items-center justify-center px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm shadow-sm"
          >
            {isStarting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting...
              </>
            ) : (
              <>
                Start Study
                <span className="ml-2">↗</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-8">
          <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoCard label="Estimated Time:" value={estimatedTime} />
              <InfoCard label="Study Type:" value={studyType} />
              <InfoCard label="Total Vignettes:" value={String(totalVignettes)} />
            </div>

            <div className="mt-8 border-t pt-6">
              <Section title="Welcome to the Study!">
                <p className="text-sm text-gray-700">
                  You’re about to participate in an important research study. This study will help researchers understand how people evaluate different visual elements.
                </p>
              </Section>

              <Section title="What to Expect:">
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  <li><span className="font-semibold">Personal Information:</span> Brief demographic questions</li>
                  <li><span className="font-semibold">Classification Questions:</span> A few questions about your preferences</li>
                  <li><span className="font-semibold">Rating Tasks:</span> Rate different combinations of visual elements</li>
                </ul>
              </Section>

              <Section title="Important Notes:">
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  <li>Your responses are completely anonymous</li>
                  <li>There are no right or wrong answers</li>
                  <li>Please complete the study in one session</li>
                  <li>You can withdraw at any time</li>
                </ul>
              </Section>

              <div className="mt-6 text-[11px] sm:text-xs text-gray-500">
                This study has been approved by our research ethics board. Your participation is voluntary and appreciated.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removed bottom fixed button as main CTA is centered under subtitle */}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border shadow-sm p-4 text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-[rgba(38,116,186,1)]">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 border-b pb-2 border-blue-200/70">{title}</h3>
      {children}
    </div>
  )
}


