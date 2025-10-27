"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import dayjs from 'dayjs'

export default function PreviewPersonalInformation() {
  const router = useRouter()
  const [dob, setDob] = useState<Date>()
  const [gender, setGender] = useState<string | null>("male")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ageError, setAgeError] = useState<string>("")
  const [formError, setFormError] = useState<string>("")
  const [calendarOpen, setCalendarOpen] = useState(false)

  const handleDateChange = (newValue: any) => {
    if (newValue) {
      // For year-only selection, set to January 1st of the selected year
      const selectedYear = newValue.year()
      const yearDate = new Date(selectedYear, 0, 1) // January 1st of selected year
      setDob(yearDate)
      
      // Auto-close the calendar after year selection
      setTimeout(() => {
        setCalendarOpen(false)
      }, 150)
    }
  }

  const handleCalendarClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    
    // Check if clicked on a year button
    if (target.closest('.MuiPickersYear-yearButton:not(.Mui-disabled)')) {
      // Delay closing to allow the date change to process
      setTimeout(() => {
        setCalendarOpen(false)
      }, 150)
    }
  }

  const handleContinue = async () => {
    if (!dob || !gender || !gender.trim()) {
      setFormError("All fields are required.")
      return
    } else {
      setFormError("")
    }

    // Age validation: must be 13+ (using year-only calculation)
    try {
      const today = new Date()
      const currentYear = today.getFullYear()
      const birthYear = dob.getFullYear()
      const ageYears = currentYear - birthYear
      
      if (ageYears < 13) {
        setAgeError("You must be at least 13 years old to participate.")
        return
      } else {
        setAgeError("")
      }
    } catch {}

    setIsSubmitting(true)
    
    // Simulate API call delay for preview
    setTimeout(() => {
      router.push('/home/create-study/preview/classification-questions')
      setIsSubmitting(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-white">
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Personal Information</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please provide some basic information about yourself. This helps us understand our study participants better.
        </p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6">
          {/* <div className="text-right text-xs text-gray-500">1 / 4</div> */}

          <div className="mt-2">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Year of Birth</label>
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-gray-200 hover:border-gray-300 focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] focus:border-[rgba(38,116,186,0.3)] bg-transparent"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                    {dob ? dob.getFullYear().toString() : <span className="text-gray-500">Select Year</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-4 w-[90vw] max-w-[20rem] sm:w-auto" align="start">
                  <div onClick={handleCalendarClick}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DateCalendar
                        value={dob ? dayjs(dob) : null}
                        onChange={handleDateChange}
                        maxDate={dayjs()}
                        minDate={dayjs('1900-01-01')}
                        views={['year']}
                        sx={{
                          '& .MuiPickersCalendarHeader-root': {
                            paddingLeft: 1,
                            paddingRight: 1,
                            minHeight: '40px',
                          },
                          '& .MuiYearCalendar-root': {
                            fontSize: '0.875rem',
                          },
                          '& .MuiPickersYear-yearButton': {
                            fontSize: '0.875rem',
                            width: '60px',
                            height: '32px',
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(38,116,186,1)',
                              '&:hover': {
                                backgroundColor: 'rgba(38,116,186,0.9)',
                              },
                            },
                          },
                          '& .MuiPickersCalendarHeader-switchViewButton': {
                            fontSize: '0.875rem',
                          },
                          '& .MuiPickersArrowSwitcher-button': {
                            fontSize: '0.875rem',
                          },
                        }}
                      />
                    </LocalizationProvider>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Please select your birth year. We&apos;ll calculate your age automatically.
            </p>
            {ageError && (
              <div className="mt-2 text-xs text-red-600">{ageError}</div>
            )}
            {formError && (
              <div className="mt-2 text-xs text-red-600">{formError}</div>
            )}
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
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </button>
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
