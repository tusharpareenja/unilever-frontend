"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react'

interface StepperProps {
  currentStep?: number
  className?: string
  onStepChange?: (step: number) => void
}

// Helper function to check if a step is completed based on localStorage data
function isStepCompleted(stepId: number): boolean {
  if (typeof window === 'undefined') return false

  try {
    switch (stepId) {
      case 1: {
        const data = localStorage.getItem('cs_step1')
        if (!data) return false
        const parsed = JSON.parse(data)
        return !!(parsed.title && parsed.description && parsed.language && parsed.agree)
      }
      case 2: {
        const data = localStorage.getItem('cs_step2')
        if (!data) return false
        const parsed = JSON.parse(data)
        return !!(parsed.type && parsed.mainQuestion && parsed.orientationText)
      }
      case 3: {
        const data = localStorage.getItem('cs_step3')
        if (!data) return false
        const parsed = JSON.parse(data)
        // middleLabel is optional, only require minValue, maxValue, minLabel, maxLabel
        return !!(parsed.minValue && parsed.maxValue && parsed.minLabel && parsed.maxLabel)
      }
      case 4: {
        const data = localStorage.getItem('cs_step4')
        if (!data) return false
        try {
          const parsed = JSON.parse(data)
          if (!Array.isArray(parsed) || parsed.length === 0) return false

          return parsed.every((q: any) => {
            // Accept both frontend format (title, options) and backend format (question_text, answer_options)
            const questionText = q.title || q.question_text || ''
            const opts = q.options || q.answer_options || []

            // Check if question has text and at least 2 options with text
            return (
              questionText &&
              questionText.trim().length > 0 &&
              Array.isArray(opts) &&
              opts.length >= 2 &&
              opts.every((o: any) => (o.text || o.option_text) && (o.text || o.option_text).trim().length > 0)
            )
          })
        } catch {
          return false
        }
      }
      case 5: {
        const gridData = localStorage.getItem('cs_step5_grid')
        const textData = localStorage.getItem('cs_step5_text')
        const layerData = localStorage.getItem('cs_step5_layer')
        const step2Data = localStorage.getItem('cs_step2')

        if (!step2Data) return false
        const step2 = JSON.parse(step2Data)

        if (step2.type === 'grid') {
          if (!gridData) return false
          let grid: any
          try {
            grid = JSON.parse(gridData)
          } catch {
            return false
          }

          // Check if it's the new category format or legacy format
          const isCategoryFormat = grid.length > 0 && grid[0] && grid[0].title && grid[0].elements

          if (isCategoryFormat) {
            // New category format: check categories and their elements
            // Accept either secureUrl, previewUrl, or textContent as valid element content
            const hasValidElement = (element: any) => {
              return Boolean(element && (element.secureUrl || element.previewUrl || element.textContent))
            }

            return Array.isArray(grid) &&
              grid.length >= 3 && // Minimum 3 categories
              grid.every((category: any) =>
                category.title &&
                category.title.trim().length > 0 &&
                category.elements &&
                Array.isArray(category.elements) &&
                category.elements.length >= 3 &&
                category.elements.every((element: any) => hasValidElement(element))
              )
          } else {
            // Legacy format
            return Array.isArray(grid) && grid.length >= 3 && grid.every((e: any) => (e && (e.secureUrl || e.previewUrl || e.textContent)))
          }
        } else if (step2.type === 'text') {
          if (!textData) return false
          let text: any
          try {
            text = JSON.parse(textData)
          } catch { return false }

          // Text mode uses the category format
          return Array.isArray(text) &&
            text.length >= 3 &&
            text.every((category: any) =>
              category.title &&
              category.title.trim().length > 0 &&
              category.elements &&
              Array.isArray(category.elements) &&
              category.elements.length >= 3 &&
              category.elements.every((element: any) => element.name && element.name.trim().length > 0)
            )
        } else if (step2.type === 'hybrid') {
          const hybridGridData = localStorage.getItem('cs_step5_hybrid_grid')
          const hybridTextData = localStorage.getItem('cs_step5_hybrid_text')

          if (!hybridGridData || !hybridTextData) return false

          try {
            const grid = JSON.parse(hybridGridData)
            const text = JSON.parse(hybridTextData)

            const isGridValid = Array.isArray(grid) &&
              grid.length >= 3 &&
              grid.every((category: any) =>
                category.title &&
                category.title.trim().length > 0 &&
                category.elements &&
                Array.isArray(category.elements) &&
                category.elements.length >= 3 &&
                category.elements.every((element: any) => element.secureUrl || element.previewUrl)
              )

            const isTextValid = Array.isArray(text) &&
              text.length >= 3 &&
              text.every((category: any) =>
                category.title &&
                category.title.trim().length > 0 &&
                category.elements &&
                Array.isArray(category.elements) &&
                category.elements.length >= 3 &&
                category.elements.every((element: any) => element.name && element.name.trim().length > 0)
              )

            return isGridValid && isTextValid
          } catch {
            return false
          }
        } else {
          if (!layerData) return false
          const layer = JSON.parse(layerData)
          return Array.isArray(layer) && layer.length >= 3 && layer.every((l: any) =>
            l.images && l.images.length >= 3 && l.images.every((img: any) => img.secureUrl)
          )
        }
      }
      case 6: {
        const data = localStorage.getItem('cs_step6')
        if (!data) return false
        const parsed = JSON.parse(data)
        return !!(parsed.respondents && parsed.respondents > 0)
      }
      case 7: {
        // Step 7 is completed when task generation is successful
        const data = localStorage.getItem('cs_step7_tasks')
        return !!data
      }
      case 8: {
        // Step 8 is completed if cs_step8 flag is set
        const data = localStorage.getItem('cs_step8')
        if (!data) return false
        try {
          const parsed = JSON.parse(data)
          return !!parsed.completed
        } catch { return false }
      }
      default:
        return false
    }
  } catch (error) {
    console.error('Error checking step completion:', error)
    return false
  }
}

