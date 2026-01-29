"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { updateStudyAsync } from "@/lib/api/StudyAPI"

interface Step2StudyTypeProps {
  onNext: (selected: StudyType, mainQuestion: string, orientationText: string) => void
  onBack: () => void
  value?: StudyType
  onDataChange?: () => void
  isReadOnly?: boolean
}

type StudyType = "grid" | "layer" | "text" | "hybrid"

// Visual preview for Text Study
export function TextStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-2 sm:p-3 shadow-lg flex flex-col">
      {/* Title */}
      <div className="text-center mb-2 sm:mb-4">
        <h2 className="text-blue-700 font-semibold text-xs sm:text-sm lg:text-base leading-tight">
          Text Study - Categorized
          <br />
          Statements
        </h2>
      </div>

      {/* List representation */}
      <div className="flex-1 flex flex-col gap-1 sm:gap-2 px-1 sm:px-2 mb-1">
        <div className="h-1 sm:h-2 w-1/3 bg-blue-600/20 rounded mx-auto mb-1 sm:mb-2"></div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
          <div className="h-4 sm:h-6 flex-1 bg-white rounded border border-blue-200"></div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
          <div className="h-4 sm:h-6 flex-1 bg-white rounded border border-blue-200"></div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
          <div className="h-4 sm:h-6 flex-1 bg-white rounded border border-blue-200"></div>
        </div>
      </div>
    </div>
  )
}

// Visual preview for Layer Study (as provided)
export function LayerStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-2 sm:p-3 flex flex-col items-center justify-between gap-2 sm:gap-4">
      {/* Header */}
      <div className="text-center flex-shrink-0">
        <h2 className="text-blue-700 font-semibold text-xs sm:text-sm lg:text-base leading-tight">Layer Study - Categorized</h2>
        <h3 className="text-blue-700 font-semibold text-xs sm:text-sm lg:text-base">Elements (A, B, C, D)</h3>
      </div>

      {/* Geometric Shapes */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 w-full">
        {/* Large square background */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 border-2 border-blue-600 rounded-lg bg-blue-200/50 relative flex-shrink-0">
          {/* Vertical rectangle */}
          <div className="absolute -bottom-3 sm:-bottom-4 lg:-bottom-6 left-1/2 transform -translate-x-1/2 w-5 h-8 sm:w-8 sm:h-12 lg:w-12 lg:h-18 bg-blue-500 rounded-lg border-2 border-blue-600 flex-shrink-0"></div>
        </div>

        {/* Horizontal rounded rectangle at bottom */}
        <div className="absolute bottom-6 sm:bottom-8 lg:bottom-10 w-10 h-3 sm:w-14 sm:h-4 lg:w-20 lg:h-6 bg-blue-400 rounded-full border-2 border-blue-600 flex-shrink-0"></div>
      </div>

      {/* Bottom dots */}
      {/* <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 sm:w-2 sm:h-2 lg:w-2.5 lg:h-2.5 bg-blue-400/60 rounded-full flex-shrink-0"></div>
        ))}
      </div> */}
    </div>
  )
}

// Visual preview for Grid Study (as provided)
export function GridStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-2 sm:p-3 shadow-lg flex flex-col">
      {/* Title */}
      <div className="text-center mb-2 sm:mb-4">
        <h2 className="text-blue-700 font-semibold text-xs sm:text-sm lg:text-base leading-tight">
          Grid Study - Image/Text
          <br />
          Elements
        </h2>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-1 sm:gap-2 lg:gap-3 flex-1 mb-2 sm:mb-4">
        <div className="bg-blue-400/60 rounded-lg sm:rounded-xl border-2 border-blue-500/30"></div>
        <div className="bg-blue-400/60 rounded-lg sm:rounded-xl border-2 border-blue-500/30"></div>
        <div className="bg-blue-400/60 rounded-lg sm:rounded-xl border-2 border-blue-500/30"></div>
        <div className="bg-blue-400/60 rounded-lg sm:rounded-xl border-2 border-blue-500/30"></div>
      </div>

      <div className="flex justify-center space-x-1 sm:space-x-2 flex-shrink-0">
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400/70 rounded-full"></div>
      </div>
    </div>
  )
}

