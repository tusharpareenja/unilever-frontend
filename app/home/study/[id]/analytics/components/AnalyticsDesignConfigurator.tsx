"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, ChevronDown, ImageIcon, RotateCcw, Sparkles, Type, X } from "lucide-react"

type Metric = "Top Down" | "Bottom Up" | "Response Time"

type ConfiguratorElement = {
  id: string
  name: string
  category: string
  value: number
  imageUrl?: string | null
  content?: string | null
  elementType?: string
  zIndex: number
  transform?: { x: number; y: number; width: number; height: number }
}

type ConfiguratorCategory = {
  name: string
  code?: string
  zIndex: number
  elements: ConfiguratorElement[]
}

type SegmentOption = {
  id: string
  label: string
  sectionKey: string
  valueKey?: string
}

const METRIC_OPTIONS: { value: Metric; label: string; description: string }[] = [
  { value: "Top Down", label: "Top Down", description: "Conscious preference" },
  { value: "Bottom Up", label: "Bottom Up", description: "Implicit lift" },
  { value: "Response Time", label: "Response Time", description: "Decision speed" },
]

const METRIC_KEYS: Record<Metric, string> = {
  "Top Down": "(T) Overall",
  "Bottom Up": "(B) Overall",
  "Response Time": "(R) Overall",
}

const METRIC_PREFIX: Record<Metric, string> = {
  "Top Down": "(T)",
  "Bottom Up": "(B)",
  "Response Time": "(R)",
}

const MAX_NON_LAYER_SELECTIONS = 4
const AGE_SEGMENTS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function getBackgroundUrl(analysisData: any): string | null {
  const info = analysisData?.["Information Block"] || {}
  const candidates = [
    info["Study Background"],
    info.background_image_url,
    info.Background,
    info.metadata?.background_image_url,
    analysisData?.background_image_url,
    analysisData?.metadata?.background_image_url,
  ]
  return candidates.find(isHttpUrl) || null
}

function getLayerAspectRatio(analysisData: any): string {
  const info = analysisData?.["Information Block"] || {}
  const frontPage = analysisData?.["Front Page"] || {}
  const raw = normalizeText(info["Aspect Ratio"] ?? info.aspect_ratio ?? frontPage["Aspect Ratio"] ?? frontPage.aspect_ratio)
    .toLowerCase()

  if (raw === "landscape" || raw === "16:9") return "16 / 9"
  if (raw === "square" || raw === "1:1") return "1 / 1"
  if (raw === "portrait" || raw === "9:16") return "9 / 16"

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (match) return `${match[1]} / ${match[2]}`

  return "9 / 16"
}

function getElementKey(category: string, elementName: string): string {
  return `${category}::${elementName}`
}

function getSegmentId(sectionKey: string, valueKey?: string): string {
  return valueKey ? `${sectionKey}::${valueKey}` : sectionKey
}

function formatSegmentLabel(valueKey: string): string {
  const mindsetMatch = valueKey.match(/^Mindset_(\d+)_of_\d+$/)
  if (mindsetMatch) return `Mindset ${mindsetMatch[1]}`
  return valueKey.replace(/_/g, " ")
}

function addSegmentOption(options: SegmentOption[], option: Omit<SegmentOption, "id">) {
  const id = getSegmentId(option.sectionKey, option.valueKey)
  if (options.some((existing) => existing.id === id || existing.label === option.label)) return
  options.push({ ...option, id })
}

