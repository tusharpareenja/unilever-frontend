"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { checkIsSpecialCreator } from "@/lib/config/specialCreators"

export default function ParticipateIntroPage() {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Track orientation page time
  // const orientStartRef = useRef<number>(Date.now())

  // Fetch study details on component mount
  useEffect(() => {
    try {
      // Build from Step localStorage only
      const step2 = JSON.parse(localStorage.getItem('cs_step2') || '{}')
      const step5grid = JSON.parse(localStorage.getItem('cs_step5_grid') || '[]')
      const step5layer = JSON.parse(localStorage.getItem('cs_step5_layer') || '[]')
      const step7matrix = JSON.parse(localStorage.getItem('cs_step7_matrix') || '{}')
      const layerBg = JSON.parse(localStorage.getItem('cs_step5_layer_background') || '{}')

      console.log('[Preview] Step2:', step2)
      console.log('[Preview] Step7 Matrix:', step7matrix)

      // Preload all study assets
      const urls = new Set<string>()

      if (step2?.type === 'text') {
        console.log('[Preview] Skipping image preloading for text study type')
      } else {
        // Add background image for layer studies
        if (layerBg?.secureUrl) {
          urls.add(String(layerBg.secureUrl))
          console.log('[Preview] Adding background URL:', layerBg.secureUrl)
        }

        // Add grid elements
        if (step2?.type === 'grid') {
          (Array.isArray(step5grid) ? step5grid : []).forEach((e: Record<string, unknown>) => {
            if (e?.secureUrl) {
              urls.add(String(e.secureUrl))
              console.log('[Preview] Adding grid URL:', e.secureUrl)
            }
          })
        }

        // Add layer images
        if (step2?.type === 'layer') {
          (Array.isArray(step5layer) ? step5layer : []).forEach((l: Record<string, unknown>) => {
            (Array.isArray(l?.images) ? l.images : []).forEach((img: Record<string, unknown>) => {
              if (img?.secureUrl) {
                urls.add(String(img.secureUrl))
                console.log('[Preview] Adding layer URL:', img.secureUrl)
              }
            })
          })
        }

        // Add task images from matrix
        if (step7matrix && typeof step7matrix === 'object') {
          // Check for new preview format first
          if (Array.isArray(step7matrix.preview_tasks)) {
            console.log('[Preview] Found preview_tasks:', step7matrix.preview_tasks.length)
            step7matrix.preview_tasks.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                // Handle layer study format: {url: "...", layer_name: "...", name: "...", z_index: 0}
                if (v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.startsWith('http')) {
                  urls.add(String(v.url))
                  console.log('[Preview] Adding task layer URL:', v.url)
                }
                // Handle other URL formats
                else if (v && typeof v === 'object') {
                  if (v.content && typeof v.content === 'string' && v.content.startsWith('http')) {
                    urls.add(String(v.content))
                    console.log('[Preview] Adding task content URL:', v.content)
                  }
                } else if (typeof v === 'string' && v.startsWith('http')) {
                  urls.add(String(v))
                  console.log('[Preview] Adding task string URL:', v)
                }
              })
            })
          } else if (Array.isArray(step7matrix.tasks)) {
            console.log('[Preview] Found tasks array:', step7matrix.tasks.length)
            step7matrix.tasks.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                // Handle layer study format: {url: "...", layer_name: "...", name: "...", z_index: 0}
                if (v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.startsWith('http')) {
                  urls.add(String(v.url))
                  console.log('[Preview] Adding task layer URL:', v.url)
                }
                // Handle other URL formats
                else if (v && typeof v === 'object') {
                  if (v.content && typeof v.content === 'string' && v.content.startsWith('http')) {
                    urls.add(String(v.content))
                    console.log('[Preview] Adding task content URL:', v.content)
                  }
                } else if (typeof v === 'string' && v.startsWith('http')) {
                  urls.add(String(v))
                  console.log('[Preview] Adding task string URL:', v)
                }
              })
            })
          } else if (step7matrix.tasks && typeof step7matrix.tasks === 'object') {
            const buckets = step7matrix.tasks as Record<string, any>
            // Prefer bucket "0" if present; otherwise pick the first non-empty array
            let respondentTasks: any[] = []
            if (Array.isArray(buckets['0']) && buckets['0'].length) {
              respondentTasks = buckets['0']
            } else {
              for (const v of Object.values(buckets)) {
                if (Array.isArray(v) && v.length) { respondentTasks = v; break }
              }
            }
            console.log('[Preview] Found bucket tasks:', respondentTasks.length)
            respondentTasks.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                // Handle layer study format: {url: "...", layer_name: "...", name: "...", z_index: 0}
                if (v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.startsWith('http')) {
                  urls.add(String(v.url))
                  console.log('[Preview] Adding bucket task layer URL:', v.url)
                }
                // Handle other URL formats
                else if (v && typeof v === 'object') {
                  if (v.content && typeof v.content === 'string' && v.content.startsWith('http')) {
                    urls.add(String(v.content))
                    console.log('[Preview] Adding bucket task content URL:', v.content)
                  }
                } else if (typeof v === 'string' && v.startsWith('http')) {
                  urls.add(String(v))
                  console.log('[Preview] Adding bucket task string URL:', v)
                }
              })
            })
          }
        }
      }

      // Preload all images
      if (urls.size > 0) {
        console.log('[Preview] Preloading', urls.size, 'images from localStorage')
        Array.from(urls).forEach((src) => {
          try {
            console.log('[Preview] Preloading image:', src)
            const img = new Image()
              ; (img as any).decoding = 'async'
              ; (img as any).referrerPolicy = 'no-referrer'
            img.src = src
          } catch (e) {
            console.error('[Preview] Failed to preload:', src, e)
          }
        })
      }
    } catch (e) {
      console.error('[Preview] Error in useEffect:', e)
    }
    setIsLoading(false)
  }, [])

  // Derive UI strings from steps
  const step1 = (() => { try { return JSON.parse(localStorage.getItem('cs_step1') || '{}') } catch { return {} } })()
  const step2 = (() => { try { return JSON.parse(localStorage.getItem('cs_step2') || '{}') } catch { return {} } })()
  // Check creator email from step 1 or other source
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const userEmail = user?.email || ""
  const isAdmin = checkIsSpecialCreator(userEmail)

  const step6 = (() => { try { return JSON.parse(localStorage.getItem('cs_step6') || '{}') } catch { return {} } })()
  const step7matrix = (() => { try { return JSON.parse(localStorage.getItem('cs_step7_matrix') || '{}') } catch { return {} } })()

  const studyTitle = step1?.title || "Study Title"
  const estimatedTime = "2-5 minutes"
  const orientationText = step2?.orientationText || "Welcome to the study!"
  const studyType = step2?.type === "layer" ? "Layer Study" : step2?.type === "text" ? "Text Study" : step2?.type === "hybrid" ? "Hybrid Study" : "Grid Study"

  // Calculate total number of tasks
  let totalTasks = 0
  if (step7matrix && typeof step7matrix === 'object') {
    if (Array.isArray(step7matrix.preview_tasks)) {
      totalTasks = step7matrix.preview_tasks.length
    } else if (Array.isArray(step7matrix.tasks)) {
      totalTasks = step7matrix.tasks.length
    } else if (step7matrix.tasks && typeof step7matrix.tasks === 'object') {
      const buckets = step7matrix.tasks as Record<string, any>
      if (Array.isArray(buckets['0']) && buckets['0'].length) {
        totalTasks = buckets['0'].length
      } else {
        for (const v of Object.values(buckets)) {
          if (Array.isArray(v) && v.length) {
            totalTasks = v.length
            break
          }
        }
      }
    }
  }

  const totalVignettes = totalTasks || 0
  const startHref = '/home/create-study/preview/personal-information'

  const handleStartStudy = async () => {
    if (isStarting) return

    setIsStarting(true)

    // Additional preloading when user clicks Start Study
    try {
      const step2 = JSON.parse(localStorage.getItem('cs_step2') || '{}')
      if (step2?.type === 'text') {
        console.log('[Preview] Start Study - Skipping image preloading for text study type')
      } else {
        const step7matrix = JSON.parse(localStorage.getItem('cs_step7_matrix') || '{}')
        const layerBg = JSON.parse(localStorage.getItem('cs_step5_layer_background') || '{}')

        const urls = new Set<string>()

        // Add background image
        if (layerBg?.secureUrl) {
          urls.add(String(layerBg.secureUrl))
        }

        // Add all task images from matrix
        if (step7matrix && typeof step7matrix === 'object') {
          if (Array.isArray(step7matrix.preview_tasks)) {
            step7matrix.preview_tasks.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                // Handle layer study format: {url: "...", layer_name: "...", name: "...", z_index: 0}
                if (v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.startsWith('http')) {
                  urls.add(String(v.url))
                }
                // Handle other URL formats
                else if (v && typeof v === 'object') {
                  if (v.content && typeof v.content === 'string' && v.content.startsWith('http')) {
                    urls.add(String(v.content))
                  }
                } else if (typeof v === 'string' && v.startsWith('http')) {
                  urls.add(String(v))
                }
              })
            })
          } else if (Array.isArray(step7matrix.tasks)) {
            step7matrix.tasks.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                // Handle layer study format: {url: "...", layer_name: "...", name: "...", z_index: 0}
                if (v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.startsWith('http')) {
                  urls.add(String(v.url))
                }
                // Handle other URL formats
                else if (v && typeof v === 'object') {
                  if (v.content && typeof v.content === 'string' && v.content.startsWith('http')) {
                    urls.add(String(v.content))
                  }
                } else if (typeof v === 'string' && v.startsWith('http')) {
                  urls.add(String(v))
                }
              })
            })
          } else if (step7matrix.tasks && typeof step7matrix.tasks === 'object') {
            const buckets = step7matrix.tasks as Record<string, any>
            let respondentTasks: any[] = []
            if (Array.isArray(buckets['0']) && buckets['0'].length) {
              respondentTasks = buckets['0']
            } else {
              for (const v of Object.values(buckets)) {
                if (Array.isArray(v) && v.length) { respondentTasks = v; break }
              }
            }
            respondentTasks.forEach((t: any) => {
              const content = t?.elements_shown_content || {}
              Object.values(content).forEach((v: any) => {
                // Handle layer study format: {url: "...", layer_name: "...", name: "...", z_index: 0}
                if (v && typeof v === 'object' && v.url && typeof v.url === 'string' && v.url.startsWith('http')) {
                  urls.add(String(v.url))
                }
                // Handle other URL formats
                else if (v && typeof v === 'object') {
                  if (v.content && typeof v.content === 'string' && v.content.startsWith('http')) {
                    urls.add(String(v.content))
                  }
                } else if (typeof v === 'string' && v.startsWith('http')) {
                  urls.add(String(v))
                }
              })
            })
          }
        }

        // Preload all images with high priority
        if (urls.size > 0) {
          console.log('[Preview] Start Study - Preloading', urls.size, 'images with high priority')
          Array.from(urls).forEach((src) => {
            try {
              console.log('[Preview] High priority preloading:', src)
              const img = new Image()
                ; (img as any).decoding = 'async'
                ; (img as any).referrerPolicy = 'no-referrer'
                ; (img as any).fetchPriority = 'high'
              img.src = src
            } catch (e) {
              console.error('[Preview] Failed to preload:', src, e)
            }
          })
        }
      }
    } catch (e) {
      console.error('[Preview] Error in handleStartStudy:', e)
    }

    // Preview mode: do not store anything and just navigate within preview flow
    const targetHref = isAdmin ? '/home/create-study/preview/product-id' : startHref
    router.push(targetHref)
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
              <Section title={orientationText}>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
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
      <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 border-b pb-2 border-blue-200/70 whitespace-pre-wrap break-words">{title}</h3>
      {children}
    </div>
  )
}


