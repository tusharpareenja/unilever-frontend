"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { buildTaskGenerationPayloadFromLocalStorage, generateTasks } from "@/lib/api/StudyAPI"

interface Step7TaskGenerationProps {
  onNext: () => void
  onBack: () => void
  active?: boolean
  onDataChange?: () => void
}

export function Step7TaskGeneration({ onNext, onBack, active = false, onDataChange }: Step7TaskGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [matrix, setMatrix] = useState<any | null>(null)

  const generateNow = async () => {
    try {
      setIsGenerating(true)
      const payload = buildTaskGenerationPayloadFromLocalStorage()
      console.log('Task generation payload:', payload)
      const data = await generateTasks(payload)
      console.log('Task generation response:', data)
      setMatrix(data)
      
      // Store only preview data (1 respondent) to avoid localStorage limit
      try {
        const previewData = {
          metadata: data.metadata,
          preview_tasks: data.tasks?.[0] || [], // Only first respondent's tasks
          total_respondents: data.metadata?.number_of_respondents || 0,
          total_tasks: data.metadata?.total_tasks || 0,
          full_matrix_available: true // Flag to indicate we have full data on backend
        }
        localStorage.setItem('cs_step7_matrix', JSON.stringify(previewData))
        console.log('Stored preview data (1 respondent only) to avoid storage limit')
      } catch (storageError) {
        console.warn('Failed to store preview data:', storageError)
        // Still mark as completed even if storage fails
      }
      
      // Mark step 7 as completed
      localStorage.setItem('cs_step7_tasks', JSON.stringify({ completed: true, timestamp: Date.now() }))
      onDataChange?.()
    } catch (e) {
      console.error('Task generation error:', e)
      const err: any = e
      const message = err?.data?.detail || err?.message || 'Task generation failed.'
      alert(typeof message === 'string' ? message : JSON.stringify(message))
    } finally {
      setIsGenerating(false)
    }
  }

  // Trigger on becoming active so it doesn't run too early
  useEffect(() => {
    if (!active) return
    // Load from cache if available, else generate
    try {
      const cached = localStorage.getItem('cs_step7_matrix')
      if (cached) {
        setMatrix(JSON.parse(cached))
        return
      }
    } catch {}
    generateNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  function getFromLS<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
  }

  // derive stats safely from metadata or LS
  const respondentsFromLS = getFromLS('cs_step6', { respondents: undefined as any }).respondents
  const studyType = getFromLS('cs_step2', { type: 'grid' }).type
  console.log('Study type:', studyType)
  const meta = (matrix as any)?.metadata || {}
  // We will compute total tasks from metadata if available, else sum of bucket lengths
  let totalTasks = meta.total_tasks as any
  const numRespondents = meta.number_of_respondents ?? respondentsFromLS ?? '-'
  const tasksPerRespondent = meta.tasks_per_consumer ?? '-'
  const elementsPerTask = meta.K ?? meta.elements_per_task ?? '-'

  // Use preview data (1 respondent only) for display
  const rawTasks = (matrix as any)?.preview_tasks || (matrix as any)?.tasks
  let respondentBuckets: any[][] = []
  if (Array.isArray(rawTasks)) {
    respondentBuckets = [rawTasks] // Show only first respondent
  } else if (rawTasks && typeof rawTasks === 'object') {
    // If we have the old format, take only first respondent
    const keys = Object.keys(rawTasks).sort((a,b)=>Number(a)-Number(b))
    respondentBuckets = keys.slice(0, 1).map((k)=>rawTasks[k]) // Only first respondent
  }

  if (totalTasks == null) {
    if (typeof meta.number_of_respondents === 'number' && typeof meta.tasks_per_consumer === 'number') {
      totalTasks = meta.number_of_respondents * meta.tasks_per_consumer
    } else {
      totalTasks = respondentBuckets.reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
    }
  }

  return (
    <div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Task Matrix</h3>
        <p className="text-sm text-gray-600">Preview tasks generated for respondents.</p>

        {matrix && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 bg-white">
              <div className="text-xs text-gray-600">Total Tasks</div>
              <div className="text-xl font-semibold">{totalTasks}</div>
            </div>
            <div className="rounded-lg border p-3 bg-white">
              <div className="text-xs text-gray-600">Respondents</div>
              <div className="text-xl font-semibold">{numRespondents}</div>
            </div>
            <div className="rounded-lg border p-3 bg-white">
              <div className="text-xs text-gray-600">Tasks / Respondent</div>
              <div className="text-xl font-semibold">{tasksPerRespondent}</div>
            </div>
            <div className="rounded-lg border p-3 bg-white">
              <div className="text-xs text-gray-600">Elements / Task</div>
              <div className="text-xl font-semibold">{elementsPerTask}</div>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-2">
            {studyType === 'layer' ? 'Layer Study Algorithm Details' : 'Grid Study Algorithm Details'}
          </div>
          <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
            {studyType === 'layer' ? (
              <>
                <li>Layer combinations are algorithmically generated for optimal balance.</li>
                <li>Z-Index Stacking: Layers are rendered with proper depth ordering.</li>
                <li>Exposure Balancing: Each layer appears with comparable exposure across tasks.</li>
                <li>Visual Layering: Multiple layers can be visible simultaneously with proper stacking.</li>
              </>
            ) : (
              <>
                <li>Matrix is algorithmically generated for optimal balance.</li>
                <li>Exposure Balancing: Each element appears with comparable exposure.</li>
                <li>Uniqueness: Ensures non-repetitive arrangements within capacity limits.</li>
              </>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold">
            {studyType === 'layer' ? 'Layer Study Preview' : 'Elements Preview'}
          </div>
          {!matrix ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4">Click generate to simulate a task matrix preview for 2 tasks.</p>
              <Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)]" onClick={generateNow} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Example Matrix'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {respondentBuckets.slice(0,1).map((tasks, rIdx) => (
                <div key={rIdx}>
                  <div className="text-sm font-medium text-gray-700 mb-2">Respondent {rIdx + 1} - All Tasks</div>
                  <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                    {(Array.isArray(tasks) ? tasks : []).map((task: any, tIdx: number) => {
                      if (studyType === 'layer') {
                        // Handle layer study - extract visible layers with z-index
                        const elementsShown = task?.elements_shown || {}
                        const elementsContent = task?.elements_shown_content || {}
                        
                        // Get all visible layer elements with their z-index
                        const visibleLayers: Array<{url: string, z_index: number, layer_name: string}> = []
                        
                        Object.keys(elementsShown).forEach((key) => {
                          if (elementsShown[key] === 1 && elementsContent[key]) {
                            const content = elementsContent[key]
                            if (content.url && typeof content.z_index === 'number') {
                              visibleLayers.push({
                                url: content.url,
                                z_index: content.z_index,
                                layer_name: content.layer_name || key
                              })
                            }
                          }
                        })
                        
                        // Sort by z-index (ascending - lower z-index renders first/behind)
                        visibleLayers.sort((a, b) => a.z_index - b.z_index)
                        
                        console.log('Visible layers for task:', visibleLayers)
                        
                        return (
                          <div key={tIdx} className="border rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
                              <div>Task {(typeof task?.task_index === 'number') ? task.task_index + 1 : tIdx + 1}</div>
                              {/* <div className="text-gray-400">{task?.task_id}</div> */}
                            </div>
                            <div className="relative bg-gray-100 min-h-[300px] overflow-hidden">
                              {visibleLayers.length > 0 ? (
                                <div className="relative w-full h-[300px]">
                                  {visibleLayers.map((layer, layerIdx) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img 
                                      key={layerIdx} 
                                      src={layer.url} 
                                      alt={layer.layer_name}
                                      className="absolute inset-0 w-full h-full object-contain"
                                      style={{ 
                                        zIndex: layer.z_index + 10, // Add offset to ensure proper stacking
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%'
                                      }}
                                      onLoad={() => {
                                        console.log(`Layer ${layer.layer_name} loaded with z-index: ${layer.z_index}`)
                                      }}
                                      onError={(e) => {
                                        console.error(`Failed to load layer image: ${layer.url}`)
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-[300px] text-xs text-gray-400">
                                  No visible layers
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      } else {
                        // Handle grid study - existing logic
                        const shown = task?.elements_shown || {}
                        console.log('Task elements_shown:', shown)
                        const urls: string[] = []
                        
                        // Try different ways to extract URLs based on API response structure
                        Object.keys(shown).forEach((k) => {
                          if (k.endsWith('_content') && shown[k]) {
                            urls.push(shown[k])
                          }
                        })
                        
                        // If no URLs found with _content pattern, try direct URL fields
                        if (urls.length === 0) {
                          Object.keys(shown).forEach((k) => {
                            if (k.includes('url') && shown[k] && typeof shown[k] === 'string' && shown[k].startsWith('http')) {
                              urls.push(shown[k])
                            }
                          })
                        }
                        
                        // If still no URLs, try to get from elements array if it exists
                        if (urls.length === 0 && task?.elements) {
                          task.elements.forEach((element: any) => {
                            if (element.content && typeof element.content === 'string' && element.content.startsWith('http')) {
                              urls.push(element.content)
                            }
                          })
                        }
                        
                        // If still no URLs, try to extract from any field that looks like a URL
                        if (urls.length === 0) {
                          const extractUrlsFromObject = (obj: any): string[] => {
                            const found: string[] = []
                            if (typeof obj === 'object' && obj !== null) {
                              Object.values(obj).forEach((value: any) => {
                                if (typeof value === 'string' && value.startsWith('http')) {
                                  found.push(value)
                                } else if (typeof value === 'object' && value !== null) {
                                  found.push(...extractUrlsFromObject(value))
                                }
                              })
                            }
                            return found
                          }
                          urls.push(...extractUrlsFromObject(task))
                        }
                        
                        console.log('Extracted URLs:', urls)
                        // Determine elements per task dynamically, fallback to all urls
                        const maxPerTask = typeof elementsPerTask === 'number' && elementsPerTask > 0 ? elementsPerTask : urls.length
                        const show = urls.slice(0, maxPerTask)
                        const colClass = show.length >= 4 ? 'lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1' : (show.length === 3 ? 'md:grid-cols-3 sm:grid-cols-2 grid-cols-1' : 'sm:grid-cols-2 grid-cols-1')
                        return (
                          <div key={tIdx} className="border rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
                              <div>Task {(typeof task?.task_index === 'number') ? task.task_index + 1 : tIdx + 1}</div>
                              {/* <div className="text-gray-400">{task?.task_id}</div> */}
                            </div>
                            <div className={`grid ${colClass} gap-0`}>
                              {(show.length ? show : [null]).map((url, i) => (
                                url ? (
                                  <div key={i} className="aspect-square bg-gray-100 flex items-center justify-center p-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={`element-${i+1}`} className="max-w-full max-h-full object-contain" />
                                  </div>
                                ) : (
                                  <div key={i} className="aspect-square bg-slate-100 flex items-center justify-center text-xs text-gray-400">No Image</div>
                                )
                              ))}
                            </div>
                          </div>
                        )
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold mb-3">Matrix Actions</div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">Download Matrix (CSV)</Button>
            <Button variant="outline">View Matrix Statistics</Button>
            <Button variant="outline">Download Assets (ZIP)</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
        <Button className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto" onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}