function getAvailableSegmentOptions(analysisData: any, metric: Metric): SegmentOption[] {
  const prefix = METRIC_PREFIX[metric]
  const options: SegmentOption[] = []

  addSegmentOption(options, {
    label: "Overall",
    sectionKey: `${prefix} Overall`,
  })

  const genderSection = analysisData?.[`${prefix} Gender`]
  for (const key of Object.keys(genderSection?.segments || {})) {
    addSegmentOption(options, {
      label: key,
      sectionKey: `${prefix} Gender`,
      valueKey: key,
    })
  }

  const ageSection = analysisData?.[`${prefix} Age`]
  const ageKeys = Array.from(new Set([...AGE_SEGMENTS, ...Object.keys(ageSection?.segments || {})])).sort((a, b) => {
    const aNum = Number.parseInt(a, 10)
    const bNum = Number.parseInt(b, 10)
    if (Number.isNaN(aNum) || Number.isNaN(bNum)) return a.localeCompare(b)
    return aNum - bNum
  })
  if (ageSection) {
    for (const key of ageKeys) {
      addSegmentOption(options, {
        label: key,
        sectionKey: `${prefix} Age`,
        valueKey: key,
      })
    }
  }

  const mindsetSection = analysisData?.[`${prefix} Mindsets`]
  const mindsetGroup = mindsetSection?.groups?.Mindset_3 || mindsetSection?.groups?.Mindset_2 || {}
  const mindsetKeys = Object.keys(mindsetGroup).sort()
  for (const key of mindsetKeys) {
    addSegmentOption(options, {
      label: formatSegmentLabel(key),
      sectionKey: `${prefix} Mindsets`,
      valueKey: key,
    })
  }

  return options
}

function getInfoCategories(analysisData: any): any[] {
  const info = analysisData?.["Information Block"] || {}
  const candidates = [
    info.Categories,
    info.categories,
    info.Layers,
    info.layers,
    info["Study Layers"],
    info.study_layers,
    analysisData?.study_layers,
  ]
  const match = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
  return Array.isArray(match) ? match : []
}

function getRawElements(category: any): any[] {
  const candidates = [
    category?.elements,
    category?.Elements,
    category?.images,
    category?.Images,
    category?.options,
  ]
  const match = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
  return Array.isArray(match) ? match : []
}

function pickElementImage(element: any): string | null {
  const candidates = [
    element?.content,
    element?.url,
    element?.imageUrl,
    element?.imageLink,
    element?.image,
    element?.secureUrl,
    element?.previewUrl,
  ]
  return candidates.find(isHttpUrl) || null
}

function pickTransform(element: any): ConfiguratorElement["transform"] | undefined {
  const transform = element?.transform || element?.position || element?.metadata?.transform
  if (!transform || typeof transform !== "object") return undefined
  return {
    x: toNumber(transform.x, 0),
    y: toNumber(transform.y, 0),
    width: toNumber(transform.width, 100),
    height: toNumber(transform.height, 100),
  }
}

function getScoreMap(analysisData: any, metric: Metric, segment: SegmentOption): Map<string, { value: number; code?: string }> {
  const section = analysisData?.[segment?.sectionKey || METRIC_KEYS[metric]]
  const scoreMap = new Map<string, { value: number; code?: string }>()

  for (const category of section?.categories || []) {
    const categoryName = normalizeText(category?.name)
    for (const element of category?.elements || []) {
      const name = normalizeText(element?.name)
      if (!categoryName || !name) continue
      scoreMap.set(getElementKey(categoryName, name), {
        value: segment?.valueKey ? toNumber(element?.values?.[segment.valueKey], 0) : toNumber(element?.value, 0),
        code: normalizeText(element?.code) || undefined,
      })
    }
  }

  return scoreMap
}

