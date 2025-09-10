"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createStudyFromLocalStorage, regenerateTasksForStudy } from "@/lib/api/StudyAPI"

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}

export function Step8LaunchPreview({ onBack }: { onBack: () => void }) {
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const step1 = get('cs_step1', { title: '', description: '', language: '' })
  const step2 = get('cs_step2', { type: 'grid', mainQuestion: '', orientationText: '' })
  const step3 = get('cs_step3', { minValue: 1, maxValue: 5, minLabel: '', maxLabel: '', middleLabel: '' })
  const grid = get<any[]>('cs_step5_grid', [])
  const layer = get<any[]>('cs_step5_layer', [])
  const step6 = get('cs_step6', { respondents: 0, countries: [], genderMale: 0, genderFemale: 0, ageSelections: {} })

  const hasLayer = step2.type === 'layer'
  
  // Debug layer structure
  console.log('Step 8 - Layer data:', layer)
  console.log('Step 8 - Has layer:', hasLayer)

  const handleLaunchStudy = async () => {
    if (!isConfirmed) {
      setLaunchError('Please confirm you are ready to launch this study')
      return
    }

    setIsLaunching(true)
    setLaunchError(null)

    try {
      const result = await createStudyFromLocalStorage()
      console.log('Study launched successfully:', result)
      const studyId = result?.id || result?.study_id || result?.data?.id
      if (studyId) {
        console.log('Regenerating tasks for study:', studyId)
        await regenerateTasksForStudy(String(studyId))
        console.log('Tasks regenerated successfully for study:', studyId)
      } else {
        console.warn('Cannot regenerate tasks: study id missing in create response')
      }
      
      // Clear all step data from localStorage
      const keysToRemove = ['cs_step1', 'cs_step2', 'cs_step3', 'cs_step4', 'cs_step5_grid', 'cs_step5_layer', 'cs_step6', 'cs_step7']
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // Redirect to home or show success message
      alert('Study launched successfully!')
      window.location.href = '/home'
    } catch (error: any) {
      console.error('Failed to launch study:', error)
      setLaunchError(error.message || 'Failed to launch study. Please try again.')
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800">Study Preview</h3>
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

        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Study Elements</div>
          {hasLayer ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-3">Layers Configuration ({layer.length} layers)</div>
              {layer.map((l, i) => (
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
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {grid.map((e, idx) => (
                <div key={e.id || idx} className="aspect-square bg-gray-100 flex items-center justify-center p-2 rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.secureUrl || e.previewUrl} alt={e.name} className="max-w-full max-h-full object-contain" />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Audience</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div><div className="text-gray-500">Respondents</div><div className="font-medium">{step6.respondents}</div></div>
            <div><div className="text-gray-500">Countries</div><div className="font-medium">{step6.countries.join(', ') || '-'}</div></div>
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
                className="flex-1 bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 rounded-full"
              >
                PREVIOUS
              </Button>
              <Button 
                className="flex-1 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white rounded-full"
                onClick={handleLaunchStudy}
                disabled={isLaunching || !isConfirmed}
              >
                {isLaunching ? 'LAUNCHING...' : 'LAUNCH STUDY'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}


