"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { updateStudyAsync } from "@/lib/api/StudyAPI"

interface Step2StudyTypeProps {
  onNext: (selected: StudyType, mainQuestion: string, orientationText: string) => void
  onBack: () => void
  value?: StudyType
  onDataChange?: () => void
}

type StudyType = "grid" | "layer" | "text"

// Visual preview for Text Study
export function TextStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-4 shadow-lg flex flex-col">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-blue-700 font-semibold text-lg leading-tight">
          Text Study - Categorized
          <br />
          Statements
        </h2>
      </div>

      {/* List representation */}
      <div className="flex-1 flex flex-col gap-2 px-2 mb-2">
        <div className="h-2 w-1/3 bg-blue-600/20 rounded mx-auto mb-2"></div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <div className="h-6 flex-1 bg-white rounded border border-blue-200"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <div className="h-6 flex-1 bg-white rounded border border-blue-200"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <div className="h-6 flex-1 bg-white rounded border border-blue-200"></div>
        </div>
      </div>
    </div>
  )
}

// Visual preview for Layer Study (as provided)
export function LayerStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-4 flex flex-col items-center justify-between relative">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-blue-700 font-semibold text-lg leading-tight">Layer Study - Categorized</h2>
        <h3 className="text-blue-700 font-semibold text-lg">Elements (A, B, C, D)</h3>
      </div>

      {/* Geometric Shapes */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Large square background */}
        <div className="w-24 h-24 border-2 border-blue-600 rounded-lg bg-blue-200/50 relative">
          {/* Vertical rectangle */}
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-12 h-18 bg-blue-500 rounded-lg border-2 border-blue-600"></div>
        </div>

        {/* Horizontal rounded rectangle at bottom */}
        <div className="absolute bottom-8 w-20 h-6 bg-blue-400 rounded-full border-2 border-blue-600"></div>
      </div>

      {/* Bottom dots */}
      <div className="flex space-x-3 mt-10 sm:mt-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-3 h-3 bg-blue-400/60 rounded-full"></div>
        ))}
      </div>
    </div>
  )
}

// Visual preview for Grid Study (as provided)
export function GridStudy() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl p-4 shadow-lg flex flex-col">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-blue-700 font-semibold text-lg leading-tight">
          Grid Study - Image/Text
          <br />
          Elements
        </h2>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1 mb-6">
        <div className="bg-blue-400/60 rounded-xl border-2 border-blue-500/30"></div>
        <div className="bg-blue-400/60 rounded-xl border-2 border-blue-500/30"></div>
        <div className="bg-blue-400/60 rounded-xl border-2 border-blue-500/30"></div>
        <div className="bg-blue-400/60 rounded-xl border-2 border-blue-500/30"></div>
      </div>

      <div className="flex justify-center space-x-2">
        <div className="w-2 h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-400/70 rounded-full"></div>
        <div className="w-2 h-2 bg-blue-400/70 rounded-full"></div>
      </div>
    </div>
  )
}

export function Step2StudyType({ onNext, onBack, value, onDataChange }: Step2StudyTypeProps) {
  const [type, setType] = useState<StudyType | null>(() => {
    try { const v = localStorage.getItem('cs_step2'); if (v) { const o = JSON.parse(v); return (o.type === 'layer' || o.type === 'grid' || o.type === 'text') ? o.type : (value ?? 'grid') } } catch { }
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
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Type <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-4">Choose whether your study will use images or text elements</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <button
              type="button"
              onClick={() => setType("grid")}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full max-w-[18rem] mx-auto flex items-center justify-center text-left transition-all ${type === "grid" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-2">
                <GridStudy />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setType("layer")}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full max-w-[18rem] mx-auto flex items-center justify-center text-left transition-all ${type === "layer" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-2">
                <LayerStudy />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setType("text")}
              className={`border-2 cursor-pointer rounded-3xl aspect-square w-full max-w-[18rem] mx-auto flex items-center justify-center text-left transition-all ${type === "text" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)] opacity-100" : "border-gray-200 bg-white opacity-50 hover:opacity-100"}`}
            >
              <div className="w-full h-full p-2">
                <TextStudy />
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Main Research Question <span className="text-red-500">*</span></label>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
            placeholder="What is the main question respondents will answer?"
            value={mainQuestion}
            onChange={(e) => setMainQuestion(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">This question will be displayed to respondents during each task</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Orientation Text for Respondents <span className="text-red-500">*</span></label>
          <textarea
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] resize-none min-h-[120px] max-h-[300px] overflow-y-auto"
            placeholder="Enter the welcome message for respondents"
            value={orientationText}
            onChange={(e) => setOrientationText(e.target.value)}
            rows={4}
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
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto cursor-pointer" onClick={onBack}>Back</Button>
        <Button
          className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto cursor-pointer"
          onClick={() => {
            if (type && mainQuestion && orientationText) {
              const studyId = localStorage.getItem('cs_study_id')
              if (studyId) {
                // Fire API in background and redirect immediately
                updateStudyAsync(studyId, {
                  last_step: 2,
                  type,
                  main_question: mainQuestion,
                  orientation_text: orientationText,
                })
              }
              onNext(type, mainQuestion, orientationText)
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


