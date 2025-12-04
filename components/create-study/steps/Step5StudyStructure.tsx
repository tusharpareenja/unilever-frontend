/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Fragment, useEffect, useRef, useState, forwardRef } from "react"
import { Rnd } from "react-rnd"
import { Button } from "@/components/ui/button"
import { uploadImages, putUpdateStudyAsync } from "@/lib/api/StudyAPI"

interface ElementItem {
  id: string
  name: string
  description: string
  file?: File
  previewUrl?: string
  secureUrl?: string
}

// Simple large preview mirroring background-fit logic
function LargePreview({ background, layers, aspect }: { background: { secureUrl?: string; previewUrl?: string } | null; layers: any[]; aspect: 'portrait' | 'landscape' | 'square' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [fit, setFit] = useState<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 0, height: 0 })
  const aspectClass = aspect === 'portrait' ? 'aspect-[9/16]' : aspect === 'landscape' ? 'aspect-[16/9]' : 'aspect-square'

  useEffect(() => {
    const compute = () => {
      const cw = containerRef.current?.offsetWidth || 0
      const ch = containerRef.current?.offsetHeight || 0
      if (!cw || !ch) return
      const iw = imgRef.current?.naturalWidth || cw
      const ih = imgRef.current?.naturalHeight || ch
      const scale = Math.min(cw / iw, ch / ih)
      const w = iw * scale
      const h = ih * scale
      const left = (cw - w) / 2
      const top = (ch - h) / 2
      setFit({ left, top, width: w, height: h })
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [aspect])

  return (
    <div className={`relative w-full ${aspectClass} max-h-[80vh] max-w-[90vw] mx-auto overflow-hidden bg-slate-50 rounded-lg border`} ref={containerRef}>
      {background && (background.secureUrl || background.previewUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={background.secureUrl || background.previewUrl}
          alt="Background"
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: 0 }}
          onLoad={() => {
            const cw = containerRef.current?.offsetWidth || 0
            const ch = containerRef.current?.offsetHeight || 0
            const iw = imgRef.current?.naturalWidth || cw
            const ih = imgRef.current?.naturalHeight || ch
            const scale = Math.min(cw / iw, ch / ih)
            const w = iw * scale
            const h = ih * scale
            const left = (cw - w) / 2
            const top = (ch - h) / 2
            setFit({ left, top, width: w, height: h })
          }}
        />
      )}
      <div className="absolute overflow-hidden" style={{ left: fit.left, top: fit.top, width: fit.width || '100%', height: fit.height || '100%', zIndex: 1 }}>
        {layers.map((l: any) => {
          const base = l.images?.[0]
          if (!base) return null
          const widthPct = Math.max(1, Math.min(100, Number(base.width ?? 100)))
          const heightPct = Math.max(1, Math.min(100, Number(base.height ?? 100)))
          const leftPct = Math.max(0, Math.min(100 - widthPct, Number(base.x ?? 0)))
          const topPct = Math.max(0, Math.min(100 - heightPct, Number(base.y ?? 0)))
          // Compute displayed pixel size. If the layer image includes captured pixel dimensions, prefer those.
          const iw = imgRef.current?.naturalWidth || fit.width || 1
          const ih = imgRef.current?.naturalHeight || fit.height || 1
          const displayWidth = base.pixelWidth ? (base.pixelWidth * (fit.width / iw)) : (widthPct / 100 * fit.width)
          const displayHeight = base.pixelHeight ? (base.pixelHeight * (fit.height / ih)) : (heightPct / 100 * fit.height)
          const leftPx = (leftPct / 100) * fit.width
          const topPx = (topPct / 100) * fit.height
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={l.id}
              src={base.secureUrl || base.previewUrl}
              alt={l.name}
              className="absolute object-contain"
              style={{
                zIndex: l.z ?? 0,
                position: 'absolute',
                top: `${topPx}px`,
                left: `${leftPx}px`,
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

interface CategoryItem {
  id: string
  title: string
  description?: string
  elements: ElementItem[]
}

interface Step5StudyStructureProps {
  onNext: () => void
  onBack: () => void
  mode?: "grid" | "layer"
  onDataChange?: () => void
}

export function Step5StudyStructure({ onNext, onBack, mode = "grid", onDataChange }: Step5StudyStructureProps) {
  // Dynamic limits from env with sensible defaults
  // const GRID_MIN = Number.parseInt(process.env.NEXT_PUBLIC_GRID_MIN_ELEMENTS || '4') || 4
  const GRID_MAX = Number.parseInt(process.env.NEXT_PUBLIC_GRID_MAX_ELEMENTS || '20') || 20
  const CATEGORY_MIN = 4
  const CATEGORY_MAX = 10

  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    try {
      const raw = localStorage.getItem('cs_step5_grid')
      if (raw) {
        const arr = JSON.parse(raw) as Array<Partial<CategoryItem>>
        return (arr || []).map((c, idx) => ({
          id: c.id || crypto.randomUUID(),
          title: c.title || `Category ${idx + 1}`,
          description: c.description || "",
          elements: (c.elements || []).map((e, eIdx) => ({
            id: e.id || crypto.randomUUID(),
            name: e.name || `Element ${eIdx + 1}`,
            description: e.description || "",
            previewUrl: e.previewUrl,
            secureUrl: e.secureUrl,
          }))
        }))
      }
    } catch { }
    return []
  })

  // Legacy support for old format
  const [elements, setElements] = useState<ElementItem[]>(() => {
    try {
      const raw = localStorage.getItem('cs_step5_grid')
      if (raw) {
        const arr = JSON.parse(raw) as Array<Partial<ElementItem>>
        // Check if it's the old format (direct elements)
        if (arr.length > 0 && !(arr[0] as any).title && !(arr[0] as any).elements) {
          return (arr || []).map((e, idx) => ({
            id: e.id || crypto.randomUUID(),
            name: e.name || `Element ${idx + 1}`,
            description: e.description || "",
            previewUrl: e.previewUrl,
            secureUrl: e.secureUrl,
          }))
        }
      }
    } catch { }
    return []
  })
  // const [uploading, setUploading] = useState(false)
  const [nextLoading, setNextLoading] = useState(false)
  // const inputRef = useRef<HTMLInputElement | null>(null)
  const gridHasHydratedRef = useRef(false)

  // Track which categories are collapsed
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Validation functions
  const areCategoriesValid = () => {
    if (categories.length < CATEGORY_MIN) return false
    return categories.every(category =>
      category.title &&
      category.title.trim().length > 0 &&
      category.elements &&
      category.elements.length > 0
    )
  }

  const getNextButtonText = () => {
    if (categories.length < CATEGORY_MIN) {
      return `Add at least ${CATEGORY_MIN} categories`
    }
    const invalidCategories = categories.filter(category =>
      !category.title || category.title.trim().length === 0
    )
    if (invalidCategories.length > 0) {
      return 'Complete category titles'
    }
    // Check if any category is missing images
    const hasEmptyCategories = categories.some(category =>
      !category.elements || category.elements.length === 0
    )
    if (hasEmptyCategories) {
      return 'Add at least one image to each category'
    }
    return 'Save & Next'
  }
  // Hybrid uploader (grid): accumulate single-file adds for 2s, batch upload
  const gridPendingRef = useRef<Array<{ id: string; file: File }>>([])
  const gridTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate GRID elements from localStorage on mount
  useEffect(() => { gridHasHydratedRef.current = true }, [mode])

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    let list = Array.from(files)
    // Enforce grid max limit
    if (mode === 'grid') {
      const remaining = Math.max(0, GRID_MAX - elements.length)
      if (remaining <= 0) return
      if (list.length > remaining) list = list.slice(0, remaining)
    }
    // Add previews and remember ids in selection order
    const selectionIds: string[] = []
    list.forEach((file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.[^/.]+$/, "")
      const newItem: ElementItem = { id: tempId, name: fileName, description: "", file, previewUrl: url }
      selectionIds.push(tempId)
      setElements(prev => [...prev, newItem])
    })

    // If user selected multiple at once, upload this selection as one batch now
    if (list.length > 1) {
      try {
        const results = await uploadImages(list)
        setElements(prev => prev.map((e) => {
          const idx = selectionIds.indexOf(e.id)
          if (idx !== -1) return { ...e, secureUrl: results[idx]?.secure_url || e.secureUrl }
          return e
        }))
      } catch (e) {
        console.error('Batch upload (grid) failed', e)
      }
      return
    }

    // Single file added: debounce and batch with other singles
    gridPendingRef.current.push({ id: selectionIds[0], file: list[0] })
    if (gridTimerRef.current) clearTimeout(gridTimerRef.current)
    gridTimerRef.current = setTimeout(async () => {
      const pending = gridPendingRef.current.splice(0)
      gridTimerRef.current = null
      if (pending.length === 0) return
      try {
        const results = await uploadImages(pending.map(p => p.file))
        setElements(prev => prev.map((e) => {
          const idx = pending.findIndex(p => p.id === e.id)
          if (idx !== -1) return { ...e, secureUrl: results[idx]?.secure_url || e.secureUrl }
          return e
        }))
      } catch (e) {
        console.error('Debounced upload (grid) failed', e)
      }
    }, 1000)
  }

  // const removeElement = (id: string) => {
  //   setElements((prev) => prev.filter((e) => e.id !== id))
  // }

  // const updateElement = (id: string, patch: Partial<ElementItem>) => {
  //   setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  // }

  // const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
  //   e.preventDefault()
  //   handleFiles(e.dataTransfer.files)
  // }

  // const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  //   e.preventDefault()
  //   e.dataTransfer.dropEffect = 'copy'
  // }

  // const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
  //   e.preventDefault()
  //   e.currentTarget.classList.add('bg-blue-50', 'border-blue-300')
  // }

  // const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
  //   e.preventDefault()
  //   e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300')
  // }

  // Warn on reload if any grid uploads pending
  useEffect(() => {
    if (mode !== 'grid') return
    const hasPending = elements.some(e => !e.secureUrl)
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    if (hasPending) {
      window.addEventListener('beforeunload', handler)
    }
    return () => window.removeEventListener('beforeunload', handler)
  }, [mode, elements])

  // persist categories
  useEffect(() => {
    if (mode !== 'grid') return
    if (typeof window === 'undefined') return
    if (!gridHasHydratedRef.current) return



    const minimal = categories.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      elements: c.elements.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        previewUrl: e.previewUrl,
        secureUrl: e.secureUrl
      }))
    }))

    localStorage.setItem('cs_step5_grid', JSON.stringify(minimal))
    onDataChange?.()
  }, [categories, mode, onDataChange])

  // Ensure all grid elements have secureUrl (upload pending ones)
  // const ensureGridUploads = async () => {
  //   const pending = elements.filter(e => !e.secureUrl && e.file)
  //   if (pending.length === 0) return

  //   const files = pending.map(p => p.file!)

  //   try {
  //     const results = await uploadImages(files)

  //     setElements(prev => prev.map(el => {
  //       const i = pending.findIndex(p => p.id === el.id)
  //       if (i !== -1) return { ...el, secureUrl: results[i]?.secure_url || el.secureUrl }
  //       return el
  //     }))
  //   } catch (e) {
  //     console.error('ensureGridUploads error', e)
  //   }
  // }

  // Category management functions
  const handleCategoryFiles = async (categoryId: string, files: FileList) => {


    const list = Array.from(files)
    const selectionIds: string[] = []

    list.forEach((file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.[^/.]+$/, "")
      const newElement: ElementItem = {
        id: tempId,
        name: fileName,
        description: "",
        file,
        previewUrl: url
      }
      selectionIds.push(tempId)



      setCategories(prev => {
        const updated = prev.map(c =>
          c.id === categoryId
            ? {
              ...c,
              elements: [...c.elements, newElement].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            }
            : c
        )

        return updated
      })
    })

    // Upload files
    if (list.length > 1) {
      try {
        const results = await uploadImages(list)
        setCategories(prev => prev.map(c =>
          c.id === categoryId
            ? {
              ...c,
              elements: c.elements.map((e) => {
                const idx = selectionIds.indexOf(e.id)
                if (idx !== -1) return { ...e, secureUrl: results[idx]?.secure_url || e.secureUrl }
                return e
              }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            }
            : c
        ))
      } catch (e) {
        console.error('Category batch upload failed', e)
      }
      return
    }

    // Single file: debounce
    gridPendingRef.current.push({ id: selectionIds[0], file: list[0] })
    if (gridTimerRef.current) clearTimeout(gridTimerRef.current)
    gridTimerRef.current = setTimeout(async () => {
      const pending = gridPendingRef.current.splice(0)
      gridTimerRef.current = null
      if (pending.length === 0) return
      try {
        const results = await uploadImages(pending.map(p => p.file))
        setCategories(prev => prev.map(c =>
          c.id === categoryId
            ? {
              ...c,
              elements: c.elements.map((e) => {
                const idx = pending.findIndex(p => p.id === e.id)
                if (idx !== -1) return { ...e, secureUrl: results[idx]?.secure_url || e.secureUrl }
                return e
              }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            }
            : c
        ))
      } catch (e) {
        console.error('Category debounced upload failed', e)
      }
    }, 1000)
  }

  const updateCategoryElement = (categoryId: string, elementId: string, patch: Partial<ElementItem>) => {
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? {
          ...c,
          elements: c.elements.map(e => e.id === elementId ? { ...e, ...patch } : e).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        }
        : c
    ))
  }

  const removeCategoryElement = (categoryId: string, elementId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, elements: c.elements.filter(e => e.id !== elementId) }
        : c
    ))
  }

  const handleNext = async () => {
    setNextLoading(true)
    try {
      // Ensure all category uploads (including preview-only entries) complete
      const uploadedCategories = await ensureCategoryUploadsEnhanced()

      const rawStudyId = localStorage.getItem('cs_study_id')
      if (rawStudyId) {
        // Parse study_id: handle both plain string and JSON-stringified format
        let studyId = rawStudyId
        try {
          const parsed = JSON.parse(rawStudyId)
          if (typeof parsed === 'string') studyId = parsed
        } catch {
          // Already a plain string, use as-is
        }

        // Build payload directly from uploaded categories to ensure all secureUrls are present
        // Map to backend contract: ElementPayload and CategoryPayload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: any = { study_type: 'grid' }
        const categoriesToSend = uploadedCategories && uploadedCategories.length > 0 ? uploadedCategories : categories

        if (categoriesToSend && categoriesToSend.length > 0) {
          updatePayload.categories = categoriesToSend.map((c, idx) => ({
            category_id: String(c.id),
            name: c.title || `Category ${idx + 1}`,
            order: idx
          }))
          // Collect all elements from all categories with secureUrl
          const categorizedElements = categoriesToSend.flatMap((c, _catIdx) =>
            (c.elements || [])
              .filter(el => el.secureUrl) // Only include elements that have been uploaded
              .map((el, _idx) => ({
                element_id: String(el.id),
                name: el.name || '',
                description: el.description || '',
                element_type: 'image',
                content: el.secureUrl,
                alt_text: el.name || '',
                category_id: String(c.id)
              }))
          )
          if (categorizedElements.length > 0) {
            updatePayload.elements = categorizedElements
            console.log('[Step5] Grid payload with categories and elements:', { categories: updatePayload.categories.length, elements: categorizedElements.length, payload: updatePayload })
          }
        }

        // Also handle legacy format with direct elements
        if (elements && elements.length > 0 && (!updatePayload.elements || updatePayload.elements.length === 0)) {
          updatePayload.elements = elements
            .filter(e => e.secureUrl)
            .map(e => ({
              element_id: String(e.id),
              name: e.name || '',
              description: e.description || '',
              element_type: 'image',
              content: e.secureUrl,
              alt_text: e.name || '',
              category_id: 'default-category'
            }))
        }

        putUpdateStudyAsync(studyId, updatePayload, 5)
      }
    } catch (e) {
      console.error('Failed in handleNext (grid):', e)
    } finally {
      setNextLoading(false)
      onNext()
    }
  }

  // Ensure all category elements have secureUrl (upload pending ones)
  // const ensureCategoryUploads = async () => {
  //   const pending: Array<{ categoryId: string; elementId: string; file: File }> = []
  //   categories.forEach(c =>
  //     c.elements.forEach(e => {
  //       if (!e.secureUrl && e.file) {
  //         pending.push({ categoryId: c.id, elementId: e.id, file: e.file })
  //       }
  //     })
  //   )
  //   if (pending.length === 0) return

  //   const files = pending.map(p => p.file)

  //   try {
  //     const results = await uploadImages(files)

  //     setCategories(prev => prev.map(category => {
  //       const updatedElements = category.elements.map(element => {
  //         const pendingIndex = pending.findIndex(p => p.categoryId === category.id && p.elementId === element.id)
  //         if (pendingIndex !== -1) {
  //           return { ...element, secureUrl: results[pendingIndex]?.secure_url || element.secureUrl }
  //         }
  //         return element
  //       })
  //       return { ...category, elements: updatedElements }
  //     }))
  //   } catch (e) {
  //     console.error('ensureCategoryUploads error', e)
  //   }
  // }

  // Enhanced: upload category images even when only previewUrl exists (no File)
  // Returns the updated categories with secureUrls set
  const ensureCategoryUploadsEnhanced = async (): Promise<CategoryItem[]> => {
    const pendingEntries: Array<{ categoryId: string; elementId: string; file?: File; previewUrl?: string }> = []
    categories.forEach(c =>
      c.elements.forEach(e => {
        if (!e.secureUrl) {
          if (e.file) pendingEntries.push({ categoryId: c.id, elementId: e.id, file: e.file })
          else if (e.previewUrl) pendingEntries.push({ categoryId: c.id, elementId: e.id, previewUrl: e.previewUrl })
        }
      })
    )

    // If no uploads needed, return current categories
    if (pendingEntries.length === 0) return categories

    // Prepare files: fetch blobs for previewUrls where file is not present
    const filesToUpload: File[] = []
    const mapIndex: Array<{ categoryId: string; elementId: string }> = []

    for (const entry of pendingEntries) {
      if (entry.file) {
        filesToUpload.push(entry.file)
        mapIndex.push({ categoryId: entry.categoryId, elementId: entry.elementId })
      } else if (entry.previewUrl) {
        try {
          const res = await fetch(entry.previewUrl)
          if (!res.ok) throw new Error('Failed to fetch preview URL')
          const blob = await res.blob()
          const ext = (entry.previewUrl.split('.').pop() || 'png').split('?')[0]
          const filename = `${entry.elementId || 'elem'}.${ext}`
          const file = new File([blob], filename, { type: blob.type || 'image/png' })
          filesToUpload.push(file)
          mapIndex.push({ categoryId: entry.categoryId, elementId: entry.elementId })
        } catch (err) {
          console.warn('Failed to fetch preview URL for upload:', entry.previewUrl, err)
        }
      }
    }

    if (filesToUpload.length === 0) return categories

    try {
      const results = await uploadImages(filesToUpload)
      // Create updated categories with secureUrls
      const updatedCategories = categories.map(category => {
        const updatedElements = category.elements.map(element => {
          const idx = mapIndex.findIndex(m => m.categoryId === category.id && m.elementId === element.id)
          if (idx !== -1) {
            return { ...element, secureUrl: results[idx]?.secure_url || element.secureUrl }
          }
          return element
        })
        return { ...category, elements: updatedElements }
      })

      // Update state for persistence
      setCategories(updatedCategories)

      console.log('[Step5] Upload complete, returning updated categories with secureUrls')
      return updatedCategories
    } catch (e) {
      console.error('ensureCategoryUploadsEnhanced error', e)
      // Return current categories even on error
      return categories
    }
  }

  if (mode === "layer") {
    return (
      <LayerMode onNext={onNext} onBack={onBack} onDataChange={onDataChange} />
    )
  }

  return (
    <div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Study Categories</h3>
        <p className="text-sm text-gray-600">Organize your study elements into categories. Each category can contain multiple elements.</p>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-gray-800">Category Management</div>
          <Button
            className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] cursor-pointer"
            onClick={() => {
              if (categories.length >= CATEGORY_MAX) return
              const newCategory: CategoryItem = {
                id: crypto.randomUUID(),
                title: `Category ${categories.length + 1}`,
                description: "",
                elements: []
              }
              setCategories(prev => [...prev, newCategory])

              // Auto-collapse all other categories when adding a new one
              setCollapsedCategories(new Set(categories.map(c => c.id)))
            }}
            disabled={categories.length >= CATEGORY_MAX}
          >
            + Add Category
          </Button>
        </div>

        <div className="text-xs text-gray-600 mb-4">Min {CATEGORY_MIN}, Max {CATEGORY_MAX}. Current: {categories.length}</div>

        {categories.length > 0 && (
          <div className="space-y-4">
            {categories.map((category, catIdx) => (
              <div key={category.id} className="border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCategoryCollapse(category.id)}
                      className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
                    >
                      <div className={`transform transition-transform ${collapsedCategories.has(category.id) ? 'rotate-0' : 'rotate-90'}`}>
                        ▶
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {category.title || `Category ${catIdx + 1}`}
                          {(!category.title || category.title.trim().length === 0) && (
                            <span className="text-red-500 text-xs">* Required</span>
                          )}
                        </div>
                        {category.description && (
                          <div className="text-xs text-gray-500">{category.description}</div>
                        )}
                      </div>
                    </button>
                  </div>
                  <Button variant="outline" onClick={() => setCategories(prev => prev.filter(c => c.id !== category.id))} className="px-3 py-1 cursor-pointer">Remove</Button>
                </div>
                {!collapsedCategories.has(category.id) && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Category Title <span className="text-red-500">*</span></label>
                        <input
                          value={category.title}
                          onChange={(e) => setCategories(prev => prev.map(c => c.id === category.id ? { ...c, title: e.target.value } : c))}
                          className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] ${!category.title || category.title.trim().length === 0
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-200'
                            }`}
                          placeholder="Enter category title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Description (Optional)</label>
                        <input
                          value={category.description || ""}
                          onChange={(e) => setCategories(prev => prev.map(c => c.id === category.id ? { ...c, description: e.target.value } : c))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                          placeholder="Enter category description"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-800">Elements ({category.elements.length})</div>
                      </div>

                      {category.elements.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {category.elements.map((element, _elIdx) => (
                            <div key={element.id} className="border rounded-lg p-3">
                              <div className="aspect-square bg-gray-100 flex items-center justify-center mb-2 rounded-lg">
                                {(element.secureUrl || element.previewUrl) ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={element.secureUrl || element.previewUrl} alt={element.name} className="max-w-full max-h-full object-contain" />
                                ) : (
                                  <div className="text-gray-400 text-xs">No Image</div>
                                )}
                              </div>
                              <input
                                value={element.name}
                                onChange={(e) => updateCategoryElement(category.id, element.id, { name: e.target.value })}
                                className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[rgba(38,116,186,0.3)]"
                                placeholder="Element name"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeCategoryElement(category.id, element.id)}
                                className="w-full mt-1 text-xs cursor-pointer"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          {/* Add more elements button */}
                          <div
                            className="border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col items-center justify-center min-h-[120px]"
                            onDrop={(e) => {
                              e.preventDefault()
                              handleCategoryFiles(category.id, e.dataTransfer.files)
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'copy'
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('bg-blue-50', 'border-blue-300')
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300')
                            }}
                            onClick={() => {
                              const input = document.createElement('input')
                              input.type = 'file'
                              input.accept = 'image/*'
                              input.multiple = true
                              input.onchange = (e) => {
                                const files = (e.target as HTMLInputElement).files
                                if (files) handleCategoryFiles(category.id, files)
                              }
                              input.click()
                            }}
                          >
                            <div className="text-gray-400 text-2xl mb-1">+</div>
                            <div className="text-xs text-gray-500 text-center">Click anywhere to add more</div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-lg p-6 text-center text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors"
                          onDrop={(e) => {
                            e.preventDefault()
                            handleCategoryFiles(category.id, e.dataTransfer.files)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'copy'
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('bg-blue-50', 'border-blue-300')
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300')
                          }}
                          onClick={() => {
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.accept = 'image/*'
                            input.multiple = true
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files
                              if (files) handleCategoryFiles(category.id, files)
                            }
                            input.click()
                          }}
                        >
                          <div className="text-sm">No elements added yet</div>
                          <div className="text-xs">Click anywhere to upload images or drag & drop</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Centered Add Category at bottom */}
            <div className="flex items-center justify-center pt-2">
              <Button
                className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] cursor-pointer"
                onClick={() => {
                  if (categories.length >= CATEGORY_MAX) return
                  const newCategory: CategoryItem = {
                    id: crypto.randomUUID(),
                    title: `Category ${categories.length + 1}`,
                    description: "",
                    elements: []
                  }
                  setCategories(prev => [...prev, newCategory])
                  setCollapsedCategories(new Set(categories.map(c => c.id)))
                }}
                disabled={categories.length >= CATEGORY_MAX}
              >
                + Add Category
              </Button>
            </div>
          </div>
        )}

        {categories.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-sm">No categories added yet</div>
            <div className="text-xs">Click "Add Category" to begin</div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto cursor-pointer" onClick={onBack}>Back</Button>
        <Button
          className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto cursor-pointer"
          onClick={handleNext}
          disabled={nextLoading || categories.length < CATEGORY_MIN || !areCategoriesValid()}
        >
          {nextLoading ? 'Uploading...' : getNextButtonText()}
        </Button>
      </div>
    </div>
  )
}

// ---------------- Layer Mode ----------------
interface LayerModeProps { onNext: () => void; onBack: () => void; onDataChange?: () => void }

type LayerImage = {
  id: string
  file?: File
  previewUrl: string
  secureUrl?: string
  name?: string
  x?: number // Position x (percentage of container width)
  y?: number // Position y (percentage of container height)
  width?: number // Width (percentage of container width)
  height?: number // Height (percentage of container height)
  // Exact captured pixel dimensions of the exported image (at scale=1)
  pixelWidth?: number
  pixelHeight?: number
  sourceType?: "text" | "upload"
  textContent?: string
  htmlContent?: string // For rich text
  textColor?: string
  textWeight?: '300' | '400' | '600' | '700'
  textSize?: number
  textFont?: string
  textBackgroundColor?: string
  textBackgroundRadius?: number
  textStrokeColor?: string
  textStrokeWidth?: number
  textLetterSpacing?: number
  textShadowColor?: string
  textShadowBlur?: number
  textShadowOffsetX?: number
  textShadowOffsetY?: number
  textFontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textOpacity?: number
  textRotation?: number
}

type Layer = {
  id: string
  name: string
  description?: string
  z: number
  images: LayerImage[]
  open: boolean
  visible?: boolean
  layer_type?: 'image' | 'text'
  transform?: { x: number; y: number; width: number; height: number }
}

type LayerTextModalState =
  | { layerId: string; mode: 'add' }
  | { layerId: string; mode: 'edit'; imageId: string }

function LayerMode({ onNext, onBack, onDataChange }: LayerModeProps) {
  // Dynamic limits from env with sensible defaults
  const LAYER_MIN = Number.parseInt(process.env.NEXT_PUBLIC_LAYER_MIN_LAYERS || '2') || 2
  const LAYER_MAX = Number.parseInt(process.env.NEXT_PUBLIC_LAYER_MAX_LAYERS || '10') || 10
  const [layers, setLayers] = useState<Layer[]>(() => {
    try {
      const raw = localStorage.getItem('cs_step5_layer')
      if (raw) {
        const saved = JSON.parse(raw) as Layer[]
        if (Array.isArray(saved)) {
          return saved.map((l, idx): Layer => ({
            id: l.id || crypto.randomUUID(),
            name: l.name || `Layer ${idx + 1}`,
            description: l.description || "",
            z: typeof l.z === 'number' ? l.z : idx,
            transform: l.transform ? {
              x: typeof l.transform.x === 'number' ? l.transform.x : 0,
              y: typeof l.transform.y === 'number' ? l.transform.y : 0,
              width: typeof l.transform.width === 'number' ? l.transform.width : 100,
              height: typeof l.transform.height === 'number' ? l.transform.height : 100,
            } : undefined,
            images: (l.images || []).map((img, imgIdx): LayerImage => {
              const sourceType = ((img as { sourceType?: 'text' | 'upload' }).sourceType === 'text' ? 'text' : 'upload') as 'text' | 'upload'
              return {
                id: img.id || crypto.randomUUID(),
                previewUrl: img.previewUrl || img.secureUrl || '',
                secureUrl: img.secureUrl,
                name: img.name || `Image ${imgIdx + 1}`,
                x: img.x ?? 0,
                y: img.y ?? 0,
                width: img.width ?? 100,
                height: img.height ?? 100,
                pixelWidth: (img as any).pixelWidth ?? undefined,
                pixelHeight: (img as any).pixelHeight ?? undefined,
                sourceType,
                textContent: sourceType === 'text'
                  ? ((img as { textContent?: string }).textContent ?? (img as { name?: string }).name ?? '')
                  : undefined,
                textColor: sourceType === 'text' ? ((img as { textColor?: string | null }).textColor ?? undefined) : undefined,
                textWeight: sourceType === 'text' ? (() => {
                  const w = (img as { textWeight?: '300' | '400' | '500' | '600' | '700' | null }).textWeight
                  if (!w) return undefined
                  return w === '500' ? '400' : (w as '300' | '400' | '600' | '700')
                })() : undefined,
                textSize: sourceType === 'text' ? ((img as { textSize?: number | null }).textSize ?? undefined) : undefined,
                textFont: sourceType === 'text' ? ((img as { textFont?: string }).textFont || 'Inter') : undefined,
                textBackgroundColor: sourceType === 'text' ? ((img as { textBackgroundColor?: string | null }).textBackgroundColor ?? undefined) : undefined,
                textBackgroundRadius: sourceType === 'text' ? ((img as { textBackgroundRadius?: number | null }).textBackgroundRadius ?? undefined) : undefined,
                textStrokeColor: sourceType === 'text' ? ((img as { textStrokeColor?: string | null }).textStrokeColor ?? undefined) : undefined,
                textStrokeWidth: sourceType === 'text' ? ((img as { textStrokeWidth?: number | null }).textStrokeWidth ?? undefined) : undefined,
                textLetterSpacing: sourceType === 'text' ? ((img as { textLetterSpacing?: number | null }).textLetterSpacing ?? undefined) : undefined,
                textShadowColor: sourceType === 'text' ? ((img as { textShadowColor?: string | null }).textShadowColor ?? undefined) : undefined,
                textShadowBlur: sourceType === 'text' ? ((img as { textShadowBlur?: number | null }).textShadowBlur ?? undefined) : undefined,
                textShadowOffsetX: sourceType === 'text' ? ((img as { textShadowOffsetX?: number | null }).textShadowOffsetX ?? undefined) : undefined,
                textShadowOffsetY: sourceType === 'text' ? ((img as { textShadowOffsetY?: number | null }).textShadowOffsetY ?? undefined) : undefined,
                textFontStyle: sourceType === 'text' ? ((img as { textFontStyle?: string | null }).textFontStyle ?? undefined) : undefined,
                textDecoration: sourceType === 'text' ? ((img as { textDecoration?: string | null }).textDecoration ?? undefined) : undefined,
                textAlign: sourceType === 'text' ? ((img as { textAlign?: string | null }).textAlign ?? undefined) : undefined,
                textOpacity: sourceType === 'text' ? ((img as { textOpacity?: number | null }).textOpacity ?? undefined) : undefined,
                textRotation: sourceType === 'text' ? ((img as { textRotation?: number | null }).textRotation ?? undefined) : undefined,
                htmlContent: sourceType === 'text' ? ((img as { htmlContent?: string | null }).htmlContent ?? undefined) : undefined,
              } as LayerImage
            }),
            open: false,
            visible: (l as any).visible !== false,
            layer_type: (() => {
              const savedLayerType = (l as any).layer_type
              if (savedLayerType === 'text' || savedLayerType === 'image') return savedLayerType
              const hasImages = (l.images || []).length > 0
              const allText = hasImages && (l.images || []).every((img: any) => (img.sourceType ?? 'upload') === 'text')
              return allText ? 'text' : 'image'
            })()
          } as Layer))
        }
      }
    } catch { }
    return []
  })
  // Keep a ref to the latest layers so async upload helpers can read fresh state
  const layersRef = useRef<Layer[]>(layers)
  useEffect(() => { layersRef.current = layers }, [layers])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showLayerTypeMenu, setShowLayerTypeMenu] = useState(false)
  const [draftType, setDraftType] = useState<'image' | 'text'>('image')
  const [draftName, setDraftName] = useState("Layer 1")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftImages, setDraftImages] = useState<Array<{ id: string; file?: File; previewUrl: string; secureUrl?: string; name: string; sourceType?: 'text' | 'upload' }>>([])
  const [draftText, setDraftText] = useState("")
  const [draftTextColor, setDraftTextColor] = useState("#000000")
  const [draftTextWeight, setDraftTextWeight] = useState<'300' | '400' | '600' | '700'>('600')
  const [draftTextSize, setDraftTextSize] = useState(100)
  const [draftTextFont, setDraftTextFont] = useState("Inter")
  const [draftTextBackgroundColor, setDraftTextBackgroundColor] = useState("")
  const [draftTextBackgroundRadius, setDraftTextBackgroundRadius] = useState(0)
  const [draftTextStrokeColor, setDraftTextStrokeColor] = useState("#000000")
  const [draftTextStrokeWidth, setDraftTextStrokeWidth] = useState(1)
  const [draftTextLetterSpacing, setDraftTextLetterSpacing] = useState(0)
  const [draftTextShadowColor, setDraftTextShadowColor] = useState("#000000")
  const [draftTextShadowBlur, setDraftTextShadowBlur] = useState(0)
  const [draftTextShadowOffsetX, setDraftTextShadowOffsetX] = useState(0)
  const [draftTextShadowOffsetY, setDraftTextShadowOffsetY] = useState(0)
  const [draftTextFontStyle, setDraftTextFontStyle] = useState<'normal' | 'italic'>('normal')
  const [draftTextDecoration, setDraftTextDecoration] = useState<'none' | 'underline' | 'line-through'>('none')
  const [draftTextAlign, setDraftTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left')
  const [draftTextOpacity, setDraftTextOpacity] = useState(100)
  const [draftTextRotation, setDraftTextRotation] = useState(0)
  const [draftHtmlContent, setDraftHtmlContent] = useState("")

  const [draftSaving, setDraftSaving] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [layerAddMenu, setLayerAddMenu] = useState<string | null>(null)
  const [showLayerTextModal, setShowLayerTextModal] = useState<LayerTextModalState | null>(null)
  const [layerTextValue, setLayerTextValue] = useState("")
  const [layerHtmlContent, setLayerHtmlContent] = useState("")
  const [layerTextColor, setLayerTextColor] = useState("#000000")
  const [layerTextWeight, setLayerTextWeight] = useState<'300' | '400' | '600' | '700'>('600')
  const [layerTextSize, setLayerTextSize] = useState(100)
  const [layerTextFont, setLayerTextFont] = useState("Inter")
  const [layerTextBackgroundColor, setLayerTextBackgroundColor] = useState("")
  const [layerTextBackgroundRadius, setLayerTextBackgroundRadius] = useState(0)
  const [layerTextStrokeColor, setLayerTextStrokeColor] = useState("#000000")
  const [layerTextStrokeWidth, setLayerTextStrokeWidth] = useState(1)
  const [layerTextLetterSpacing, setLayerTextLetterSpacing] = useState(0)
  const [layerTextShadowColor, setLayerTextShadowColor] = useState("#000000")
  const [layerTextShadowBlur, setLayerTextShadowBlur] = useState(0)
  const [layerTextShadowOffsetX, setLayerTextShadowOffsetX] = useState(0)
  const [layerTextShadowOffsetY, setLayerTextShadowOffsetY] = useState(0)
  const [layerTextFontStyle, setLayerTextFontStyle] = useState<'normal' | 'italic'>('normal')
  const [layerTextDecoration, setLayerTextDecoration] = useState<'none' | 'underline' | 'line-through'>('none')
  const [layerTextAlign, setLayerTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left')
  const [layerTextOpacity, setLayerTextOpacity] = useState(100)
  const [layerTextRotation, setLayerTextRotation] = useState(0)
  const [layerTextSaving, setLayerTextSaving] = useState(false)
  const [layerTextError, setLayerTextError] = useState<string | null>(null)
  const draftTextEditorRef = useRef<HTMLDivElement>(null)
  const layerTextEditorRef = useRef<HTMLDivElement>(null)
  const draftTextPreviewRef = useRef<HTMLDivElement | null>(null)
  const layerTextPreviewRef = useRef<HTMLDivElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const bgImgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 300, height: 400 })
  const HANDLE_INSET = 8
  const [bgFit, setBgFit] = useState<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 300, height: 400 })
  const bgFitKey = `${Math.round(bgFit.width)}x${Math.round(bgFit.height)}`
  const [selectedImageIds, setSelectedImageIds] = useState<Record<string, string>>({}) // layerId -> selectedImageId
  const [nextLoading, setNextLoading] = useState(false)
  const draggingRef = useRef<string | null>(null) // Track which layer is being dragged
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  // Preview aspect + modal preview
  const [previewAspect, setPreviewAspect] = useState<'portrait' | 'landscape' | 'square'>(() => {
    try {
      const saved = localStorage.getItem('cs_step5_layer_preview_aspect')
      if (saved === 'portrait' || saved === 'landscape' || saved === 'square') return saved as any
    } catch { }
    return 'portrait'
  })
  const aspectClass = previewAspect === 'portrait' ? 'aspect-[9/16]' : previewAspect === 'landscape' ? 'aspect-[16/9]' : 'aspect-square'
  const [showFullPreview, setShowFullPreview] = useState(false)
  const FONT_OPTIONS = [
    "Inter",
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Georgia",
    "Courier New",
    "Poppins",
    "Roboto",
    "Montserrat",
    "Open Sans",
    "Lato",
    "Oswald",
    "Raleway",
    "Merriweather",
    "Playfair Display",
    "Rubik",
    "Ubuntu"
  ]

  // Populate draft text editor when modal opens (run only once when modal opens)
  useEffect(() => {
    if (showModal && draftTextEditorRef.current) {
      if (draftHtmlContent) {
        draftTextEditorRef.current.innerHTML = draftHtmlContent
      } else if (draftText) {
        draftTextEditorRef.current.innerText = draftText
      } else {
        draftTextEditorRef.current.innerHTML = ''
      }
      // Focus the editor
      draftTextEditorRef.current.focus()
    }
  }, [showModal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Populate layer text editor when modal opens
  useEffect(() => {
    if (showLayerTextModal && layerTextEditorRef.current) {
      if (layerHtmlContent) {
        layerTextEditorRef.current.innerHTML = layerHtmlContent
      } else if (layerTextValue) {
        layerTextEditorRef.current.innerText = layerTextValue
      } else {
        layerTextEditorRef.current.innerHTML = ''
      }
      // Focus the editor
      layerTextEditorRef.current.focus()
    }
  }, [showLayerTextModal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers: unique name generators
  const generateUniqueName = (base: string, usedNames: Set<string>): string => {
    const trimmed = (base || '').trim() || 'Untitled'
    if (!usedNames.has(trimmed)) return trimmed
    let i = 1
    let candidate = `${trimmed}(${i})`
    while (usedNames.has(candidate)) {
      i += 1
      candidate = `${trimmed}(${i})`
    }
    return candidate
  }
  const uniqueLayerName = (proposed: string, excludeId?: string): string => {
    const used = new Set<string>()
    layers.forEach(l => { if (!excludeId || l.id !== excludeId) used.add((l.name || '').trim()) })
    return generateUniqueName(proposed, used)
  }

  // Deselect layer when clicking outside of the preview canvas entirely
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const container = previewContainerRef.current
      if (!container) return
      const target = e.target as Node | null
      if (selectedLayerId && target && !container.contains(target)) {
        setSelectedLayerId(null)
      }
    }
    document.addEventListener('mousedown', handleGlobalMouseDown, true)
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown, true)
  }, [selectedLayerId])

  useEffect(() => {
    if (!layerAddMenu) return
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.closest('[data-layer-add-menu]')) return
      setLayerAddMenu(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [layerAddMenu])

  useEffect(() => {
    if (!showLayerTypeMenu) return
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.closest('[data-layer-type-menu]')) return
      setShowLayerTypeMenu(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showLayerTypeMenu])

  // Update container size when it changes
  useEffect(() => {
    const updateSize = () => {
      if (previewContainerRef.current) {
        setContainerSize({
          width: previewContainerRef.current.offsetWidth,
          height: previewContainerRef.current.offsetHeight
        })
      }
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Persist chosen aspect for Step 7 to use
  useEffect(() => {
    try { localStorage.setItem('cs_step5_layer_preview_aspect', previewAspect) } catch { }
  }, [previewAspect])

  // Compute background fit box (object-contain) within container
  useEffect(() => {
    const computeFit = () => {
      const cw = containerSize.width
      const ch = containerSize.height
      // If no background image element, use full container
      const hasBg = Boolean(bgImgRef.current)
      if (!hasBg) {
        setBgFit({ left: 0, top: 0, width: cw, height: ch })
        return
      }
      const imgEl = bgImgRef.current
      const iw = imgEl?.naturalWidth || cw
      const ih = imgEl?.naturalHeight || ch
      if (iw <= 0 || ih <= 0) {
        setBgFit({ left: 0, top: 0, width: cw, height: ch })
        return
      }
      const scale = Math.min(cw / iw, ch / ih)
      const w = iw * scale
      const h = ih * scale
      const left = (cw - w) / 2
      const top = (ch - h) / 2
      setBgFit({ left, top, width: w, height: h })
    }
    computeFit()
  }, [containerSize])
  // Hybrid uploader (layer): accumulate single-file adds per layer, debounce 2s
  const layerPendingRef = useRef<Record<string, Array<{ imageId: string; file: File }>>>({})
  const layerTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})

  // Optional background image (single image)
  const [background, setBackground] = useState<{ id: string; file?: File; previewUrl?: string; secureUrl?: string; name?: string } | null>(() => {
    try {
      const raw = localStorage.getItem('cs_step5_layer_background')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && (parsed.secureUrl || parsed.previewUrl)) {
          return {
            id: parsed.id || crypto.randomUUID(),
            previewUrl: parsed.previewUrl,
            secureUrl: parsed.secureUrl,
            name: parsed.name || 'Background'
          }
        }
      }
    } catch { }
    return null
  })

  const addLayer = () => {
    if (layers.length >= LAYER_MAX) return
    setShowLayerTypeMenu(true)
  }

  const selectLayerType = (type: 'image' | 'text') => {
    // Compute next available default name like "Layer N"
    const existing = new Set(layers.map(l => (l.name || '').trim()))
    let n = layers.length + 1
    let proposed = `Layer ${n}`
    while (existing.has(proposed)) {
      n += 1
      proposed = `Layer ${n}`
    }
    setDraftType(type)
    setDraftName(proposed)
    setDraftDescription("")
    setDraftImages([])
    setDraftText("")
    setDraftTextColor("#000000")
    setDraftTextWeight('600')
    setDraftTextSize(60)
    setDraftTextFont("Inter")
    setDraftError(null)
    setShowLayerTypeMenu(false)
    setShowModal(true)
  }

  const reindexLayers = (list: Layer[]): Layer[] => {
    // Only update z by order; keep user-provided names intact
    return list.map((l, idx) => ({ ...l, z: idx }))
  }

  const handleDraftFiles = (files: FileList | null) => {
    if (draftType !== 'image') return
    if (!files) return
    setDraftError(null)
    const list = Array.from(files)
    const ids: string[] = []
    list.forEach((file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.[^/.]+$/, "")
      ids.push(tempId)
      setDraftImages(prev => [...prev, { id: tempId, file, previewUrl: url, name: fileName, sourceType: 'upload' as const }])
    })
    if (list.length > 1) {
      uploadImages(list).then((results) => {
        setDraftImages(prev => prev.map(img => {
          const idx = ids.indexOf(img.id)
          if (idx !== -1) return { ...img, secureUrl: results[idx]?.secure_url || img.secureUrl }
          return img
        }))
      }).catch((e) => console.error('Draft batch upload failed', e))
      return
    }
    // Single: debounce
    const singleId = ids[0]
    const singleFile = list[0]
    // Use a shared queue for draft context (key 'draft')
    if (!layerPendingRef.current['__draft__']) layerPendingRef.current['__draft__'] = []
    layerPendingRef.current['__draft__'].push({ imageId: singleId, file: singleFile })
    if (layerTimersRef.current['__draft__']) clearTimeout(layerTimersRef.current['__draft__']!)
    layerTimersRef.current['__draft__'] = setTimeout(async () => {
      const pending = (layerPendingRef.current['__draft__'] || []).splice(0)
      layerTimersRef.current['__draft__'] = null
      if (pending.length === 0) return
      try {
        const results = await uploadImages(pending.map(p => p.file))
        setDraftImages(prev => prev.map(img => {
          const idx = pending.findIndex(p => p.imageId === img.id)
          if (idx !== -1) return { ...img, secureUrl: results[idx]?.secure_url || img.secureUrl }
          return img
        }))
      } catch (e) {
        console.error('Draft debounced upload failed', e)
      }
    }, 1000)
  }
  // Helper to convert React style object to CSS string
  const styleObjectToCssString = (style: React.CSSProperties): string => {
    return Object.entries(style).map(([key, value]) => {
      if (value === undefined || value === null) return ''
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^(webkit|moz|ms)-/, '-$1-')
      return `${cssKey}: ${value};`
    }).join(' ')
  }

  interface TextLayerStyleProps {
    color: string
    fontWeight: string
    fontSize: number
    fontFamily?: string
    backgroundColor?: string
    backgroundRadius?: number
    textAlign?: string
    letterSpacing?: number
    fontStyle?: string
    textDecoration?: string
    textOpacity?: number
    textRotation?: number
    shadowColor?: string
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    strokeColor?: string;
    strokeWidth?: number;
  }

  const getTextLayerStyles = (props: TextLayerStyleProps) => {
    const {
      color,
      fontWeight,
      fontSize,
      fontFamily,
      backgroundColor,
      backgroundRadius,
      textAlign,
      letterSpacing,
      fontStyle,
      textDecoration,
      textOpacity = 100,
      textRotation = 0,
      shadowColor,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      strokeColor,
      strokeWidth,
    } = props

    const chosenFontFamily = fontFamily && fontFamily.trim().length > 0 ? fontFamily : "Inter"
    const contentPadding = backgroundColor ? Math.max(24, Math.round(fontSize * 0.9)) : 0
    const defaultShift = '-0.06em';
    const strokeNudge = (typeof strokeWidth !== 'undefined' && strokeWidth > 0)
      ? `calc(${defaultShift} - ${strokeWidth}px / 4)`
      : defaultShift;

    const containerStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      width: "100%",
      outline: "none",
      border: "none",
    }

    const wrapperStyle: React.CSSProperties = {
      backgroundColor: backgroundColor || "transparent",
      borderRadius: backgroundColor && backgroundRadius ? `${backgroundRadius}px` : "0",
      padding: `${contentPadding}px`,
      display: "flex",
      alignItems: "center",

      justifyContent: "center",
      outline: "none",
      border: "none",
    }

    const contentStyle: React.CSSProperties = {
      maxWidth: "3000px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      overflow: "visible",
      outline: "none",
      border: "none",
    }

    const textStyle: React.CSSProperties = {
      fontFamily: `'${chosenFontFamily}', system-ui, -apple-system, sans-serif`,
      fontSize: `${fontSize}px`,
      fontWeight: fontWeight,
      color: color,
      textAlign: (textAlign as any) || "left",
      letterSpacing: letterSpacing ? `${letterSpacing}px` : "normal",
      fontStyle: fontStyle || "normal",
      textDecoration: textDecoration || "none",
      opacity: textOpacity / 100,
      transform: `translateY(${strokeNudge}) rotate(${textRotation}deg)`,
      transformOrigin: "center center",
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
      display: "inline-block",
      textShadow: shadowColor && (
        (typeof shadowBlur !== 'undefined' && shadowBlur !== 0) ||
        (typeof shadowOffsetX !== 'undefined' && shadowOffsetX !== 0) ||
        (typeof shadowOffsetY !== 'undefined' && shadowOffsetY !== 0)
      )
        ? `${shadowOffsetX || 0}px ${shadowOffsetY || 0}px ${shadowBlur || 0}px ${shadowColor}`
        : "none",
      WebkitTextStroke: strokeColor && strokeWidth && strokeWidth > 0
        ? `${strokeWidth}px ${strokeColor}`
        : "none",
      paintOrder: "stroke fill" as any,
      WebkitFontSmoothing: "antialiased" as any,
      MozOsxFontSmoothing: "grayscale" as any,
      outline: "none",
      border: "none",
    }

    return { containerStyle, wrapperStyle, contentStyle, textStyle }
  }

  // Shared TextLayerPreview component — renders the exact DOM subtree used for preview and export
  const TextLayerPreview = forwardRef<HTMLDivElement, (TextLayerStyleProps & { text?: string; html?: string })>(
    ({ text, html, ...styleProps }, ref) => {
      const styles = getTextLayerStyles(styleProps as TextLayerStyleProps)
      return (
        <div ref={ref as any} data-text-layer-preview style={styles.containerStyle}>
          <div style={styles.wrapperStyle}>
            <div style={styles.contentStyle}>
              <span style={styles.textStyle} dangerouslySetInnerHTML={{ __html: html || text || '' }} />
            </div>
          </div>
        </div>
      )
    }
  )
  TextLayerPreview.displayName = 'TextLayerPreview'

  const renderTextLayerImage = async ({
    text,
    html,
    color,
    fontWeight,
    fontSize,
    fontFamily,
    fileBaseName,
    backgroundColor,
    backgroundRadius,
    strokeColor,
    strokeWidth,
    letterSpacing,
    shadowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    fontStyle,
    textDecoration,
    textAlign = "left",
    textOpacity = 100,
    textRotation = 0,
  }: {
    text: string
    html?: string
    color: string
    fontWeight: string
    fontSize: number
    fontFamily?: string
    fileBaseName: string
    backgroundColor?: string
    backgroundRadius?: number
    strokeColor?: string
    strokeWidth?: number
    letterSpacing?: number
    shadowColor?: string
    shadowBlur?: number
    shadowOffsetX?: number
    shadowOffsetY?: number
    fontStyle?: string
    textDecoration?: string
    textAlign?: string
    textOpacity?: number
    textRotation?: number
  }): Promise<{ file: File; previewUrl: string; width: number; height: number }> => {
    // Dynamically import dom-to-image-more to avoid SSR issues
    const domToImage = (await import('dom-to-image-more')).default

    // Prefer capturing the live mounted preview DOM if available so export matches on-screen exactly
    try {
      if ((document as any).fonts && (document as any).fonts.ready) {
        try { await (document as any).fonts.ready } catch (_) { /* ignore */ }
      }

      const exportNode = (layerTextPreviewRef && layerTextPreviewRef.current) || (draftTextPreviewRef && draftTextPreviewRef.current) || document.querySelector('[data-text-layer-preview]') as HTMLElement | null
      if (exportNode) {
        const rect = exportNode.getBoundingClientRect()
        // Add a small buffer to prevent sub-pixel wrapping issues
        const widthPx = Math.ceil(rect.width) + 2
        const heightPx = Math.ceil(rect.height) + 2

        // Capture at native layout size (scale:1) and DO NOT override width/height so canvas size equals node layout
        // Use dom-to-image-more for better CSS support (including -webkit-text-stroke)
        const blob = await domToImage.toBlob(exportNode, {
          width: widthPx,
          height: heightPx,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
            width: `${widthPx}px`,
            height: `${heightPx}px`
          }
        })



        const previewUrl = URL.createObjectURL(blob)
        const safeBase = fileBaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'text-layer'
        const fileName = `${safeBase}.png`
        const file = new File([blob], fileName, { type: 'image/png' })
        // Return captured pixel dimensions
        return { file, previewUrl, width: widthPx, height: heightPx }
      }
    } catch (err) {
      console.warn('Live preview capture failed, falling back to iframe capture', err)
    }

    // Fallback: render in an offscreen iframe (legacy path)
    const iframe = document.createElement("iframe")
    iframe.style.position = "absolute"
    iframe.style.left = "-9999px"
    iframe.style.top = "-9999px"
    iframe.style.width = "4000px"
    iframe.style.height = "4000px"
    iframe.style.border = "none"
    iframe.style.visibility = "hidden"
    document.body.appendChild(iframe)

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error("Failed to access iframe document")

      const styles = getTextLayerStyles({
        color, fontWeight, fontSize, fontFamily, backgroundColor, backgroundRadius,
        textAlign, letterSpacing, fontStyle, textDecoration, textOpacity, textRotation,
        shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, strokeColor, strokeWidth
      })

      const strokePadding = strokeWidth ? Math.ceil(strokeWidth * 2) : 0
      const shadowPadding = Math.max(
        Math.abs(shadowOffsetX || 0) + (shadowBlur || 0) + 10,
        Math.abs(shadowOffsetY || 0) + (shadowBlur || 0) + 10,
      )
      const extraPadding = Math.max(strokePadding, shadowPadding, 20)

      const htmlContent = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Poppins:wght@300;400;600;700&family=Roboto:wght@300;400;600;700&family=Montserrat:wght@300;400;600;700&family=Open+Sans:wght@300;400;600;700&family=Lato:wght@300;400;700&family=Oswald:wght@300;400;700&family=Raleway:wght@300;400;600;700&family=Merriweather:wght@300;400;700&family=Playfair+Display:wght@400;600;700&family=Rubik:wght@300;400;600;700&family=Ubuntu:wght@300;400;700&display=swap');
        body {
          background: transparent;
          padding: ${extraPadding}px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        #container { ${styleObjectToCssString(styles.containerStyle)} }
        #wrapper { ${styleObjectToCssString(styles.wrapperStyle)} }
        #content { ${styleObjectToCssString(styles.contentStyle)} }
        #text-span { ${styleObjectToCssString(styles.textStyle)} }
      </style>
    </head>
    <body>
      <div id="container">
        <div id="wrapper">
          <div id="content">
            <span id="text-span">${html || text}</span>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;

      iframeDoc.open()
      iframeDoc.write(htmlContent)
      iframeDoc.close()

      await new Promise((resolve) => setTimeout(resolve, 800))

      const wrapper = iframeDoc.getElementById("wrapper")
      if (!wrapper) throw new Error("Wrapper element not found in iframe")

      // Get the actual wrapper dimensions (includes padding and background)
      const wrapperRect = wrapper.getBoundingClientRect()
      const width = Math.ceil(wrapperRect.width)
      const height = Math.ceil(wrapperRect.height)

      // Add extra padding for effects (shadows, strokes)
      const totalWidth = width + (extraPadding * 2)
      const totalHeight = height + (extraPadding * 2)

      const blob = await domToImage.toBlob(iframeDoc.body, {
        width: totalWidth,
        height: totalHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: `${totalWidth}px`,
          height: `${totalHeight}px`,
          margin: '0',
          padding: '0',
          overflow: 'hidden'
        }
      })



      const previewUrl = URL.createObjectURL(blob)
      const safeBase =
        fileBaseName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "text-layer"
      const fileName = `${safeBase}.png`
      const file = new File([blob], fileName, { type: "image/png" })

      const canvasWidth = totalWidth
      const canvasHeight = totalHeight
      return { file, previewUrl, width: Math.ceil(canvasWidth), height: Math.ceil(canvasHeight) }
    } finally {
      document.body.removeChild(iframe)
    }
  }

  const renderPreviewAsImage = async ({
    text,
    html,
    color,
    fontWeight,
    fontSize,
    fontFamily,
    backgroundColor,
    backgroundRadius,
    strokeColor,
    strokeWidth,
    letterSpacing,
    shadowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    fontStyle,
    textDecoration,
    textAlign,
    textOpacity,
    textRotation,
  }: {
    text: string
    html?: string
    color: string
    fontWeight: string
    fontSize: number
    fontFamily?: string
    backgroundColor?: string
    backgroundRadius?: number
    strokeColor?: string
    strokeWidth?: number
    letterSpacing?: number
    shadowColor?: string
    shadowBlur?: number
    shadowOffsetX?: number
    shadowOffsetY?: number
    fontStyle?: string
    textDecoration?: string
    textAlign?: string
    textOpacity?: number
    textRotation?: number
  }): Promise<string> => {
    try {
      const { previewUrl } = await renderTextLayerImage({
        text,
        html,
        color,
        fontWeight,
        fontSize,
        fontFamily,
        fileBaseName: "preview",
        backgroundColor,
        backgroundRadius,
        strokeColor,
        strokeWidth,
        letterSpacing,
        shadowColor,
        shadowBlur,
        shadowOffsetX,
        shadowOffsetY,
        fontStyle,
        textDecoration,
        textAlign,
        textOpacity,
        textRotation,
      })
      return previewUrl
    } catch (e) {
      console.warn("Failed to render preview as image:", e)
      return ""
    }
  }

  const resetDraftState = () => {
    setShowModal(false)
    setShowLayerTypeMenu(false)
    setDraftType('image')
    setDraftName("")
    setDraftDescription("")
    setDraftImages([])
    setDraftText("")
    setDraftTextColor("#000000")
    setDraftTextWeight('600')
    setDraftTextSize(60)
    setDraftTextFont("Inter")
    setDraftTextBackgroundColor("")
    setDraftTextBackgroundRadius(0)
    setDraftTextStrokeColor("#000000")
    setDraftTextStrokeWidth(1)
    setDraftTextLetterSpacing(0)
    setDraftTextShadowColor("#000000")
    setDraftTextShadowBlur(0)
    setDraftTextShadowOffsetX(0)
    setDraftTextShadowOffsetY(0)
    setDraftTextFontStyle('normal')
    setDraftTextDecoration('none')
    setDraftHtmlContent("")
    setDraftError(null)
  }

  const handleDraftTypeSwitch = (type: 'image' | 'text') => {
    if (draftType === type) return
    setDraftType(type)
    setDraftError(null)
    if (type === 'image') {
      setDraftText("")
    } else {
      setDraftImages([])
      setDraftTextFont("Inter")
      setDraftTextColor("#000000")
      setDraftTextWeight('600')
      setDraftTextSize(100)
      setDraftTextBackgroundColor("")
      setDraftTextBackgroundRadius(0)
      setDraftTextStrokeColor("#000000")
      setDraftTextStrokeWidth(1)
      setDraftTextLetterSpacing(0)
      setDraftTextShadowColor("#000000")
      setDraftTextShadowBlur(0)
      setDraftTextShadowOffsetX(0)
      setDraftTextShadowOffsetY(0)
      setDraftTextFontStyle('normal')
      setDraftTextDecoration('none')
      setDraftHtmlContent("")
    }
  }

  const openLayerTextModal = (layerId: string, options?: { imageId?: string }) => {
    setLayerAddMenu(null)
    setLayerTextError(null)

    if (options?.imageId) {
      const targetLayer = layers.find(l => l.id === layerId)
      const targetImage = targetLayer?.images.find(img => img.id === options.imageId && (img.sourceType ?? 'upload') === 'text')
      if (!targetLayer || !targetImage) {
        console.warn('Text layer/image not found for editing', { layerId, imageId: options.imageId })
        setShowLayerTextModal({ layerId, mode: 'add' })
        setLayerTextValue("")
        setLayerTextColor("#000000")
        setLayerTextWeight('600')
        setLayerTextSize(60)
        setLayerTextBackgroundColor("")
        setLayerTextBackgroundRadius(0)
        setLayerTextStrokeColor("#000000")
        setLayerTextStrokeWidth(1)
        return
      }

      const existingText = typeof targetImage.textContent === 'string' && targetImage.textContent.trim().length > 0
        ? targetImage.textContent
        : (targetImage.name || "")

      setShowLayerTextModal({ layerId, mode: 'edit', imageId: targetImage.id })
      setLayerTextValue(existingText)
      setLayerTextColor(targetImage.textColor || "#000000")
      setLayerTextWeight(targetImage.textWeight || '600')
      setLayerTextSize(targetImage.textSize || 60)
      setLayerTextFont(targetImage.textFont || "Inter")
      setLayerTextBackgroundColor(targetImage.textBackgroundColor || "")
      setLayerTextBackgroundRadius(targetImage.textBackgroundRadius || 0)
      setLayerTextStrokeColor(targetImage.textStrokeColor || "")
      setLayerTextStrokeWidth(targetImage.textStrokeWidth || 0)
      setLayerTextLetterSpacing(targetImage.textLetterSpacing || 0)
      setLayerTextShadowColor(targetImage.textShadowColor || "#000000")
      setLayerTextShadowBlur(targetImage.textShadowBlur || 0)
      setLayerTextShadowOffsetX(targetImage.textShadowOffsetX || 0)
      setLayerTextShadowOffsetY(targetImage.textShadowOffsetY || 0)
      setLayerTextFontStyle(targetImage.textFontStyle || 'normal')
      setLayerTextDecoration(targetImage.textDecoration || 'none')
      setLayerTextAlign(targetImage.textAlign || 'left')
      setLayerTextOpacity(targetImage.textOpacity ?? 100)
      setLayerTextRotation(targetImage.textRotation ?? 0)
      setLayerHtmlContent(targetImage.htmlContent || "")
      return
    }

    setShowLayerTextModal({ layerId, mode: 'add' })
    setLayerTextValue("")
    setLayerTextColor("#000000")
    setLayerTextWeight('600')
    setLayerTextSize(60)
    setLayerTextFont("Inter")
    setLayerTextBackgroundColor("")
    setLayerTextBackgroundRadius(0)
    setLayerTextStrokeColor("#000000")
    setLayerTextStrokeWidth(1)
    setLayerTextLetterSpacing(0)
    setLayerTextShadowColor("#000000")
    setLayerTextShadowBlur(0)
    setLayerTextShadowOffsetX(0)
    setLayerTextShadowOffsetY(0)
    setLayerTextFontStyle('normal')
    setLayerTextDecoration('none')
    setLayerHtmlContent("")
  }

  const closeLayerTextModal = () => {
    setShowLayerTextModal(null)
    setLayerTextValue("")
    setLayerTextColor("#000000")
    setLayerTextWeight('600')
    setLayerTextSize(60)
    setLayerTextFont("Inter")
    setLayerTextBackgroundColor("")
    setLayerTextBackgroundRadius(0)
    setLayerTextStrokeColor("")
    setLayerTextStrokeWidth(0)
    setLayerTextLetterSpacing(0)
    setLayerTextShadowColor("#000000")
    setLayerTextShadowBlur(0)
    setLayerTextShadowOffsetX(0)
    setLayerTextShadowOffsetY(0)
    setLayerTextFontStyle('normal')
    setLayerTextDecoration('none')
    setLayerHtmlContent("")
    setLayerTextError(null)
    setLayerTextSaving(false)
  }

  const saveLayerTextToExistingLayer = async () => {
    if (!showLayerTextModal || layerTextSaving) return
    if (!layerTextValue.trim()) {
      setLayerTextError('Enter some text to add')
      return
    }
    setLayerTextSaving(true)
    setLayerTextError(null)
    const { layerId } = showLayerTextModal
    try {
      const targetLayer = layers.find(l => l.id === layerId)
      if (!targetLayer) throw new Error('Layer not found')
      const baseName = layerTextValue.split('\n')[0].trim() || 'Text'
      const { file, previewUrl, width: pixelWidth, height: pixelHeight } = await renderTextLayerImage({
        text: layerTextValue,
        html: layerHtmlContent,
        color: layerTextColor,
        fontWeight: layerTextWeight,
        fontSize: layerTextSize,
        fontFamily: layerTextFont,
        fileBaseName: baseName,
        backgroundColor: layerTextBackgroundColor,
        backgroundRadius: layerTextBackgroundRadius,
        strokeColor: layerTextStrokeColor,
        strokeWidth: layerTextStrokeWidth,
        letterSpacing: layerTextLetterSpacing,
        shadowColor: layerTextShadowColor,
        shadowBlur: layerTextShadowBlur,
        shadowOffsetX: layerTextShadowOffsetX,
        shadowOffsetY: layerTextShadowOffsetY,
        fontStyle: layerTextFontStyle,
        textDecoration: layerTextDecoration,
        textAlign: layerTextAlign,
        textOpacity: layerTextOpacity,
        textRotation: layerTextRotation,
      })
      const [result] = await uploadImages([file])
      const secureUrl = result?.secure_url || null
      if (secureUrl) {
        try { URL.revokeObjectURL(previewUrl) } catch (_) { }
      }
      if (showLayerTextModal.mode === 'add') {
        const base = targetLayer.images[0]
        const baseTransform = base ? {
          x: base.x ?? 0,
          y: base.y ?? 0,
          width: base.width ?? 100,
          height: base.height ?? 100
        } : { x: 0, y: 0, width: 100, height: 100 }

        const imageId = crypto.randomUUID()
        const image: LayerImage = {
          id: imageId,
          previewUrl: secureUrl || previewUrl,
          secureUrl: secureUrl || undefined,
          name: baseName,
          x: baseTransform.x,
          y: baseTransform.y,
          width: baseTransform.width,
          height: baseTransform.height,
          pixelWidth,
          pixelHeight,
          sourceType: 'text' as const,
          textContent: layerTextValue,
          htmlContent: layerHtmlContent,
          textColor: layerTextColor,
          textWeight: layerTextWeight,
          textSize: layerTextSize,
          textFont: layerTextFont,
          textBackgroundColor: layerTextBackgroundColor,
          textBackgroundRadius: layerTextBackgroundRadius,
          textStrokeColor: layerTextStrokeColor,
          textStrokeWidth: layerTextStrokeWidth,
          textLetterSpacing: layerTextLetterSpacing,
          textShadowColor: layerTextShadowColor,
          textShadowBlur: layerTextShadowBlur,
          textShadowOffsetX: layerTextShadowOffsetX,
          textShadowOffsetY: layerTextShadowOffsetY,
          textFontStyle: layerTextFontStyle,
          textDecoration: layerTextDecoration,
          textAlign: layerTextAlign,
          textOpacity: layerTextOpacity,
          textRotation: layerTextRotation
        }
        setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l
          const images = [...l.images, image]
          const allText = images.every(i => (i.sourceType ?? 'upload') === 'text')
          return { ...l, images, layer_type: allText ? 'text' : 'image' }
        }))
        setSelectedImageIds(prev => ({ ...prev, [layerId]: imageId }))
      } else {
        const targetImage = targetLayer.images.find(img => img.id === showLayerTextModal.imageId)
        if (!targetImage) throw new Error('Text image not found')
        setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l
          const updatedImages = l.images.map(img => {
            if (img.id !== showLayerTextModal.imageId) return img
            return {
              ...img,
              previewUrl: secureUrl || previewUrl,
              secureUrl: secureUrl || img.secureUrl,
              name: baseName,
              pixelWidth,
              pixelHeight,
              sourceType: 'text' as const,
              textContent: layerTextValue,
              htmlContent: layerHtmlContent,
              textColor: layerTextColor,
              textWeight: layerTextWeight,
              textSize: layerTextSize,
              textFont: layerTextFont,
              textBackgroundColor: layerTextBackgroundColor,
              textBackgroundRadius: layerTextBackgroundRadius,
              textStrokeColor: layerTextStrokeColor,
              textStrokeWidth: layerTextStrokeWidth,
              textLetterSpacing: layerTextLetterSpacing,
              textShadowColor: layerTextShadowColor,
              textShadowBlur: layerTextShadowBlur,
              textShadowOffsetX: layerTextShadowOffsetX,
              textShadowOffsetY: layerTextShadowOffsetY,
              textFontStyle: layerTextFontStyle,
              textDecoration: layerTextDecoration,
              textAlign: layerTextAlign,
              textOpacity: layerTextOpacity,
              textRotation: layerTextRotation
            }
          })
          const allText = updatedImages.every(i => (i.sourceType ?? 'upload') === 'text')
          return { ...l, images: updatedImages, layer_type: allText ? 'text' : 'image' }
        }))
      }
      closeLayerTextModal()
    } catch (error) {
      console.error('Failed to add text image to layer', error)
      setLayerTextError('Unable to add text. Please try again.')
      setLayerTextSaving(false)
    } finally {
      setLayerTextSaving(false)
    }
  }

  const saveLayer = async () => {
    if (draftSaving) return

    if (draftType === 'text') {
      if (!draftText.trim()) {
        setDraftError('Enter some text to create a layer')
        return
      }
      setDraftSaving(true)
      setDraftError(null)
      try {
        const baseName = (draftName || draftText).split('\n')[0].trim() || 'Text Layer'
        const { file, previewUrl, width: pixelWidth, height: pixelHeight } = await renderTextLayerImage({
          text: draftText,
          html: draftHtmlContent,
          color: draftTextColor,
          fontWeight: draftTextWeight,
          fontSize: draftTextSize,
          fontFamily: draftTextFont,
          fileBaseName: baseName,
          backgroundColor: draftTextBackgroundColor,
          backgroundRadius: draftTextBackgroundRadius,
          strokeColor: draftTextStrokeColor,
          strokeWidth: draftTextStrokeWidth,
          letterSpacing: draftTextLetterSpacing,
          shadowColor: draftTextShadowColor,
          shadowBlur: draftTextShadowBlur,
          shadowOffsetX: draftTextShadowOffsetX,
          shadowOffsetY: draftTextShadowOffsetY,
          fontStyle: draftTextFontStyle,
          textDecoration: draftTextDecoration,
          textAlign: draftTextAlign,
          textOpacity: draftTextOpacity,
          textRotation: draftTextRotation,
        })
        const [result] = await uploadImages([file])
        const secureUrl = result?.secure_url || null
        if (secureUrl) {
          try { URL.revokeObjectURL(previewUrl) } catch (_) { }
        }
        const layerId = crypto.randomUUID()
        const imageId = crypto.randomUUID()
        const nextZ = layers.length
        const initialName = draftName || `Layer ${nextZ + 1}`
        const name = uniqueLayerName(initialName)
        const layerImage: LayerImage = {
          id: imageId,
          previewUrl: secureUrl || previewUrl,
          secureUrl: secureUrl || undefined,
          name: baseName,
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          pixelWidth,
          pixelHeight,
          sourceType: 'text' as const,
          textContent: draftText,
          htmlContent: draftHtmlContent,
          textColor: draftTextColor,
          textWeight: draftTextWeight,
          textSize: draftTextSize,
          textFont: draftTextFont,
          textBackgroundColor: draftTextBackgroundColor,
          textBackgroundRadius: draftTextBackgroundRadius,
          textStrokeColor: draftTextStrokeColor,
          textStrokeWidth: draftTextStrokeWidth,
          textLetterSpacing: draftTextLetterSpacing,
          textShadowColor: draftTextShadowColor,
          textShadowBlur: draftTextShadowBlur,
          textShadowOffsetX: draftTextShadowOffsetX,
          textShadowOffsetY: draftTextShadowOffsetY,
          textFontStyle: draftTextFontStyle,
          textDecoration: draftTextDecoration,
          textAlign: draftTextAlign,
          textOpacity: draftTextOpacity,
          textRotation: draftTextRotation
        }
        const layer: Layer = { id: layerId, name, description: draftDescription, z: nextZ, images: [layerImage], open: false, layer_type: 'text' }
        setLayers(prev => reindexLayers([...prev, layer]))
        resetDraftState()
      } catch (error) {
        console.error('Failed to create text layer', error)
        setDraftError('Unable to create text layer. Please try again.')
      } finally {
        setDraftSaving(false)
      }
      return
    }

    if (draftImages.length === 0) {
      setDraftError('Add at least one image to this layer')
      return
    }

    setDraftError(null)
    const id = crypto.randomUUID()
    const nextZ = layers.length
    const imgs = draftImages.map(i => ({
      id: i.id,
      file: i.file,
      previewUrl: i.previewUrl,
      secureUrl: i.secureUrl,
      name: i.name,
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      sourceType: (i.sourceType ?? 'upload') as 'text' | 'upload'
    }))
    const initialName = draftName || `Layer ${nextZ + 1}`
    const name = uniqueLayerName(initialName)
    const layer: Layer = { id, name, description: draftDescription, z: nextZ, images: imgs, open: false, layer_type: 'image' }
    setLayers(prev => reindexLayers([...prev, layer]))
    resetDraftState()
  }

  const removeDraftImage = (imageId: string) => {
    setDraftImages(prev => prev.filter(img => img.id !== imageId))
  }

  const ensureLayerUploads = async () => {
    // Find all images across layers missing secureUrl but with file or previewUrl
    const pendingEntries: Array<{ layerId: string; imageId: string; file?: File; previewUrl?: string }> = []
    layers.forEach(l => l.images.forEach(img => { if (!img.secureUrl) pendingEntries.push({ layerId: l.id, imageId: img.id, file: img.file, previewUrl: img.previewUrl }) }))
    if (pendingEntries.length === 0) return

    const filesToUpload: File[] = []
    const mapIndex: Array<{ layerId: string; imageId: string }> = []

    for (const entry of pendingEntries) {
      if (entry.file) {
        filesToUpload.push(entry.file)
        mapIndex.push({ layerId: entry.layerId, imageId: entry.imageId })
      } else if (entry.previewUrl) {
        try {
          const res = await fetch(entry.previewUrl)
          if (!res.ok) throw new Error('Failed to fetch preview URL')
          const blob = await res.blob()
          const ext = (entry.previewUrl.split('.').pop() || 'png').split('?')[0]
          const filename = `${entry.imageId || 'img'}.${ext}`
          const file = new File([blob], filename, { type: blob.type || 'image/png' })
          filesToUpload.push(file)
          mapIndex.push({ layerId: entry.layerId, imageId: entry.imageId })
        } catch (err) {
          console.warn('Failed to fetch preview URL for upload:', entry.previewUrl, err)
        }
      }
    }

    if (filesToUpload.length === 0) return

    try {
      const results = await uploadImages(filesToUpload)

      // Update all layers with their corresponding secure URLs
      setLayers(prev => prev.map(layer => {
        const updatedImages = layer.images.map(img => {
          const idx = mapIndex.findIndex(m => m.layerId === layer.id && m.imageId === img.id)
          if (idx !== -1) {
            return { ...img, secureUrl: results[idx]?.secure_url || img.secureUrl }
          }
          return img
        })
        return { ...layer, images: updatedImages }
      }))
    } catch (e) {
      console.error('ensureLayerUploads error', e)
    }
  }

  const handleNext = async () => {
    setNextLoading(true)
    // Ensure all layer image uploads (including preview-only entries) complete
    await ensureLayerUploads()
    setNextLoading(false)
    try {
      const rawStudyId = localStorage.getItem('cs_study_id')
      if (rawStudyId) {
        // Parse study_id: handle both plain string and JSON-stringified format
        let studyId = rawStudyId
        try {
          const parsed = JSON.parse(rawStudyId)
          if (typeof parsed === 'string') studyId = parsed
        } catch {
          // Already a plain string, use as-is
        }

        // Build payload directly from in-memory layers & background using backend field names
        const updatePayload: any = { study_type: 'layer' }
        const sourceLayers = layersRef.current || []
        const mappedLayers: any[] = []
        // Background should not be sent as a layer object; instead include as `background_image_url`
        // The backend expects the background image separately, so don't push it into study_layers

        sourceLayers.forEach((l, layerIdx) => {
          const images = (l.images || []).filter((img: any) => img.secureUrl).map((img: any, imgIdx: number) => {
            const imageObj: any = {
              image_id: img.id || crypto.randomUUID(),
              name: img.name || `Image ${imgIdx + 1}`,
              url: img.secureUrl,
              alt_text: img.name || `Image ${imgIdx + 1}`,
              order: imgIdx,
              x: typeof img.x === 'number' ? img.x : 0,
              y: typeof img.y === 'number' ? img.y : 0,
              width: typeof img.width === 'number' ? img.width : 100,
              height: typeof img.height === 'number' ? img.height : 100
            }

            // Add text properties if this is a text layer  
            if ((img.sourceType ?? 'upload') === 'text') {
              // Add all text properties at image level
              if (img.htmlContent) imageObj.html_content = img.htmlContent
              if (img.textContent) imageObj.text_content = img.textContent
              if (img.textColor) imageObj.text_color = img.textColor
              if (img.textWeight) imageObj.text_weight = img.textWeight
              if (typeof img.textSize === 'number') imageObj.text_size = img.textSize
              if (img.textFont) imageObj.text_font = img.textFont
              if (img.textBackgroundColor) imageObj.text_background_color = img.textBackgroundColor
              if (typeof img.textBackgroundRadius === 'number') imageObj.text_background_radius = img.textBackgroundRadius
              if (img.textStrokeColor) imageObj.text_stroke_color = img.textStrokeColor
              if (typeof img.textStrokeWidth === 'number') imageObj.text_stroke_width = img.textStrokeWidth
              if (typeof img.textLetterSpacing === 'number') imageObj.text_letter_spacing = img.textLetterSpacing
              if (img.textShadowColor) imageObj.text_shadow_color = img.textShadowColor
              if (typeof img.textShadowBlur === 'number') imageObj.text_shadow_blur = img.textShadowBlur
              if (typeof img.textShadowOffsetX === 'number') imageObj.text_shadow_offset_x = img.textShadowOffsetX
              if (typeof img.textShadowOffsetY === 'number') imageObj.text_shadow_offset_y = img.textShadowOffsetY
              if (img.textFontStyle) imageObj.text_font_style = img.textFontStyle
              if (img.textDecoration) imageObj.text_decoration = img.textDecoration
              if (img.textAlign) imageObj.text_align = img.textAlign
              if (typeof img.textOpacity === 'number') imageObj.text_opacity = img.textOpacity
              if (typeof img.textRotation === 'number') imageObj.text_rotation = img.textRotation

              // Also add config for backward compatibility
              imageObj.config = {
                text_content: img.textContent || img.name,
                ...(img.htmlContent ? { html_content: img.htmlContent } : {}),
                ...(img.textColor ? { text_color: img.textColor } : {}),
                ...(img.textWeight ? { text_weight: img.textWeight } : {}),
                ...(typeof img.textSize === 'number' ? { text_size: img.textSize } : {}),
                ...(img.textFont ? { text_font: img.textFont } : {}),
                ...(img.textBackgroundColor ? { text_background_color: img.textBackgroundColor } : {}),
                ...(typeof img.textBackgroundRadius === 'number' ? { text_background_radius: img.textBackgroundRadius } : {}),
                ...(img.textStrokeColor ? { text_stroke_color: img.textStrokeColor } : {}),
                ...(typeof img.textStrokeWidth === 'number' ? { text_stroke_width: img.textStrokeWidth } : {}),
                ...(typeof img.textLetterSpacing === 'number' ? { text_letter_spacing: img.textLetterSpacing } : {}),
                ...(img.textShadowColor ? { text_shadow_color: img.textShadowColor } : {}),
                ...(typeof img.textShadowBlur === 'number' ? { text_shadow_blur: img.textShadowBlur } : {}),
                ...(typeof img.textShadowOffsetX === 'number' ? { text_shadow_offset_x: img.textShadowOffsetX } : {}),
                ...(typeof img.textShadowOffsetY === 'number' ? { text_shadow_offset_y: img.textShadowOffsetY } : {}),
                ...(img.textFontStyle ? { text_font_style: img.textFontStyle } : {}),
                ...(img.textDecoration ? { text_decoration: img.textDecoration } : {}),
                ...(img.textAlign ? { text_align: img.textAlign } : {}),
                ...(typeof img.textOpacity === 'number' ? { text_opacity: img.textOpacity } : {}),
                ...(typeof img.textRotation === 'number' ? { text_rotation: img.textRotation } : {}),
                additionalProp1: {}
              }
            }

            return imageObj
          })

          // Determine layer_type based on sourceType of images
          // If all images in the layer have sourceType 'text', mark as 'text', otherwise 'image'
          const hasImages = (l.images || []).length > 0
          const allText = hasImages && (l.images || []).every((img: any) => (img.sourceType ?? 'upload') === 'text')
          const layerType = allText ? 'text' : 'image'

          const layerObj: any = {
            layer_id: l.id || crypto.randomUUID(),
            name: l.name || `Layer ${layerIdx + 1}`,
            description: l.description || '',
            layer_type: layerType,
            z_index: typeof l.z === 'number' ? l.z : layerIdx + (background ? 1 : 0),
            order: typeof l.z === 'number' ? l.z : layerIdx + (background ? 1 : 0),
            images
          }

          // Include transform data if available
          // Calculate from first image if not stored on layer
          if (l.transform) {
            layerObj.transform = {
              x: l.transform.x || 0,
              y: l.transform.y || 0,
              width: l.transform.width || 0,
              height: l.transform.height || 0
            }
          } else if (l.images && l.images.length > 0) {
            const firstImg = l.images[0]
            if (firstImg && (typeof firstImg.x === 'number' || typeof firstImg.y === 'number' || typeof firstImg.width === 'number' || typeof firstImg.height === 'number')) {
              layerObj.transform = {
                x: firstImg.x || 0,
                y: firstImg.y || 0,
                width: firstImg.width || 0,
                height: firstImg.height || 0
              }
            }
          }

          mappedLayers.push(layerObj)
        })

        if (mappedLayers.length > 0) updatePayload.study_layers = mappedLayers
        if (background && (background.secureUrl || background.previewUrl)) {
          updatePayload.background_image_url = background.secureUrl || background.previewUrl
        }
        putUpdateStudyAsync(studyId, updatePayload, 5)
      }
    } catch (e) {
      console.error('Failed to schedule background study update (layer):', e)
    }
    onNext()
  }

  const removeLayer = (id: string) => {
    setLayers(prev => {
      const filtered = prev.filter(l => l.id !== id)
      return reindexLayers(filtered)
    })
    // Remove selected image for this layer
    setSelectedImageIds(prev => {
      const newState = { ...prev }
      delete newState[id]
      return newState
    })
  }

  const selectImage = (layerId: string, imageId: string) => {
    setSelectedImageIds(prev => ({ ...prev, [layerId]: imageId }))
  }

  const removeImageFromLayer = (layerId: string, imageId: string) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer
      const newImages = layer.images.filter(img => img.id !== imageId)
      // If we're removing the selected image, select the first remaining image
      if (selectedImageIds[layerId] === imageId && newImages.length > 0) {
        setSelectedImageIds(prev => ({ ...prev, [layerId]: newImages[0].id }))
      } else if (newImages.length === 0) {
        // No images left, remove selection
        setSelectedImageIds(prev => {
          const newState = { ...prev }
          delete newState[layerId]
          return newState
        })
      }
      const allText = newImages.length > 0 && newImages.every(img => (img.sourceType ?? 'upload') === 'text')
      return { ...layer, images: newImages, layer_type: allText ? 'text' : 'image' }
    }))
  }

  const updateImageName = (layerId: string, imageId: string, name: string) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer
      return { ...layer, images: layer.images.map(img => img.id === imageId ? { ...img, name } : img) }
    }))
  }

  const duplicateLayerImage = (layerId: string, imageId: string) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer
      const targetImage = layer.images.find(img => img.id === imageId)
      if (!targetImage) return layer

      const newImageId = crypto.randomUUID()
      const newImage: LayerImage = {
        ...targetImage,
        id: newImageId,
        name: `${targetImage.name} (Copy)`,
        // Offset slightly to make duplication visible
        x: (targetImage.x ?? 0) + 2,
        y: (targetImage.y ?? 0) + 2,
      }

      return {
        ...layer,
        images: [...layer.images, newImage]
      }
    }))
  }

  const moveLayer = (fromIdx: number, toIdx: number) => {
    setLayers(prev => {
      const copy = [...prev]
      const [item] = copy.splice(fromIdx, 1)
      copy.splice(toIdx, 0, item)
      return reindexLayers(copy)
    })
  }

  const addImagesToLayer = (layerId: string, files: FileList | null) => {
    if (!files) return
    const list = Array.from(files)
    const ids: string[] = []
    list.forEach((file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.[^/.]+$/, "")
      ids.push(tempId)
      setLayers(prev => prev.map(l => {
        if (l.id !== layerId) return l
        const base = l.images[0]
        const baseTransform = base ? {
          x: base.x ?? 0,
          y: base.y ?? 0,
          width: base.width ?? 100,
          height: base.height ?? 100
        } : { x: 0, y: 0, width: 100, height: 100 }
        return {
          ...l,
          images: [...l.images, {
            id: tempId,
            file,
            previewUrl: url,
            name: fileName,
            sourceType: 'upload' as const,
            ...baseTransform
          }]
        }
      }))
    })
    if (list.length > 1) {
      uploadImages(list).then((results) => {
        setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l
          return {
            ...l, images: l.images.map((img) => {
              const idx = ids.indexOf(img.id)
              if (idx !== -1) return { ...img, secureUrl: results[idx]?.secure_url || img.secureUrl }
              return img
            })
          }
        }))
      }).catch((e) => console.error('Layer batch upload failed', e))
      return
    }
    // Single file added to layer: debounce per-layer
    if (!layerPendingRef.current[layerId]) layerPendingRef.current[layerId] = []
    layerPendingRef.current[layerId].push({ imageId: ids[0], file: list[0] })
    if (layerTimersRef.current[layerId]) clearTimeout(layerTimersRef.current[layerId]!)
    layerTimersRef.current[layerId] = setTimeout(async () => {
      const pending = (layerPendingRef.current[layerId] || []).splice(0)
      layerTimersRef.current[layerId] = null
      if (pending.length === 0) return
      try {
        const results = await uploadImages(pending.map(p => p.file))
        setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l
          return {
            ...l, images: l.images.map((img) => {
              const idx = pending.findIndex(p => p.imageId === img.id)
              if (idx !== -1) return { ...img, secureUrl: results[idx]?.secure_url || img.secureUrl }
              return img
            })
          }
        }))
      } catch (e) {
        console.error('Layer debounced upload failed', e)
      }
    }, 1000)
  }

  const promptLayerImageUpload = (layerId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) addImagesToLayer(layerId, files)
    }
    input.click()
  }

  // Background upload helpers
  const handleBackgroundFile = async (file: File | null) => {
    if (!file) return
    const tempId = crypto.randomUUID()
    const url = URL.createObjectURL(file)
    const fileName = file.name.replace(/\.[^/.]+$/, "")
    setBackground({ id: tempId, file, previewUrl: url, name: fileName })
    try {
      const [res] = await uploadImages([file])
      setBackground(prev => prev ? { ...prev, secureUrl: res?.secure_url || prev.secureUrl } : prev)
    } catch (e) {
      console.error('Background upload failed', e)
    }
  }

  const removeBackground = () => {
    setBackground(null)
  }

  // Warn on reload if any layer image uploads pending
  useEffect(() => {
    const hasPending = layers.some(l => l.images.some(img => !img.secureUrl))
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    if (hasPending) window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [layers])

  // Function to update layer image position and size
  // Applies the same transform to ALL images in the specified layer
  const updateLayerImageTransform = (layerId: string, imageId: string, transform: { x?: number; y?: number; width?: number; height?: number }) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer
      return {
        ...layer,
        images: layer.images.map(img => ({ ...img, ...transform }))
      }
    }))
  }

  // persist layers
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem('cs_resuming_draft') === 'true') {
        // Resume from backend is in progress; skip persisting layers to avoid overwriting
        return
      }
    } catch { }
    ; (async () => {
      // If any image in layers lacks secureUrl, attempt to upload them first
      const hasMissing = layersRef.current.some(l => (l.images || []).some((img: any) => !img.secureUrl))
      if (hasMissing) {
        try {
          await ensureLayerUploads()
        } catch (e) {
          console.warn('Layer uploads attempted but some images may still be missing secureUrl:', e)
        }
      }

      // Use the freshest layers from ref (ensureLayerUploads updated state)
      const sourceLayers = layersRef.current
      const minimal = sourceLayers.map(l => ({
        id: l.id,
        name: l.name,
        description: l.description || '',
        z: l.z,
        // Save layer-level transform: use existing transform if available, otherwise derive from first image
        transform: l.transform || (() => {
          const base = l.images?.[0]
          if (!base) return undefined
          return {
            x: base.x,
            y: base.y,
            width: base.width,
            height: base.height,
          }
        })(),
        images: l.images.map(i => {
          const imageObj: any = {
            id: i.id,
            previewUrl: i.previewUrl,
            secureUrl: i.secureUrl,
            name: i.name,
            x: i.x,
            y: i.y,
            width: i.width,
            height: i.height,
            pixelWidth: (i as any).pixelWidth ?? undefined,
            pixelHeight: (i as any).pixelHeight ?? undefined,
            sourceType: i.sourceType,
            textContent: i.textContent ?? i.name ?? ''
          }
          // Always include text properties for text-based images
          if (i.sourceType === 'text') {
            // Persist sensible defaults instead of null so resume flow retains values
            imageObj.htmlContent = i.htmlContent ?? ''
            imageObj.textColor = i.textColor ?? ''
            imageObj.textWeight = i.textWeight ?? '600'
            imageObj.textSize = typeof i.textSize === 'number' ? i.textSize : 60
            imageObj.textFont = i.textFont ?? 'Inter'
            imageObj.textBackgroundColor = i.textBackgroundColor ?? ''
            imageObj.textBackgroundRadius = typeof i.textBackgroundRadius === 'number' ? i.textBackgroundRadius : 0
            imageObj.textStrokeColor = i.textStrokeColor ?? ''
            imageObj.textStrokeWidth = typeof i.textStrokeWidth === 'number' ? i.textStrokeWidth : 0
            imageObj.textLetterSpacing = typeof i.textLetterSpacing === 'number' ? i.textLetterSpacing : 0
            imageObj.textShadowColor = i.textShadowColor ?? ''
            imageObj.textShadowBlur = typeof i.textShadowBlur === 'number' ? i.textShadowBlur : 0
            imageObj.textShadowOffsetX = typeof i.textShadowOffsetX === 'number' ? i.textShadowOffsetX : 0
            imageObj.textShadowOffsetY = typeof i.textShadowOffsetY === 'number' ? i.textShadowOffsetY : 0
            imageObj.textFontStyle = i.textFontStyle ?? 'normal'
            imageObj.textDecoration = i.textDecoration ?? 'none'
            imageObj.textAlign = i.textAlign ?? 'left'
            imageObj.textOpacity = typeof i.textOpacity === 'number' ? i.textOpacity : 100
            imageObj.textRotation = typeof i.textRotation === 'number' ? i.textRotation : 0
          }
          return imageObj
        }),
        visible: l.visible !== false,
        layer_type: (() => {
          // Always calculate layer_type from images to ensure it matches content
          const hasImages = (l.images || []).length > 0
          const allText = hasImages && (l.images || []).every((img: any) => (img.sourceType ?? 'upload') === 'text')
          return allText ? 'text' : 'image'
        })()
      }))
      localStorage.setItem('cs_step5_layer', JSON.stringify(minimal))
    })()
    // persist background separately
    if (background && (background.secureUrl || background.previewUrl)) {
      localStorage.setItem('cs_step5_layer_background', JSON.stringify({
        id: background.id,
        previewUrl: background.previewUrl,
        secureUrl: background.secureUrl,
        name: background.name || 'Background'
      }))
    } else {
      localStorage.removeItem('cs_step5_layer_background')
    }
    onDataChange?.()
  }, [layers, background, onDataChange]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Layer Configuration</h3>
        <p className="text-sm text-gray-600">Configure layers, upload images, and preview your layer study</p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm font-semibold text-gray-800">Layer Management</div>
        <div className="relative" data-layer-type-menu>
          <Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] cursor-pointer" onClick={addLayer} disabled={layers.length >= LAYER_MAX}>+ Add New Layer</Button>
          {showLayerTypeMenu && (
            <div className="absolute right-0 top-full mt-2 w-36 rounded-md border border-gray-200 bg-white shadow-lg p-2 space-y-1 z-20">
              <button
                type="button"
                className="w-full text-xs px-2 py-1 rounded-md text-left hover:bg-gray-100 cursor-pointer"
                onClick={() => selectLayerType('image')}
              >
                Image
              </button>
              <button
                type="button"
                className="w-full text-xs px-2 py-1 rounded-md text-left hover:bg-gray-100 cursor-pointer"
                onClick={() => selectLayerType('text')}
              >
                Text
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-5">
        <div className={`${previewAspect === 'landscape' ? 'md:col-span-3' : 'md:col-span-2'} rounded-xl bg-white p-4 flex flex-col`}>
          {/* Preview canvas built from z order with draggable/resizable layers */}
          <div
            ref={previewContainerRef}
            className={`relative w-full ${aspectClass} ${previewAspect === 'portrait' ? 'max-h-[55vh]' : 'max-h-[75vh]'} overflow-hidden bg-slate-50 rounded-lg border`}
            style={{ position: 'relative' }}
            onMouseDown={(e) => { if (e.currentTarget === e.target) setSelectedLayerId(null) }}
          >
            {background && (background.secureUrl || background.previewUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={bgImgRef}
                src={background.secureUrl || background.previewUrl}
                alt="Background"
                className="absolute inset-0 w-full h-full object-contain"
                style={{ zIndex: 0 }}
                onLoad={() => {
                  // recompute fit after image loads
                  const cw = containerSize.width
                  const ch = containerSize.height
                  const iw = bgImgRef.current?.naturalWidth || cw
                  const ih = bgImgRef.current?.naturalHeight || ch
                  const scale = Math.min(cw / iw, ch / ih)
                  const w = iw * scale
                  const h = ih * scale
                  const left = (cw - w) / 2
                  const top = (ch - h) / 2
                  setBgFit({ left, top, width: w, height: h })
                }}
              />
            )}

            {/* Overlay fit box; children are constrained within */}
            <div
              className="absolute overflow-hidden"
              style={{ left: bgFit.left, top: bgFit.top, width: bgFit.width, height: bgFit.height, zIndex: 1 }}
            >
              {layers.map((l) => {
                if (l.visible === false) return null
                const selectedImageId = selectedImageIds[l.id]
                const selectedImage = selectedImageId ? l.images.find(img => img.id === selectedImageId) : l.images[0]
                if (!selectedImage) return null

                // Convert percentage to pixels using background fit box
                const x = ((selectedImage.x ?? 0) / 100) * bgFit.width
                const y = ((selectedImage.y ?? 0) / 100) * bgFit.height
                const width = ((selectedImage.width ?? 100) / 100) * bgFit.width
                const height = ((selectedImage.height ?? 100) / 100) * bgFit.height

                const layerKey = `${l.id}-${selectedImage.id}`
                const isSelected = selectedLayerId === l.id
                const positionKey = `${(selectedImage.x ?? 0).toFixed(2)}-${(selectedImage.y ?? 0).toFixed(2)}-${(selectedImage.width ?? 100).toFixed(2)}-${(selectedImage.height ?? 100).toFixed(2)}`

                return (
                  <Rnd
                    key={`${layerKey}-${positionKey}-${bgFitKey}`}
                    default={{ x, y, width, height }}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedLayerId(l.id) }}
                    disableDragging={!isSelected}
                    onDragStart={() => {
                      draggingRef.current = layerKey
                    }}
                    onDragStop={(e, d) => {
                      draggingRef.current = null
                      // Convert pixels to percentage and save
                      if (bgFit.width > 0 && bgFit.height > 0) {
                        const xPercent = Math.max(0, Math.min(100, (d.x / bgFit.width) * 100))
                        const yPercent = Math.max(0, Math.min(100, (d.y / bgFit.height) * 100))
                        updateLayerImageTransform(l.id, selectedImage.id, { x: xPercent, y: yPercent })
                      }
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      // Convert pixels to percentage and save
                      if (bgFit.width > 0 && bgFit.height > 0) {
                        const newWidth = parseInt(ref.style.width) || width
                        const newHeight = parseInt(ref.style.height) || height
                        const widthPercent = Math.max(5, Math.min(100, (newWidth / bgFit.width) * 100))
                        const heightPercent = Math.max(5, Math.min(100, (newHeight / bgFit.height) * 100))
                        const xPercent = Math.max(0, Math.min(100, (position.x / bgFit.width) * 100))
                        const yPercent = Math.max(0, Math.min(100, (position.y / bgFit.height) * 100))
                        updateLayerImageTransform(l.id, selectedImage.id, {
                          x: xPercent,
                          y: yPercent,
                          width: widthPercent,
                          height: heightPercent
                        })
                      }
                    }}
                    style={{
                      zIndex: background ? l.z + 1 : l.z,
                      border: isSelected ? '2px solid rgba(37,99,235,1)' : 'none',
                      boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
                      background: 'transparent',
                      pointerEvents: 'auto'
                    }}
                    bounds="parent"
                    minWidth={50}
                    minHeight={50}
                    lockAspectRatio={false}
                    enableResizing={isSelected ? {
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true
                    } : {
                      top: false,
                      right: false,
                      bottom: false,
                      left: false,
                      topRight: false,
                      bottomRight: false,
                      bottomLeft: false,
                      topLeft: false
                    }}
                    resizeHandleStyles={isSelected ? {
                      // Edge handles: centered on each side
                      top: {
                        width: '24px', height: '10px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        top: `${HANDLE_INSET}px`, left: '50%', transform: 'translate(-50%, 0)'
                      },
                      bottom: {
                        width: '24px', height: '10px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        bottom: `${HANDLE_INSET}px`, left: '50%', transform: 'translate(-50%, 0)'
                      },
                      left: {
                        width: '10px', height: '24px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        left: `${HANDLE_INSET}px`, top: '50%', transform: 'translate(0, -50%)'
                      },
                      right: {
                        width: '10px', height: '24px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        right: `${HANDLE_INSET}px`, top: '50%', transform: 'translate(0, -50%)'
                      },
                      // Corner handles: circles at corners
                      topLeft: {
                        width: '12px', height: '12px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        left: `${HANDLE_INSET}px`, top: `${HANDLE_INSET}px`
                      },
                      topRight: {
                        width: '12px', height: '12px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        right: `${HANDLE_INSET}px`, top: `${HANDLE_INSET}px`
                      },
                      bottomLeft: {
                        width: '12px', height: '12px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        left: `${HANDLE_INSET}px`, bottom: `${HANDLE_INSET}px`
                      },
                      bottomRight: {
                        width: '12px', height: '12px', background: '#fff', borderRadius: '9999px',
                        border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        right: `${HANDLE_INSET}px`, bottom: `${HANDLE_INSET}px`
                      }
                    } : undefined}
                  >
                    <div
                      className={`w-full h-full flex items-center justify-center bg-transparent ${isSelected ? 'cursor-move' : 'cursor-default'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedImage.secureUrl || selectedImage.previewUrl}
                        alt={l.name}
                        className="max-w-full max-h-full object-contain pointer-events-none select-none"
                        draggable={false}
                      />
                    </div>
                  </Rnd>
                )
              })}
            </div>
          </div>
          {/* Controls under the outer preview div */}
          <div className="mt-3 w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Portrait"
                onClick={() => setPreviewAspect('portrait')}
                className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs cursor-pointer ${previewAspect === 'portrait' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >9:16</button>
              <button
                type="button"
                title="Landscape"
                onClick={() => setPreviewAspect('landscape')}
                className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs cursor-pointer ${previewAspect === 'landscape' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >16:9</button>
              <button
                type="button"
                title="Square"
                onClick={() => setPreviewAspect('square')}
                className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs cursor-pointer ${previewAspect === 'square' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >1:1</button>
            </div>
            <Button variant="outline" className="rounded-full px-4 py-1 cursor-pointer" onClick={() => setShowFullPreview(true)}>Preview</Button>
          </div>
        </div>
        <div className={previewAspect === 'landscape' ? 'md:col-span-2' : 'md:col-span-3'}>
          {/* Background controls */}
          <div className="border rounded-xl bg-white p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-800">Background (Optional)</div>
              {background && (
                <Button variant="outline" onClick={removeBackground} className="cursor-pointer">Remove</Button>
              )}
            </div>
            {background && (background.secureUrl || background.previewUrl) ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border rounded-md overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={background.secureUrl || background.previewUrl} alt="Background" className="w-full h-full object-contain" />
                </div>
                <div className="text-xs text-gray-600">Rendered behind all layers.</div>
              </div>
            ) : (
              <label className="inline-flex items-center justify-center px-3 py-2 border-2 border-dashed rounded-md text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
                Upload Background
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBackgroundFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
          <div className="text-xs text-gray-600 mb-2">Min {LAYER_MIN}, Max {LAYER_MAX}. Current: {layers.length}</div>
          {layers.map((layer, idx) => (
            <Fragment key={layer.id}>
              {overIndex === idx && (
                <div className="h-2 rounded bg-[rgba(38,116,186,0.3)] border border-[rgba(38,116,186,0.5)] mb-2" />
              )}
              <div
                className={`border rounded-xl bg-white ${dragIndex === idx ? 'opacity-70' : ''} ${selectedLayerId === layer.id ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <div
                  className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-t-xl cursor-move"
                  draggable
                  onDragStart={(e) => { setDragIndex(idx); setOverIndex(idx); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch { } }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move'
                    if (dragIndex === null) return
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const isBefore = e.clientY < rect.top + rect.height / 2
                    let targetIndex = isBefore ? idx : idx + 1
                    if (targetIndex < 0) targetIndex = 0
                    if (targetIndex > layers.length) targetIndex = layers.length
                    setOverIndex(targetIndex)
                  }}
                  onDrop={(e) => { e.preventDefault(); if (dragIndex !== null && overIndex !== null) { let to = overIndex; if (dragIndex < to) to = to - 1; if (to !== dragIndex) moveLayer(dragIndex, to) } setDragIndex(null); setOverIndex(null) }}
                  onDragEnd={() => { if (dragIndex !== null && overIndex !== null) { let to = overIndex; if (dragIndex < to) to = to - 1; if (to !== dragIndex) moveLayer(dragIndex, to) } setDragIndex(null); setOverIndex(null) }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <span className="truncate max-w-[20ch]">{layer.name || `Layer ${idx + 1}`}</span>

                    </div>
                    {layer.description ? (
                      <div className="text-xs text-gray-500 truncate max-w-[25ch]">{layer.description}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)) }}
                      className="w-7 h-7 border rounded-md flex items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-600"
                      title={layer.visible !== false ? "Hide layer" : "Show layer"}
                    >
                      {layer.visible !== false ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.44 0 .87-.03 1.28-.09" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                      )}
                    </button>
                    <Button variant="outline" onClick={() => removeLayer(layer.id)} className="cursor-pointer">Remove</Button>
                    <button
                      type="button"
                      aria-label="Toggle layer"
                      onClick={() => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, open: !l.open } : l))}
                      className="w-7 h-7 border rounded-md flex items-center justify-center cursor-pointer"
                    >
                      <span className={`transition-transform ${layer.open ? 'rotate-180' : ''}`}>﹀</span>
                    </button>
                  </div>
                </div>
                {layer.open && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Layer Name <span className="text-red-500">*</span></label>
                        <input value={layer.name} onChange={(e) => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l))} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">Description (Optional)</label>
                        <input value={layer.description || ''} onChange={(e) => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, description: e.target.value } : l))} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Images</div>
                      <div className="flex flex-wrap gap-3">
                        {layer.images.map(img => {
                          const isSelected = selectedImageIds[layer.id] === img.id || (!selectedImageIds[layer.id] && layer.images[0]?.id === img.id)
                          return (
                            <div key={img.id} className="relative group">
                              <div
                                className={`w-20 h-20 rounded-md border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                onClick={() => selectImage(layer.id, img.id)}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.secureUrl || img.previewUrl} alt="layer" className="w-full h-full object-contain rounded-md" />
                              </div>
                              {layer.layer_type === 'text' && (
                                <button
                                  onClick={() => openLayerTextModal(layer.id, { imageId: img.id })}
                                  className="absolute -top-2 -left-2 w-5 h-5 bg-blue-500 text-white rounded-full text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-blue-600 cursor-pointer flex items-center justify-center z-10"
                                  title="Edit text"
                                >
                                  ✎
                                </button>
                              )}
                              <button
                                onClick={() => removeImageFromLayer(layer.id, img.id)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer z-10"
                              >
                                ×
                              </button>
                              {layer.layer_type === 'text' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); duplicateLayerImage(layer.id, img.id) }}
                                  className="absolute -bottom-2 -right-2 w-5 h-5 bg-green-500 text-white rounded-full text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-green-600 cursor-pointer flex items-center justify-center z-10"
                                  title="Duplicate"
                                >
                                  ⧉
                                </button>
                              )}
                              <input
                                type="text"
                                value={img.name || ''}
                                onChange={(e) => updateImageName(layer.id, img.id, e.target.value)}
                                className="w-20 mt-1 text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Image name"
                              />
                            </div>
                          )
                        })}
                        <div
                          data-layer-add-menu
                          className="relative w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center text-gray-400 cursor-pointer hover:border-gray-300 transition-colors"
                          onDrop={(e) => {
                            e.preventDefault()
                            setLayerAddMenu(null)
                            addImagesToLayer(layer.id, e.dataTransfer.files)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'copy'
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('bg-blue-50', 'border-blue-300')
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300')
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            const hasTextOnly = layer.images.length > 0 && layer.images.every(img => (img.sourceType ?? 'upload') === 'text')
                            const hasImageOnly = layer.images.length === 0 || layer.images.every(img => (img.sourceType ?? 'upload') !== 'text')
                            if (hasTextOnly) {
                              openLayerTextModal(layer.id)
                              return
                            }
                            if (hasImageOnly) {
                              setLayerAddMenu(null)
                              promptLayerImageUpload(layer.id)
                              return
                            }
                            setLayerAddMenu(prev => prev === layer.id ? null : layer.id)
                          }}
                          title="Add more content"
                        >
                          <span className="text-2xl leading-none">+</span>
                          {layerAddMenu === layer.id && (
                            <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-2 w-36 rounded-md border border-gray-200 bg-white shadow-lg p-2 space-y-1">
                              <button
                                type="button"
                                className="w-full text-xs px-2 py-1 rounded-md text-left hover:bg-gray-100 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLayerAddMenu(null)
                                  promptLayerImageUpload(layer.id)
                                }}
                              >
                                Upload image(s)
                              </button>
                              <button
                                type="button"
                                className="w-full text-xs px-2 py-1 rounded-md text-left hover:bg-gray-100 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openLayerTextModal(layer.id)
                                }}
                              >
                                Add text
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="px-4 py-2 text-xs text-gray-500 border-t">Drag and drop layers to reorder.</div>
              </div>
              {idx === layers.length - 1 && overIndex === layers.length && (
                <div className="h-2 rounded bg-[rgba(38,116,186,0.3)] border border-[rgba(38,116,186,0.5)] mt-2" />
              )}
            </Fragment>
          ))}

          {layers.length === 0 && (
            <div className="text-sm text-gray-500">No layers added yet. Click &quot;Add New Layer&quot; to begin.</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { if (!draftSaving) { setShowModal(false); resetDraftState(); } }}>
          <div className={`bg-white rounded-2xl shadow-2xl ${draftType === 'text' ? 'w-full max-w-6xl h-[90vh] max-h-[90vh] flex flex-col' : 'w-full max-w-2xl'}`} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b font-semibold">Add New {draftType === 'image' ? 'Image' : 'Text'} Layer</div>
            <div className={draftType === 'text' ? 'flex-1 flex flex-col overflow-hidden p-5 gap-4' : 'p-5 space-y-5 overflow-y-auto max-h-[70vh] pr-1'}>
              {draftType === 'image' ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Layer Name <span className="text-red-500">*</span></label>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Description (Optional)</label>
                    <input
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                    />
                  </div>
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-[rgba(38,116,186,1)] hover:bg-blue-50 transition-colors"
                    onClick={() => document.getElementById('draft-file-input')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleDraftFiles(e.dataTransfer.files)
                    }}
                  >
                    <div className="text-sm text-[rgba(38,116,186,1)]">Drag And Drop</div>
                    <div className="text-[10px] text-gray-500">Supports JPG, PNG (Max 10MB Each)</div>
                    <div className="mt-3 text-sm text-gray-600">Click anywhere to select files</div>
                    <input
                      id="draft-file-input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleDraftFiles(e.target.files)}
                      className="hidden"
                    />
                    {draftImages.length > 0 && (
                      <div className="mt-3 flex gap-3 flex-wrap justify-center">
                        {draftImages.map(img => (
                          <div key={img.id} className="relative group flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                            <div className="w-20 h-20 border rounded-md overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.previewUrl} alt="preview" className="w-full h-full object-contain" />
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeDraftImage(img.id) }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                              aria-label="Remove image"
                            >
                              ×
                            </button>
                            <input
                              type="text"
                              value={img.name || ''}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onFocus={(e) => e.stopPropagation()}
                              onChange={(e) => setDraftImages(prev => prev.map(draftImg =>
                                draftImg.id === img.id ? { ...draftImg, name: e.target.value } : draftImg
                              ))}
                              className="w-20 mt-1 text-xs px-1 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Name"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Top - Layer Info */}
                  <div className="flex-shrink-0 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Layer Name <span className="text-red-500">*</span></label>
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Description (Optional)</label>
                      <input
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                      />
                    </div>
                  </div>

                  {/* Middle - Main Content */}
                  <div className="flex-1 flex overflow-hidden gap-6">
                    {/* Left Side - Text Input & Preview */}
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                      <div className="flex-shrink-0 flex flex-col gap-2">
                        <label className="block text-sm font-semibold text-gray-800">Text Content <span className="text-red-500">*</span></label>

                        {/* Rich Text Toolbar */}
                        <div className="flex flex-wrap items-center gap-2 p-2 border rounded-t-lg bg-gray-50">
                          <select
                            className="text-xs border rounded px-1 py-1"
                            onChange={(e) => {
                              document.execCommand('fontName', false, e.target.value)
                            }}
                            value={draftTextFont} // This might not reflect selection perfectly without complex sync
                          >
                            {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <div className="flex items-center border rounded bg-white overflow-hidden">
                            <button className="px-2 py-1 hover:bg-gray-100 font-bold" onClick={() => document.execCommand('bold')} title="Bold">B</button>
                            <button className="px-2 py-1 hover:bg-gray-100 italic" onClick={() => document.execCommand('italic')} title="Italic">I</button>

                          </div>
                          <input
                            type="color"
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                            onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                            title="Text Color"
                          />
                          {/* Helper to clear formatting */}
                          <button className="text-xs px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('removeFormat')} title="Clear Formatting">Clear</button>
                        </div>

                        {/* Content Editable Area */}
                        <div
                          ref={draftTextEditorRef}
                          className="w-full rounded-b-lg border border-t-0 border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] h-32 overflow-y-auto text-base bg-white"
                          contentEditable
                          onInput={(e) => {
                            const target = e.currentTarget
                            setDraftHtmlContent(target.innerHTML)
                            // Use innerText to capture newlines as \n
                            setDraftText(target.innerText)
                            setDraftError(null)
                          }}
                          onBlur={(e) => {
                            // Ensure we persist the text with newlines
                            setDraftText(e.currentTarget.innerText)
                          }}
                          style={{
                            fontFamily: draftTextFont, // Default font
                            fontSize: '16px', // Fixed size for editing
                            fontWeight: draftTextWeight, // Default weight
                            color: draftTextColor, // Default color
                          }}
                        />
                        <div className="text-xs text-gray-500">
                          Tip: Select text to apply specific styles. Global styles below apply to the container.
                        </div>
                      </div>

                      {/* Preview Section */}
                      <div className="flex-1 flex flex-col overflow-hidden gap-2">
                        <label className="block text-sm font-semibold text-gray-800">Preview (This is how it will look when saved)</label>
                        <div className="flex-1 bg-gray-50 rounded-lg p-6 border border-gray-200 overflow-auto flex items-center justify-center">
                          {(draftHtmlContent || draftText) ? (
                            <TextLayerPreview
                              ref={(el) => { draftTextPreviewRef.current = el }}
                              text={draftText}
                              html={draftHtmlContent}
                              color={draftTextColor}
                              fontWeight={draftTextWeight}
                              fontSize={draftTextSize}
                              fontFamily={draftTextFont}
                              backgroundColor={draftTextBackgroundColor}
                              backgroundRadius={draftTextBackgroundRadius}
                              textAlign={draftTextAlign}
                              letterSpacing={draftTextLetterSpacing}
                              fontStyle={draftTextFontStyle}
                              textDecoration={draftTextDecoration}
                              textOpacity={draftTextOpacity}
                              textRotation={draftTextRotation}
                              shadowColor={draftTextShadowColor}
                              shadowBlur={draftTextShadowBlur}
                              shadowOffsetX={draftTextShadowOffsetX}
                              shadowOffsetY={draftTextShadowOffsetY}
                              strokeColor={draftTextStrokeColor}
                              strokeWidth={draftTextStrokeWidth}
                            />
                          ) : (
                            <div className="text-gray-400 text-sm">Your text preview will appear here</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Designing Tools */}
                    <div className="w-80 overflow-y-auto pr-2 flex flex-col gap-5">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 mb-4">Text Styling</h4>
                        <div className="space-y-4">
                          {/* Color */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={draftTextColor}
                                onChange={(e) => setDraftTextColor(e.target.value)}
                                className="w-12 h-12 rounded-2xl cursor-pointer flex-shrink-0"
                              />
                              <input
                                type="text"
                                value={draftTextColor}
                                onChange={(e) => setDraftTextColor(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-500 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                                placeholder="#000000"
                              />
                            </div>
                          </div>

                          {/* Font Weight */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Font Weight</label>
                            <select
                              value={draftTextWeight}
                              onChange={(e) => setDraftTextWeight(e.target.value as '300' | '400' | '600' | '700')}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                            >
                              <option value="300">Light (300)</option>
                              <option value="400">Regular (400)</option>
                              <option value="600">Semi Bold (600)</option>
                              <option value="700">Bold (700)</option>
                            </select>
                          </div>

                          {/* Font Family */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                            <select
                              value={draftTextFont}
                              onChange={(e) => setDraftTextFont(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                            >
                              {FONT_OPTIONS.map(font => (
                                <option key={font} value={font}>{font}</option>
                              ))}
                            </select>
                          </div>

                          {/* Font Size */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Font Size: <span className="font-semibold text-[rgba(38,116,186,1)]">{draftTextSize}px</span>
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="12"
                                max="100"
                                value={draftTextSize}
                                onChange={(e) => setDraftTextSize(Number(e.target.value))}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                              />
                              <input
                                type="number"
                                min="12"
                                max="100"
                                value={draftTextSize}
                                onChange={(e) => setDraftTextSize(Number(e.target.value))}
                                className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Background & Stroke Effects */}
                      <div className="border-t pt-4">
                        <h5 className="text-sm font-bold text-gray-900 mb-3">Background & Stroke</h5>

                        {/* Background Color */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">Background Color</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={draftTextBackgroundColor || "#ffffff"}
                              onChange={(e) => setDraftTextBackgroundColor(e.target.value)}
                              className="w-12 h-12 rounded-2xl cursor-pointer flex-shrink-0 hover:border-[rgba(38,116,186,1)] transition-colors"
                            />
                            <div className="text-xs flex-1 flex flex-col gap-1">
                              <p className="text-gray-700 font-medium text-xs">{draftTextBackgroundColor || "No bg"}</p>
                              <button
                                onClick={() => setDraftTextBackgroundColor("")}
                                className="text-xs text-red-500 hover:text-red-700 underline text-left"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Background Radius */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">
                            Background Radius: <span className="text-[rgba(38,116,186,1)]">{draftTextBackgroundRadius}px</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={draftTextBackgroundRadius}
                            onChange={(e) => setDraftTextBackgroundRadius(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                        </div>

                        {/* Stroke Color */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">Stroke Color</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={draftTextStrokeColor || "#000000"}
                              onChange={(e) => setDraftTextStrokeColor(e.target.value)}
                              className="w-12 h-12 rounded-2xl cursor-pointer flex-shrink-0 hover:border-[rgba(38,116,186,1)] transition-colors"
                            />
                            <div className="text-xs flex-1">
                              <p className="text-gray-700 font-medium text-xs">{draftTextStrokeColor || "#000000"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Stroke Width */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">
                            Stroke Width: <span className="text-[rgba(38,116,186,1)]">{draftTextStrokeWidth}px</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={draftTextStrokeWidth}
                            onChange={(e) => setDraftTextStrokeWidth(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                        </div>

                        {/* Letter Spacing */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">
                            Letter Spacing: <span className="text-[rgba(38,116,186,1)]">{draftTextLetterSpacing}px</span>
                          </label>
                          <input
                            type="range"
                            min="-5"
                            max="50"
                            value={draftTextLetterSpacing}
                            onChange={(e) => setDraftTextLetterSpacing(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                        </div>

                        {/* Text Shadow */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">Text Shadow</label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={draftTextShadowColor || "#000000"}
                                onChange={(e) => setDraftTextShadowColor(e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer flex-shrink-0"
                              />
                              <div className="text-xs text-gray-600">Shadow Color</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] text-gray-500">Blur</label>
                                <input
                                  type="number"
                                  value={draftTextShadowBlur}
                                  onChange={(e) => setDraftTextShadowBlur(Number(e.target.value))}
                                  className="w-full border rounded px-1 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500">X Offset</label>
                                <input
                                  type="number"
                                  value={draftTextShadowOffsetX}
                                  onChange={(e) => setDraftTextShadowOffsetX(Number(e.target.value))}
                                  className="w-full border rounded px-1 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500">Y Offset</label>
                                <input
                                  type="number"
                                  value={draftTextShadowOffsetY}
                                  onChange={(e) => setDraftTextShadowOffsetY(Number(e.target.value))}
                                  className="w-full border rounded px-1 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Global Font Style & Decoration */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">Global Style</label>
                          <div className="flex gap-2">
                            <button
                              className={`flex-1 py-1 text-xs border rounded ${draftTextFontStyle === 'italic' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                              onClick={() => setDraftTextFontStyle(prev => prev === 'italic' ? 'normal' : 'italic')}
                            >
                              Italic
                            </button>

                          </div>
                        </div>

                        {/* Text Alignment */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">Text Alignment</label>
                          <div className="flex gap-2">
                            <button
                              className={`flex-1 py-1 text-xs border rounded ${draftTextAlign === 'left' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                              onClick={() => setDraftTextAlign('left')}
                            >
                              Left
                            </button>
                            <button
                              className={`flex-1 py-1 text-xs border rounded ${draftTextAlign === 'center' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                              onClick={() => setDraftTextAlign('center')}
                            >
                              Center
                            </button>
                            <button
                              className={`flex-1 py-1 text-xs border rounded ${draftTextAlign === 'right' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                              onClick={() => setDraftTextAlign('right')}
                            >
                              Right
                            </button>
                          </div>
                        </div>

                        {/* Opacity */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">
                            Opacity: <span className="text-[rgba(38,116,186,1)]">{draftTextOpacity}%</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={draftTextOpacity}
                            onChange={(e) => setDraftTextOpacity(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                        </div>

                        {/* Rotation */}
                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-800 mb-2">
                            Rotation: <span className="text-[rgba(38,116,186,1)]">{draftTextRotation}°</span>
                          </label>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            value={draftTextRotation}
                            onChange={(e) => setDraftTextRotation(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {draftError && (
                <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                  {draftError}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetDraftState} disabled={draftSaving} className="cursor-pointer">Cancel</Button>
                {/* {draftType === 'text' && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const baseName = (draftName || draftText).split('\n')[0].trim() || 'Text Layer'
                        const { file } = await renderTextLayerImage({
                          text: draftText,
                          html: draftHtmlContent,
                          color: draftTextColor,
                          fontWeight: draftTextWeight,
                          fontSize: draftTextSize,
                          fontFamily: draftTextFont,
                          fileBaseName: baseName,
                          backgroundColor: draftTextBackgroundColor,
                          backgroundRadius: draftTextBackgroundRadius,
                          strokeColor: draftTextStrokeColor,
                          strokeWidth: draftTextStrokeWidth,
                          letterSpacing: draftTextLetterSpacing,
                          shadowColor: draftTextShadowColor,
                          shadowBlur: draftTextShadowBlur,
                          shadowOffsetX: draftTextShadowOffsetX,
                          shadowOffsetY: draftTextShadowOffsetY,
                          fontStyle: draftTextFontStyle,
                          textDecoration: draftTextDecoration,
                          textAlign: draftTextAlign,
                          textOpacity: draftTextOpacity,
                          textRotation: draftTextRotation,
                        })
                        const url = URL.createObjectURL(file)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `debug-${baseName}.png`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      } catch (e) {
                        console.error('Debug download failed', e)
                      }
                    }}
                    className="cursor-pointer border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    Download PNG
                  </Button>
                )} */}
              </div>
              <Button
                className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => void saveLayer()}
                disabled={
                  draftSaving ||
                  layers.length >= LAYER_MAX ||
                  (draftType === 'image' ? draftImages.length === 0 : !draftText.trim())
                }
              >
                {draftSaving ? 'Saving...' : layers.length >= LAYER_MAX ? 'Max layers reached' : 'Save Layer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showLayerTextModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { if (!layerTextSaving) { closeLayerTextModal(); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b font-semibold">Edit Text Layer</div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden gap-6 p-5">

              {/* Left Side - Text Input & Preview */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex-shrink-0 flex flex-col gap-2">
                  <label className="block text-sm font-semibold text-gray-800">Text Content <span className="text-red-500">*</span></label>

                  {/* Rich Text Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 p-2 border rounded-t-lg bg-gray-50">
                    <select
                      className="text-xs border rounded px-1 py-1"
                      onChange={(e) => {
                        document.execCommand('fontName', false, e.target.value)
                      }}
                      value={layerTextFont}
                    >
                      {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="flex items-center border rounded bg-white overflow-hidden">
                      <button className="px-2 py-1 hover:bg-gray-100 font-bold" onClick={() => document.execCommand('bold')} title="Bold">B</button>
                      <button className="px-2 py-1 hover:bg-gray-100 italic" onClick={() => document.execCommand('italic')} title="Italic">I</button>

                    </div>
                    <input
                      type="color"
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                      onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                      title="Text Color"
                    />
                    <button className="text-xs px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('removeFormat')} title="Clear Formatting">Clear</button>
                  </div>

                  {/* Content Editable Area */}
                  <div
                    ref={layerTextEditorRef}
                    className="w-full rounded-b-lg border border-t-0 border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] h-32 overflow-y-auto text-base bg-white"
                    contentEditable
                    onInput={(e) => {
                      const target = e.currentTarget
                      setLayerHtmlContent(target.innerHTML)
                      // Use innerText to capture newlines as \n
                      setLayerTextValue(target.innerText)
                      setLayerTextError(null)
                    }}
                    onBlur={(e) => {
                      // Ensure we persist the text with newlines
                      setLayerTextValue(e.currentTarget.innerText)
                    }}
                    style={{
                      fontFamily: layerTextFont,
                      fontSize: '16px',
                      fontWeight: layerTextWeight,
                      color: layerTextColor,
                    }}
                  />
                  <div className="text-xs text-gray-500">
                    Tip: Select text to apply specific styles. Global styles below apply to the container.
                  </div>
                </div>

                {/* Preview Section */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Preview (This is how it will look when saved)</label>
                  <div className="flex-1 bg-gray-50 rounded-lg p-6 border border-gray-200 overflow-auto flex items-center justify-center">
                    {(layerHtmlContent || layerTextValue) ? (
                      <TextLayerPreview
                        ref={(el) => { layerTextPreviewRef.current = el }}
                        text={layerTextValue}
                        html={layerHtmlContent}
                        color={layerTextColor}
                        fontWeight={layerTextWeight}
                        fontSize={layerTextSize}
                        fontFamily={layerTextFont}
                        backgroundColor={layerTextBackgroundColor}
                        backgroundRadius={layerTextBackgroundRadius}
                        textAlign={layerTextAlign}
                        letterSpacing={layerTextLetterSpacing}
                        fontStyle={layerTextFontStyle}
                        textDecoration={layerTextDecoration}
                        textOpacity={layerTextOpacity}
                        textRotation={layerTextRotation}
                        shadowColor={layerTextShadowColor}
                        shadowBlur={layerTextShadowBlur}
                        shadowOffsetX={layerTextShadowOffsetX}
                        shadowOffsetY={layerTextShadowOffsetY}
                        strokeColor={layerTextStrokeColor}
                        strokeWidth={layerTextStrokeWidth}
                      />
                    ) : (
                      <div className="text-gray-400 text-sm">Your text preview will appear here</div>
                    )}
                  </div>
                </div>

                {layerTextError && (
                  <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200 flex-shrink-0">
                    {layerTextError}
                  </div>
                )}
              </div>

              {/* Right Side - Designing Tools */}
              <div className="w-80 overflow-y-auto pr-2 flex flex-col gap-5">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">Text Styling</h4>
                  <div className="space-y-4">
                    {/* Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={layerTextColor}
                          onChange={(e) => setLayerTextColor(e.target.value)}
                          className="w-12 h-12 rounded-2xl cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={layerTextColor}
                          onChange={(e) => setLayerTextColor(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-500 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                          placeholder="#000000"
                        />
                      </div>
                    </div>

                    {/* Font Weight */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Font Weight</label>
                      <select
                        value={layerTextWeight}
                        onChange={(e) => setLayerTextWeight(e.target.value as '300' | '400' | '600' | '700')}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                      >
                        <option value="300">Light (300)</option>
                        <option value="400">Regular (400)</option>
                        <option value="600">Semi Bold (600)</option>
                        <option value="700">Bold (700)</option>
                      </select>
                    </div>

                    {/* Font Family */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                      <select
                        value={layerTextFont}
                        onChange={(e) => setLayerTextFont(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                      >
                        {FONT_OPTIONS.map(font => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </select>
                    </div>

                    {/* Font Size */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Font Size: <span className="font-semibold text-[rgba(38,116,186,1)]">{layerTextSize}px</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="12"
                          max="120"
                          value={layerTextSize}
                          onChange={(e) => setLayerTextSize(Number(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <input
                          type="number"
                          min="12"
                          max="120"
                          value={layerTextSize}
                          onChange={(e) => setLayerTextSize(Number(e.target.value))}
                          className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Background & Stroke Effects */}
                <div className="border-t pt-4">
                  <h5 className="text-sm font-bold text-gray-900 mb-3">Background & Stroke</h5>

                  {/* Background Color */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Background Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={layerTextBackgroundColor || "#ffffff"}
                        onChange={(e) => setLayerTextBackgroundColor(e.target.value)}
                        className="w-12 h-12 rounded-2xl cursor-pointer flex-shrink-0 hover:border-[rgba(38,116,186,1)] transition-colors"
                      />
                      <div className="text-xs flex-1 flex flex-col gap-1">
                        <p className="text-gray-700 font-medium text-xs">{layerTextBackgroundColor || "No bg"}</p>
                        <button
                          onClick={() => setLayerTextBackgroundColor("")}
                          className="text-xs text-red-500 hover:text-red-700 underline text-left"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Background Radius */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Background Radius: <span className="text-[rgba(38,116,186,1)]">{layerTextBackgroundRadius}px</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={layerTextBackgroundRadius}
                      onChange={(e) => setLayerTextBackgroundRadius(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* Stroke Color */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Stroke Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={layerTextStrokeColor || "#000000"}
                        onChange={(e) => setLayerTextStrokeColor(e.target.value)}
                        className="w-12 h-12 rounded-2xl cursor-pointer flex-shrink-0 hover:border-[rgba(38,116,186,1)] transition-colors"
                      />
                      <div className="text-xs flex-1">
                        <p className="text-gray-700 font-medium text-xs">{layerTextStrokeColor || "#000000"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stroke Width */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Stroke Width: <span className="text-[rgba(38,116,186,1)]">{layerTextStrokeWidth}px</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={layerTextStrokeWidth}
                      onChange={(e) => setLayerTextStrokeWidth(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* Letter Spacing */}
                  <div className="mb-4 mt-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Letter Spacing: <span className="text-[rgba(38,116,186,1)]">{layerTextLetterSpacing}px</span>
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="50"
                      value={layerTextLetterSpacing}
                      onChange={(e) => setLayerTextLetterSpacing(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* Text Shadow */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Text Shadow</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={layerTextShadowColor || "#000000"}
                          onChange={(e) => setLayerTextShadowColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer flex-shrink-0"
                        />
                        <div className="text-xs text-gray-600">Shadow Color</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500">Blur</label>
                          <input
                            type="number"
                            value={layerTextShadowBlur}
                            onChange={(e) => setLayerTextShadowBlur(Number(e.target.value))}
                            className="w-full border rounded px-1 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">X Offset</label>
                          <input
                            type="number"
                            value={layerTextShadowOffsetX}
                            onChange={(e) => setLayerTextShadowOffsetX(Number(e.target.value))}
                            className="w-full border rounded px-1 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">Y Offset</label>
                          <input
                            type="number"
                            value={layerTextShadowOffsetY}
                            onChange={(e) => setLayerTextShadowOffsetY(Number(e.target.value))}
                            className="w-full border rounded px-1 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Global Font Style & Decoration */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Global Style</label>
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 py-1 text-xs border rounded ${layerTextFontStyle === 'italic' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                        onClick={() => setLayerTextFontStyle(prev => prev === 'italic' ? 'normal' : 'italic')}
                      >
                        Italic
                      </button>

                    </div>
                  </div>

                  {/* Text Alignment */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Text Alignment</label>
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 py-1 text-xs border rounded ${layerTextAlign === 'left' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                        onClick={() => setLayerTextAlign('left')}
                      >
                        Left
                      </button>
                      <button
                        className={`flex-1 py-1 text-xs border rounded ${layerTextAlign === 'center' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                        onClick={() => setLayerTextAlign('center')}
                      >
                        Center
                      </button>
                      <button
                        className={`flex-1 py-1 text-xs border rounded ${layerTextAlign === 'right' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                        onClick={() => setLayerTextAlign('right')}
                      >
                        Right
                      </button>
                    </div>
                  </div>

                  {/* Opacity */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Opacity: <span className="text-[rgba(38,116,186,1)]">{layerTextOpacity}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={layerTextOpacity}
                      onChange={(e) => setLayerTextOpacity(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* Rotation */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Rotation: <span className="text-[rgba(38,116,186,1)]">{layerTextRotation}°</span>
                    </label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={layerTextRotation}
                      onChange={(e) => setLayerTextRotation(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[rgba(38,116,186,1)] [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t flex justify-end gap-3 flex-shrink-0">
              {/* <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const baseName = layerTextValue.split('\n')[0].trim() || 'Text'
                    const { file } = await renderTextLayerImage({
                      text: layerTextValue,
                      html: layerHtmlContent,
                      color: layerTextColor,
                      fontWeight: layerTextWeight,
                      fontSize: layerTextSize,
                      fontFamily: layerTextFont,
                      fileBaseName: baseName,
                      backgroundColor: layerTextBackgroundColor,
                      backgroundRadius: layerTextBackgroundRadius,
                      strokeColor: layerTextStrokeColor,
                      strokeWidth: layerTextStrokeWidth,
                      letterSpacing: layerTextLetterSpacing,
                      shadowColor: layerTextShadowColor,
                      shadowBlur: layerTextShadowBlur,
                      shadowOffsetX: layerTextShadowOffsetX,
                      shadowOffsetY: layerTextShadowOffsetY,
                      fontStyle: layerTextFontStyle,
                      textDecoration: layerTextDecoration,
                      textAlign: layerTextAlign,
                      textOpacity: layerTextOpacity,
                      textRotation: layerTextRotation,
                    })
                    const url = URL.createObjectURL(file)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `debug-${baseName}.png`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  } catch (e) {
                    console.error('Debug download failed', e)
                  }
                }}
                className="cursor-pointer border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Download PNG
              </Button> */}
              <Button variant="outline" onClick={closeLayerTextModal} disabled={layerTextSaving} className="cursor-pointer">Cancel</Button>
              <Button
                className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] cursor-pointer"
                onClick={() => void saveLayerTextToExistingLayer()}
                disabled={layerTextSaving || !layerTextValue.trim()}
              >
                {layerTextSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Fullscreen Preview Modal */}
      {
        showFullPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowFullPreview(false)} />
            <div className="relative bg-white rounded-xl w-full max-w-5xl shadow-xl p-4 z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-800">Preview</div>
                <Button variant="outline" onClick={() => setShowFullPreview(false)} className="cursor-pointer">Close</Button>
              </div>
              <LargePreview background={background} layers={layers} aspect={previewAspect} />
            </div>
          </div>
        )
      }

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full cursor-pointer px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
        <Button
          className="rounded-full cursor-pointer px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto"
          onClick={handleNext}
          disabled={nextLoading || layers.length < LAYER_MIN}
        >
          {nextLoading ? 'Uploading...' : (layers.length < LAYER_MIN ? `Add at least ${LAYER_MIN}` : 'Save & Next')}
        </Button>
      </div>
    </div >
  )
}
