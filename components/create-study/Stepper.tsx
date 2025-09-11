interface StepperProps {
  currentStep?: number
  className?: string
  onStepChange?: (step: number) => void
}

const steps = [
  { id: 1, label: "Basic Details" },
  { id: 2, label: "Study Type" },
  { id: 3, label: "Rating Scale" },
  { id: 4, label: "Classification Questions" },
  { id: 5, label: "Layer Configuration" },
  { id: 6, label: "Audience Segmentation" },
  { id: 7, label: "Task Generation" },
  { id: 8, label: "Launch Study" },
]

export default function Stepper({ currentStep = 5, className = "", onStepChange }: StepperProps) {
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
        <div className="relative flex flex-row justify-between items-start gap-2 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep
            const isCurrent = step.id === currentStep
            const isUpcoming = step.id > currentStep

            return (
              <div
                key={step.id}
                className="flex flex-col items-center text-center flex-shrink-0 min-w-[100px] cursor-pointer"
                onClick={() => onStepChange?.(step.id)}
                role="button"
                aria-current={isCurrent ? "step" : undefined}
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
                        : "bg-white border-gray-300 text-gray-500"
                  }
                `}
                >
                  {step.id}
                </div>

                {/* Step label */}
                <div
                  className={`
                  mt-3 text-xs font-medium px-2 leading-tight transition-all duration-300
                  ${isCurrent ? "text-[rgba(38,116,186,0.9)]" : isCompleted ? "text-gray-700" : "text-gray-500"}
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


