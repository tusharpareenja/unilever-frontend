"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { createStudyFromLocalStorage, fetchWithAuth, buildStudyPayloadFromLocalStorage, putUpdateStudyAsync } from "@/lib/api/StudyAPI"
import { API_BASE_URL } from "@/lib/api/LoginApi"

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}

// Remove stored study id used for fast launch
function clearStoredStudyId() {
  try {
    localStorage.removeItem('cs_study_id')
    localStorage.removeItem('cs_flash_message')
  } catch (error) {
    console.warn('Failed to clear stored study id:', error)
  }
}

export function Step8LaunchPreview({ onBack, onDataChange }: { onBack: () => void; onDataChange?: () => void }) {
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchStage, setLaunchStage] = useState(0)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const step1 = get('cs_step1', { title: '', description: '', language: '' })
  const step2 = get('cs_step2', { type: 'grid', mainQuestion: '', orientationText: '' })
  const step3 = get('cs_step3', { minValue: 1, maxValue: 5, minLabel: '', maxLabel: '', middleLabel: '' })
  const step4 = get('cs_step4', [])
  const gridData = get<any>('cs_step5_grid', [])
  const textData = get<any>('cs_step5_text', [])
  const layerData = get<any>('cs_step5_layer', [])
  const step6 = get('cs_step6', { respondents: 0, countries: [], genderMale: 0, genderFemale: 0, ageSelections: {} })

  // Handle both legacy array format and new object format {elements: [...], categories: [...]}
  const grid = Array.isArray(gridData)
    ? gridData
    : (gridData?.categories && gridData.categories.length > 0
      ? gridData.categories
      : gridData?.elements || [])

  const text = Array.isArray(textData)
    ? textData
    : (textData?.categories && textData.categories.length > 0
      ? textData.categories
      : textData?.elements || [])

  const layer = Array.isArray(layerData) ? layerData : (layerData?.study_layers || [])

  const hasLayer = step2.type === 'layer'
  const hasText = step2.type === 'text'

  // Update last_step to 8 on mount so resuming brings user here
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      let studyId: string | null = null
      const raw = localStorage.getItem('cs_study_id')
      if (raw) {
        try { studyId = JSON.parse(raw) } catch { studyId = raw }
      }
      if (studyId) {
        // Fire-and-forget
        putUpdateStudyAsync(String(studyId), { last_step: 8 })
      }
    } catch { }
  }, [])

  const handleLaunchStudy = async () => {
    if (!isConfirmed) {
      setLaunchError('Please confirm you are ready to launch this study')
      return
    }

    // Show launching indicator during create call only
    setIsLaunching(true)
    setLaunchStage(0)
    setLaunchError(null)

    // Stage 1: Creating your study
    setLaunchStage(1)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Stage 2: Activating your study
    setLaunchStage(2)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Stage 3: Finalizing setup
    setLaunchStage(3)
    await new Promise(resolve => setTimeout(resolve, 1500))

    try {
      // Prefer fast launch if we already have a study_id from Step 7
      const storedIdRaw = localStorage.getItem('cs_study_id')
      let existingStudyId: string | undefined = undefined
      if (storedIdRaw) {
        try {
          const parsed = JSON.parse(storedIdRaw)
          existingStudyId = typeof parsed === 'string' ? parsed : String(parsed)
        } catch {
          // Not a JSON string — use raw value
          existingStudyId = storedIdRaw
        }
      }

      let studyId = existingStudyId

      if (existingStudyId) {
        console.log('[Step8] Using existing study_id for fast launch:', existingStudyId)

        // Validate that the study_id is a valid string and not empty
        if (typeof existingStudyId !== 'string' || existingStudyId.trim() === '') {
          console.warn('[Step8] Invalid study_id found, falling back to create new study')
          const result = await createStudyFromLocalStorage()
          studyId = result?.id || result?.study_id || result?.data?.id
        } else {
          try {
            // Build full payload from localStorage including all steps (1-7)
            const updatePayload = buildStudyPayloadFromLocalStorage()

            // Validate payload before sending
            console.log('=== STEP 8 PAYLOAD VALIDATION ===')
            const validationErrors: string[] = []

            if (!updatePayload.title || updatePayload.title.trim() === '') {
              validationErrors.push('Title is missing or empty')
            }
            if (!updatePayload.main_question || updatePayload.main_question.trim() === '') {
              validationErrors.push('Main question is missing or empty')
            }
            if (!updatePayload.audience_segmentation?.number_of_respondents || updatePayload.audience_segmentation.number_of_respondents <= 0) {
              validationErrors.push('Number of respondents is missing or invalid')
            }
            if (!updatePayload.rating_scale?.min_value || !updatePayload.rating_scale?.max_value) {
              validationErrors.push('Rating scale values are missing')
            }

            if (validationErrors.length > 0) {
              console.error('Payload validation failed:', validationErrors)
              throw new Error(`Validation failed: ${validationErrors.join(', ')}`)
            }
            console.log('Payload validation passed')
            console.log('=== END PAYLOAD VALIDATION ===')

            // Add status: 'active' to the payload to activate the study
            const finalPayload = { ...updatePayload, status: 'active' }

            // CRITICAL: Explicitly remove study_layers if not a layer study to prevent backend 400 error
            const currentType = String(step2.type || 'grid').toLowerCase()
            if (currentType !== 'layer') {
              // Use delete operator to remove keys if they exist
              if ('study_layers' in finalPayload) delete finalPayload.study_layers
              if ('background_image_url' in finalPayload) delete finalPayload.background_image_url
            }

            // Log the fast launch payload
            console.log('=== STEP 8 FAST LAUNCH PAYLOAD ===')
            console.log('URL:', `${API_BASE_URL}/studies/${existingStudyId}/launch`)
            console.log('Method: PUT (Update + Activate)')
            console.log('Payload:', JSON.stringify(finalPayload, null, 2))
            console.log('Payload Summary:', {
              title: finalPayload.title,
              study_type: step2.type,
              status: finalPayload.status,
              main_question: finalPayload.main_question,
              respondents: finalPayload.audience_segmentation?.number_of_respondents,
              elements_count: finalPayload.elements?.length || 0,
              layers_count: finalPayload.study_layers?.length || 0,
              categories_count: finalPayload.categories?.length || 0
            })
            console.log('=== END FAST LAUNCH PAYLOAD ===')

            // Call fast launch endpoint (applies updates and activates)
            const res = await fetchWithAuth(`${API_BASE_URL}/studies/${existingStudyId}/launch`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(finalPayload),
            })
            if (!res.ok) {
              const text = await res.text().catch(() => '')
              console.error('=== STEP 8 LAUNCH ERROR ===')
              console.error('Status:', res.status, res.statusText)
              console.error('Response text:', text)
              try {
                const errorData = JSON.parse(text)
                console.error('Error details:', errorData)
              } catch {
                console.error('Could not parse error response as JSON')
              }
              console.error('=== END LAUNCH ERROR ===')
              throw new Error(text || `Launch failed (${res.status})`)
            }
            const updated = await res.json().catch(() => ({}))
            studyId = updated?.id || existingStudyId
          } catch (fastLaunchError) {
            console.error('[Step8] Fast launch failed, falling back to create new study:', fastLaunchError)
            const result = await createStudyFromLocalStorage()
            studyId = result?.id || result?.study_id || result?.data?.id
            if (studyId) {
              try {
                await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'active' }),
                })
              } catch (activateError) {
                console.warn('[Step8] Failed to activate fallback study:', activateError)
              }
            }
          }
        }
      } else {
        // Fallback: create + activate (legacy path)
        console.log('=== STEP 8 FALLBACK CREATE STUDY ===')
        console.log('Using createStudyFromLocalStorage() - this will log its own payload')
        console.log('=== END FALLBACK CREATE STUDY ===')

        const result = await createStudyFromLocalStorage()
        studyId = result?.id || result?.study_id || result?.data?.id
        if (studyId) {
          try {
            await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'active' }),
            })
          } catch (activateError) {
            console.warn('[Step8] Failed to activate fallback study:', activateError)
          }
        }
      }

      if (!studyId) {
        console.warn('Cannot activate study: study id missing in create response')
        throw new Error('Study launch failed: no study ID available')
      }

      console.log('[Step8] Study launch successful, study_id:', studyId)

      // Only clear localStorage after confirming successful launch
      try {
        // Clear all step data from localStorage (including cached step7 matrix)
        clearStoredStudyId()
        const keysToRemove = [
          'cs_step1', 'cs_step2', 'cs_step3', 'cs_step4', 'cs_step5_grid', 'cs_step5_layer', 'cs_step5_layer_background',
          'cs_step6', 'cs_step7', 'cs_step7_tasks', 'cs_step7_matrix', 'cs_step7_meta', 'cs_step7_signature',
          'cs_current_step', 'cs_backup_steps', 'cs_study_id', 'cs_flash_message'
        ]

        // Remove all keys and log for debugging
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key)
            console.log(`Cleared localStorage key: ${key}`)
          } catch (error) {
            console.warn(`Failed to remove localStorage key ${key}:`, error)
          }
        })

        console.log('[Step8] Successfully cleared all localStorage data after study launch')
        console.log('[Step8] Study launch completed successfully, study_id cleared:', studyId)
      } catch (clearError) {
        console.warn('[Step8] Failed to clear some localStorage data:', clearError)
        // Don't throw here as the study launch was successful
      }

      // Additional cleanup: remove any remaining step7 related keys that might exist
      try {
        const allKeys = Object.keys(localStorage)
        const step7Keys = allKeys.filter(key => key.startsWith('cs_step7'))
        step7Keys.forEach(key => {
          localStorage.removeItem(key)
          console.log(`Cleared additional step7 key: ${key}`)
        })
      } catch (error) {
        console.warn('Failed to clean up additional step7 keys:', error)
      }

      // Redirect to study page after activation
      window.location.href = `/home/study/${studyId}`
    } catch (error: any) {
      console.error('Failed to launch study:', error)
      console.log('[Step8] Study launch failed, preserving study_id for retry')
      setLaunchError(error.message || 'Failed to launch study. Please try again.')
    } finally {
      setIsLaunching(false)
      setLaunchStage(0)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Study Preview</h3>
        <a
          href="/home/create-study/preview"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-[rgba(38,116,186,1)] hover:underline"
        >
          Preview as Participant ↗
        </a>
      </div>
      <p className="text-sm text-gray-600">Review all details before launching. This view summarizes your current setup.</p>

      <div className="space-y-6 mt-4">
        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Basic Details</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Study Title</div>
              <div className="font-medium">{step1.title || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Language</div>
              <div className="font-medium">{step1.language || '-'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500">Study Description</div>
              <div className="font-medium">{step1.description || '-'}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Study Configuration</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Study Type</div>
              <div className="font-medium">{step2.type}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500">Main Question</div>
              <div className="font-medium">{step2.mainQuestion || '-'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500">Orientation Text</div>
              <div className="font-medium">{step2.orientationText || '-'}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Rating Scale</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div><div className="text-gray-500">Min</div><div className="font-medium">{step3.minValue} ({step3.minLabel || '-'})</div></div>
            <div><div className="text-gray-500">Max</div><div className="font-medium">{step3.maxValue} ({step3.maxLabel || '-'})</div></div>
            <div><div className="text-gray-500">Middle Label</div><div className="font-medium">{step3.middleLabel || '-'}</div></div>
          </div>
        </section>

        {step4 && step4.length > 0 && (
          <section className="rounded-lg border bg-white p-4">
            <div className="text-sm font-semibold mb-2">Classification Questions</div>
            <div className="space-y-3">
              {step4.map((question: any, index: number) => (
                <div key={question.id || index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-sm font-medium mb-2">{question.title}</div>
                  <div className="text-sm text-gray-600">
                    <div className="mb-1">Required: {question.required ? 'Yes' : 'No'}</div>
                    {question.options && question.options.length > 0 && (
                      <div>
                        <div className="text-gray-500 mb-1">Options:</div>
                        <div className="flex flex-wrap gap-2">
                          {question.options.map((option: any, optIndex: number) => (
                            <span key={option.id || optIndex} className="px-2 py-1 bg-white border rounded text-xs">
                              {option.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">{hasText ? 'Study Statements' : 'Study Elements'}</div>
          {hasLayer ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-3">Layers Configuration ({layer.length} layers)</div>
              {layer.map((l: any, i: number) => (
                <div key={l.id} className="border rounded-lg bg-gray-50 p-4">
                  <div className="text-sm font-medium mb-3">{l.name} (z-{l.z})</div>
                  <div className="flex flex-wrap gap-3">
                    {l.images?.map((img: any, idx: number) => (
                      <div key={idx} className="flex-shrink-0">
                        <div className="w-48 h-48 border rounded-lg overflow-hidden bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.secureUrl || img.previewUrl || img.url}
                            alt="preview"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              console.error('Failed to load image:', img)
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      </div>
                    )) || <div className="text-sm text-gray-500">No images in this layer</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : hasText ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-3">Statements Configuration ({text.length} categories)</div>
              {text.map((category: any, catIdx: number) => (
                <div key={category.id || catIdx} className="border rounded-lg bg-gray-50 p-4">
                  <div className="text-sm font-medium mb-3">
                    {category.title}
                    {category.description && (
                      <span className="text-gray-500 ml-2">- {category.description}</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {category.elements?.map((element: any, elIdx: number) => (
                      <div
                        key={element.id || elIdx}
                        className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 break-words shadow-sm"
                        style={{
                          minHeight: '40px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {element.name}
                      </div>
                    )) || <div className="text-sm text-gray-500">No statements in this category</div>}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {category.elements?.length || 0} statements
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Check if using new category format or legacy format */}
              {grid.length > 0 && grid[0].title && grid[0].elements ? (
                <>
                  <div className="text-sm text-gray-600 mb-3">Categories Configuration ({grid.length} categories)</div>
                  {grid.map((category: any, catIdx: number) => (
                    <div key={category.id || catIdx} className="border rounded-lg bg-gray-50 p-4">
                      <div className="text-sm font-medium mb-3">
                        {category.title}
                        {category.description && (
                          <span className="text-gray-500 ml-2">- {category.description}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {category.elements?.map((element: any, elIdx: number) => (
                          <div key={element.id || elIdx} className="aspect-square bg-gray-100 flex items-center justify-center p-2 rounded-md border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={element.secureUrl || element.previewUrl}
                              alt={element.name}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                console.error('Failed to load image:', element)
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )) || <div className="text-sm text-gray-500">No elements in this category</div>}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {category.elements?.length || 0} elements
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-600 mb-3">Elements Configuration ({grid.length} elements)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {grid.map((e: any, idx: number) => (
                      <div key={e.id || idx} className="aspect-square bg-gray-100 flex items-center justify-center p-2 rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={e.secureUrl || e.previewUrl}
                          alt={e.name}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            console.error('Failed to load image:', e)
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Audience</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div><div className="text-gray-500">Respondents</div><div className="font-medium">{step6.respondents}</div></div>
            <div><div className="text-gray-500">Countries</div><div className="font-medium">{step6.countries?.join(', ') || '-'}</div></div>
            <div><div className="text-gray-500">Gender Split</div><div className="font-medium">M {step6.genderMale}% / F {step6.genderFemale}%</div></div>
          </div>
        </section>

        <section className="rounded-lg border-2 border-[rgba(38,116,186,1)] bg-white" style={{ borderTopWidth: '4px' }}>
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-[rgba(38,116,186,1)] text-center">Launch Study</h3>

            <p className="text-sm text-gray-600 text-center">
              Once you launch your study, it will be available to respondents and you can start collecting data.
            </p>

            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="confirm"
                  className="w-4 h-4 text-[rgba(38,116,186,1)] border-gray-300 rounded focus:ring-[rgba(38,116,186,0.3)]"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                />
                <label htmlFor="confirm" className="text-sm text-gray-700">
                  I am ready to launch this study <span className="text-red-500">*</span>
                </label>
              </div>

              <p className="text-xs text-gray-500 ml-7 mt-2">
                I confirm that I have reviewed all study details and am ready to launch
              </p>
            </div>

            {launchError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{launchError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onBack}
                disabled={isLaunching}
                className="flex-1 bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 rounded-full cursor-pointer"
              >
                PREVIOUS
              </Button>
              <Button
                className="flex-1 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white rounded-full disabled:opacity-80 cursor-pointer"
                onClick={handleLaunchStudy}
                disabled={isLaunching || !isConfirmed}
              >
                {isLaunching ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="relative inline-flex">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-30"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    Launching...
                  </span>
                ) : (
                  'LAUNCH STUDY'
                )}
              </Button>
            </div>
          </div>
        </section>

        {isLaunching && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-xl shadow-lg px-8 py-6 text-center">
              <div className="mx-auto mb-4 relative inline-flex">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
              </div>
              <div className="text-lg font-semibold text-gray-800 mb-2">
                {launchStage === 1 && "📝 Creating your study..."}
                {launchStage === 2 && "🚀 Activating your study..."}
                {launchStage === 3 && "⚙️ Finalizing setup..."}
              </div>
              <div className="text-sm text-gray-600">
                {launchStage === 1 && "Setting up your study configuration"}
                {launchStage === 2 && "Making your study live and accessible"}
                {launchStage === 3 && "Preparing everything for participants"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}