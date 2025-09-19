"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
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
  const [dob, setDob] = useState<Date | null>(null)
  const [gender, setGender] = useState<string>("male")
  const [error, setError] = useState<string>("")

  const handleContinue = () => {
    if (!dob || !gender) { setError('All fields are required'); return }
    setError("")
    router.push('/home/create-study/preview/classification-questions')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900">Personal Information</h1>
        <p className="mt-2 text-center text-sm text-gray-600">Preview only. Nothing is being saved.</p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6">
          <div>
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
                <PopoverContent className="p-4 w-[90vw] max-w-[20rem] sm:w-auto" align="start">
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateCalendar
                      value={dob ? dayjs(dob) : null}
                      onChange={(newValue: any) => { if (newValue) setDob(newValue.toDate()) }}
                      maxDate={dayjs()}
                      minDate={dayjs('1900-01-01')}
                      sx={{
                        '& .MuiPickersCalendarHeader-root': { paddingLeft: 1, paddingRight: 1, minHeight: '40px' },
                        '& .MuiDayCalendar-root': { fontSize: '0.875rem' },
                        '& .MuiPickersDay-root': { fontSize: '0.875rem', width: '32px', height: '32px', '&.Mui-selected': { backgroundColor: 'rgba(38,116,186,1)', '&:hover': { backgroundColor: 'rgba(38,116,186,0.9)' } } },
                        '& .MuiPickersCalendarHeader-switchViewButton': { fontSize: '0.875rem' },
                        '& .MuiPickersArrowSwitcher-button': { fontSize: '0.875rem' },
                      }}
                    />
                  </LocalizationProvider>
                </PopoverContent>
              </Popover>
            </div>
            <p className="mt-2 text-xs text-gray-500">Please enter your birth date.</p>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold text-gray-800 mb-2">Gender</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Male','Female','Other','Prefer not to say'].map(g => (
                <button key={g} onClick={()=>setGender(g)} className={`w-full h-11 rounded-md border text-sm ${gender===g? 'bg-[rgba(38,116,186,1)] text-white border-[rgba(38,116,186,1)]':'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}>{g}</button>
              ))}
            </div>
          </div>
          {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
          <div className="mt-8 flex justify-end">
            <button onClick={handleContinue} className="px-5 py-2 rounded-md bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] text-white text-sm">Continue</button>
          </div>
        </div>
      </div>
    </div>
  )
}