function getCategoriesForMetric(analysisData: any, metric: Metric, segment: SegmentOption): ConfiguratorCategory[] {
  const infoCategories = getInfoCategories(analysisData)
  const scoreMap = getScoreMap(analysisData, metric, segment)

  if (!Array.isArray(infoCategories) || infoCategories.length === 0) {
    const section = analysisData?.[segment?.sectionKey || METRIC_KEYS[metric]]
    return (section?.categories || [])
      .map((category: any, categoryIndex: number) => {
        const categoryName = normalizeText(category?.name) || `Category ${categoryIndex + 1}`
        const zIndex = toNumber(category?.z_index ?? category?.z ?? categoryIndex + 1, categoryIndex + 1)
      const elements = getRawElements(category).map((element: any, elementIndex: number) => ({
          id: getElementKey(categoryName, normalizeText(element?.name) || `Element ${elementIndex + 1}`),
          name: normalizeText(element?.name) || `Element ${elementIndex + 1}`,
          category: categoryName,
          value: segment?.valueKey ? toNumber(element?.values?.[segment.valueKey], 0) : toNumber(element?.value, 0),
          imageUrl: pickElementImage(element),
          content: normalizeText(element?.content) || null,
          elementType: normalizeText(element?.element_type ?? element?.elementType),
          zIndex,
          transform: pickTransform(element),
        }))

        return { name: categoryName, code: normalizeText(category?.code) || undefined, zIndex, elements }
      })
      .filter((category: ConfiguratorCategory) => category.elements.length > 0)
  }

  return infoCategories
    .map((category: any, categoryIndex: number) => {
      const categoryName = normalizeText(category?.name) || normalizeText(category?.title) || `Category ${categoryIndex + 1}`
      const zIndex = toNumber(category?.z_index ?? category?.z ?? categoryIndex + 1, categoryIndex + 1)
      const elements = getRawElements(category).map((element: any, elementIndex: number) => {
        const name = normalizeText(element?.name) || normalizeText(element?.alt_text) || `Element ${elementIndex + 1}`
        const score = scoreMap.get(getElementKey(categoryName, name))
        const elementType = normalizeText(element?.element_type ?? element?.elementType)
        const imageUrl = elementType.toLowerCase() === "text" ? null : pickElementImage(element)

        return {
          id: getElementKey(categoryName, name),
          name,
          category: categoryName,
          value: score?.value ?? 0,
          imageUrl,
          content: normalizeText(element?.content) || null,
          elementType,
          zIndex: toNumber(element?.z_index ?? element?.z ?? category?.z_index ?? category?.z ?? zIndex, zIndex),
          transform: pickTransform(element),
        }
      })

      return {
        name: categoryName,
        code: normalizeText(category?.code) || undefined,
        zIndex,
        elements,
      }
    })
    .filter((category: ConfiguratorCategory) => category.elements.length > 0)
}

function buildDefaultSelection(categories: ConfiguratorCategory[], isLayerStudy: boolean): Record<string, string> {
  const selected: Record<string, string> = {}
  const rankedCategories = [...categories]
    .map((category) => ({
      category,
      best: [...category.elements].sort((a, b) => b.value - a.value)[0],
    }))
    .filter((item) => item.best)
    .sort((a, b) => {
      if (isLayerStudy) return a.category.zIndex - b.category.zIndex
      return b.best.value - a.best.value
    })

  const limit = isLayerStudy ? rankedCategories.length : MAX_NON_LAYER_SELECTIONS
  rankedCategories.slice(0, limit).forEach(({ category, best }) => {
    selected[category.name] = best.id
  })

  return selected
}

