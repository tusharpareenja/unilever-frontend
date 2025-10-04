"use client"

import { useParams, useRouter } from "next/navigation"
// import { DashboardHeader } from "@/app/home/components/dashboard-header"
import { useState, useEffect, useRef } from "react"
import { imagePreloader, preloadTaskImages } from "@/lib/utils/imagePreloader"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
// import Link from "next/link"
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import dayjs from 'dayjs'
import { updateUserPersonalInfo } from "@/lib/api/ResponseAPI"

export default function PersonalInformationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  // Guard: ensure session exists before allowing input
  const [sessionReady, setSessionReady] = useState<boolean>(false)
  const [guardChecked, setGuardChecked] = useState<boolean>(false)
  const preloadedUrlsRef = useRef<Set<string>>(new Set())
  const preloaderRunningRef = useRef(false)
  const nextTaskToPreloadRef = useRef<number>(1)

  const getUrlsForTask = (task: any, studyType: string): string[] => {
    if (!task) return []
    const urls = new Set<string>()
    if (studyType === 'layer') {
      const shown = task?.elements_shown || {}
      const content = task?.elements_shown_content || {}
      Object.keys(shown).forEach((k) => {
        if (Number(shown[k]) === 1) {
          const c = content?.[k]
          if (c && typeof c === 'object' && typeof c.url === 'string') urls.add(String(c.url))
          const s2: any = content?.[`${k}_content`]
          if (s2 && typeof s2 === 'object' && typeof s2.url === 'string') urls.add(String(s2.url))
          if (typeof s2 === 'string') urls.add(String(s2))
        }
      })
    } else {
      const es = task?.elements_shown || {}
      const content = task?.elements_shown_content || {}
      const activeKeys = Object.keys(es).filter((k) => Number(es[k]) === 1)
      const getUrlForKey = (k: string): string | undefined => {
        const directUrl = (es as any)[`${k}_content`]
        if (typeof directUrl === 'string' && directUrl) return directUrl
        const c1: any = (content as any)[k]
        if (c1 && typeof c1 === 'object' && typeof c1.url === 'string') return c1.url
        const c2: any = (content as any)[`${k}_content`]
        if (c2 && typeof c2 === 'object' && typeof c2.url === 'string') return c2.url
        if (typeof c2 === 'string') return c2
        const s2: any = (content as any)[k]
        if (typeof s2 === 'string') return s2
        return undefined
      }
      activeKeys.forEach((k) => { const u = getUrlForKey(k); if (u) urls.add(u) })
      if (urls.size === 0 && content && typeof content === 'object') {
        Object.values(content).forEach((v: any) => {
          if (v && typeof v === 'object' && typeof v.url === 'string') urls.add(v.url)
          if (typeof v === 'string') urls.add(v)
        })
      }
    }
    return Array.from(urls)
  }

  const loadImage = (src: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const img = new Image()
        ;(img as any).decoding = 'async'
        ;(img as any).referrerPolicy = 'no-referrer'
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = src
      } catch { resolve() }
    })
  }

  const startSequentialPreload = (tasksList: any[], studyType: string) => {
    if (preloaderRunningRef.current) return
    preloaderRunningRef.current = true
    const step = async () => {
      if (nextTaskToPreloadRef.current >= tasksList.length) {
        preloaderRunningRef.current = false
        return
      }
      const idx = nextTaskToPreloadRef.current
      const urls = getUrlsForTask(tasksList[idx], studyType)
      const toLoad = urls.filter(u => !preloadedUrlsRef.current.has(u))
      if (toLoad.length > 0) {
        Promise.all(toLoad.map(loadImage)).then(() => {
          toLoad.forEach(u => preloadedUrlsRef.current.add(u))
        }).catch(() => {
          // best-effort preload
        })
      }
      nextTaskToPreloadRef.current = idx + 1
      setTimeout(step, 0)
    }
    setTimeout(step, 0)
  }

  useEffect(() => {
    try {
      const s = localStorage.getItem('study_session')
      if (s) {
        const { sessionId } = JSON.parse(s)
        if (sessionId) setSessionReady(true)
      }
    } catch {}
    setGuardChecked(true)
  }, [])

  useEffect(() => {
    try {
      const detailsRaw = localStorage.getItem('current_study_details')
      const sessionRaw = localStorage.getItem('study_session')
      if (!detailsRaw) return
      const study = JSON.parse(detailsRaw || '{}')
      const { respondentId } = sessionRaw ? JSON.parse(sessionRaw) : { respondentId: 0 }

      const studyInfo = study?.study_info || study
      const assignedTasks = study?.assigned_tasks || []

      let userTasks: any[] = []
      if (Array.isArray(assignedTasks) && assignedTasks.length > 0) {
        userTasks = assignedTasks
      } else {
        const tasksObj = study?.tasks || study?.data?.tasks || study?.task_map || study?.task || {}
        const respondentKey = String(respondentId ?? 0)
        let respondentTasks: any[] = tasksObj?.[respondentKey] || tasksObj?.[Number(respondentKey)] || []
        if (!Array.isArray(respondentTasks) || respondentTasks.length === 0) {
          if (Array.isArray(tasksObj)) {
            respondentTasks = tasksObj
          } else if (tasksObj && typeof tasksObj === 'object') {
            for (const [k, v] of Object.entries(tasksObj)) {
              if (Array.isArray(v) && v.length) { respondentTasks = v as any[]; break }
            }
          }
        }
        userTasks = respondentTasks
      }

      const type = (studyInfo?.study_type || study?.study_type || '').toString()

      // Preload first 10 tasks aggressively (more than before)
      const allUrls: string[] = []

      // Extract ALL image URLs from first 10 tasks
      const tasksToPreload = userTasks.slice(0, 10)
      tasksToPreload.forEach(task => {
        if (task.layeredImages) {
          task.layeredImages.forEach((img: any) => {
            if (img.url) allUrls.push(img.url)
          })
        }
        if (task.gridUrls) {
          allUrls.push(...task.gridUrls.filter(Boolean))
        }
        if (task.leftImageUrl) allUrls.push(task.leftImageUrl)
        if (task.rightImageUrl) allUrls.push(task.rightImageUrl)
      })

      // Remove duplicates and preload ALL images in parallel
      const uniqueUrls = [...new Set(allUrls)]
      console.log(`Preloading ${uniqueUrls.length} images for first 10 tasks`)

      // Preload all URLs immediately in parallel
      uniqueUrls.forEach(url => {
        const img = document.createElement('img') as HTMLImageElement
        img.decoding = 'async'
        img.referrerPolicy = 'no-referrer-when-downgrade'
        img.src = url
      })

      console.log('Personal information page preloading completed')
    } catch (e) {
      // best-effort preload
    }
  }, [])

  const [dob, setDob] = useState<Date>()
  const [gender, setGender] = useState<string | null>("male")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ageError, setAgeError] = useState<string>("")
  const [formError, setFormError] = useState<string>("")
  const [calendarOpen, setCalendarOpen] = useState(false) // Add state to control calendar open/close

  const handleDateChange = (newValue: any) => {
    if (newValue) {
      setDob(newValue.toDate())
    }
  }

  const handleCalendarClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    
    // Check if clicked on a day button
    if (target.closest('.MuiPickersDay-root:not(.Mui-disabled)')) {
      // Delay closing to allow the date change to process
      setTimeout(() => {
        setCalendarOpen(false)
      }, 150)
    }
  }

  const handleContinue = async () => {
    if (!sessionReady) {
      alert('Study is still starting. Please wait a moment and try again.')
      return
    }
    if (!dob || !gender || !gender.trim()) {
      setFormError("All fields are required.")
      return
    } else {
      setFormError("")
    }

    // Age validation: must be 13+
    try {
      const today = new Date()
      const ageYears = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
      if (ageYears < 13) {
        setAgeError("You must be at least 13 years old to participate.")
        return
      } else {
        setAgeError("")
      }
    } catch {}

    setIsSubmitting(true)
    
    try {
      // Get session data from localStorage
      const sessionData = localStorage.getItem('study_session')
      // console.log('Session data from localStorage:', sessionData)
      if (!sessionData) {
        throw new Error('Session data not found')
      }
      
      const { sessionId } = JSON.parse(sessionData)
      // console.log('Session ID:', sessionId)
      
      // Check if study details are available
      const studyDetails = localStorage.getItem('current_study_details')
      // console.log('Study details from localStorage:', studyDetails)
      
      // Prepare personal info payload
      const personalInfo = {
        user_details: {
          date_of_birth: dob.toISOString().split('T')[0], // Format as YYYY-MM-DD
          gender: gender
        }
      }
      
      // Store in localStorage for later use
      localStorage.setItem('personal_info', JSON.stringify(personalInfo))
      
      // Update user personal info via API
      updateUserPersonalInfo(sessionId, personalInfo).catch((error) => {
        console.error('Failed to update personal info:', error)
      })
      
      // Navigate to next page
      router.push(`/participate/${params?.id}/classification-questions`)
    } catch (error) {
      console.error('Failed to update personal info:', error)
      alert('Failed to save personal information. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!guardChecked) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(38,116,186,1)]"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    if (typeof window !== 'undefined' && params?.id) {
      // redirect back to intro to restart flow
      router.replace(`/participate/${params.id}`)
    }
    return null
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
            <label className="block text-sm font-semibold text-gray-800 mb-2">Date of Birth</label>
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
                  <div onClick={handleCalendarClick}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DateCalendar
                        value={dob ? dayjs(dob) : null}
                        onChange={handleDateChange}
                        maxDate={dayjs()}
                        minDate={dayjs('1900-01-01')}
                        sx={{
                          '& .MuiPickersCalendarHeader-root': {
                            paddingLeft: 1,
                            paddingRight: 1,
                            minHeight: '40px',
                          },
                          '& .MuiDayCalendar-root': {
                            fontSize: '0.875rem',
                          },
                          '& .MuiPickersDay-root': {
                            fontSize: '0.875rem',
                            width: '32px',
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
              Please enter your birth date. We&apos;ll calculate your age automatically.
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