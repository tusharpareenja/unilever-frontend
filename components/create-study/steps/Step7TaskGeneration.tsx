"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { buildTaskGenerationPayloadFromLocalStorage, generateTasks, generateTasksWithPolling, JobStatus } from "@/lib/api/StudyAPI"
import JSZip from "jszip"

interface Step7TaskGenerationProps {
  onNext: () => void
  onBack: () => void
  active?: boolean
  onDataChange?: () => void
}

export function Step7TaskGeneration({ onNext, onBack, active = false, onDataChange }: Step7TaskGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [matrix, setMatrix] = useState<any | null>(null)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isDownloadingAssets, setIsDownloadingAssets] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(600) // 10 minutes
  
  // Background job polling states
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [pollingError, setPollingError] = useState<string | null>(null)

  // Persist preview and mark step completed when full result is ready
  const savePreviewAndComplete = (result: any) => {
    if (!result) return
    try {
      console.log('[Step7] Saving preview and completing. totals:', {
        respondents: result?.metadata?.number_of_respondents,
        total_tasks: result?.metadata?.total_tasks,
        tasks_per_consumer: result?.metadata?.tasks_per_consumer,
        metadata_keys: result?.metadata ? Object.keys(result.metadata) : []
      })
      setMatrix(result)
      const previewData = {
        metadata: result.metadata,
        preview_tasks: result.tasks?.[0] || [], // Only first respondent's tasks
        total_respondents: result.metadata?.number_of_respondents || 0,
        total_tasks: result.metadata?.total_tasks || 0,
        full_matrix_available: true
      }
      console.log('[Step7] Persisting cs_step7_matrix')
      localStorage.setItem('cs_step7_matrix', JSON.stringify(previewData))
    } catch (storageError) {
      console.warn('Failed to store preview data:', storageError)
    }
    // Mark step 7 as completed
    try {
      console.log('[Step7] Marking step7 as completed')
      localStorage.setItem('cs_step7_tasks', JSON.stringify({ completed: true, timestamp: Date.now() }))
      onDataChange?.()
    } catch {}
  }

  const generateNow = async () => {
    try {
      setIsGenerating(true)
      setPollingError(null)
      setJobStatus(null)
      // Ensure we don't show stale preview while a new background job runs
      try { console.log('[Step7] Clearing cached cs_step7_matrix'); localStorage.removeItem('cs_step7_matrix') } catch {}
      setMatrix(null)
      
      const payload = buildTaskGenerationPayloadFromLocalStorage()
      console.log('[Step7] Submitting task generation payload')
      
      // Use the new polling-enabled generation
      const data = await generateTasksWithPolling(payload, (status) => {
        console.log('[Step7] Job status update:', {
          job_id: status?.job_id,
          status: status?.status,
          progress: status?.progress,
          message: status?.message
        })
        setJobStatus(status)
        setIsPolling(status.status === 'processing' || status.status === 'pending')
        
        if (status.status === 'completed') {
          // The result will be fetched separately via getTaskGenerationResult
          // This callback is just for status updates during polling
        }
      })
      
      console.log('[Step7] generateTasksWithPolling returned:', {
        hasData: !!data,
        hasTasks: !!(data?.tasks),
        hasMetadata: !!(data?.metadata),
        dataKeys: data ? Object.keys(data) : []
      })
      
      // Check if this is a completed background job result or immediate result
      const dataJobId = (data as any)?.job_id || (data as any)?.metadata?.job_id || (data as any)?.data?.job_id
      const hasTasks = !!(data?.tasks && Object.keys(data.tasks).length > 0)
      
      if (hasTasks) {
        // We have actual task data (either immediate or completed background job)
        console.log('[Step7] Task data received, processing...')
        savePreviewAndComplete(data)
      } else if (dataJobId) {
        // Background job started but not completed yet
        console.log('[Step7] Background job started; id:', dataJobId)
      } else {
        // Immediate generation without background job
        console.log('[Step7] Immediate generation response received (no job).')
        setMatrix(data)
        
        // Store only preview data (1 respondent) to avoid localStorage limit
        try {
          // If backend returns a study_id in the task generation response, persist it for fast launch
          try {
            const possibleStudyIdCandidates: Array<string | undefined> = [
              data?.study_id,
              data?.id,
              data?.data?.id,
              data?.metadata?.study_id,
              data?.metadata?.id,
              data?.study?.id,
            ]
            const possibleStudyId = possibleStudyIdCandidates.find((v) => typeof v === 'string' && v.length > 0)
            if (possibleStudyId) {
              console.log('[Step7] Persisting cs_study_id', possibleStudyId)
              localStorage.setItem('cs_study_id', JSON.stringify(String(possibleStudyId)))
              
            } else {
              console.warn('No study_id found in task generation response; fast launch will fall back if needed.')
            }
          } catch (idStoreErr) {
            console.warn('Failed to store study id from task generation response:', idStoreErr)
          }

          const previewData = {
            metadata: data.metadata,
            preview_tasks: data.tasks?.[0] || [], // Only first respondent's tasks
            total_respondents: data.metadata?.number_of_respondents || 0,
            total_tasks: data.metadata?.total_tasks || 0,
            full_matrix_available: true // Flag to indicate we have full data on backend
          }
          console.log('[Step7] Persisting cs_step7_matrix (immediate)')
          localStorage.setItem('cs_step7_matrix', JSON.stringify(previewData))
          
        } catch (storageError) {
          console.warn('Failed to store preview data:', storageError)
          // Still mark as completed even if storage fails
        }
        
        // Mark step 7 as completed
        console.log('[Step7] Marking step7 as completed (immediate)')
        localStorage.setItem('cs_step7_tasks', JSON.stringify({ completed: true, timestamp: Date.now() }))
        onDataChange?.()
      }
    } catch (e) {
      console.error('Task generation error:', e)
      const err: any = e
      const message = err?.data?.detail || err?.message || 'Task generation failed.'
      const textMsg = typeof message === 'string' ? message : JSON.stringify(message)
      setPollingError(textMsg)
      alert(textMsg)
      try {
        const lower = String(textMsg).toLowerCase()
        // Heuristics for T/E or capacity errors indicating insufficient elements
        const isCapacityError = /t\s*\/?\s*e|preflight|not enough|insufficient|a_min|absence|capacity|unable to lock t/i.test(lower)
        if (isCapacityError) {
          // Persist a flash message for Step 5 and redirect there
          localStorage.setItem('cs_flash_message', JSON.stringify({
            type: 'error',
            message: 'Task generation could not complete. Please add more elements/categories in Step 5 and try again.'
          }))
          localStorage.setItem('cs_current_step', '5')
          window.location.href = '/home/create-study'
        }
      } catch {}
    } finally {
      setIsGenerating(false)
      setIsPolling(false)
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
        // continue timer even if matrix exists
      } else {
        generateNow()
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Countdown timer logic: always runs when active; restarts every 10 minutes if tasks not ready
  useEffect(() => {
    if (!active) return
    setCountdownSeconds(600)
    const id = window.setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev > 0) return prev - 1
        // When reaches zero and tasks are still not generated, restart timer
        if (!matrix) return 600
        // If tasks are ready, keep cycling the timer (continue as requested)
        return 600
      })
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, !!matrix])

  function getFromLS<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
  }

  // derive stats safely from metadata or LS
  const respondentsFromLS = getFromLS('cs_step6', { respondents: undefined as any }).respondents
  const studyType = getFromLS('cs_step2', { type: 'grid' }).type
  
  const meta = (matrix as any)?.metadata || {}
  
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

  const numRespondents = meta.number_of_respondents ?? respondentsFromLS ?? '-'
  
  // Calculate tasks per respondent from available data
  let tasksPerRespondent = meta.tasks_per_consumer ?? '-'
  
  // If tasks_per_consumer is not available, calculate it from total_tasks and number_of_respondents
  if (tasksPerRespondent === '-' && typeof meta.total_tasks === 'number' && typeof meta.number_of_respondents === 'number' && meta.number_of_respondents > 0) {
    tasksPerRespondent = Math.round(meta.total_tasks / meta.number_of_respondents)
  }
  
  // If still not available, try to calculate from actual task data
  if (tasksPerRespondent === '-' && respondentBuckets.length > 0 && Array.isArray(respondentBuckets[0])) {
    tasksPerRespondent = respondentBuckets[0].length
  }
  
  // Calculate total tasks as tasks_per_respondent × number_of_respondents
  let totalTasks: any = '-'
  if (typeof tasksPerRespondent === 'number' && typeof numRespondents === 'number') {
    totalTasks = tasksPerRespondent * numRespondents
  } else if (meta.total_tasks) {
    totalTasks = meta.total_tasks
  } else if (respondentBuckets.length > 0) {
    totalTasks = respondentBuckets.reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  }
  
  const elementsPerTask = meta.K ?? meta.elements_per_task ?? '-'
  const formattedCountdown = `${Math.floor(countdownSeconds / 60)}:${String(countdownSeconds % 60).padStart(2, '0')}`

  // Compute additional derived statistics from preview data (first respondent only)
  const previewTasksForStats = Array.isArray(respondentBuckets?.[0]) ? respondentBuckets[0] : []
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
  const perTaskUrlCounts: number[] = previewTasksForStats.map((t: any) => {
    // Prefer explicit fields when available
    if (studyType === 'layer') {
      const elementsShown = t?.elements_shown || {}
      const elementsContent = t?.elements_shown_content || {}
      const visibleLayerKeys = Object.keys(elementsShown).filter((k) => elementsShown[k] === 1 && elementsContent[k])
      return visibleLayerKeys.length
    }
    
    // For grid studies, check if using new category format
    const gridData = localStorage.getItem('cs_step5_grid')
    const isCategoryFormat = gridData && JSON.parse(gridData).length > 0 && JSON.parse(gridData)[0].title
    
    if (isCategoryFormat) {
      // New category format: count visible elements from elements_shown
      const shown = t?.elements_shown || {}
      return Object.keys(shown).filter(key => shown[key] === 1).length
    } else {
      // Legacy format: extract URLs as before
      const urlsFromShown: string[] = []
      const shown = t?.elements_shown || {}
      Object.keys(shown).forEach((k) => {
        if (k.endsWith('_content') && shown[k]) urlsFromShown.push(shown[k])
        if (k.includes('url') && shown[k] && typeof shown[k] === 'string' && shown[k].startsWith('http')) urlsFromShown.push(shown[k])
      })
      if (urlsFromShown.length > 0) return urlsFromShown.length
      if (Array.isArray(t?.elements)) {
        const fromElements = t.elements.filter((e: any) => e?.content && typeof e.content === 'string' && e.content.startsWith('http'))
        if (fromElements.length > 0) return fromElements.length
      }
      return extractUrlsFromObject(t).length
    }
  })
  const totalUrlsInPreview = perTaskUrlCounts.reduce((a, b) => a + b, 0)
  const avgElementsPerTaskPreview = perTaskUrlCounts.length ? (totalUrlsInPreview / perTaskUrlCounts.length) : 0
  const uniqueAssetsInPreview = (() => {
    const set = new Set<string>()
    previewTasksForStats.forEach((t: any) => extractUrlsFromObject(t).forEach((u) => set.add(u)))
    return set.size
  })()
  const estimatedTotalElementViews = (typeof numRespondents === 'number' && typeof tasksPerRespondent === 'number' && typeof elementsPerTask === 'number')
    ? numRespondents * tasksPerRespondent * elementsPerTask
    : '-'

  // Download all uploaded assets (from Step 5) as a ZIP
  const handleDownloadAssetsZip = async () => {
    if (isDownloadingAssets) return
    setIsDownloadingAssets(true)
    try {
      const grid = getFromLS<any[]>("cs_step5_grid", [])
      const layer = getFromLS<any[]>("cs_step5_layer", [])

      type Asset = { url: string; name: string }
      const assets: Asset[] = []

      // Collect grid assets
      if (Array.isArray(grid) && grid.length > 0) {
        grid.forEach((g: any, idx: number) => {
          if (g?.secureUrl) {
            const url: string = g.secureUrl
            const fromPath = (() => {
              try {
                const u = new URL(url)
                const last = u.pathname.split('/').filter(Boolean).pop() || `grid_${idx + 1}`
                return last
              } catch {
                const parts = url.split('?')[0].split('/')
                return parts[parts.length - 1] || `grid_${idx + 1}`
              }
            })()
            const ext = fromPath.includes('.') ? fromPath.split('.').pop() : 'jpg'
            assets.push({ url, name: g.name ? `${g.name}.${ext}` : fromPath })
          }
        })
      }

      // Collect layer assets
      if (Array.isArray(layer) && layer.length > 0) {
        layer.forEach((l: any, lIdx: number) => {
          const images = Array.isArray(l?.images) ? l.images : []
          images.forEach((img: any, iIdx: number) => {
            if (img?.secureUrl) {
              const url: string = img.secureUrl
              const fromPath = (() => {
                try {
                  const u = new URL(url)
                  const last = u.pathname.split('/').filter(Boolean).pop() || `layer_${lIdx + 1}_img_${iIdx + 1}`
                  return last
                } catch {
                  const parts = url.split('?')[0].split('/')
                  return parts[parts.length - 1] || `layer_${lIdx + 1}_img_${iIdx + 1}`
                }
              })()
              const ext = fromPath.includes('.') ? fromPath.split('.').pop() : 'png'
              const safeLayer = (l?.name || `Layer_${lIdx + 1}`).toString().replace(/[^a-z0-9_-]+/gi, '_')
              const baseName = img?.name || `Image_${iIdx + 1}`
              const safeBase = baseName.toString().replace(/[^a-z0-9_-]+/gi, '_')
              assets.push({ url, name: `${safeLayer}/${safeBase}.${ext}` })
            }
          })
        })
      }

      // Deduplicate by URL
      const deduped: Asset[] = []
      const seen = new Set<string>()
      assets.forEach(a => { if (!seen.has(a.url)) { seen.add(a.url); deduped.push(a) } })

      if (deduped.length === 0) {
        alert('No uploaded assets found to download.')
        return
      }

      const zip = new JSZip()
      // Fetch all assets in parallel
      const results = await Promise.allSettled(deduped.map(async (a) => {
        const res = await fetch(a.url)
        if (!res.ok) throw new Error(`Failed to fetch: ${a.url}`)
        const blob = await res.blob()
        zip.file(a.name, blob)
      }))

      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        console.warn(`${failed.length} assets failed to fetch and were skipped.`)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(zipBlob)
      link.href = url
      link.download = 'study-assets.zip'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 0)
    } catch (e) {
      console.error('Download assets ZIP failed', e)
      alert('Failed to prepare assets ZIP. Please try again.')
    } finally {
      setIsDownloadingAssets(false)
    }
  }

  const handleRegenerateTasks = async () => {
     await generateNow();
  }

  // Function to download CSV matrix
  const downloadMatrixCSV = async () => {
    try {
      if (!matrix) {
        alert('No task generation data found. Please generate tasks first.')
        return
      }
      
      // Check if we're still polling (tasks not ready)
      if (isPolling || (jobStatus && jobStatus.status !== 'completed')) {
        alert('Tasks are still being generated. Please wait for completion before downloading CSV.')
        return
      }

      // Handle both full response format and cached preview format
      let tasks = matrix.tasks
      let metadata = matrix.metadata
      
      // If it's cached preview data, we need to get the full task data
      if (matrix.preview_tasks && !matrix.tasks) {
        console.log('[CSV] Using cached preview data - this will only show first respondent')
        console.log('[CSV] To get all respondents, please regenerate tasks or wait for full completion')
        
        // Try to get the study ID and fetch full data
        const studyId = localStorage.getItem('cs_study_id')
        if (studyId) {
          try {
            console.log('[CSV] Attempting to fetch full study data for CSV generation')
            const { getStudyDetails } = await import('@/lib/api/StudyAPI')
            const fullStudyData = await getStudyDetails(JSON.parse(studyId))
            if (fullStudyData && fullStudyData.tasks) {
              console.log('[CSV] Successfully fetched full study data with', Object.keys(fullStudyData.tasks).length, 'respondents')
              tasks = fullStudyData.tasks
              metadata = fullStudyData
            } else {
              console.log('[CSV] Full study data not available, using preview data')
              tasks = { "0": matrix.preview_tasks }
              metadata = matrix.metadata || {}
            }
          } catch (error) {
            console.warn('[CSV] Failed to fetch full study data:', error)
            console.log('[CSV] Using preview data instead')
            tasks = { "0": matrix.preview_tasks }
            metadata = matrix.metadata || {}
          }
        } else {
          console.log('[CSV] No study ID found, using preview data')
          tasks = { "0": matrix.preview_tasks }
          metadata = matrix.metadata || {}
        }
      }

      

      if (!tasks) {
        alert('Invalid task generation data format.')
        return
      }

      // Get study type from metadata or determine from localStorage
      let studyType = 'grid' // default
      if (metadata && metadata.study_type) {
        studyType = metadata.study_type
      } else {
        // Fallback: determine from localStorage
        const step2Data = localStorage.getItem('cs_step2')
        if (step2Data) {
          const step2 = JSON.parse(step2Data)
          studyType = step2.type || 'grid'
        }
      }
      
      console.log('[CSV] Study type detected:', studyType)
      console.log('[CSV] Tasks keys:', Object.keys(tasks))
      console.log('[CSV] First task sample:', tasks[Object.keys(tasks)[0]]?.[0])
      let elementColumns: string[] = []
      let elementKeyMapping: { [key: string]: string } = {}

      if (studyType === 'grid') {
        // For grid studies, try to get element names from localStorage first
        const gridData = localStorage.getItem('cs_step5_grid')
        console.log('[CSV] Grid data from localStorage:', gridData)
        if (gridData) {
          try {
            const categories = JSON.parse(gridData)
            console.log('[CSV] Parsed grid categories:', categories)
            
            // Build columns with proper names and category order
            elementColumns = []
            elementKeyMapping = {}
            
            categories.forEach((category: any, catIdx: number) => {
              if (category.elements && Array.isArray(category.elements)) {
                category.elements.forEach((element: any, elIdx: number) => {
                  const categoryName = category.title || `Category_${catIdx + 1}`
                  const elementName = element.name || `Element_${elIdx + 1}`
                  const columnName = `${categoryName}_${elementName}`
                  elementColumns.push(columnName)
                  
                  // Map the API response key to our column name
                  const apiKey = `${categoryName}_${elIdx + 1}`
                  elementKeyMapping[apiKey] = columnName
                  
                  console.log('[CSV] Added grid column:', columnName, 'from category:', categoryName, 'element:', elementName)
                  console.log('[CSV] Mapped API key:', apiKey, 'to column:', columnName)
                })
              }
            })
            
            console.log('[CSV] Grid element columns:', elementColumns)
            console.log('[CSV] Grid element key mapping:', elementKeyMapping)
          } catch (e) {
            console.warn('[CSV] Failed to parse grid data from localStorage:', e)
          }
        }
        
        // If no columns from localStorage, try to get them from task data
        if (elementColumns.length === 0 && Object.keys(tasks).length > 0) {
          console.log('[CSV] No grid columns found, falling back to task data')
          const firstTask = tasks[Object.keys(tasks)[0]][0]
          
          if (firstTask && firstTask.elements_shown) {
            const elementKeys = Object.keys(firstTask.elements_shown).filter(key => 
              !key.includes('_content')
            )
            
            // Use the keys directly as column names
            elementColumns = elementKeys.sort()
            elementKeyMapping = {}
            elementColumns.forEach(key => {
              elementKeyMapping[key] = key
            })
          }
        }
      } else if (studyType === 'layer' || studyType === 'layer_v2') {
        // For layer studies, get layer names with image names
        const layerData = localStorage.getItem('cs_step5_layer')
        console.log('[CSV] Layer data from localStorage:', layerData)
        if (layerData) {
          const layers = JSON.parse(layerData)
          console.log('[CSV] Parsed layers:', layers)
          elementColumns = []
          elementKeyMapping = {}
          layers.forEach((layer: any) => {
            layer.images.forEach((img: any, index: number) => {
              const imageName = img.name || img.filename || `image_${index + 1}`
              const columnName = `${layer.name}_${imageName}`
              elementColumns.push(columnName)
              
              // Map the API response key (categoryname_1, categoryname_2, etc.) to our desired column name
              const apiKey = `${layer.name}_${index + 1}`
              elementKeyMapping[apiKey] = columnName
              
              console.log('[CSV] Added layer column:', columnName, 'from layer:', layer.name, 'image:', imageName)
              console.log('[CSV] Mapped API key:', apiKey, 'to column:', columnName)
            })
          })
          console.log('[CSV] Layer element columns:', elementColumns)
          console.log('[CSV] Layer element key mapping:', elementKeyMapping)
        }
        
        // If no columns from localStorage, try to get them from task data
        if (elementColumns.length === 0 && Object.keys(tasks).length > 0) {
          console.log('[CSV] No layer columns found, falling back to task data')
          const firstTask = tasks[Object.keys(tasks)[0]][0]
          if (firstTask && firstTask.elements_shown) {
            const elementKeys = Object.keys(firstTask.elements_shown).filter(key => 
              !key.includes('_content')
            )
            elementColumns = elementKeys.sort()
            elementKeyMapping = {}
            elementColumns.forEach(key => {
              elementKeyMapping[key] = key
            })
          }
        }
      }
      
      console.log('[CSV] Element columns found:', elementColumns.length, elementColumns)

      // Force debug: if no columns, try to get them from any task BEFORE generating CSV
      if (elementColumns.length === 0) {
        
        for (const respondentId of Object.keys(tasks)) {
          const respondentTasks = tasks[respondentId]
          if (respondentTasks && respondentTasks.length > 0) {
            const firstTask = respondentTasks[0]
            if (firstTask && firstTask.elements_shown) {
              const elementKeys = Object.keys(firstTask.elements_shown).filter(key => 
                !key.includes('_content')
              )
              
              if (elementKeys.length > 0) {
                // Try to get element names from localStorage first
                const gridData = localStorage.getItem('cs_step5_grid')
                if (gridData) {
                  try {
                    const categories = JSON.parse(gridData)
                    
                    
                    // Build columns with proper names and category order
                    elementColumns = []
                    elementKeyMapping = {}
                    
                    categories.forEach((category: any, catIdx: number) => {
                      if (category.elements && Array.isArray(category.elements)) {
                        category.elements.forEach((element: any, elIdx: number) => {
                          const categoryName = category.title || `Category_${catIdx + 1}`
                          const elementName = element.name || `Element_${elIdx + 1}`
                          const columnName = `${categoryName}_${elementName}`
                          elementColumns.push(columnName)
                          
                          // Map the API response key to our column name
                          const apiKey = `${categoryName}_${elIdx + 1}`
                          elementKeyMapping[apiKey] = columnName
                        })
                      }
                    })
                    
                    
                  } catch (e) {
                    
                    elementColumns = elementKeys.sort()
                    elementKeyMapping = {}
                    elementColumns.forEach(key => {
                      elementKeyMapping[key] = key
                    })
                  }
                } else {
                  // Fallback to using task keys directly
                  elementColumns = elementKeys.sort()
                  elementKeyMapping = {}
                  elementColumns.forEach(key => {
                    elementKeyMapping[key] = key
                  })
                }
                
                break
              }
            }
          }
        }
      }

      

      // Generate CSV content
      const csvRows: string[] = []
      
      // Add header row
      const headers = ['Responder', 'Task', ...elementColumns]
      csvRows.push(headers.join(','))

      // Add data rows
      Object.keys(tasks).forEach(respondentId => {
        const respondentTasks = tasks[respondentId]
        respondentTasks.forEach((task: any, taskIndex: number) => {
          const row = [
            parseInt(respondentId) + 1, // Convert to 1-based numbering
            taskIndex + 1,
            ...elementColumns.map(col => {
              // Find the corresponding API key for this column
              const apiKey = Object.keys(elementKeyMapping).find(key => elementKeyMapping[key] === col)
              if (apiKey) {
                return task.elements_shown[apiKey] || 0
              } else {
                // Fallback: try using the column name directly
                return task.elements_shown[col] || 0
              }
            })
          ]
          csvRows.push(row.join(','))
        })
      })

      // Create and download CSV
      const csvContent = csvRows.join('\n')
      
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `task_matrix_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error generating CSV:', error)
      alert('Error generating CSV file. Please try again.')
    }
  }
    

  return (
    <div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Task Matrix</h3>
        <p className="text-sm text-gray-600">Preview tasks generated for respondents.</p>

        {matrix && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            <div className="flex items-center justify-center py-10 sm:py-14 md:py-16 min-h-[220px] sm:min-h-[260px] md:min-h-[300px]">
              <div className="text-center space-y-3">
                {/* Main timer display */}
                <div className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold tracking-widest text-gray-900">
                  {formattedCountdown}
                </div>
                
                {/* Status line - properly aligned under timer */}
                {jobStatus && (
                  <div className="text-sm text-gray-600 font-medium">
                    {jobStatus.status}
                    {typeof jobStatus.progress === 'number' ? ` • ${Math.round(jobStatus.progress)}%` : ''}
                  </div>
                )}
                
                {/* Generating status with spinner */}
                {isGenerating && (
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></span>
                      {isPolling ? 'Generating your task' : 'Generating...'}
                    </div>
                    
                    {/* Progress bar - centered and properly sized */}
                    {jobStatus && jobStatus.progress !== undefined && (
                      <div className="w-full max-w-xs mx-auto">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${Math.round(jobStatus.progress)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Polling error */}
                    {pollingError && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded max-w-xs mx-auto">
                        Error: {pollingError}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                        
                        // Optional background from Step 5 (render behind all layers)
                        let backgroundUrl: string | null = null
                        try {
                          const bgRaw = localStorage.getItem('cs_step5_layer_background')
                          if (bgRaw) {
                            const bg = JSON.parse(bgRaw)
                            backgroundUrl = bg?.secureUrl || bg?.previewUrl || null
                          }
                        } catch {}

                        // Sort by z-index (ascending - lower z-index renders first/behind)
                        visibleLayers.sort((a, b) => a.z_index - b.z_index)
                        
                        
                        
                        return (
                          <div key={tIdx} className="border rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
                              <div>Task {(typeof task?.task_index === 'number') ? task.task_index + 1 : tIdx + 1}</div>
                              {/* <div className="text-gray-400">{task?.task_id}</div> */}
                            </div>
                            <div className="relative bg-gray-100 min-h-[300px] overflow-hidden">
                              {visibleLayers.length > 0 ? (
                                <div className="relative w-full h-[300px]">
                                  {backgroundUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img 
                                      src={backgroundUrl}
                                      alt="Background"
                                      className="absolute inset-0 w-full h-full object-contain"
                                      style={{ 
                                        zIndex: 0,
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%'
                                      }}
                                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                  )}
                                  {visibleLayers.map((layer, layerIdx) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img 
                                      key={layerIdx} 
                                      src={layer.url} 
                                      alt={layer.layer_name}
                                      className="absolute inset-0 w-full h-full object-contain"
                                      style={{ 
                                        zIndex: layer.z_index + 10, // Add offset to ensure proper stacking; background uses zIndex 0
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
                        // Handle grid study - updated for category-based format
                        const shown = task?.elements_shown || {}
                        const shownContent = task?.elements_shown_content || {}
                        
                        
                        const urls: string[] = []
                        
                        // New category-based format: extract URLs from elements_shown_content
                        Object.keys(shown).forEach((key) => {
                          if (shown[key] === 1 && shownContent[key]) {
                            const content = shownContent[key]
                            if (content.content && typeof content.content === 'string' && content.content.startsWith('http')) {
                              urls.push(content.content)
                            }
                          }
                        })
                        
                        // Fallback: Try different ways to extract URLs based on API response structure
                        if (urls.length === 0) {
                          Object.keys(shown).forEach((k) => {
                            if (k.endsWith('_content') && shown[k]) {
                              urls.push(shown[k])
                            }
                          })
                        }
                        
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
          <div className="flex flex-wrap gap-3 justify-start">
            <Button onClick={handleRegenerateTasks} variant="outline" className="flex-shrink-0">
              {isGenerating ? "Regenerating..." : "Regenerate Tasks"}
            </Button>
            <Button variant="outline" onClick={() => setIsStatsOpen(true)} className="flex-shrink-0">
              View Matrix Statistics
            </Button>
            <Button variant="outline" onClick={() => downloadMatrixCSV().catch(console.error)} className="flex-shrink-0">
              📥 Download Matrix CSV
            </Button>
          </div>
        </div>
      </div>

      {isStatsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsStatsOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <div className="text-base font-semibold text-gray-900">Matrix Statistics</div>
                <div className="text-xs text-gray-500">Overview of generated tasks and exposure</div>
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsStatsOpen(false)} aria-label="Close statistics">
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
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
                {/* <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600">Elements / Task</div>
                  <div className="text-xl font-semibold">{elementsPerTask}</div>
                </div> */}
                {/* <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600">Avg Elements / Task (Preview)</div>
                  <div className="text-xl font-semibold">{avgElementsPerTaskPreview.toFixed(2)}</div>
                </div> */}
                {/* <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-600">Unique Assets in Preview</div>
                  <div className="text-xl font-semibold">{uniqueAssetsInPreview}</div>
                </div> */}
                {/* <div className="rounded-lg border p-3 bg-white sm:col-span-2 lg:col-span-3">
                  <div className="text-xs text-gray-600">Estimated Total Element Views</div>
                  <div className="text-xl font-semibold">{estimatedTotalElementViews}</div>
                </div> */}
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-gray-600 mb-2">Notes</div>
                <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
                  <li>Preview shows data for the first respondent to optimize performance.</li>
                  <li>All totals come from metadata where available; otherwise they are derived.</li>
                  {studyType === 'layer' ? (
                    <li>Layer study: average count uses number of visible layers per task.</li>
                  ) : (
                    <li>Grid study: average count uses number of image URLs detected per task.</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => setIsStatsOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
        <Button 
          className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto" 
          onClick={onNext}
          disabled={Boolean(!matrix) || isPolling || isGenerating || (jobStatus ? jobStatus.status !== 'completed' : false)}
        >
          {!matrix ? 'Generate Tasks First' : 
           isPolling || isGenerating ? 'Generating...' : 
           (jobStatus && jobStatus.status !== 'completed') ? 'Tasks Not Ready' : 
           'Next'}
        </Button>
      </div>
    </div>
  )
}