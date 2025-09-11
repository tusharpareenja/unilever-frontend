"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { uploadImages } from "@/lib/api/StudyAPI"

interface ElementItem {
  id: string
  name: string
  description: string
  file?: File
  previewUrl?: string
  secureUrl?: string
}

interface Step5StudyStructureProps {
  onNext: () => void
  onBack: () => void
  mode?: "grid" | "layer"
}

export function Step5StudyStructure({ onNext, onBack, mode = "grid" }: Step5StudyStructureProps) {
  const [elements, setElements] = useState<ElementItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [nextLoading, setNextLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Hydrate GRID elements from localStorage on mount
  useEffect(() => {
    if (mode !== 'grid') return
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('cs_step5_grid')
      if (!raw) return
      const arr = JSON.parse(raw) as Array<Partial<ElementItem>>
      const restored: ElementItem[] = (arr || []).map((e, idx) => ({
        id: e.id || crypto.randomUUID(),
        name: e.name || `Element ${idx + 1}`,
        description: e.description || "",
        previewUrl: e.previewUrl,
        secureUrl: e.secureUrl,
      }))
      if (restored.length > 0) setElements(restored)
    } catch {}
  // run once per mode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(async (file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      const newItem: ElementItem = { id: tempId, name: `Element ${elements.length + 1}`, description: "", file, previewUrl: url }
      // add immediately
      setElements(prev => [...prev, newItem])
      // start upload for this single file and patch result as soon as it arrives
      try {
        const res = await uploadImages([file])
        const secure = res?.[0]?.secure_url
        if (secure) {
          setElements(prev => prev.map(e => e.id === tempId ? { ...e, secureUrl: secure } : e))
        }
      } catch (e) {
        // keep preview only
        console.error('Upload failed for file', e)
      }
    })
  }

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id))
  }

  const updateElement = (id: string, patch: Partial<ElementItem>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  // persist grid elements
  useEffect(() => {
    if (mode !== 'grid') return
    if (typeof window === 'undefined') return
    const minimal = elements.map(e => ({ 
      id: e.id, 
      name: e.name, 
      description: e.description, 
      previewUrl: e.previewUrl,
      secureUrl: e.secureUrl 
    }))
    localStorage.setItem('cs_step5_grid', JSON.stringify(minimal))
  }, [elements, mode])

  // Ensure all grid elements have secureUrl (upload pending ones)
  const ensureGridUploads = async () => {
    const pending = elements.filter(e => !e.secureUrl && e.file)
    if (pending.length === 0) return
    const files = pending.map(p => p.file!)
    try {
      const results = await uploadImages(files)
      setElements(prev => prev.map(el => {
        const i = pending.findIndex(p => p.id === el.id)
        if (i !== -1) return { ...el, secureUrl: results[i]?.secure_url || el.secureUrl }
        return el
      }))
    } catch (e) {
      console.error('ensureGridUploads error', e)
    }
  }

  const handleNext = async () => {
    setNextLoading(true)
    await Promise.all([
      ensureGridUploads(),
      new Promise(res => setTimeout(res, 1500)),
    ])
    setNextLoading(false)
    onNext()
  }

  if (mode === "layer") {
    return (
      <LayerMode onNext={onNext} onBack={onBack} />
    )
  }

  return (
    <div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Study Elements</h3>
        <p className="text-sm text-gray-600">Configure the elements that respondents will evaluate in your study.</p>
      </div>

      <div
        className="mt-5 border-2 border-dashed rounded-xl p-8 text-center bg-slate-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="mx-auto w-12 h-12 rounded-full border flex items-center justify-center text-gray-500">📁</div>
        <div className="mt-3 text-sm text-[rgba(38,116,186,1)] font-medium">Drag And Drop</div>
        <div className="text-[10px] text-gray-500">Supports JPG, PNG, GIF (Max 10MB Each)</div>
        <div className="mt-4">
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => inputRef.current?.click()}>Browse Files</Button>
        </div>
      </div>

      {elements.length > 0 && (
        <div className="mt-6">
          <div className="rounded-md bg-blue-50 border border-blue-100 text-xs text-blue-700 px-3 py-2">
            Drag and drop elements to reorder them. The order will be preserved in your study.
          </div>

          <div className="mt-5 space-y-5">
            {elements.map((el, idx) => (
              <div key={el.id} className="border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm text-gray-700">
                  <div>Elements {idx + 1}</div>
                  <Button variant="outline" onClick={() => removeElement(el.id)} className="px-3 py-1">Remove</Button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    {el.previewUrl ? (
                      <div className="w-full h-40 bg-gray-100 flex items-center justify-center p-2 rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={el.previewUrl} alt={el.name} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-full h-40 rounded-lg border border-dashed flex items-center justify-center text-gray-400">No Image</div>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Elements Name <span className="text-red-500">*</span></label>
                      <input
                        value={el.name}
                        onChange={(e) => updateElement(el.id, { name: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Elements Description</label>
                      <textarea
                        value={el.description}
                        onChange={(e) => updateElement(el.id, { description: e.target.value })}
                        className="w-full min-h-[90px] rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
        <Button
          className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto"
          onClick={handleNext}
          disabled={nextLoading}
        >
          {nextLoading ? 'Loading…' : 'Next'}
        </Button>
      </div>
    </div>
  )
}

// ---------------- Layer Mode ----------------
interface LayerModeProps { onNext: () => void; onBack: () => void }

type Layer = {
  id: string
  name: string
  description?: string
  z: number
  images: { id: string; file?: File; previewUrl: string; secureUrl?: string }[]
  open: boolean
}

function LayerMode({ onNext, onBack }: LayerModeProps) {
  const [layers, setLayers] = useState<Layer[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [draftName, setDraftName] = useState("Layer 1")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftImages, setDraftImages] = useState<Array<{ id: string; file?: File; previewUrl: string; secureUrl?: string }>>([])
  const [selectedImageIds, setSelectedImageIds] = useState<Record<string, string>>({}) // layerId -> selectedImageId
  const [nextLoading, setNextLoading] = useState(false)

  // Hydrate layers from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('cs_step5_layer')
      if (!raw) return
      const saved = JSON.parse(raw) as Array<{ id: string; name: string; z: number; images: Array<{ id: string; previewUrl?: string; secureUrl?: string }> }>
      if (!Array.isArray(saved)) return
      const restored: Layer[] = saved.map((l, idx) => ({
        id: l.id || crypto.randomUUID(),
        name: l.name || `Layer ${idx + 1}`,
        description: "",
        z: typeof l.z === 'number' ? l.z : idx,
        images: (l.images || []).map(img => ({ id: img.id || crypto.randomUUID(), previewUrl: img.previewUrl || img.secureUrl || '', secureUrl: img.secureUrl })),
        open: false,
      }))
      setLayers(restored)
    } catch {}
  }, [])

  const addLayer = () => setShowModal(true)

  const reindexLayers = (list: Layer[]): Layer[] => {
    // Only update z by order; keep user-provided names intact
    return list.map((l, idx) => ({ ...l, z: idx }))
  }

  const handleDraftFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(async (file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      setDraftImages(prev => [...prev, { id: tempId, file, previewUrl: url }])
      try {
        const res = await uploadImages([file])
        const secure = res?.[0]?.secure_url
        if (secure) {
          setDraftImages(prev => prev.map(img => img.id === tempId ? { ...img, secureUrl: secure } : img))
        }
      } catch (e) {
        console.error('Draft upload failed', e)
      }
    })
  }

  const saveLayer = () => {
    // Close immediately with whatever images drafted (keep file so we can finalize if still pending)
    const id = crypto.randomUUID()
    const nextZ = layers.length
    const imgs = draftImages.map(i => ({ id: i.id, file: i.file, previewUrl: i.previewUrl, secureUrl: i.secureUrl }))
    const layer: Layer = { id, name: draftName || `Layer ${nextZ + 1}`, description: draftDescription, z: nextZ, images: imgs, open: false }
    setLayers(prev => reindexLayers([...prev, layer]))
    setShowModal(false)
    setDraftName("")
    setDraftDescription("")
    setDraftImages([])
  }

  const ensureLayerUploads = async () => {
    // Find all images across layers missing secureUrl but with file
    const pending: Array<{ layerId: string; imageId: string; file: File }> = []
    layers.forEach(l => l.images.forEach(img => { if (!img.secureUrl && img.file) pending.push({ layerId: l.id, imageId: img.id, file: img.file }) }))
    if (pending.length === 0) return
    // Upload one-by-one to patch as soon as ready (avoids mis-ordering)
    for (const item of pending) {
      try {
        const res = await uploadImages([item.file])
        const secure = res?.[0]?.secure_url
        if (secure) {
          setLayers(prev => prev.map(l => {
            if (l.id !== item.layerId) return l
            return { ...l, images: l.images.map(img => img.id === item.imageId ? { ...img, secureUrl: secure } : img) }
          }))
        }
      } catch (e) {
        console.error('ensureLayerUploads item failed', e)
      }
    }
  }

  const handleNext = async () => {
    setNextLoading(true)
    await Promise.all([
      ensureLayerUploads(),
      new Promise(res => setTimeout(res, 1500)),
    ])
    setNextLoading(false)
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
      return { ...layer, images: newImages }
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
    Array.from(files).forEach(async (file) => {
      const tempId = crypto.randomUUID()
      const url = URL.createObjectURL(file)
      setLayers(prev => prev.map(l => (l.id === layerId ? { ...l, images: [...l.images, { id: tempId, file, previewUrl: url }] } : l)))
      try {
        const res = await uploadImages([file])
        const secure = res?.[0]?.secure_url
        if (secure) {
          setLayers(prev => prev.map(l => {
            if (l.id !== layerId) return l
            return { ...l, images: l.images.map(img => img.id === tempId ? { ...img, secureUrl: secure } : img) }
          }))
        }
      } catch (e) {
        console.error('Layer add image upload failed', e)
      }
    })
  }

  // persist layers
  useEffect(() => {
    if (typeof window === 'undefined') return
    const minimal = layers.map(l => ({ 
      id: l.id, 
      name: l.name, 
      z: l.z, 
      images: l.images.map(i => ({ 
        id: i.id, 
        previewUrl: i.previewUrl, 
        secureUrl: i.secureUrl 
      })) 
    }))
    console.log('Saving layers to localStorage:', minimal)
    localStorage.setItem('cs_step5_layer', JSON.stringify(minimal))
  }, [layers])

  return (
    <div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Layer Configuration</h3>
        <p className="text-sm text-gray-600">Configure layers, upload images, and preview your layer study</p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm font-semibold text-gray-800">Layer Management</div>
        <Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)]" onClick={addLayer}>+ Add New Layer</Button>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1 border rounded-xl bg-white p-4 flex items-center justify-center">
          {/* Preview canvas built from z order */}
          <div className="relative w-full aspect-[3/4] bg-slate-50 rounded-lg overflow-hidden border">
            {layers.map((l) => {
              const selectedImageId = selectedImageIds[l.id]
              const selectedImage = selectedImageId ? l.images.find(img => img.id === selectedImageId) : l.images[0]
              return selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${l.id}-${selectedImage.id}`} src={selectedImage.secureUrl || selectedImage.previewUrl} alt={l.name} className="absolute inset-0 w-full h-full object-contain" style={{ zIndex: l.z }} />
              ) : null
            })}
          </div>
        </div>
        <div className="md:col-span-2">
          {layers.map((layer, idx) => (
            <Fragment key={layer.id}>
              {overIndex === idx && (
                <div className="h-2 rounded bg-[rgba(38,116,186,0.3)] border border-[rgba(38,116,186,0.5)] mb-2" />
              )}
            <div className={`border rounded-xl bg-white ${dragIndex === idx ? 'opacity-70' : ''}`}>
              <div
                className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-t-xl cursor-move"
                draggable
                onDragStart={(e) => { setDragIndex(idx); setOverIndex(idx); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {} }}
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
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span>{layer.name || `Layer ${idx + 1}`}</span>
                  <span className="text-xs text-gray-500">z-{layer.z}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => removeLayer(layer.id)}>Remove</Button>
                  <button
                    type="button"
                    aria-label="Toggle layer"
                    onClick={() => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, open: !l.open } : l))}
                    className="w-7 h-7 border rounded-md flex items-center justify-center"
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
                            className={`w-20 h-20 rounded-md border-2 cursor-pointer transition-all ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => selectImage(layer.id, img.id)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.secureUrl || img.previewUrl} alt="layer" className="w-full h-full object-cover rounded-md" />
                          </div>
                          <button
                            onClick={() => removeImageFromLayer(layer.id, img.id)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                    <label className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center text-gray-400 cursor-pointer hover:border-gray-300 transition-colors">
                      +
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImagesToLayer(layer.id, e.target.files)} />
                    </label>
                  </div>
                </div>
              </div>
              )}
              <div className="px-4 py-2 text-xs text-gray-500 border-t">Drag and drop layers to reorder; z updates automatically.</div>
            </div>
            {idx === layers.length - 1 && overIndex === layers.length && (
              <div className="h-2 rounded bg-[rgba(38,116,186,0.3)] border border-[rgba(38,116,186,0.5)] mt-2" />
            )}
            </Fragment>
          ))}

          {layers.length === 0 && (
            <div className="text-sm text-gray-500">No layers added yet. Click "Add New Layer" to begin.</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-lg">
            <div className="px-5 py-4 border-b font-semibold">Add New Layer</div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Layer Name <span className="text-red-500">*</span></label>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Description (Optional)</label>
                <input value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
              </div>
              <div className="border-2 border-dashed rounded-xl p-6 text-center">
                <div className="text-sm text-[rgba(38,116,186,1)]">Drag And Drop</div>
                <div className="text-[10px] text-gray-500">Supports JPG, PNG (Max 10MB Each)</div>
                <div className="mt-3">
                  <input type="file" multiple accept="image/*" onChange={(e) => handleDraftFiles(e.target.files)} />
                </div>
                {draftImages.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {draftImages.map(img => (
                      <div key={img.id} className="w-16 h-16 border rounded-md overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-between">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={false}>Cancel</Button>
              <Button 
                className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)]" 
                onClick={saveLayer}
              >
                Save Layer
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
        <Button className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto" onClick={handleNext} disabled={nextLoading}>{nextLoading ? 'Loading…' : 'Next'}</Button>
      </div>
    </div>
  )
}
