"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { updateStudyAsync, putUpdateStudyAsync } from "@/lib/api/StudyAPI"

interface Option {
	id: string
	text: string
}

interface QuestionCard {
	id: string
	title: string
	required: boolean
	options: Option[]
}

interface Step4ClassificationQuestionsProps {
	onNext: () => void
	onBack: () => void
	onDataChange?: () => void
}

export function Step4ClassificationQuestions({ onNext, onBack, onDataChange }: Step4ClassificationQuestionsProps) {
	const [questions, setQuestions] = useState<QuestionCard[]>(() => {
		try {
			const raw = localStorage.getItem('cs_step4')
			if (raw) {
				const data = JSON.parse(raw) as QuestionCard[]
				if (Array.isArray(data) && data.length > 0) {
					return data.map((q) => ({
						id: q.id || crypto.randomUUID(),
						title: q.title || "",
						required: typeof q.required === 'boolean' ? q.required : true,
						options: Array.isArray(q.options) && q.options.length > 0 ? q.options.map(o => ({ id: o.id || crypto.randomUUID(), text: o.text || "" })) : [
							{ id: crypto.randomUUID(), text: "" },
							{ id: crypto.randomUUID(), text: "" },
						],
					}))
				}
			}
		} catch {}
		return [{ id: crypto.randomUUID(), title: "", required: true, options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }] }]
	})

	// Hydrate marker (kept for compatibility)
	const hasHydratedRef = useRef(true)

	// Persist on change
	useEffect(() => {
		if (typeof window === 'undefined') return
		localStorage.setItem('cs_step4', JSON.stringify(questions))
		onDataChange?.()
	}, [questions, onDataChange])

	const addQuestion = () => {
		setQuestions((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				title: "",
				required: true,
				options: [
					{ id: crypto.randomUUID(), text: "" },
					{ id: crypto.randomUUID(), text: "" },
				],
			},
		])
	}

	const removeQuestion = (qid: string) => {
		setQuestions((prev) => {
			if (prev.length <= 1) return prev
			return prev.filter(q => q.id !== qid)
		})
	}

	const removeOption = (qid: string, oid: string) => {
		setQuestions((prev) => prev.map(q => {
			if (q.id === qid) {
				// Don't allow removing if there are only 2 options left
				if (q.options.length <= 2) return q
				return { ...q, options: q.options.filter(o => o.id !== oid) }
			}
			return q
		}))
	}

	const addOption = (qid: string) => {
		setQuestions((prev) => prev.map(q => q.id === qid ? { ...q, options: [...q.options, { id: crypto.randomUUID(), text: "" }] } : q))
	}

	const updateQuestionTitle = (qid: string, title: string) => {
		setQuestions((prev) => prev.map(q => q.id === qid ? { ...q, title } : q))
	}

	const updateOptionText = (qid: string, oid: string, text: string) => {
		setQuestions((prev) => prev.map(q => q.id === qid ? { ...q, options: q.options.map(o => o.id === oid ? { ...o, text } : o) } : q))
	}

	const toggleRequired = (qid: string) => {
		setQuestions((prev) => prev.map(q => q.id === qid ? { ...q, required: !q.required } : q))
	}

	const canProceed = questions.every(q => 
		q.title.trim().length > 0 && 
		q.options.length >= 2 && 
		q.options.every(o => o.text.trim().length > 0)
	)

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-lg font-semibold text-gray-800">Classification Questions</h3>
					<p className="text-sm text-gray-600">Add demographic and classification questions to segment your respondents. These questions will be asked before the main study tasks.</p>
					<p className="text-sm text-gray-600 mt-1">Age and Gender will be asked by default (no need to put them here).</p>
				</div>
				<Button className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)]" onClick={addQuestion}>+ Add Question</Button>
			</div>

			<div className="space-y-6">
				{questions.map((q, idx) => (
					<div key={q.id} className="border rounded-xl bg-white">
						<div className="p-5">
							<div className="flex items-center justify-between gap-3 mb-2">
								<div className="text-xs font-semibold text-gray-600">Question {idx + 1}</div>
								<Button
									variant="outline"
									onClick={() => removeQuestion(q.id)}
									disabled={questions.length === 1}
									className="px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Remove Question
								</Button>
							</div>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
								placeholder="e.g., Do you like deo?"
								value={q.title}
								onChange={(e) => updateQuestionTitle(q.id, e.target.value)}
							/>

							{/* <div className="mt-4">
								<div className="text-sm font-semibold text-gray-800 mb-1">Required <span className="text-red-500">*</span></div>
								<label className="inline-flex items-center gap-2 text-sm text-gray-600">
									<input type="checkbox" checked={q.required} onChange={() => toggleRequired(q.id)} />
									The minimum value on your rating scale
								</label>
							</div> */}

							<div className="mt-4">
								<div className="text-sm font-semibold text-gray-800 mb-2">Answer Options <span className="text-red-500">*</span></div>
								<div className="text-xs text-gray-500 mb-3">Minimum 2 options required</div>
								<div className="space-y-3">
									{q.options.map((o) => (
										<div key={o.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
											<input
												className="flex-1 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
												placeholder="e.g., Moderately important"
												value={o.text}
												onChange={(e) => updateOptionText(q.id, o.id, e.target.value)}
											/>
											<Button 
												variant="outline" 
												onClick={() => removeOption(q.id, o.id)} 
												disabled={q.options.length <= 2}
												className="sm:w-auto w-full disabled:opacity-50 disabled:cursor-not-allowed"
											>
												Remove
											</Button>
										</div>
									))}
								</div>
								<div className="mt-4">
									<Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => addOption(q.id)}>+ Add Options</Button>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Add Question button at the bottom */}
			<div className="flex justify-center mt-6">
				<Button 
					className="bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] rounded-full px-6"
					onClick={addQuestion}
				>
					+ Add Question
				</Button>
			</div>

			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
				<Button variant="outline" className="rounded-full cursor-pointer px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
				<Button
					className="rounded-full cursor-pointer px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)]"
					onClick={() => {
								if (canProceed) {
									const studyIdRaw = localStorage.getItem('cs_study_id')
									if (studyIdRaw) {
										// parse study id if stringified
										let studyId = studyIdRaw
										try {
											const parsed = JSON.parse(studyIdRaw)
											if (typeof parsed === 'string') studyId = parsed
										} catch {}

										// Build classification_questions payload from current state
										const classification_questions = questions
											.filter(q => q.title && q.title.trim().length > 0)
											.map((q, idx) => ({
												question_id: String(q.id || `Q${idx + 1}`).substring(0, 10),
												question_text: q.title || "",
												question_type: "multiple_choice",
												is_required: q.required !== false,
												order: idx + 1,
												answer_options: (q.options || [])
													.filter(o => o.text && o.text.trim().length > 0)
													.map((o, optIdx) => ({ id: String(o.id || String.fromCharCode(65 + optIdx)).substring(0, 10), text: o.text || "", order: optIdx + 1 }))
											}))

										// Include study_type and step metadata to help server
										let studyType = 'grid'
										try {
											const s2raw = localStorage.getItem('cs_step2')
											if (s2raw) studyType = JSON.parse(s2raw).type || 'grid'
										} catch {}

										const payload: any = {
											last_step: 4,
											study_type: studyType,
											classification_questions: classification_questions.length > 0 ? classification_questions : undefined,
										}

										// Fire background PUT update that includes classification_questions
										putUpdateStudyAsync(studyId, payload, 4)
									}
									onNext()
								}
					}}
					disabled={!canProceed}
				>
					Save & Next
				</Button>
			</div>
		</div>
	)
}


