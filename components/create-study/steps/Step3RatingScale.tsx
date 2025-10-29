"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Step3RatingScaleProps {
  onNext: () => void
  onBack: () => void
  onDataChange?: () => void
}

export function Step3RatingScale({ onNext, onBack, onDataChange }: Step3RatingScaleProps) {
  const [minLabel, setMinLabel] = useState(() => {
    try {
      const v = localStorage.getItem("cs_step3")
      if (v) {
        const o = JSON.parse(v)
        return o.minLabel || ""
      }
    } catch {}
    return ""
  })

  const [maxLabel, setMaxLabel] = useState(() => {
    try {
      const v = localStorage.getItem("cs_step3")
      if (v) {
        const o = JSON.parse(v)
        return o.maxLabel || ""
      }
    } catch {}
    return ""
  })

  const [middleLabel, setMiddleLabel] = useState(() => {
    try {
      const v = localStorage.getItem("cs_step3")
      if (v) {
        const o = JSON.parse(v)
        return o.middleLabel || ""
      }
    } catch {}
    return ""
  })

  // Fixed values - user cannot change these
  const minValue = 1
  const maxValue = 5

  useEffect(() => {}, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem("cs_step3", JSON.stringify({ minValue, maxValue, minLabel, maxLabel, middleLabel }))
    onDataChange?.()
  }, [minLabel, maxLabel, middleLabel, onDataChange])

  const previewValues = useMemo(() => {
    const values: number[] = []
    for (let i = minValue; i <= maxValue; i++) values.push(i)
    return values
  }, [minValue, maxValue])

  const canProceed = minLabel && maxLabel

  const formatLabel = (label: string, fallback: string) => {
    const text = (label || "").trim()
    if (!text) return fallback
    return text
  }

  return (
    <div>
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Rating Scale Configuration</h3>
        <p className="text-sm text-gray-600">
          Configure the rating scale that respondents will use to evaluate elements.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Minimum Label (Value: 1) <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Not at all important"
              value={minLabel}
              onChange={(e) => setMinLabel(e.target.value)}
              maxLength={50}
              className="rounded-lg"
            />
            <p className="mt-2 text-xs text-gray-500">Label for the minimum value (1) - Max 50 characters</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Maximum Label (Value: 5) <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Very important"
              value={maxLabel}
              onChange={(e) => setMaxLabel(e.target.value)}
              maxLength={50}
              className="rounded-lg"
            />
            <p className="mt-2 text-xs text-gray-500">Label for the maximum value (5) - Max 50 characters</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Middle Label (Value: 3) - Optional</label>
            <Input
              placeholder="e.g., Fairly important"
              value={middleLabel}
              onChange={(e) => setMiddleLabel(e.target.value)}
              maxLength={50}
              className="rounded-lg"
            />
            <p className="mt-2 text-xs text-gray-500">Optional label for the middle value (3) - Max 50 characters</p>
          </div>
        </div>

        <div className="border rounded-xl p-5 bg-slate-50">
          <div className="text-sm font-medium text-gray-700 mb-4">Scale Preview</div>
          <div className="flex flex-col items-center gap-4">


            {/* Vertical labels below - 1, 3, 5 in small grey circles */}
            <div className="flex flex-col items-start gap-2 min-w-[200px]">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border border-gray-400 bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ minWidth: '20px', minHeight: '20px' }}>
                  1
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">{formatLabel(minLabel, "Lowest")}</span>
              </div>
              {middleLabel && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-gray-400 bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ minWidth: '20px', minHeight: '20px' }}>
                    3
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">{formatLabel(middleLabel, "")}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border border-gray-400 bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ minWidth: '20px', minHeight: '20px' }}>
                  5
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">{formatLabel(maxLabel, "Highest")}</span>
              </div>
            </div>
            {/* Horizontal scale 1 2 3 4 5 */}


            <div className="flex items-center justify-center gap-4 px-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <div key={v} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-[rgba(38,116,186,1)] text-[rgba(38,116,186,1)] flex items-center justify-center font-medium text-sm sm:text-base">
                  {v}
                </div>
              ))}
            </div>
            
            
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full cursor-pointer px-6 w-full sm:w-auto bg-transparent" onClick={onBack}>
          Back
        </Button>
        <Button
          className="rounded-full cursor-pointer px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto"
          onClick={onNext}
          disabled={!canProceed}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
