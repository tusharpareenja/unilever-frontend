"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

type Q = { id: string; text: string; options: Array<{ id: string; text: string }>; required: boolean; selected?: string | null }

export default function PreviewClassificationQuestions() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Q[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cs_step4')
      const arr = raw ? JSON.parse(raw) : []
      const mapped: Q[] = Array.isArray(arr) ? arr.map((q: any) => ({ id: q.id, text: q.title, required: q.required !== false, options: (q.options||[]).map((o:any)=>({id:o.id,text:o.text})), selected: null })) : []
      setQuestions(mapped)
    } catch {}
  }, [])

  const canProceed = questions.every(q => !q.required || q.selected)

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900">Classification Questions</h1>
        <p className="mt-2 text-center text-sm text-gray-600">Preview only. Selections are not saved.</p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6">
          <div className="space-y-6">
            {questions.map(q => (
              <div key={q.id}>
                <div className="text-sm font-semibold text-gray-800 mb-2">{q.text}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {q.options.map(opt => (
                    <button key={opt.id} onClick={()=>setQuestions(prev=>prev.map(qq=>qq.id===q.id?{...qq,selected:opt.id}:qq))} className={`w-full h-11 rounded-md border text-sm ${q.selected===opt.id? 'bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]':'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}>{opt.text}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button disabled={!canProceed} onClick={()=>router.push('/home/create-study/preview/orientation-page')} className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white text-sm disabled:bg-gray-300 disabled:cursor-not-allowed">Continue</button>
          </div>
        </div>
      </div>
    </div>
  )
}

