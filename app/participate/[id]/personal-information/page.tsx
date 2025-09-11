"use client"

import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

export default function PersonalInformationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [dob, setDob] = useState<Date>()
  const [gender, setGender] = useState<string | null>("male")

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Personal Information</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please provide some basic information about yourself. This helps us understand our study participants better.
        </p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6">
          <div className="text-right text-xs text-gray-500">1 / 4</div>

          <div className="mt-2">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Date of Birth</label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-gray-200 hover:border-gray-300 focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] focus:border-[rgba(38,116,186,0.3)] bg-transparent"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                    {dob ? format(dob, "dd / MM / yyyy") : <span className="text-gray-500">DD / MM / YYYY</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[90vw] max-w-[20rem] sm:w-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={dob}
                    onSelect={setDob}
                    captionLayout="dropdown"
                    fromYear={1900}
                    toYear={new Date().getFullYear()}
                    defaultMonth={dob || new Date()}
                    initialFocus
                    className="rounded-md border p-2 [&_.rdp-caption]:px-2 [&_.rdp-dropdown]:max-w-[46%] [&_.rdp-dropdown]:truncate [&_.rdp-dropdowns]:flex [&_.rdp-dropdowns]:gap-2"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Please enter your birth date. We'll calculate your age automatically.
            </p>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-gray-800 mb-2">Gender</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Toggle value="male" selected={gender} onSelect={setGender} label="Male" />
              <Toggle value="female" selected={gender} onSelect={setGender} label="Female" />
              <Toggle value="other" selected={gender} onSelect={setGender} label="Other" />
              <Toggle value="na" selected={gender} onSelect={setGender} label="Prefer not to say" />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Link href={`/participate/${params?.id}/classification-questions`}>
            <button
              onClick={() => router.push(`/participate/${params?.id}/classification-questions`)}
              className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white text-sm"
            >
              Continue
            </button>
            
            </Link>
            
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  value,
  selected,
  onSelect,
  label,
}: { value: string; selected: string | null; onSelect: (v: string) => void; label: string }) {
  const active = selected === value
  return (
    <button
      onClick={() => onSelect(value)}
      className={`w-full h-11 rounded-md border text-sm transition-colors ${active ? "bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"}`}
    >
      {label}
    </button>
  )
}