function formatValue(value: number, metric: Metric): string {
  if (!Number.isFinite(value)) return "0"
  if (metric === "Response Time") return Math.abs(value) < 1 ? value.toFixed(3) : value.toFixed(1)
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function SelectionPreview({
  selectedElements,
  studyType,
  backgroundUrl,
  aspectRatio,
}: {
  selectedElements: ConfiguratorElement[]
  studyType: string
  backgroundUrl: string | null
  aspectRatio: string
}) {
  const isLayerStudy = studyType === "layer"
  const containerRef = useRef<HTMLDivElement>(null)
  const backgroundImgRef = useRef<HTMLImageElement>(null)
  const [layerFit, setLayerFit] = useState({ left: 0, top: 0, width: 0, height: 0 })

  useEffect(() => {
    if (!isLayerStudy) return

    const computeFit = () => {
      const container = containerRef.current
      if (!container) return

      const cw = container.offsetWidth
      const ch = container.offsetHeight
      if (!cw || !ch) return

      const background = backgroundImgRef.current
      if (!backgroundUrl || !background) {
        setLayerFit({ left: 0, top: 0, width: cw, height: ch })
        return
      }

      const iw = background.naturalWidth || cw
      const ih = background.naturalHeight || ch
      const scale = Math.min(cw / iw, ch / ih)
      const width = iw * scale
      const height = ih * scale

      setLayerFit({
        left: (cw - width) / 2,
        top: (ch - height) / 2,
        width,
        height,
      })
    }

    computeFit()
    const resizeObserver = new ResizeObserver(computeFit)
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [aspectRatio, backgroundUrl, isLayerStudy])

  if (selectedElements.length === 0 && (!isLayerStudy || !backgroundUrl)) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-center"
        style={{
          aspectRatio: isLayerStudy ? aspectRatio : "1 / 1",
          maxHeight: isLayerStudy ? (aspectRatio === "16 / 9" ? "600px" : "320px") : undefined,
          maxWidth: isLayerStudy ? (aspectRatio === "16 / 9" ? "100%" : "280px") : undefined,
          margin: "0 auto"
        }}
      >
        <div className="px-6">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-blue-300" />
          <p className="text-sm font-medium text-gray-500">Select elements to build your preview</p>
        </div>
      </div>
    )
  }

  if (isLayerStudy) {
    const sorted = [...selectedElements].sort((a, b) => a.zIndex - b.zIndex)
    const isLandscape = aspectRatio === "16 / 9"
    return (
      <div
        ref={containerRef}
        className="relative mx-auto w-full overflow-hidden bg-transparent"
        style={{ aspectRatio, maxHeight: isLandscape ? "600px" : "320px", maxWidth: isLandscape ? "100%" : "280px" }}
      >
        {backgroundUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={backgroundImgRef}
            src={backgroundUrl}
            alt="Background"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ zIndex: 0 }}
            onLoad={() => {
              const container = containerRef.current
              const background = backgroundImgRef.current
              if (!container || !background) return

              const cw = container.offsetWidth
              const ch = container.offsetHeight
              const iw = background.naturalWidth || cw
              const ih = background.naturalHeight || ch
              const scale = Math.min(cw / iw, ch / ih)
              const width = iw * scale
              const height = ih * scale

              setLayerFit({
                left: (cw - width) / 2,
                top: (ch - height) / 2,
                width,
                height,
              })
            }}
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        )}
        <div
          className="absolute overflow-hidden"
          style={{
            left: backgroundUrl ? layerFit.left : 0,
            top: backgroundUrl ? layerFit.top : 0,
            width: backgroundUrl ? layerFit.width || "100%" : "100%",
            height: backgroundUrl ? layerFit.height || "100%" : "100%",
            zIndex: 1,
          }}
        >
          {sorted.map((element) => {
            const transform = element.transform || { x: 0, y: 0, width: 100, height: 100 }
            const widthPct = Math.max(1, Math.min(100, transform.width))
            const heightPct = Math.max(1, Math.min(100, transform.height))
            const leftPct = Math.max(0, Math.min(100 - widthPct, transform.x))
            const topPct = Math.max(0, Math.min(100 - heightPct, transform.y))
            const useFitPixels = Boolean(backgroundUrl && layerFit.width && layerFit.height)
            const fitWidth = layerFit.width || 1
            const fitHeight = layerFit.height || 1
            const layerStyle = useFitPixels
              ? {
                  top: `${(topPct / 100) * fitHeight}px`,
                  left: `${(leftPct / 100) * fitWidth}px`,
                  width: `${(widthPct / 100) * fitWidth}px`,
                  height: `${(heightPct / 100) * fitHeight}px`,
                }
              : {
                  top: `${topPct}%`,
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                }

            if (!element.imageUrl) {
              return (
                <div
                  key={element.id}
                  className="absolute flex items-center justify-center rounded-lg border border-white/70 bg-white/80 p-2 text-center text-[10px] font-semibold text-gray-700 shadow-sm backdrop-blur-sm sm:p-3 sm:text-xs"
                  style={{
                    zIndex: element.zIndex + 1,
                    ...layerStyle,
                  }}
                >
                  {element.name}
                </div>
              )
            }

            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={element.id}
                src={element.imageUrl}
                alt={element.name}
                className="absolute object-contain"
                style={{
                  zIndex: element.zIndex + 1,
                  ...layerStyle,
                }}
                onError={(event) => {
                  event.currentTarget.style.display = "none"
                }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const count = selectedElements.length
  const hasImage = selectedElements.some(e => e.imageUrl && e.elementType?.toLowerCase() !== "text")
  const allText = count > 0 && !hasImage

  if (allText) {
    return (
      <div className="relative mx-auto flex w-full max-w-[380px] items-center justify-center overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6" style={{ minHeight: '380px' }}>
        <div className="flex w-full flex-col items-center justify-center gap-2 h-full flex-1">
          {selectedElements.map((element) => (
            <div
              key={element.id}
              className="w-full flex items-center justify-center text-center px-4 py-3 rounded-xl shadow-sm transition-colors bg-gray-50 border border-gray-100"
              style={{
                height: `${100 / count}%`,
                maxHeight: '120px',
                fontSize: 'clamp(14px, 1.2vw, 20px)',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              {element.content || element.name}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-2"
        : "grid-cols-2"

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[380px] items-center justify-center overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
      {backgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundUrl}
          alt="Background"
          className="absolute inset-0 h-full w-full object-contain opacity-10"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
      <div className={`relative grid w-full ${gridClass} gap-3 sm:gap-4`}>
        {selectedElements.map((element, index) => {
          const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"
          return (
            <div
              key={element.id}
              className={`flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4 ${
                count === 3 && index === 2 ? "col-span-2 mx-auto w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)]" : ""
              }`}
            >
              {isText ? (
                <div className="text-center">
                  <Type className="mx-auto mb-1.5 h-5 w-5 text-blue-500 sm:mb-2 sm:h-6 sm:w-6" />
                  <p className="text-xs font-medium leading-snug text-gray-800 sm:text-sm">{element.content || element.name}</p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={element.imageUrl || ""}
                  alt={element.name}
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = "none"
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface AnalyticsDesignConfiguratorProps {
  analysisData: any
  studyType?: string
}

export function AnalyticsDesignConfigurator({
  analysisData,
  studyType = "grid",
}: AnalyticsDesignConfiguratorProps) {
  const normalizedStudyType = (studyType || "grid").toLowerCase()
  const isLayerStudy = normalizedStudyType === "layer"
  const [activeMetric, setActiveMetric] = useState<Metric>("Top Down")
  const segmentOptions = useMemo(
    () => getAvailableSegmentOptions(analysisData || {}, activeMetric),
    [analysisData, activeMetric]
  )
  const [activeSegmentId, setActiveSegmentId] = useState<string>("")
  const activeSegment = useMemo(
    () => segmentOptions.find((segment) => segment.id === activeSegmentId) ?? segmentOptions[0],
    [segmentOptions, activeSegmentId]
  )
  const categories = useMemo(
    () => getCategoriesForMetric(analysisData || {}, activeMetric, activeSegment),
    [analysisData, activeMetric, activeSegment]
  )
  const backgroundUrl = useMemo(() => getBackgroundUrl(analysisData || {}), [analysisData])
  const layerAspectRatio = useMemo(() => getLayerAspectRatio(analysisData || {}), [analysisData])
  const [selectedByCategory, setSelectedByCategory] = useState<Record<string, string>>({})
  const [showLayerBackground, setShowLayerBackground] = useState(
    () => isLayerStudy && Boolean(getBackgroundUrl(analysisData || {}))
  )
  const [isSelectionOpen, setIsSelectionOpen] = useState(false)

  useEffect(() => {
    if (!isLayerStudy) return
    if (backgroundUrl) setShowLayerBackground(true)
    else setShowLayerBackground(false)
  }, [isLayerStudy, backgroundUrl])

  useEffect(() => {
    if (segmentOptions.length === 0) return
    if (!segmentOptions.some((segment) => segment.id === activeSegmentId)) {
      setActiveSegmentId(segmentOptions[0].id)
    }
  }, [segmentOptions, activeSegmentId])

  const selectedElements = useMemo(
    () =>
      categories
        .map((category) => category.elements.find((element) => element.id === selectedByCategory[category.name]))
        .filter((element): element is ConfiguratorElement => Boolean(element)),
    [categories, selectedByCategory]
  )

  const totalCoefficient = selectedElements.reduce((sum, element) => sum + element.value, 0)
  const selectedCount = selectedElements.length
  const maxSelections = isLayerStudy ? categories.length : MAX_NON_LAYER_SELECTIONS

  const handleSelect = (category: ConfiguratorCategory, element: ConfiguratorElement) => {
    setSelectedByCategory((current) => {
      const next = { ...current }
      const alreadySelected = next[category.name] === element.id

      if (alreadySelected) {
        delete next[category.name]
        return next
      }

      const currentCount = Object.keys(next).length
      if (!isLayerStudy && !next[category.name] && currentCount >= MAX_NON_LAYER_SELECTIONS) {
        return next
      }

      next[category.name] = element.id
      return next
    })
  }

  if (!analysisData || categories.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Design configurator
            </h2>
          </div>
          <p className="ml-4 text-sm text-gray-500">
            Combine winning {isLayerStudy ? "layer assets" : "elements"} and preview the total coefficient.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex rounded-xl bg-gray-100 p-1 shadow-inner">
            {METRIC_OPTIONS.map((metric) => (
              <button
                key={metric.value}
                type="button"
                onClick={() => setActiveMetric(metric.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeMetric === metric.value
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px]">
            <select
              value={activeSegment?.id || ""}
              onChange={(event) => setActiveSegmentId(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-700 shadow-sm outline-none transition-colors hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {segmentOptions.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:h-[calc(100vh-180px)] lg:flex-row">
        {/* Left Column - Preview & Selected Elements */}
        <div className="flex flex-col gap-6 lg:w-5/12 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-4">
          {/* Preview Card */}
          <div className="flex flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-3">
              {isLayerStudy ? (
                <button
                  type="button"
                  onClick={() => setShowLayerBackground((current) => !current)}
                  disabled={!backgroundUrl}
                  className={`flex cursor-pointer items-center gap-2 text-sm font-medium transition-colors ${
                    showLayerBackground ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-pressed={showLayerBackground}
                >
                  <ImageIcon className="h-4 w-4" /> Background
                </button>
              ) : (
                <div />
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedByCategory(buildDefaultSelection(categories, isLayerStudy))}
                  className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  <Sparkles className="h-4 w-4" /> Best Mix
                </button>
                <div className="mx-1 h-4 w-px bg-gray-300" />
                <button
                  type="button"
                  onClick={() => setSelectedByCategory({})}
                  className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
                >
                  <RotateCcw className="h-4 w-4" /> Clear
                </button>
              </div>
            </div>

            <div className="bg-transparent p-4 sm:p-6">
              <SelectionPreview
                selectedElements={selectedElements}
                studyType={normalizedStudyType}
                backgroundUrl={isLayerStudy ? (showLayerBackground ? backgroundUrl : null) : backgroundUrl}
                aspectRatio={layerAspectRatio}
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Coefficient</p>
                <p className="mt-0.5 text-sm font-medium text-gray-400">{activeSegment?.label || "Overall"}</p>
              </div>
              <div className="tabular-nums text-3xl font-black text-gray-900">
                {formatValue(totalCoefficient, activeMetric)}
              </div>
            </div>
          </div>

          {/* Selected Elements Card */}
          {selectedElements.length > 0 && (
            <div className={`flex flex-col rounded-3xl border border-gray-200 bg-white shadow-sm transition-all ${isSelectionOpen ? "min-h-[200px] flex-1" : "flex-shrink-0"}`}>
              <button
                type="button"
                onClick={() => setIsSelectionOpen(!isSelectionOpen)}
                className="flex w-full cursor-pointer items-center justify-between p-5 outline-none sm:p-6"
              >
                <h3 className="text-sm font-bold text-gray-900">Active Selection ({selectedElements.length})</h3>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isSelectionOpen ? "rotate-180" : ""}`} />
              </button>
              {isSelectionOpen && (
                <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5 pr-3 sm:px-6 sm:pb-6 sm:pr-4">
                  {selectedElements.map((element) => (
                    <div key={`selected-${element.id}`} className="group flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-1 ring-1 ring-gray-100">
                          {element.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={element.imageUrl} alt={element.name} className="h-full w-full object-contain" />
                          ) : (
                            <Type className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 break-words">{element.name}</p>
                          <p className="truncate text-xs text-gray-500">{element.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`tabular-nums text-sm font-bold ${
                            element.value >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {element.value >= 0 ? "+" : ""}
                          {formatValue(element.value, activeMetric)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedByCategory((current) => {
                              const next = { ...current }
                              delete next[element.category]
                              return next
                            })
                          }
                          className="text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          aria-label={`Remove ${element.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Categories */}
        <div className="space-y-10 pb-10 lg:w-7/12 lg:h-full lg:overflow-y-auto lg:pr-4">
          {!isLayerStudy && selectedCount >= MAX_NON_LAYER_SELECTIONS && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
              Maximum 4 elements can be selected. Remove one to add another category.
            </div>
          )}

          {categories.map((category) => {
            const selectedId = selectedByCategory[category.name]
            return (
              <div key={category.name}>
                <div className="mb-4 flex items-baseline justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {isLayerStudy ? "Layer" : "Category"}: {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {category.elements.length} option{category.elements.length === 1 ? "" : "s"}{" "}
                      {isLayerStudy ? `· z-index ${category.zIndex}` : ""}
                    </p>
                  </div>
                  {selectedId && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[...category.elements]
                    .sort((a, b) => b.value - a.value)
                    .map((element) => {
                      const isSelected = selectedId === element.id
                      const disabled =
                        !isLayerStudy &&
                        !isSelected &&
                        !selectedId &&
                        selectedCount >= MAX_NON_LAYER_SELECTIONS
                      const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"

                      return (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() => handleSelect(category, element)}
                          disabled={disabled}
                          className={`relative flex flex-col rounded-2xl border p-3 text-left transition-all ${
                            isSelected
                              ? "border-blue-500 ring-1 ring-blue-500 shadow-md bg-white"
                              : disabled
                                ? "cursor-not-allowed border-gray-200 bg-gray-50/50 opacity-50"
                                : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                          }`}
                        >
                          <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-xl bg-gray-50 p-2">
                            {isText ? (
                              <Type className="h-8 w-8 text-gray-300" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={element.imageUrl || ""}
                                alt={element.name}
                                className="h-full w-full object-contain"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none"
                                }}
                              />
                            )}
                          </div>
                          <div className="flex w-full flex-1 flex-col justify-between">
                            <p className="mb-2 text-sm font-medium leading-snug text-gray-900 break-words">
                              {element.name}
                            </p>
                            <div className="mt-auto flex items-center justify-between">
                              {/* <span className="text-xs text-gray-500">
                                {isLayerStudy ? `Stack ${element.zIndex}` : isText ? "Text" : "Image"}
                              </span> */}
                              <span
                                className={`rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${
                                  element.value >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                }`}
                              >
                                {element.value >= 0 ? "+" : ""}
                                {formatValue(element.value, activeMetric)}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}
