// No authentication required for study participation

const BASE_URL = "http://127.0.0.1:8000/api/v1"

// Import fetchWithAuth from StudyAPI for authenticated requests
import { fetchWithAuth } from './StudyAPI'

export interface StudyInfo {
	id: string
	title: string
	study_type: "grid" | "layer"
	main_question: string
	orientation_text: string
	rating_scale: {
		max_label: string
		max_value: number
		min_label: string
		min_value: number
		middle_label: string
	}
}

export interface StartStudyResponse {
	session_id: string
	respondent_id: number
	total_tasks_assigned: number
	study_info: StudyInfo
}

export interface TaskResponse {
	task_id: string
	rating: number
	response_time_seconds: number
}

export interface SubmitResponsePayload {
	session_id: string
	respondent_id: number
	study_id: string
	responses: TaskResponse[]
	personal_info?: {
		date_of_birth?: string
		gender?: string
	}
	classification_answers?: Record<string, string>
}

export interface SubmitResponseResult {
	success: boolean
	response_id: string
	message: string
}

export interface PersonalInfoPayload {
	user_details: {
		date_of_birth?: string
		gender?: string
	}
}

export interface ClassificationAnswerItem {
	question_id: string
	question_text: string
	answer: string
	answer_timestamp: string // ISO string
	time_spent_seconds: number
}

export interface SubmitClassificationAnswersPayload {
	answers: ClassificationAnswerItem[]
}

export interface SubmitTaskPayload {
	task_id: string
	rating_given: number
	task_duration_seconds: number
	element_interactions: Array<{
		element_id: string
		view_time_seconds: number
		hover_count: number
		click_count: number
		first_view_time: string
		last_view_time: string
	}>
}

export interface TaskSessionPayload {
	session_id: string
	task_id: string
	classification_page_time: number
	orientation_page_time: number
	individual_task_page_times: number[]
	page_transitions?: Array<Record<string, any>>
	is_completed: boolean
	abandonment_timestamp?: string | null
	abandonment_reason?: string | null
	recovery_attempts?: number
	browser_performance?: Record<string, any>
	page_load_times?: number[]
	device_info?: Record<string, any>
	screen_resolution?: string
}

/**
 * Start a study session for a participant
 * @param studyId - The study ID from URL params
 * @returns Promise with session details and study info
 */
export async function startStudy(studyId: string): Promise<StartStudyResponse> {
	const payload = {
		study_id: studyId,
		personal_info: {}
	}

	const response = await fetch(`${BASE_URL}/responses/start-study`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to start study: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	console.log('Study started:', data)
	return data
}

/**
 * Submit study responses
 * @param payload - Response data including session info and task responses
 * @returns Promise with submission result
 */
export async function submitStudyResponses(payload: SubmitResponsePayload): Promise<SubmitResponseResult> {
	const response = await fetch('http://127.0.0.1:8000/api/v1/studies/responses', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to submit responses: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	console.log('Responses submitted:', data)
	return data
}

/**
 * Update user personal information for a study session
 * @param sessionId - The session ID
 * @param personalInfo - Personal information data (DOB, gender)
 * @returns Promise with update result
 */
export async function updateUserPersonalInfo(sessionId: string, personalInfo: PersonalInfoPayload): Promise<any> {
	const response = await fetch(`${BASE_URL}/responses/session/${sessionId}/user-details`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(personalInfo),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to update personal info: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	console.log('Personal info updated:', data)
	return data
}

/** Submit classification answers (per-click or batched) with session_id in query */
export async function submitClassificationAnswers(sessionId: string, payload: SubmitClassificationAnswersPayload): Promise<any> {
	const q = encodeURIComponent(sessionId)
	const response = await fetch(`${BASE_URL}/responses/submit-classification?session_id=${q}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to submit classification: ${response.status} ${JSON.stringify(errorData)}`)
	}
	return response.json().catch(() => ({}))
}

/** Submit a single task response with interactions */
export async function submitTaskResponse(sessionId: string, payload: SubmitTaskPayload): Promise<any> {
	const q = encodeURIComponent(sessionId)
	const res = await fetch(`${BASE_URL}/responses/submit-task?session_id=${q}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}))
		throw new Error(`Failed to submit task: ${res.status} ${JSON.stringify(errorData)}`)
	}
	return res.json().catch(() => ({}))
}

/** Submit task session analytics */
export async function submitTaskSession(payload: TaskSessionPayload): Promise<any> {
	const res = await fetch(`${BASE_URL}/responses/task-sessions/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}))
		throw new Error(`Failed to submit task session: ${res.status} ${JSON.stringify(errorData)}`)
	}
	return res.json().catch(() => ({}))
}

/**
 * Get study tasks for a session
 * @param sessionId - The session ID from startStudy
 * @returns Promise with task data
 */
export async function getStudyTasks(sessionId: string): Promise<any> {
	const response = await fetch(`http://127.0.0.1:8000/api/v1/studies/sessions/${sessionId}/tasks`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to get tasks: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	console.log('Study tasks:', data)
	return data
}

// Analytics response interface
export interface StudyAnalytics {
	total_responses: number
	completed_responses: number
	abandoned_responses: number
	completion_rate: number
	average_duration: number
	abandonment_rate: number
	element_heatmap: Record<string, any>
	timing_distributions: Record<string, any>
}

/**
 * Get study analytics data
 * @param studyId - The study ID
 * @returns Promise with analytics data
 */
export async function getStudyAnalytics(studyId: string): Promise<StudyAnalytics> {
	const response = await fetchWithAuth(`${BASE_URL}/responses/analytics/study/${studyId}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to get study analytics: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	return data
}