const steps = [
  { id: 1, label: "Basic Details" },
  { id: 2, label: "Study Type" },
  { id: 3, label: "Rating Scale" },
  { id: 4, label: "Classification Questions" },
  { id: 5, label: "Study Structure" },
  { id: 6, label: "Audience Segmentation" },
  { id: 7, label: "Task Generation" },
  { id: 8, label: "Launch Study" },
]

export default function Stepper({ currentStep = 5, className = "", onStepChange }: StepperProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  // Listen for localStorage changes to update step completion status
  useEffect(() => {
    const handleStorageChange = () => {
      setRefreshKey(prev => prev + 1)
    }

    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom events that might indicate localStorage changes
    window.addEventListener('stepDataChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('stepDataChanged', handleStorageChange)
    }
  }, [])

  // Force re-evaluation of step completion when refreshKey changes
  const isStepCompletedWithRefresh = (stepId: number): boolean => {
    // Use refreshKey to force re-evaluation
    refreshKey // This forces the function to re-run when refreshKey changes
    return isStepCompleted(stepId)
  }

  // Auto-scroll to current step on mobile
  useEffect(() => {
    if (!stepsContainerRef.current) return

    // Small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const container = stepsContainerRef.current
      if (!container) return

      const currentStepElement = container.children[currentStep - 1] as HTMLElement

      if (currentStepElement) {
        const containerRect = container.getBoundingClientRect()
        const stepRect = currentStepElement.getBoundingClientRect()

        // Calculate if the step is visible in the container
        const isVisible = stepRect.left >= containerRect.left && stepRect.right <= containerRect.right

        if (!isVisible) {
          // Scroll to center the current step
          const scrollLeft = currentStepElement.offsetLeft - (container.offsetWidth / 2) + (currentStepElement.offsetWidth / 2)
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
          })
        }
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [currentStep])

  const totalSegments = steps.length - 1
  const isLast = currentStep >= steps.length
  const progressWidth = isLast
    ? `calc(100% - 100px)`
    : `calc(${((currentStep - 1) / totalSegments) * 100}% - 100px + ${100 / totalSegments}%)`
  return (
    <div className={`w-full max-w-6xl mx-auto p-2 ${className}`}>
      <div className="relative">
        {/* Progress line background */}
        <div
          className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 hidden sm:block"
          style={{
            left: "calc(50px)",
            right: "calc(50px)",
          }}
        />

        {/* Progress line filled */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-[rgba(38,116,186,0.9)] hidden sm:block transition-all duration-300"
          style={{
            left: "calc(50px)",
            width: progressWidth,
          }}
        />

        {/* Steps container */}
        <div ref={stepsContainerRef} className="relative flex flex-row justify-between items-start gap-2 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            let isCompleted = isStepCompletedWithRefresh(step.id)
            const isCurrent = step.id === currentStep
            const isUpcoming = step.id > currentStep


            // Determine if step is clickable
            // Step 8 should be clickable when all previous steps (1-7) are completed
            const isClickable = isCompleted || isCurrent || step.id < currentStep

            return (
              <div
                key={step.id}
                className={`flex flex-col items-center text-center flex-shrink-0 min-w-[100px] ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  }`}
                onClick={() => {
                  if (isClickable) {
                    onStepChange?.(step.id)
                  }
                }}
                role="button"
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={!isClickable}
              >
                {/* Step circle */}
                <div
                  className={`
                  relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300
                  ${isCompleted
                      ? "bg-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)] text-white"
                      : isCurrent
                        ? "bg-[rgba(38,116,186,1)] border-[rgba(38,116,186,1)] text-white"
                        : isClickable
                          ? "bg-white border-gray-300 text-gray-500 hover:border-gray-400"
                          : "bg-gray-100 border-gray-200 text-gray-400"
                    }
                `}
                >
                  {step.id}
                </div>

                {/* Step label */}
                <div
                  className={`
                  mt-2 text-xs font-medium px-2 leading-tight transition-all duration-300
                  ${isCurrent
                      ? "text-[rgba(38,116,186,0.9)]"
                      : isCompleted
                        ? "text-gray-700"
                        : isClickable
                          ? "text-gray-500"
                          : "text-gray-400"
                    }
                `}
                >
                  {step.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