// Visual preview for Hybrid Study
export function HybridStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-2 sm:p-3 lg:p-4 shadow-lg flex flex-col">
      {/* Title */}
      <div className="text-center mb-2 sm:mb-3 lg:mb-4">
        <h2 className="text-blue-700 font-semibold text-sm sm:text-base lg:text-lg leading-tight">Hybrid Study</h2>
        <p className="text-[10px] sm:text-xs lg:text-[11px] text-blue-700/80 font-medium mt-1">Grid + Text elements</p>
      </div>

      <div className="flex-1 flex flex-col gap-1 sm:gap-2 lg:gap-3">
        {/* Grid preview (top) */}
        <div className="flex-1 bg-white/60 rounded-lg sm:rounded-xl lg:rounded-2xl border border-blue-200/70 p-1 sm:p-2">
          <div className="grid grid-cols-2 gap-1 sm:gap-2 h-full">
            <div className="bg-blue-400/55 rounded-lg sm:rounded-xl border border-blue-500/20" />
            <div className="bg-blue-400/55 rounded-lg sm:rounded-xl border border-blue-500/20" />
            <div className="bg-blue-400/55 rounded-lg sm:rounded-xl border border-blue-500/20" />
            <div className="bg-blue-400/55 rounded-lg sm:rounded-xl border border-blue-500/20" />
          </div>
        </div>

        {/* Text preview (bottom) */}
        <div className="h-12 sm:h-14 lg:h-16 bg-white/60 rounded-lg sm:rounded-xl lg:rounded-2xl border border-blue-200/70 px-2 sm:px-3 py-1 sm:py-2 flex flex-col justify-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <div className="h-1 sm:h-2 flex-1 bg-blue-400/25 rounded" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <div className="h-1 sm:h-2 w-4/5 bg-blue-400/25 rounded" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <div className="h-1 sm:h-2 w-3/5 bg-blue-400/25 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Step2StudyType({ onNext, onBack, value, onDataChange, isReadOnly = false }: Step2StudyTypeProps) {
  const [type, setType] = useState<StudyType | null>(() => {
    try { const v = localStorage.getItem('cs_step2'); if (v) { const o = JSON.parse(v); return (o.type === 'layer' || o.type === 'grid' || o.type === 'text' || o.type === 'hybrid') ? o.type : (value ?? 'grid') } } catch { }
    return value ?? 'grid'
  })
  const [mainQuestion, setMainQuestion] = useState(() => {
    try { const v = localStorage.getItem('cs_step2'); if (v) { const o = JSON.parse(v); return o.mainQuestion || "" } } catch { }
    return ""
  })
  const [orientationText, setOrientationText] = useState(() => {
    try { const v = localStorage.getItem('cs_step2'); if (v) { const o = JSON.parse(v); return o.orientationText || "Welcome to the study!" } } catch { }
    return "Welcome to the study!"
  })

  useEffect(() => { }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('cs_step2', JSON.stringify({ type, mainQuestion, orientationText }))
    onDataChange?.()
  }, [type, mainQuestion, orientationText, onDataChange])

  return (
    <div>
      <div className={`space-y-6 ${isReadOnly ? "opacity-70 pointer-events-none" : ""}`}>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Type <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-4">Choose whether your study will use images or text elements</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            <button
              type="button"
              onClick={() => !isReadOnly && setType("grid")}
              disabled={isReadOnly}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full flex items-center justify-center text-left transition-all ${type === "grid" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-1.5 sm:p-2 lg:p-3">
                <GridStudy />
              </div>
            </button>

            <button
              type="button"
              onClick={() => !isReadOnly && setType("layer")}
              disabled={isReadOnly}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full flex items-center justify-center text-left transition-all ${type === "layer" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-1.5 sm:p-2 lg:p-3">
                <LayerStudy />
              </div>
            </button>

            <button
              type="button"
              onClick={() => !isReadOnly && setType("text")}
              disabled={isReadOnly}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full flex items-center justify-center text-left transition-all ${type === "text" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-1.5 sm:p-2 lg:p-3">
                <TextStudy />
              </div>
            </button>

            <button
              type="button"
              onClick={() => !isReadOnly && setType("hybrid")}
              disabled={isReadOnly}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full flex items-center justify-center text-left transition-all ${type === "hybrid" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-1.5 sm:p-2 lg:p-3">
                <HybridStudy />
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Main Research Question <span className="text-red-500">*</span></label>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="What is the main question respondents will answer?"
            value={mainQuestion}
            onChange={(e) => setMainQuestion(e.target.value)}
            disabled={isReadOnly}
          />
          <p className="mt-2 text-xs text-gray-500">This question will be displayed to respondents during each task</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Orientation Text for Respondents <span className="text-red-500">*</span></label>
          <textarea
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] resize-none min-h-[120px] max-h-[300px] overflow-y-auto disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="Enter the welcome message for respondents"
            value={orientationText}
            onChange={(e) => setOrientationText(e.target.value)}
            rows={4}
            disabled={isReadOnly}
            style={{
              height: 'auto',
              minHeight: '120px',
              maxHeight: '300px',
              overflowY: orientationText.length > 200 ? 'auto' : 'hidden'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 300) + 'px';
            }}
          />
          <p className="mt-2 text-xs text-gray-500">This text will be displayed to respondents at the start of the study</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto cursor-pointer bg-transparent" onClick={onBack}>Back</Button>
        <Button
          className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto cursor-pointer"
          onClick={() => {
            if (type && mainQuestion && orientationText) {
              // If read-only, skip API call
              if (isReadOnly) {
                onNext(type as any, mainQuestion, orientationText)
                return
              }

              const studyId = localStorage.getItem('cs_study_id')
              if (studyId) {
                // Fire API in background and redirect immediately
                updateStudyAsync(studyId, {
                  last_step: 2,
                  type: type!,
                  main_question: mainQuestion,
                  orientation_text: orientationText,
                })
              }
              onNext(type as any, mainQuestion, orientationText)
            }
          }}
          disabled={!type || !mainQuestion || !orientationText}
        >
          Save & Next
        </Button>
      </div>
    </div>
  )
}
