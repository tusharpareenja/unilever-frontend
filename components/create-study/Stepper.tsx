"use client"

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
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) && parsed.length > 0 && parsed.every((q: any) => 
          q.title && q.options && q.options.length >= 2 && q.options.every((o: any) => o.text)
        )
      }
      case 5: {
        const gridData = localStorage.getItem('cs_step5_grid')
        const layerData = localStorage.getItem('cs_step5_layer')
        const step2Data = localStorage.getItem('cs_step2')
        
        if (!step2Data) return false
        const step2 = JSON.parse(step2Data)
        
        if (step2.type === 'grid') {
          if (!gridData) return false
          const grid = JSON.parse(gridData)
          
          // Check if it's the new category format or legacy format
          const isCategoryFormat = grid.length > 0 && grid[0].title && grid[0].elements
          
          if (isCategoryFormat) {
            // New category format: check categories and their elements
            return Array.isArray(grid) && 
                   grid.length >= 3 && // Minimum 3 categories
                   grid.every((category: any) => 
                     category.title && 
                     category.title.trim().length > 0 && 
                     category.elements && 
                     Array.isArray(category.elements) &&
                     category.elements.length > 0 &&
                     category.elements.every((element: any) => element.secureUrl)
                   )
          } else {
            // Legacy format: check direct elements
            return Array.isArray(grid) && grid.length > 0 && grid.every((e: any) => e.secureUrl)
          }
        } else {
          if (!layerData) return false
          const layer = JSON.parse(layerData)
          return Array.isArray(layer) && layer.length > 0 && layer.every((l: any) => 
            l.images && l.images.length > 0 && l.images.every((img: any) => img.secureUrl)
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
        // Step 8 is only completed when the user reaches it
        // We don't need to check for specific data since it's the final step
        // It should only be blue when it's the current step or when study is actually launched
        return false
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
    <div className={`w-full max-w-6xl mx-auto p-4 ${className}`}>
      <div className="relative">
        {/* Progress line background */}
        <div
          className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 hidden sm:block"
          style={{
            left: "calc(50px)",
            right: "calc(50px)",
          }}
        />

        {/* Progress line filled */}
        <div
          className="absolute top-6 left-0 h-0.5 bg-[rgba(38,116,186,0.9)] hidden sm:block transition-all duration-300"
          style={{
            left: "calc(50px)",
            width: progressWidth,
          }}
        />

        {/* Steps container */}
        <div ref={stepsContainerRef} className="relative flex flex-row justify-between items-start gap-2 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isCompleted = isStepCompletedWithRefresh(step.id)
            const isCurrent = step.id === currentStep
            const isUpcoming = step.id > currentStep

            // Determine if step is clickable
            const isClickable = isCompleted || isCurrent || step.id < currentStep
            
            return (
              <div
                key={step.id}
                className={`flex flex-col items-center text-center flex-shrink-0 min-w-[100px] ${
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
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
                  relative z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300
                  ${
                    isCompleted
                      ? "bg-[rgba(38,116,186,0.9)] border-[rgba(38,116,186,0.9)] text-white"
                      : isCurrent
                        ? "bg-[rgba(38,116,186,0.9)] border-[rgba(38,116,186,0.9)] text-white"
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
                  mt-3 text-xs font-medium px-2 leading-tight transition-all duration-300
                  ${
                    isCurrent 
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


