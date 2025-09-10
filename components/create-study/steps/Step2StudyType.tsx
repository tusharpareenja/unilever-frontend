"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface Step2StudyTypeProps {
  onNext: (selected: StudyType, mainQuestion: string, orientationText: string) => void
  onBack: () => void
  value?: StudyType
}

type StudyType = "grid" | "layer"

export function Step2StudyType({ onNext, onBack, value }: Step2StudyTypeProps) {
  const [type, setType] = useState<StudyType | null>(value ?? "grid")
  const [mainQuestion, setMainQuestion] = useState("")
  const [orientationText, setOrientationText] = useState("ENGLISH")

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('cs_step2') : null
    if (raw) {
      try { const v = JSON.parse(raw); setType(v.type || "grid"); setMainQuestion(v.mainQuestion || ""); setOrientationText(v.orientationText || "ENGLISH") } catch {}
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('cs_step2', JSON.stringify({ type, mainQuestion, orientationText }))
  }, [type, mainQuestion, orientationText])

  return (
    <div>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Type <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-4">Choose whether your study will use images or text elements</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              type="button"
              onClick={() => setType("grid")}
              className={`border rounded-xl p-4 w-full h-full text-left transition-all ${type === "grid" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)]" : "border-gray-200 bg-white"}`}
            >
              <div className="text-[11px] text-center text-gray-600 mb-2">Grid Study - Image/Text Elements</div>
              <div className="aspect-[4/3] rounded-lg bg-slate-100 grid grid-cols-2 gap-3 p-4">
                <div className="bg-white border border-gray-200 rounded-md" />
                <div className="bg-white border border-gray-200 rounded-md" />
                <div className="bg-white border border-gray-200 rounded-md" />
                <div className="bg-white border border-gray-200 rounded-md" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setType("layer")}
              className={`border rounded-xl p-4 w-full h-full text-left transition-all ${type === "layer" ? "border-[rgba(38,116,186,1)] ring-2 ring-[rgba(38,116,186,0.2)] bg-[rgba(38,116,186,0.05)]" : "border-gray-200 bg-white"}`}
            >
              <div className="text-[11px] text-center text-gray-600 mb-2">Layer Study - Categorized Elements (A, B, C, D)</div>
              <div className="aspect-[4/3] rounded-lg bg-slate-100 flex items-center justify-center">
                <div className="w-2/3 h-10 bg-white border border-gray-200 rounded-sm" />
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
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
            value={orientationText}
            onChange={(e) => setOrientationText(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">Provide context about your study (max 2000 characters)</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
        <Button
          className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto"
          onClick={() => type && onNext(type, mainQuestion, orientationText)}
          disabled={!type || !mainQuestion || !orientationText}
        >
          Next
        </Button>
      </div>
    </div>
  )
}


