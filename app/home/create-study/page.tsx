"use client"

import { useState } from "react"
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
              {currentStep === 1 && (
                <Step1BasicDetails onNext={() => setCurrentStep(2)} onCancel={() => history.back()} />
              )}
              {currentStep === 2 && (
                <Step2StudyType
                  value={studyType}
                  onNext={(selected) => { setStudyType(selected); setCurrentStep(3) }}
                  onBack={() => setCurrentStep(1)}
                />
              )}
              {currentStep === 3 && (
                <Step3RatingScale onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />
              )}
              {currentStep === 4 && (
                <Step4ClassificationQuestions onNext={() => setCurrentStep(5)} onBack={() => setCurrentStep(3)} />
              )}
              {currentStep === 5 && (
                <Step5StudyStructure onNext={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} mode={studyType} />
              )}
              {currentStep === 6 && (
                <Step6AudienceSegmentation onNext={() => setCurrentStep(7)} onBack={() => setCurrentStep(5)} />
              )}
              {currentStep === 7 && (
                <Step7TaskGeneration onNext={() => setCurrentStep(8)} onBack={() => setCurrentStep(6)} />
              )}
              {currentStep === 8 && (
                <Step8LaunchPreview onBack={() => setCurrentStep(7)} />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AuthGuard>
  )
}
