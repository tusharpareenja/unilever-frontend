"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Step1BasicDetailsProps {
  onNext: () => void
  onCancel: () => void
  onDataChange?: () => void
}

export function Step1BasicDetails({ onNext, onCancel, onDataChange }: Step1BasicDetailsProps) {
  const [title, setTitle] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return o.title || "" } } catch {};
    return ""
  })
  const [description, setDescription] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return o.description || "" } } catch {};
    return ""
  })
  const [language, setLanguage] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return o.language || "ENGLISH" } } catch {};
    return "ENGLISH"
  })
  const [agree, setAgree] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return Boolean(o.agree) } } catch {};
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('cs_step1', JSON.stringify({ title, description, language, agree }))
    onDataChange?.()
  }, [title, description, language, agree, onDataChange])

  return (
    <div>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Title <span className="text-red-500">*</span></label>
          <Input
            placeholder="Enter a descriptive title for your study."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg"
          />
          <p className="mt-2 text-xs text-gray-500">Choose a clear, descriptive title (3–200 characters)</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Description <span className="text-red-500">*</span></label>
          <textarea
            placeholder="Describe the background and purpose of your study."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
          />
          <p className="mt-2 text-xs text-gray-500">Provide context about your study (max 2000 characters)</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Language <span className="text-red-500">*</span></label>
          <Input
            value={language}
            readOnly
            className="rounded-lg"
          />

          {/* <p className="mt-2 text-xs text-gray-500">Provide context about your study (max 2000 characters)</p> */}
        </div>

        <div className="flex items-start sm:items-center gap-2">
          <input id="agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4 mt-1 sm:mt-0" />
          <label htmlFor="agree" className="text-sm text-gray-700">
            I Read and Agree to <span className="text-[rgba(38,116,186,1)] cursor-pointer">Terms and Conditions</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onCancel}>Cancel</Button>
        <Button className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto" onClick={onNext} disabled={!title || !description || !agree}>
          Next
        </Button>
      </div>
    </div>
  )
}


