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
import { Search, Plus, User, Check, ChevronDown, X } from "lucide-react"
import { getPanelists, searchPanelists, addPanelist, Panelist } from "@/lib/api/PanelistAPI"
import { cn } from "@/lib/utils"
import { checkIsSpecialCreator } from "@/lib/config/specialCreators"

export default function PreviewPersonalInformation() {
  const router = useRouter()
  const [dob, setDob] = useState<Date>()
  const [gender, setGender] = useState<string | null>("male")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ageError, setAgeError] = useState<string>("")
  const [formError, setFormError] = useState<string>("")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (checkIsSpecialCreator(user?.email)) {
        setIsAdmin(true)
      }
    } catch { }
  }, [])

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
    } catch { }

    setIsSubmitting(true)

    // Simulate API call delay for preview
    setTimeout(() => {
      router.push('/home/create-study/preview/classification-questions')
    }, 500)
  }

  if (isAdmin) {
    return (
      <PanelistSelection
        onComplete={() => router.push('/home/create-study/preview/classification-questions')}
        creatorEmail={(() => {
          try {
            const user = JSON.parse(localStorage.getItem('user') || '{}')
            return user?.email || ""
          } catch { return "" }
        })()}
      />
    )
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

function PanelistSelection({
  onComplete,
  creatorEmail
}: {
  onComplete: () => void;
  creatorEmail: string;
}) {
  const [panelists, setPanelists] = useState<Panelist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPanelist, setSelectedPanelist] = useState<Panelist | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Inline Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualId, setManualId] = useState("")
  const [newAge, setNewAge] = useState("")
  const [newGender, setNewGender] = useState("male")
  const [isAdding, setIsAdding] = useState(false)
  const [newPanelistId, setNewPanelistId] = useState<string | null>(null)
  const [idError, setIdError] = useState<string>("")
  const [copied, setCopied] = useState(false)

  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const primaryBlue = "rgba(38,116,186,1)"

  useEffect(() => {
    fetchInitialPanelists(creatorEmail)
  }, [creatorEmail])

  const fetchInitialPanelists = async (email: string) => {
    setLoading(true)
    try {
      const data = await getPanelists(email, 5)
      setPanelists(data)
    } catch (error) {
      console.error("Failed to fetch panelists:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!query.trim()) {
      fetchInitialPanelists(creatorEmail)
      return
    }

    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await searchPanelists(creatorEmail, query)
        setPanelists(data)
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  const handleAddPanelist = async () => {
    if (!manualId || !newAge) return

    // Validate ID length
    if (manualId.length > 50) {
      setIdError("Panelist ID must be at most 50 characters.")
      return
    }

    // Validate alphanumeric
    if (!/^[a-zA-Z0-9]{1,50}$/.test(manualId)) {
      setIdError("Panelist ID must contain only letters and numbers (1–50 characters).")
      return
    }

    setIdError("")
    setIsAdding(true)
    try {
      // Check if ID already exists
      const existing = await searchPanelists(creatorEmail, manualId)
      if (existing.some(p => p.id.toLowerCase() === manualId.toLowerCase())) {
        setIdError("Panelist ID already exists.")
        setIsAdding(false)
        return
      }

      const result = await addPanelist({
        id: manualId,
        age: parseInt(newAge),
        gender: newGender,
        creator_email: creatorEmail
      })
      setNewPanelistId(result.id)
      // Refresh list after success
      const updated = await getPanelists(creatorEmail, 5)
      setPanelists(updated)
    } catch (error) {
      console.error("Failed to add panelist:", error)
      alert("Failed to add panelist. Please try again.")
    } finally {
      setIsAdding(false)
    }
  }

  const handleCopyId = () => {
    if (newPanelistId) {
      navigator.clipboard.writeText(newPanelistId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const resetForm = () => {
    setManualId("")
    setNewAge("")
    setNewGender("male")
    setNewPanelistId(null)
    setIdError("")
    setShowAddForm(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Select Panelist (Preview)</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Choose a panelist profile to continue with the study preview.
        </p>

        <div className="mt-8 bg-white border rounded-xl shadow-sm p-4 sm:p-6 space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-600" />
              <input
                type="text"
                placeholder="Search by ID..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              )}
            </div>
            {!showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 h-10 w-full sm:w-auto flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryBlue }}
              >
                <Plus className="h-4 w-4" />
                Add Panelist
              </Button>
            )}
          </div>

          {/* Modal Add Form Overlay */}
          {showAddForm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-white/30 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-white p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">New Panelist</h3>
                    <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {!newPanelistId ? (
                    <div className="space-y-5">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 block">Panelist ID (Max 50 characters)</label>
                          <input
                            type="text"
                            value={manualId}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase().slice(0, 50);
                              setManualId(val);
                              if (idError) setIdError("");
                            }}
                            placeholder="PYQ18367"
                            className={cn(
                              "w-full px-5 py-3 bg-gray-50 border rounded-full outline-none focus:ring-4 transition-all text-sm",
                              idError ? "border-red-500 focus:ring-red-500/5" : "border-gray-200 focus:border-blue-600 focus:ring-blue-500/5"
                            )}
                          />
                          {idError && <p className="text-[10px] text-red-500 ml-1 font-medium">{idError}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 block">Age</label>
                            <input
                              type="number"
                              value={newAge}
                              onChange={(e) => setNewAge(e.target.value)}
                              placeholder="25"
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-full outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 block">Gender</label>
                            <div className="relative">
                              <select
                                value={newGender}
                                onChange={(e) => setNewGender(e.target.value)}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-full outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm appearance-none"
                              >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <Button
                          onClick={handleAddPanelist}
                          disabled={isAdding || !manualId || !newAge || manualId.length > 50}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full py-6 h-auto text-sm font-bold shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
                          style={{ backgroundColor: primaryBlue }}
                        >
                          {isAdding ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Registering...
                            </>
                          ) : "Add"}
                        </Button>
                        <button onClick={resetForm} className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors py-2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 animate-in zoom-in-95 duration-500">
                      <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-100">
                        <Check className="h-8 w-8 stroke-[3]" />
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 mb-2">Success!</h3>
                      <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        New panelist registered. <br />Save this ID for reference:
                      </p>

                      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="text-left w-full sm:w-auto">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Panelist ID</div>
                          <div className="text-lg font-mono font-black text-blue-600 tracking-wider break-all">{newPanelistId}</div>
                        </div>
                        <Button
                          onClick={handleCopyId}
                          className={cn(
                            "rounded-full px-4 h-9 text-xs font-bold transition-all shrink-0",
                            copied ? "bg-green-500 text-white" : "bg-white text-gray-900 border border-gray-200 hover:border-blue-600 hover:text-blue-600"
                          )}
                        >
                          {copied ? <Check className="h-4 w-4" /> : "Copy ID"}
                        </Button>
                      </div>

                      <Button
                        onClick={resetForm}
                        className="w-full bg-gray-900 hover:bg-black text-white rounded-full py-4 h-auto text-sm font-bold transition-all"
                      >
                        Done & Close
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Panelist List */}
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-gray-400 text-xs">Fetching panelists...</p>
              </div>
            ) : panelists.length > 0 ? (
              panelists.map((panelist) => (
                <div
                  key={panelist.id}
                  onClick={() => setSelectedPanelist(panelist)}
                  className={cn(
                    "group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4",
                    selectedPanelist?.id === panelist.id
                      ? "bg-blue-50/50 border-blue-600 ring-1 ring-blue-600"
                      : "bg-white border-gray-100 hover:border-blue-300 hover:bg-gray-50"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-all",
                    selectedPanelist?.id === panelist.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
                  )} style={selectedPanelist?.id === panelist.id ? { backgroundColor: primaryBlue } : {}}>
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-bold text-gray-900 truncate text-sm">{panelist.id}</h3>
                      {/* <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">ID: {panelist.id}</span> */}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="capitalize">{panelist.gender}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span>{panelist.age} years</span>
                    </div>
                  </div>
                  {selectedPanelist?.id === panelist.id && (
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: primaryBlue }}>
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <User className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-gray-900 mb-1">No panelists found</h3>
                <p className="text-xs text-gray-400">Try a different search term or add a new record.</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[11px] text-gray-400 font-medium">
              {selectedPanelist ? (
                <span className="text-blue-600 font-bold">Selected ID: {selectedPanelist.id}</span>
              ) : (
                "Select a profile to continue"
              )}
            </p>
            <Button
              onClick={() => {
                setIsSubmitting(true)
                setTimeout(() => {
                  onComplete()
                }, 500)
              }}
              disabled={!selectedPanelist || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 h-11 text-sm font-bold transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-lg shadow-blue-500/10 flex items-center justify-center"
              style={selectedPanelist ? { backgroundColor: primaryBlue } : {}}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Continuing...
                </>
              ) : "Continue Study Preview"}
            </Button>
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
