"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/app/home/components/dashboard-header"

type Task = {
  id: string
  leftImageUrl?: string
  rightImageUrl?: string
  leftLabel?: string
  rightLabel?: string
}

export default function TasksPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  // Dummy 4 tasks for now; in real integration, hydrate from backend
  const tasks: Task[] = useMemo(
    () => [
      {
        id: "t1",
        leftImageUrl:
          "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1200&auto=format&fit=crop",
        rightImageUrl:
          "https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=1200&auto=format&fit=crop",
        leftLabel: "1 - A",
        rightLabel: "5 - B",
      },
      {
        id: "t2",
        leftImageUrl:
          "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
        rightImageUrl:
          "https://images.unsplash.com/photo-1481391032119-d89fee407e44?q=80&w=1200&auto=format&fit=crop",
        leftLabel: "2 - A",
        rightLabel: "4 - B",
      },
      {
        id: "t3",
        leftImageUrl:
          "https://images.unsplash.com/photo-1498804103079-a6351b050096?q=80&w=1200&auto=format&fit=crop",
        rightImageUrl:
          "https://images.unsplash.com/photo-1497534446932-c925b458314e?q=80&w=1200&auto=format&fit=crop",
        leftLabel: "1 - C",
        rightLabel: "5 - D",
      },
      {
        id: "t4",
        leftImageUrl:
          "https://images.unsplash.com/photo-1510627498534-cf7e9002facc?q=80&w=1200&auto=format&fit=crop",
        rightImageUrl:
          "https://images.unsplash.com/photo-1490818387583-1baba5e638af?q=80&w=1200&auto=format&fit=crop",
        leftLabel: "2 - C",
        rightLabel: "4 - D",
      },
    ],
    []
  )

  const totalTasks = tasks.length
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [responseTimesSec, setResponseTimesSec] = useState<number[]>([])
  const taskStartRef = useRef<number>(Date.now())
  const [lastSelected, setLastSelected] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Reset timer when task changes
  useEffect(() => {
    taskStartRef.current = Date.now()
    setLastSelected(null)
  }, [currentTaskIndex])

  const handleSelect = (value: number) => {
    // compute time taken in seconds for this task
    const elapsedMs = Date.now() - taskStartRef.current
    const seconds = Math.round(elapsedMs / 1000)
    setResponseTimesSec((prev) => {
      const next = [...prev]
      next[currentTaskIndex] = seconds
      return next
    })
    setLastSelected(value)

    // Store response times in localStorage as "task1", "task2", etc.
    const updatedTimes = [...responseTimesSec]
    updatedTimes[currentTaskIndex] = seconds
    const localStorageData: Record<string, number> = {}
    updatedTimes.forEach((time, index) => {
      localStorageData[`task${index + 1}`] = time
    })
    localStorage.setItem('study_response_times', JSON.stringify(localStorageData))

    // advance to next task (or finish)
    if (currentTaskIndex < totalTasks - 1) {
      setTimeout(() => setCurrentTaskIndex((i) => i + 1), 80)
    } else {
      // All tasks completed, show loading then redirect to thank you
      setIsLoading(true)
      // Simulate backend processing time (2-3 seconds)
      setTimeout(() => {
        router.push(`/participate/${params?.id}/thank-you`)
      }, 2500)
    }
  }

  const progressPct = Math.max(
    2,
    Math.min(100, Math.round(((currentTaskIndex + 1) / totalTasks) * 100))
  )

  const task = tasks[currentTaskIndex]

  const isFinished = currentTaskIndex >= totalTasks - 1 && lastSelected !== null

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16">
        <div className="flex items-center justify-end text-sm text-gray-600 mb-1">
          <span>
            {Math.min(currentTaskIndex + 1, totalTasks)} / {totalTasks}
          </span>
        </div>
        <div className="h-1 rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-[rgba(38,116,186,1)] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-4 bg-white border rounded-xl shadow-sm p-3 sm:p-4">
          {isLoading ? (
            <div className="p-6 sm:p-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(38,116,186,1)] mx-auto mb-4"></div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Processing your responses...</h2>
              <p className="mt-2 text-sm text-gray-600">Please wait while we save your study data.</p>
            </div>
          ) : !isFinished ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-gray-100">
                  {task.leftImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={task.leftImageUrl}
                      alt="left"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-gray-100">
                  {task.rightImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={task.rightImageUrl}
                      alt="right"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-800">
                <div className="text-center">{task.leftLabel ?? ""}</div>
                <div className="text-center">{task.rightLabel ?? ""}</div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const selected = lastSelected === n
                  return (
                    <button
                      key={n}
                      onClick={() => handleSelect(n)}
                      className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full border transition-colors ${
                        selected
                          ? "border-[rgba(38,116,186,1)] text-[rgba(38,116,186,1)] bg-white"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-10 text-center">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">All tasks completed</h2>
              <p className="mt-2 text-sm text-gray-600">Response times (s): {responseTimesSec.join(", ")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


