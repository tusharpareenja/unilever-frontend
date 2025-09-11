"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { DashboardHeader } from "../components/dashboard-header"
import { AuthGuard } from "@/components/auth/AuthGuard"
import Stepper from "@/components/create-study/Stepper"
import { Step1BasicDetails } from "@/components/create-study/steps/Step1BasicDetails"
import { Step2StudyType } from "@/components/create-study/steps/Step2StudyType"
import { Step3RatingScale } from "@/components/create-study/steps/Step3RatingScale"
import { Step4ClassificationQuestions } from "@/components/create-study/steps/Step4ClassificationQuestions"
import { Step5StudyStructure } from "@/components/create-study/steps/Step5StudyStructure"
import { Step6AudienceSegmentation } from "@/components/create-study/steps/Step6AudienceSegmentation"
import { Step7TaskGeneration } from "@/components/create-study/steps/Step7TaskGeneration"
import { Step8LaunchPreview } from "@/components/create-study/steps/Step8LaunchPreview"

export default function CreateStudyPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [studyType, setStudyType] = useState<"grid" | "layer">("grid")

  // Synchronous restore from backup before children mount
  const didRestoreBackupRef = useRef(false)
  if (typeof window !== 'undefined' && !didRestoreBackupRef.current) {
    try {
      const backupRaw = localStorage.getItem('cs_backup_steps')
      if (backupRaw) {
        const backup = JSON.parse(backupRaw) as Record<string, unknown>
        const stepKeys = ['cs_step1','cs_step2','cs_step3','cs_step4','cs_step5_grid','cs_step5_layer','cs_step6']
        stepKeys.forEach((k) => {
          if (!localStorage.getItem(k) && backup && Object.prototype.hasOwnProperty.call(backup, k)) {
            const v = backup[k]
            if (v != null) {
              try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) } catch {}
            }
          }
        })
      }
    } catch {}
    didRestoreBackupRef.current = true
  }

  // Hydrate study type and last step from localStorage to avoid resets on refresh
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const s2 = localStorage.getItem('cs_step2')
      if (s2) {
        const v = JSON.parse(s2)
        if (v?.type === 'layer' || v?.type === 'grid') setStudyType(v.type)
      }
      const savedStep = localStorage.getItem('cs_current_step')
      if (savedStep) {
        const stepNum = Number(savedStep)
        if (!Number.isNaN(stepNum) && stepNum >= 1 && stepNum <= 8) setCurrentStep(stepNum)
      }
    } catch {}
  }, [])

  // Persist current step for refresh continuity
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem('cs_current_step', String(currentStep)) } catch {}
  }, [currentStep])

  // Periodically snapshot all step keys into a backup to survive accidental clears
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stepKeys = ['cs_step1','cs_step2','cs_step3','cs_step4','cs_step5_grid','cs_step5_layer','cs_step6']
    const writeBackup = () => {
      try {
        const snapshot: Record<string, unknown> = {}
        stepKeys.forEach((k) => {
          const v = localStorage.getItem(k)
          if (v != null) snapshot[k] = v
        })
        localStorage.setItem('cs_backup_steps', JSON.stringify(snapshot))
      } catch {}
    }
    const id = window.setInterval(writeBackup, 2000)
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeBackup() })
    window.addEventListener('beforeunload', writeBackup)
    writeBackup()
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', writeBackup)
    }
  }, [])

  return (
    <AuthGuard requireAuth={true}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen bg-slate-100"
      >
        <DashboardHeader />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(209,223,235,1)]">
            <div className="px-4 sm:px-6 lg:px-8 py-5 border-b border-[rgba(209,223,235,1)]">
              <Stepper currentStep={currentStep} onStepChange={setCurrentStep} />
            </div>

            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <div className={currentStep === 1 ? "block" : "hidden"} aria-hidden={currentStep !== 1}>
                <Step1BasicDetails onNext={() => setCurrentStep(2)} onCancel={() => history.back()} />
              </div>
              <div className={currentStep === 2 ? "block" : "hidden"} aria-hidden={currentStep !== 2}>
                <Step2StudyType
                  value={studyType}
                  onNext={(selected) => { setStudyType(selected); setCurrentStep(3) }}
                  onBack={() => setCurrentStep(1)}
                />
              </div>
              <div className={currentStep === 3 ? "block" : "hidden"} aria-hidden={currentStep !== 3}>
                <Step3RatingScale onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />
              </div>
              <div className={currentStep === 4 ? "block" : "hidden"} aria-hidden={currentStep !== 4}>
                <Step4ClassificationQuestions onNext={() => setCurrentStep(5)} onBack={() => setCurrentStep(3)} />
              </div>
              <div className={currentStep === 5 ? "block" : "hidden"} aria-hidden={currentStep !== 5}>
                <Step5StudyStructure onNext={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} mode={studyType} />
              </div>
              <div className={currentStep === 6 ? "block" : "hidden"} aria-hidden={currentStep !== 6}>
                <Step6AudienceSegmentation onNext={() => setCurrentStep(7)} onBack={() => setCurrentStep(5)} />
              </div>
              <div className={currentStep === 7 ? "block" : "hidden"} aria-hidden={currentStep !== 7}>
                <Step7TaskGeneration active={currentStep === 7} onNext={() => setCurrentStep(8)} onBack={() => setCurrentStep(6)} />
              </div>
              <div className={currentStep === 8 ? "block" : "hidden"} aria-hidden={currentStep !== 8}>
                <Step8LaunchPreview onBack={() => setCurrentStep(7)} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AuthGuard>
  )
}
